/**
 * Persistencia transaccional de extracciones de skills (Fase 2).
 *
 * No llama a Gemini ni descarga Drive. Solo escribe tablas organigrama.cv_*.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import type {
  ExtractedCvSkills,
  ExtractedSkill,
  SkillEvidenceItem,
  SkillType,
} from './cv-skills.types';
import { mergeEvidenceItems } from './cv-skills.evidence';
import {
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from './cv-skills.constants';
import { CvExtraction } from './entities/cv-extraction.entity';
import { CvExtractionCertification } from './entities/cv-extraction-certification.entity';
import { CvExtractionLanguage } from './entities/cv-extraction-language.entity';
import { CvExtractionSkill } from './entities/cv-extraction-skill.entity';
import { CvSkill } from './entities/cv-skill.entity';
import { CvSkillAlias } from './entities/cv-skill-alias.entity';
import {
  CompleteExtractionMetadata,
  CreateRunningExtractionInput,
  CvSkillsAliasConflictError,
  CvSkillsPersistenceError,
  FailExtractionInput,
  PersistCvSkillsInput,
  PersistSucceededResult,
  RegisterCvExtractionFailureInput,
} from './cv-skills-persistence.types';

const ERROR_MESSAGE_MAX = 2000;

/** Clave canónica alineada al comentario SQL: lower, sin acentos, espacios→_. */
export function toCanonicalKey(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export function sanitizePersistenceErrorMessage(raw: unknown): string {
  let message = raw instanceof Error ? raw.message : String(raw ?? '');
  message = message
    .replace(/AIza[0-9A-Za-z_-]+/g, '[REDACTED]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /postgres(ql)?:\/\/[^\s]+/gi,
      'postgresql://[REDACTED]',
    )
    .replace(
      /(password|passwd|pwd|api[_-]?key|secret|token)\s*[:=]\s*\S+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\r?\n[\s\S]*/g, '') // sin stack multilínea
    .trim();

  if (!message) message = 'Error desconocido';
  if (message.length > ERROR_MESSAGE_MAX) {
    message = `${message.slice(0, ERROR_MESSAGE_MAX - 3)}...`;
  }
  return message;
}

type PendingSkillRow = {
  skillId: string;
  originalName: string;
  category: string;
  confidence: number;
  level: string | null;
  evidence: string;
  evidenceItems: SkillEvidenceItem[];
  sortOrder: number;
};

@Injectable()
export class CvSkillsPersistenceService {
  private readonly logger = new Logger(CvSkillsPersistenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvExtraction)
    private readonly extractions: Repository<CvExtraction>,
  ) {}

  async findExistingSucceededExtraction(params: {
    personId: number;
    pdfSha256: string;
    model: string;
    promptVersion: string;
    extractorVersion: string;
  }): Promise<CvExtraction | null> {
    return this.extractions.findOne({
      where: {
        person_id: String(params.personId),
        pdf_sha256: params.pdfSha256,
        model: params.model,
        prompt_version: params.promptVersion,
        extractor_version: params.extractorVersion,
        status: 'SUCCEEDED',
      },
    });
  }

  async createRunningExtraction(
    input: CreateRunningExtractionInput,
  ): Promise<CvExtraction> {
    this.assertPdfByteSize(input.pdfByteSize);
    this.assertSha256(input.pdfSha256);

    const row = this.extractions.create({
      person_id: String(input.personId),
      person_cv_id: String(input.personCvId),
      document: input.document.trim(),
      drive_file_id: input.driveFileId.trim(),
      drive_file_name: input.driveFileName.trim(),
      pdf_sha256: input.pdfSha256.toLowerCase(),
      pdf_byte_size: String(input.pdfByteSize),
      model: input.model.trim(),
      prompt_version: input.promptVersion.trim(),
      extractor_version: input.extractorVersion.trim(),
      status: 'RUNNING',
      is_active: false,
      started_at: new Date(),
      finished_at: null,
      error_message: null,
      warnings: [],
      raw_result: null,
      skills_count: null,
    });

    return this.extractions.save(row);
  }

  /**
   * Completa una extracción RUNNING: catálogo + ítems → desactiva previa → SUCCEEDED activa.
   */
  async completeExtraction(
    extractionId: string | number,
    result: ExtractedCvSkills,
    metadata?: CompleteExtractionMetadata,
  ): Promise<CvExtraction> {
    const id = String(extractionId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;

      const extraction = await manager.findOne(CvExtraction, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!extraction) {
        throw new CvSkillsPersistenceError(
          `Extracción id=${id} no encontrada.`,
        );
      }
      if (extraction.status !== 'RUNNING' && extraction.status !== 'PENDING') {
        throw new CvSkillsPersistenceError(
          `Extracción id=${id} no está en estado procesable (status=${extraction.status}).`,
        );
      }

      const personId = Number(extraction.person_id);
      if (!Number.isFinite(personId)) {
        throw new CvSkillsPersistenceError(
          `person_id inválido en extracción id=${id}.`,
        );
      }

      await manager.query('SELECT pg_advisory_xact_lock($1)', [personId]);

      // Releer tras el lock (otra TX pudo completar primero).
      const locked = await manager.findOne(CvExtraction, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new CvSkillsPersistenceError(
          `Extracción id=${id} desapareció dentro de la transacción.`,
        );
      }
      if (locked.status !== 'RUNNING' && locked.status !== 'PENDING') {
        throw new CvSkillsPersistenceError(
          `Extracción id=${id} dejó de ser procesable (status=${locked.status}).`,
        );
      }

      const existing = await manager.findOne(CvExtraction, {
        where: {
          person_id: locked.person_id,
          pdf_sha256: locked.pdf_sha256,
          model: locked.model,
          prompt_version: locked.prompt_version,
          extractor_version: locked.extractor_version,
          status: 'SUCCEEDED',
        },
      });
      if (existing && existing.id !== locked.id) {
        locked.status = 'FAILED';
        locked.finished_at = new Date();
        locked.is_active = false;
        locked.error_message = sanitizePersistenceErrorMessage(
          `[IDEMPOTENCY] Ya existía SUCCEEDED id=${existing.id} para el mismo hash/modelo/prompt/extractor.`,
        );
        await manager.save(CvExtraction, locked);
        await queryRunner.commitTransaction();
        return existing;
      }

      const pendingSkills = await this.persistCatalogAndBuildRows(
        manager,
        result,
      );

      await this.insertExtractionRelations(
        manager,
        locked.id,
        pendingSkills,
        result,
      );

      // Desactivar activa previa solo después de inserts exitosos.
      await manager
        .createQueryBuilder()
        .update(CvExtraction)
        .set({ is_active: false, updated_at: new Date() })
        .where('person_id = :personId', { personId: locked.person_id })
        .andWhere('is_active = TRUE')
        .andWhere('id <> :id', { id: locked.id })
        .execute();

      const finishedAt = new Date();
      locked.status = 'SUCCEEDED';
      locked.is_active = true;
      locked.finished_at = finishedAt;
      locked.error_message = null;
      locked.warnings = Array.isArray(result.warnings) ? [...result.warnings] : [];
      locked.skills_count = pendingSkills.length;
      locked.raw_result = this.buildRawResult(result, metadata);
      locked.updated_at = finishedAt;

      try {
        await manager.save(CvExtraction, locked);
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          await queryRunner.rollbackTransaction();
          const recovered = await this.findExistingSucceededExtraction({
            personId,
            pdfSha256: locked.pdf_sha256,
            model: locked.model,
            promptVersion: locked.prompt_version,
            extractorVersion: locked.extractor_version,
          });
          if (recovered) return recovered;
        }
        throw error;
      }

      await queryRunner.commitTransaction();
      return locked;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async failExtraction(
    extractionId: string | number,
    failure: FailExtractionInput,
  ): Promise<CvExtraction> {
    const id = String(extractionId);
    const extraction = await this.extractions.findOne({ where: { id } });
    if (!extraction) {
      throw new CvSkillsPersistenceError(`Extracción id=${id} no encontrada.`);
    }
    if (extraction.status === 'SUCCEEDED' && extraction.is_active) {
      throw new CvSkillsPersistenceError(
        `No se puede marcar FAILED una extracción SUCCEEDED activa id=${id}.`,
      );
    }

    const stage = (failure.errorStage || 'UNKNOWN').trim().slice(0, 80);
    const safe = sanitizePersistenceErrorMessage(failure.errorMessage);
    extraction.status = 'FAILED';
    extraction.is_active = false;
    extraction.finished_at = new Date();
    extraction.error_message = `[${stage}] ${safe}`.slice(0, ERROR_MESSAGE_MAX);
    extraction.raw_result =
      failure.durationMs != null && Number.isFinite(failure.durationMs)
        ? { meta: { durationMs: failure.durationMs } }
        : extraction.raw_result;

    return this.extractions.save(extraction);
  }

  /**
   * Alto nivel: idempotencia → RUNNING → complete.
   * No llama a Gemini.
   */
  async persistSucceededExtraction(
    input: PersistCvSkillsInput,
  ): Promise<PersistSucceededResult> {
    const existing = await this.findExistingSucceededExtraction({
      personId: input.personId,
      pdfSha256: input.pdfSha256,
      model: input.model,
      promptVersion: input.promptVersion,
      extractorVersion: input.extractorVersion,
    });
    if (existing) {
      return { status: 'ALREADY_EXISTS', extraction: existing };
    }

    let running: CvExtraction;
    try {
      running = await this.createRunningExtraction({
        personId: input.personId,
        personCvId: input.personCvId,
        document: input.document,
        driveFileId: input.driveFileId,
        driveFileName: input.driveFileName,
        pdfSha256: input.pdfSha256,
        pdfByteSize: input.pdfByteSize,
        model: input.model,
        promptVersion: input.promptVersion,
        extractorVersion: input.extractorVersion,
      });
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const recovered = await this.findExistingSucceededExtraction({
          personId: input.personId,
          pdfSha256: input.pdfSha256,
          model: input.model,
          promptVersion: input.promptVersion,
          extractorVersion: input.extractorVersion,
        });
        if (recovered) {
          return { status: 'ALREADY_EXISTS', extraction: recovered };
        }
      }
      throw error;
    }

    try {
      const completed = await this.completeExtraction(running.id, input.result, {
        durationMs: input.durationMs,
      });
      if (
        completed.status === 'SUCCEEDED' &&
        completed.id !== running.id
      ) {
        return { status: 'ALREADY_EXISTS', extraction: completed };
      }
      return { status: 'CREATED', extraction: completed };
    } catch (error) {
      try {
        await this.failExtraction(running.id, {
          errorStage: 'PERSISTENCE',
          errorMessage: sanitizePersistenceErrorMessage(error),
          durationMs: input.durationMs,
        });
      } catch (failError) {
        this.logger.warn(
          `No se pudo marcar FAILED extracción id=${running.id}: ${sanitizePersistenceErrorMessage(failError)}`,
        );
      }
      throw error;
    }
  }

  /**
   * Registra un fallo sin extracción RUNNING previa (p. ej. fallo pre-Gemini).
   * No desactiva una SUCCEEDED activa.
   */
  async registerFailedExtraction(
    input: RegisterCvExtractionFailureInput,
  ): Promise<CvExtraction> {
    this.assertPdfByteSize(input.pdfByteSize);
    this.assertSha256(input.pdfSha256);

    const stage = (input.errorStage || 'UNKNOWN').trim().slice(0, 80);
    const safe = sanitizePersistenceErrorMessage(input.errorMessage);
    const now = new Date();

    const row = this.extractions.create({
      person_id: String(input.personId),
      person_cv_id: String(input.personCvId),
      document: input.document.trim(),
      drive_file_id: input.driveFileId.trim(),
      drive_file_name: input.driveFileName.trim(),
      pdf_sha256: input.pdfSha256.toLowerCase(),
      pdf_byte_size: String(input.pdfByteSize),
      model: input.model.trim(),
      prompt_version: input.promptVersion.trim(),
      extractor_version: input.extractorVersion.trim(),
      status: 'FAILED',
      is_active: false,
      started_at: now,
      finished_at: now,
      error_message: `[${stage}] ${safe}`.slice(0, ERROR_MESSAGE_MAX),
      warnings: [],
      raw_result:
        input.durationMs != null && Number.isFinite(input.durationMs)
          ? { meta: { durationMs: input.durationMs } }
          : null,
      skills_count: null,
    });

    return this.extractions.save(row);
  }

  // ─── internos ─────────────────────────────────────────────────────────────

  private buildRawResult(
    result: ExtractedCvSkills,
    metadata?: CompleteExtractionMetadata,
  ): Record<string, unknown> {
    const meta: Record<string, unknown> = {
      promptVersion: CV_SKILLS_PROMPT_VERSION,
      extractorVersion: CV_SKILLS_EXTRACTOR_VERSION,
    };
    if (metadata?.durationMs != null && Number.isFinite(metadata.durationMs)) {
      meta.durationMs = metadata.durationMs;
    }
    // Fase B: se persiste el resultado ya validado/normalizado.
    // El JSON bruto exacto de Gemini no se guarda aquí (requeriría rediseño
    // del flujo extract→persist para pasar ambos payloads).
    return {
      normalizedResult: {
        categories: result.categories,
        languages: result.languages,
        certifications: result.certifications,
        warnings: result.warnings,
      },
      meta,
    };
  }

  private async persistCatalogAndBuildRows(
    manager: EntityManager,
    result: ExtractedCvSkills,
  ): Promise<PendingSkillRow[]> {
    const bySkillId = new Map<string, PendingSkillRow>();
    let sortOrder = 0;

    for (const category of result.categories) {
      const categoryEvidence = category.evidence?.trim() || '(sin evidencia)';
      for (const skill of category.skills) {
        const skillEntity = await this.upsertSkill(manager, skill);
        await this.maybeRegisterAlias(
          manager,
          skillEntity.id,
          skill.originalName,
          skill.normalizedName,
        );

        const skillEvidenceItems = Array.isArray(skill.evidenceItems)
          ? skill.evidenceItems
          : [];

        const existing = bySkillId.get(skillEntity.id);
        if (!existing) {
          const evidenceItems = mergeEvidenceItems(skillEvidenceItems);
          bySkillId.set(skillEntity.id, {
            skillId: skillEntity.id,
            originalName: skill.originalName.trim().slice(0, 200),
            category: category.category.trim().slice(0, 200),
            confidence: skill.confidence,
            level: skill.level?.trim().slice(0, 80) || null,
            evidence: (
              evidenceItems[0]?.evidenceText || categoryEvidence
            ).slice(0, 2000),
            evidenceItems,
            sortOrder: sortOrder++,
          });
        } else {
          const merged = mergeEvidenceItems([
            ...existing.evidenceItems,
            ...skillEvidenceItems,
          ]);
          existing.evidenceItems = merged;
          existing.evidence = (
            merged[0]?.evidenceText || existing.evidence
          ).slice(0, 2000);
          if (skill.confidence > existing.confidence) {
            existing.confidence = skill.confidence;
            existing.category = category.category.trim().slice(0, 200);
            existing.originalName = skill.originalName.trim().slice(0, 200);
            existing.level = skill.level?.trim().slice(0, 80) || null;
          }
        }
      }
    }

    return [...bySkillId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async upsertSkill(
    manager: EntityManager,
    skill: ExtractedSkill,
  ): Promise<CvSkill> {
    const normalizedName = skill.normalizedName.trim().slice(0, 200);
    const normalizedKey = toCanonicalKey(normalizedName);
    const skillType = skill.skillType as SkillType;

    if (!normalizedKey) {
      throw new CvSkillsPersistenceError(
        `normalized_key vacío para skill "${skill.originalName}".`,
      );
    }

    const existing = await manager.findOne(CvSkill, {
      where: { normalized_key: normalizedKey, skill_type: skillType },
    });
    if (existing) {
      if (!existing.is_active) {
        existing.is_active = true;
        existing.updated_at = new Date();
        return manager.save(CvSkill, existing);
      }
      return existing;
    }

    try {
      const created = manager.create(CvSkill, {
        normalized_name: normalizedName,
        normalized_key: normalizedKey,
        skill_type: skillType,
        is_active: true,
      });
      return await manager.save(CvSkill, created);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await manager.findOne(CvSkill, {
          where: { normalized_key: normalizedKey, skill_type: skillType },
        });
        if (raced) return raced;
      }
      throw error;
    }
  }

  private async maybeRegisterAlias(
    manager: EntityManager,
    skillId: string,
    originalName: string,
    normalizedName: string,
  ): Promise<void> {
    const original = originalName.trim();
    const normalized = normalizedName.trim();
    if (!original) return;

    const originalKey = toCanonicalKey(original);
    const normalizedKey = toCanonicalKey(normalized);
    if (!originalKey || originalKey === normalizedKey) return;

    const existing = await manager.findOne(CvSkillAlias, {
      where: { alias_key: originalKey },
    });

    if (existing) {
      if (existing.skill_id !== skillId) {
        throw new CvSkillsAliasConflictError(
          originalKey,
          existing.skill_id,
          skillId,
        );
      }
      return;
    }

    try {
      const alias = manager.create(CvSkillAlias, {
        skill_id: skillId,
        alias_name: original.slice(0, 200),
        alias_key: originalKey.slice(0, 220),
      });
      await manager.save(CvSkillAlias, alias);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await manager.findOne(CvSkillAlias, {
          where: { alias_key: originalKey },
        });
        if (raced && raced.skill_id !== skillId) {
          throw new CvSkillsAliasConflictError(
            originalKey,
            raced.skill_id,
            skillId,
          );
        }
        return;
      }
      throw error;
    }
  }

  private async insertExtractionRelations(
    manager: EntityManager,
    extractionId: string,
    skills: PendingSkillRow[],
    result: ExtractedCvSkills,
  ): Promise<void> {
    for (const row of skills) {
      const entity = manager.create(CvExtractionSkill, {
        extraction_id: extractionId,
        skill_id: row.skillId,
        original_name: row.originalName,
        category: row.category,
        confidence: row.confidence.toFixed(3),
        level: row.level,
        evidence: row.evidence,
        evidence_items:
          row.evidenceItems.length > 0
            ? (JSON.parse(JSON.stringify(row.evidenceItems)) as Record<
                string,
                unknown
              >[])
            : null,
        is_explicit: true,
        sort_order: row.sortOrder,
      });
      await manager.save(CvExtractionSkill, entity);
    }

    const seenLangKeys = new Set<string>();
    let langOrder = 0;
    for (const lang of result.languages) {
      const name = lang.name.trim().slice(0, 120);
      const nameKey = toCanonicalKey(name).slice(0, 140);
      if (!nameKey || seenLangKeys.has(nameKey)) continue;
      seenLangKeys.add(nameKey);

      const entity = manager.create(CvExtractionLanguage, {
        extraction_id: extractionId,
        name,
        name_key: nameKey,
        level: lang.level?.trim().slice(0, 80) || null,
        is_certified:
          typeof lang.isCertified === 'boolean' ? lang.isCertified : null,
        evidence: (lang.evidence?.trim() || '(sin evidencia)').slice(0, 2000),
        sort_order: langOrder++,
      });
      await manager.save(CvExtractionLanguage, entity);
    }

    let certOrder = 0;
    for (const cert of result.certifications) {
      const entity = manager.create(CvExtractionCertification, {
        extraction_id: extractionId,
        name: cert.name.trim().slice(0, 255),
        issuer: cert.issuer?.trim().slice(0, 255) || null,
        evidence: (cert.evidence?.trim() || '(sin evidencia)').slice(0, 2000),
        sort_order: certOrder++,
      });
      await manager.save(CvExtractionCertification, entity);
    }
  }

  private assertPdfByteSize(size: number): void {
    if (!Number.isFinite(size) || size <= 0) {
      throw new CvSkillsPersistenceError(
        'pdfByteSize debe ser un entero positivo.',
      );
    }
  }

  private assertSha256(hash: string): void {
    if (!/^[a-fA-F0-9]{64}$/.test(hash.trim())) {
      throw new CvSkillsPersistenceError(
        'pdfSha256 debe ser un hex SHA-256 de 64 caracteres.',
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code?: unknown }).code)
          : '';
      const msg = error instanceof Error ? error.message : String(error);
      return code === '23505' || /unique|duplicate/i.test(msg);
    }
    const driver = error.driverError as { code?: string } | undefined;
    return driver?.code === '23505' || /unique|duplicate/i.test(error.message);
  }
}
