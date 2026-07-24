/**
 * Persistencia histórica del Skill Enricher (E3).
 * No llama a Gemini. No escribe inventario cv_extraction / cv_extraction_skill.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { sanitizePersistenceErrorMessage } from '../cv-skills/cv-skills-persistence.service';
import {
  buildBlockConfigSnapshot,
  computeInventoryHash,
} from './cv-skills-enrichment.hash';
import {
  ActivateEnrichmentResult,
  AppendBlockAttemptInput,
  CompleteEnrichmentInput,
  CreatePendingEnrichmentInput,
  CvSkillsEnrichmentPersistenceError,
  DeactivateEnrichmentResult,
  EnrichmentActivationRejectedError,
  FailEnrichmentInput,
  IdempotencyKey,
} from './cv-skills-enrichment-persistence.types';
import { CvSkillEnrichment } from './entities/cv-skill-enrichment.entity';
import { CvSkillEnrichmentBlock } from './entities/cv-skill-enrichment-block.entity';
import { CvSkillEnrichmentItem } from './entities/cv-skill-enrichment-item.entity';
import type { EnrichmentBlockConfig } from './cv-skills-enrichment.types';

/** Namespace advisory lock: evita colisión con locks de extracción (person_id). */
export const ENRICHMENT_ADVISORY_LOCK_NS = 0x435645; // 'CVE'

export const RAW_RESPONSE_JSON_MAX_CHARS = 256_000;

const ERROR_MESSAGE_MAX = 2000;

export function sanitizeEnrichmentErrorMessage(raw: unknown): string {
  const msg = sanitizePersistenceErrorMessage(raw);
  if (msg.length > ERROR_MESSAGE_MAX) {
    return `${msg.slice(0, ERROR_MESSAGE_MAX - 3)}...`;
  }
  return msg;
}

export function sanitizeRawResponseJson(raw: unknown): {
  json: unknown | null;
  truncated: boolean;
} {
  if (raw === undefined || raw === null) {
    return { json: null, truncated: false };
  }
  let text: string;
  try {
    text = JSON.stringify(raw);
  } catch {
    return {
      json: { _error: 'RAW_NOT_SERIALIZABLE' },
      truncated: true,
    };
  }
  if (text.length <= RAW_RESPONSE_JSON_MAX_CHARS) {
    return { json: raw, truncated: false };
  }
  return {
    json: {
      _truncated: true,
      _originalChars: text.length,
      _maxChars: RAW_RESPONSE_JSON_MAX_CHARS,
      preview: text.slice(0, RAW_RESPONSE_JSON_MAX_CHARS),
    },
    truncated: true,
  };
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

@Injectable()
export class CvSkillsEnrichmentPersistenceService {
  private readonly logger = new Logger(
    CvSkillsEnrichmentPersistenceService.name,
  );

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvSkillEnrichment)
    private readonly enrichments: Repository<CvSkillEnrichment>,
    @InjectRepository(CvSkillEnrichmentBlock)
    private readonly blocks: Repository<CvSkillEnrichmentBlock>,
    @InjectRepository(CvSkillEnrichmentItem)
    private readonly items: Repository<CvSkillEnrichmentItem>,
  ) {}

  async findIdempotentSucceededRun(
    key: IdempotencyKey,
  ): Promise<CvSkillEnrichment | null> {
    return this.enrichments.findOne({
      where: {
        extraction_id: String(key.extractionId),
        pdf_sha256: key.pdfSha256.toLowerCase(),
        inventory_hash: key.inventoryHash,
        model: key.model,
        prompt_version: key.promptVersion,
        enricher_version: key.enricherVersion,
        block_config_hash: key.blockConfigHash,
        status: 'SUCCEEDED',
      },
    });
  }

  async createPendingRun(
    input: CreatePendingEnrichmentInput,
  ): Promise<CvSkillEnrichment> {
    this.assertSha256(input.pdfSha256);
    if (!/^\d+$/.test(String(input.extractionId))) {
      throw new CvSkillsEnrichmentPersistenceError(
        `extractionId inválido: ${input.extractionId}`,
      );
    }

    const blockConfig =
      typeof input.blockConfig === 'object' &&
      input.blockConfig !== null &&
      'blockSize' in input.blockConfig
        ? buildBlockConfigSnapshot(input.blockConfig as EnrichmentBlockConfig)
        : (input.blockConfig as Record<string, unknown>);

    const row = this.enrichments.create({
      extraction_id: String(input.extractionId),
      person_id: String(input.personId),
      person_cv_id: String(input.personCvId),
      pdf_sha256: input.pdfSha256.toLowerCase(),
      inventory_hash: input.inventoryHash,
      model: input.model.trim(),
      prompt_version: input.promptVersion.trim(),
      enricher_version: input.enricherVersion.trim(),
      block_config_version: input.blockConfigVersion.trim(),
      block_config: blockConfig,
      block_config_hash: input.blockConfigHash,
      status: 'PENDING',
      is_active: false,
      input_skills_count: input.inputSkillsCount,
      output_skills_count: 0,
      skills_with_evidence_count: 0,
      skills_without_evidence_count: 0,
      evidence_items_count: 0,
      missing_filled_empty_count: 0,
      blocks_total: input.blocksTotal,
      blocks_succeeded: 0,
      blocks_failed: 0,
      attempts_total: 0,
      warnings: null,
      metrics: null,
      validated_result_json: null,
      error_stage: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
    });

    return this.enrichments.save(row);
  }

  async markRunning(enrichmentId: string | number): Promise<CvSkillEnrichment> {
    const id = String(enrichmentId);
    const row = await this.enrichments.findOne({ where: { id } });
    if (!row) {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${id} no encontrado.`,
      );
    }
    if (row.status !== 'PENDING' && row.status !== 'RUNNING') {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${id} no puede pasar a RUNNING (status=${row.status}).`,
      );
    }
    row.status = 'RUNNING';
    row.started_at = row.started_at ?? new Date();
    row.error_stage = null;
    row.error_code = null;
    row.error_message = null;
    return this.enrichments.save(row);
  }

  async appendBlockAttempt(
    input: AppendBlockAttemptInput,
  ): Promise<CvSkillEnrichmentBlock> {
    const enrichmentId = String(input.enrichmentId);
    const enrichment = await this.enrichments.findOne({
      where: { id: enrichmentId },
    });
    if (!enrichment) {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${enrichmentId} no encontrado.`,
      );
    }
    if (enrichment.status !== 'RUNNING' && enrichment.status !== 'PENDING') {
      throw new CvSkillsEnrichmentPersistenceError(
        `No se puede appendBlockAttempt en status=${enrichment.status}.`,
      );
    }

    const { json, truncated } = sanitizeRawResponseJson(input.rawResponse);
    const startedAt = toDate(input.startedAt) ?? new Date();
    const completedAt = toDate(input.completedAt) ?? new Date();

    const block = this.blocks.create({
      enrichment_id: enrichmentId,
      block_number: input.blockNumber,
      attempt_number: input.attemptNumber,
      attempt_type: input.attemptType,
      input_skill_ids: input.inputSkillIds,
      input_skills_count: input.inputSkillIds.length,
      status: input.status,
      raw_response_json: json,
      raw_truncated: truncated,
      validation_errors: input.validationErrors ?? null,
      validation_warnings: input.validationWarnings ?? null,
      model_usage: input.modelUsage ?? null,
      duration_ms: input.durationMs ?? null,
      started_at: startedAt,
      completed_at: completedAt,
    });

    const saved = await this.blocks.save(block);
    enrichment.attempts_total = (enrichment.attempts_total || 0) + 1;
    await this.enrichments.save(enrichment);
    return saved;
  }

  async completeSucceeded(
    input: Omit<CompleteEnrichmentInput, 'status'> & {
      status?: 'SUCCEEDED';
    },
  ): Promise<CvSkillEnrichment> {
    return this.completeRun({ ...input, status: 'SUCCEEDED' });
  }

  async completePartial(
    input: Omit<CompleteEnrichmentInput, 'status'> & { status?: 'PARTIAL' },
  ): Promise<CvSkillEnrichment> {
    return this.completeRun({ ...input, status: 'PARTIAL' });
  }

  private async completeRun(
    input: CompleteEnrichmentInput,
  ): Promise<CvSkillEnrichment> {
    const id = String(input.enrichmentId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const enrichment = await manager.findOne(CvSkillEnrichment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!enrichment) {
        throw new CvSkillsEnrichmentPersistenceError(
          `Enrichment id=${id} no encontrado.`,
        );
      }
      if (enrichment.status !== 'RUNNING' && enrichment.status !== 'PENDING') {
        throw new CvSkillsEnrichmentPersistenceError(
          `Enrichment id=${id} no está en estado completable (status=${enrichment.status}).`,
        );
      }

      await this.verifyItemsIntegrity(manager, enrichment, input);

      if (
        input.status === 'SUCCEEDED' &&
        input.items.some((i) => i.wasFilledEmpty)
      ) {
        throw new CvSkillsEnrichmentPersistenceError(
          'No se puede marcar SUCCEEDED con was_filled_empty; use PARTIAL.',
        );
      }

      if (
        input.status === 'SUCCEEDED' &&
        input.items.length !== enrichment.input_skills_count
      ) {
        throw new CvSkillsEnrichmentPersistenceError(
          `output count (${input.items.length}) ≠ input_skills_count (${enrichment.input_skills_count}).`,
        );
      }

      for (const item of input.items) {
        const evidenceItems = Array.isArray(item.evidenceItems)
          ? item.evidenceItems
          : [];
        const sourceTypes = Array.isArray(item.sourceTypes)
          ? item.sourceTypes
          : [];
        await manager.save(
          CvSkillEnrichmentItem,
          manager.create(CvSkillEnrichmentItem, {
            enrichment_id: id,
            extraction_skill_id: String(item.extractionSkillId),
            normalized_name: item.normalizedName,
            evidence_items: evidenceItems,
            evidence_count: evidenceItems.length,
            source_types: sourceTypes,
            warnings: item.warnings ?? null,
            status: item.status,
            was_filled_empty: item.wasFilledEmpty,
          }),
        );
      }

      const withEvidence = input.items.filter(
        (i) => (i.evidenceItems?.length ?? 0) > 0,
      ).length;
      const evidenceItemsCount = input.items.reduce(
        (acc, i) => acc + (i.evidenceItems?.length ?? 0),
        0,
      );
      const filledEmpty = input.items.filter((i) => i.wasFilledEmpty).length;

      enrichment.status = input.status;
      enrichment.is_active = false;
      enrichment.output_skills_count = input.items.length;
      enrichment.skills_with_evidence_count = withEvidence;
      enrichment.skills_without_evidence_count =
        input.items.length - withEvidence;
      enrichment.evidence_items_count = evidenceItemsCount;
      enrichment.missing_filled_empty_count = filledEmpty;
      enrichment.blocks_succeeded = input.blocksSucceeded;
      enrichment.blocks_failed = input.blocksFailed;
      enrichment.attempts_total = input.attemptsTotal;
      enrichment.warnings = input.warnings ?? null;
      enrichment.metrics = input.metrics as Record<string, unknown>;
      enrichment.validated_result_json = input.validatedResultJson;
      enrichment.error_stage = null;
      enrichment.error_code = null;
      enrichment.error_message = null;
      enrichment.completed_at = new Date();
      if (!enrichment.started_at) enrichment.started_at = enrichment.completed_at;

      const saved = await manager.save(CvSkillEnrichment, enrichment);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async failRun(input: FailEnrichmentInput): Promise<CvSkillEnrichment> {
    const id = String(input.enrichmentId);
    const row = await this.enrichments.findOne({ where: { id } });
    if (!row) {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${id} no encontrado.`,
      );
    }
    if (row.status === 'SUCCEEDED' || row.status === 'PARTIAL') {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${id} ya finalizó como ${row.status}; no se puede failRun.`,
      );
    }

    row.status = 'FAILED';
    row.is_active = false;
    row.error_stage = input.errorStage.slice(0, 80);
    row.error_code = input.errorCode?.slice(0, 80) ?? null;
    row.error_message = sanitizeEnrichmentErrorMessage(input.errorMessage);
    row.completed_at = new Date();
    if (!row.started_at) row.started_at = row.completed_at;
    if (input.blocksSucceeded != null) {
      row.blocks_succeeded = input.blocksSucceeded;
    }
    if (input.blocksFailed != null) row.blocks_failed = input.blocksFailed;
    if (input.attemptsTotal != null) row.attempts_total = input.attemptsTotal;
    if (input.warnings) row.warnings = input.warnings;

    return this.enrichments.save(row);
  }

  /**
   * Activación atómica: solo SUCCEEDED, única activa por extraction_id.
   * Usa advisory lock namespaced. No ejecuta Gemini.
   */
  async activateSucceededRun(
    enrichmentId: string | number,
  ): Promise<ActivateEnrichmentResult> {
    const id = String(enrichmentId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const enrichment = await manager.findOne(CvSkillEnrichment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!enrichment) {
        throw new EnrichmentActivationRejectedError(
          `Enrichment id=${id} no encontrado.`,
        );
      }
      if (enrichment.status !== 'SUCCEEDED') {
        throw new EnrichmentActivationRejectedError(
          `Solo SUCCEEDED puede activarse (status=${enrichment.status}).`,
        );
      }

      const extractionIdNum = Number(enrichment.extraction_id);
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ENRICHMENT_ADVISORY_LOCK_NS,
        extractionIdNum,
      ]);

      // Releer tras lock
      const locked = await manager.findOne(CvSkillEnrichment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== 'SUCCEEDED') {
        throw new EnrichmentActivationRejectedError(
          `Enrichment id=${id} no es activable tras lock.`,
        );
      }

      await this.assertActivationHashesCompatible(manager, locked);

      if (locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          enrichmentId: locked.id,
          extractionId: locked.extraction_id,
          previousActiveId: locked.id,
          activated: true,
          alreadyActive: true,
        };
      }

      const previous = await manager.findOne(CvSkillEnrichment, {
        where: {
          extraction_id: locked.extraction_id,
          is_active: true,
        },
      });

      if (previous && previous.id !== locked.id) {
        previous.is_active = false;
        await manager.save(CvSkillEnrichment, previous);
      }

      locked.is_active = true;
      await manager.save(CvSkillEnrichment, locked);
      await queryRunner.commitTransaction();

      return {
        enrichmentId: locked.id,
        extractionId: locked.extraction_id,
        previousActiveId: previous && previous.id !== locked.id ? previous.id : null,
        activated: true,
        alreadyActive: false,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async findActiveForExtraction(
    extractionId: string | number,
  ): Promise<CvSkillEnrichment | null> {
    return this.enrichments.findOne({
      where: {
        extraction_id: String(extractionId),
        is_active: true,
      },
    });
  }

  /**
   * Desactiva un enrichment concreto. Solo toca is_active.
   * Idempotente si ya estaba inactivo. No cambia status. No llama Gemini.
   */
  async deactivateSucceededRun(
    enrichmentId: string | number,
  ): Promise<DeactivateEnrichmentResult> {
    const id = String(enrichmentId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const enrichment = await manager.findOne(CvSkillEnrichment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!enrichment) {
        throw new CvSkillsEnrichmentPersistenceError(
          `Enrichment id=${id} no encontrado.`,
        );
      }

      const extractionIdNum = Number(enrichment.extraction_id);
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ENRICHMENT_ADVISORY_LOCK_NS,
        extractionIdNum,
      ]);

      const locked = await manager.findOne(CvSkillEnrichment, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new CvSkillsEnrichmentPersistenceError(
          `Enrichment id=${id} desapareció tras lock.`,
        );
      }

      if (!locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          enrichmentId: locked.id,
          extractionId: locked.extraction_id,
          deactivated: true,
          alreadyInactive: true,
          status: locked.status,
        };
      }

      locked.is_active = false;
      await manager.save(CvSkillEnrichment, locked);
      await queryRunner.commitTransaction();

      return {
        enrichmentId: locked.id,
        extractionId: locked.extraction_id,
        deactivated: true,
        alreadyInactive: false,
        status: locked.status,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deactivateActiveForExtraction(
    extractionId: string | number,
  ): Promise<number> {
    const result = await this.enrichments
      .createQueryBuilder()
      .update(CvSkillEnrichment)
      .set({ is_active: false, updated_at: new Date() })
      .where('extraction_id = :extractionId', {
        extractionId: String(extractionId),
      })
      .andWhere('is_active = TRUE')
      .execute();
    return result.affected ?? 0;
  }

  async loadRunWithItems(enrichmentId: string | number): Promise<{
    enrichment: CvSkillEnrichment;
    items: CvSkillEnrichmentItem[];
    blocks: CvSkillEnrichmentBlock[];
  }> {
    const id = String(enrichmentId);
    const enrichment = await this.enrichments.findOne({ where: { id } });
    if (!enrichment) {
      throw new CvSkillsEnrichmentPersistenceError(
        `Enrichment id=${id} no encontrado.`,
      );
    }
    const [items, blocks] = await Promise.all([
      this.items.find({
        where: { enrichment_id: id },
        order: { id: 'ASC' },
      }),
      this.blocks.find({
        where: { enrichment_id: id },
        order: { block_number: 'ASC', attempt_number: 'ASC', id: 'ASC' },
      }),
    ]);
    return { enrichment, items, blocks };
  }

  async verifyDatabaseIntegrity(enrichmentId: string | number): Promise<{
    ok: boolean;
    errors: string[];
  }> {
    const { enrichment, items } = await this.loadRunWithItems(enrichmentId);
    const errors: string[] = [];

    if (enrichment.is_active && enrichment.status !== 'SUCCEEDED') {
      errors.push('is_active=true con status distinto de SUCCEEDED');
    }

    if (items.length !== enrichment.output_skills_count) {
      errors.push(
        `items=${items.length} ≠ output_skills_count=${enrichment.output_skills_count}`,
      );
    }

    const skillRows = (await this.dataSource.query(
      `SELECT es.id::text AS id, s.normalized_name, es.extraction_id::text AS extraction_id
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.extraction_id = $1`,
      [enrichment.extraction_id],
    )) as Array<{ id: string; normalized_name: string; extraction_id: string }>;

    const byId = new Map(skillRows.map((r) => [r.id, r]));
    for (const item of items) {
      const expected = byId.get(item.extraction_skill_id);
      if (!expected) {
        errors.push(
          `item extraction_skill_id=${item.extraction_skill_id} no pertenece a extraction ${enrichment.extraction_id}`,
        );
        continue;
      }
      if (expected.normalized_name !== item.normalized_name) {
        errors.push(
          `normalized_name drift en skill ${item.extraction_skill_id}: ` +
            `"${item.normalized_name}" vs "${expected.normalized_name}"`,
        );
      }
    }

    return { ok: errors.length === 0, errors };
  }

  /**
   * Vista de lectura temporal: extracción + enrichment activo + evidence por skill.
   */
  async inspectExtraction(extractionId: string | number): Promise<{
    extractionId: string;
    activeEnrichment: {
      id: string;
      status: string;
      isActive: boolean;
      inventoryHash: string;
      model: string;
      promptVersion: string;
      enricherVersion: string;
      counts: Record<string, number>;
    } | null;
    skills: Array<{
      extractionSkillId: string;
      normalizedName: string;
      evidenceItems: unknown[];
    }>;
  }> {
    const id = String(extractionId);
    const active = await this.findActiveForExtraction(id);
    const skillRows = (await this.dataSource.query(
      `SELECT es.id::text AS extraction_skill_id,
              s.normalized_name
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.extraction_id = $1
        ORDER BY es.sort_order ASC, es.id ASC`,
      [id],
    )) as Array<{ extraction_skill_id: string; normalized_name: string }>;

    let evidenceBySkill = new Map<string, unknown[]>();
    if (active) {
      const items = await this.items.find({
        where: { enrichment_id: active.id },
      });
      evidenceBySkill = new Map(
        items.map((i) => [i.extraction_skill_id, i.evidence_items ?? []]),
      );
    }

    return {
      extractionId: id,
      activeEnrichment: active
        ? {
            id: active.id,
            status: active.status,
            isActive: active.is_active,
            inventoryHash: active.inventory_hash,
            model: active.model,
            promptVersion: active.prompt_version,
            enricherVersion: active.enricher_version,
            counts: {
              inputSkills: active.input_skills_count,
              outputSkills: active.output_skills_count,
              withEvidence: active.skills_with_evidence_count,
              withoutEvidence: active.skills_without_evidence_count,
              evidenceItems: active.evidence_items_count,
              fills: active.missing_filled_empty_count,
              blocksTotal: active.blocks_total,
              blocksSucceeded: active.blocks_succeeded,
              attemptsTotal: active.attempts_total,
            },
          }
        : null,
      skills: skillRows.map((r) => ({
        extractionSkillId: r.extraction_skill_id,
        normalizedName: r.normalized_name,
        evidenceItems: evidenceBySkill.get(r.extraction_skill_id) ?? [],
      })),
    };
  }

  async statusSummary(params: {
    extractionId?: string;
    enrichmentId?: string;
  }): Promise<Record<string, unknown>> {
    let enrichment: CvSkillEnrichment | null = null;
    if (params.enrichmentId) {
      enrichment = await this.enrichments.findOne({
        where: { id: String(params.enrichmentId) },
      });
    } else if (params.extractionId) {
      enrichment =
        (await this.findActiveForExtraction(params.extractionId)) ??
        (await this.enrichments.findOne({
          where: { extraction_id: String(params.extractionId) },
          order: { created_at: 'DESC' },
        }));
    }
    if (!enrichment) {
      throw new CvSkillsEnrichmentPersistenceError(
        'No se encontró enrichment para el filtro dado.',
      );
    }

    const blocks = await this.blocks.find({
      where: { enrichment_id: enrichment.id },
      order: { block_number: 'ASC', attempt_number: 'ASC' },
    });

    return {
      enrichmentId: enrichment.id,
      extractionId: enrichment.extraction_id,
      personId: enrichment.person_id,
      status: enrichment.status,
      isActive: enrichment.is_active,
      versions: {
        model: enrichment.model,
        promptVersion: enrichment.prompt_version,
        enricherVersion: enrichment.enricher_version,
        blockConfigVersion: enrichment.block_config_version,
        blockConfigHash: enrichment.block_config_hash,
        inventoryHash: enrichment.inventory_hash,
        pdfSha256: enrichment.pdf_sha256,
      },
      counts: {
        inputSkills: enrichment.input_skills_count,
        outputSkills: enrichment.output_skills_count,
        withEvidence: enrichment.skills_with_evidence_count,
        withoutEvidence: enrichment.skills_without_evidence_count,
        evidenceItems: enrichment.evidence_items_count,
        fills: enrichment.missing_filled_empty_count,
        blocksTotal: enrichment.blocks_total,
        blocksSucceeded: enrichment.blocks_succeeded,
        blocksFailed: enrichment.blocks_failed,
        attemptsTotal: enrichment.attempts_total,
      },
      blocks: blocks.map((b) => ({
        blockNumber: b.block_number,
        attemptNumber: b.attempt_number,
        attemptType: b.attempt_type,
        status: b.status,
        inputSkillsCount: b.input_skills_count,
        durationMs: b.duration_ms,
        rawTruncated: b.raw_truncated,
        validationErrorCount: Array.isArray(b.validation_errors)
          ? b.validation_errors.length
          : 0,
      })),
      warnings: enrichment.warnings,
      error:
        enrichment.status === 'FAILED'
          ? {
              stage: enrichment.error_stage,
              code: enrichment.error_code,
              message: enrichment.error_message,
            }
          : null,
      timestamps: {
        startedAt: enrichment.started_at,
        completedAt: enrichment.completed_at,
        createdAt: enrichment.created_at,
        updatedAt: enrichment.updated_at,
      },
    };
  }

  private async verifyItemsIntegrity(
    manager: EntityManager,
    enrichment: CvSkillEnrichment,
    input: CompleteEnrichmentInput,
  ): Promise<void> {
    const expectedById = new Map(
      input.expectedSkills.map((s) => [s.extractionSkillId, s]),
    );

    if (input.items.length !== input.expectedSkills.length) {
      throw new CvSkillsEnrichmentPersistenceError(
        `items (${input.items.length}) ≠ expectedSkills (${input.expectedSkills.length}).`,
      );
    }

    const ids = input.items.map((i) => String(i.extractionSkillId));
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      throw new CvSkillsEnrichmentPersistenceError(
        'Items con extraction_skill_id duplicado.',
      );
    }

    const rows = (await manager.query(
      `SELECT es.id::text AS id,
              s.normalized_name,
              es.extraction_id::text AS extraction_id
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.id = ANY($1::bigint[])`,
      [ids],
    )) as Array<{ id: string; normalized_name: string; extraction_id: string }>;

    const byId = new Map(rows.map((r) => [r.id, r]));

    for (const item of input.items) {
      const sid = String(item.extractionSkillId);
      const db = byId.get(sid);
      if (!db) {
        throw new CvSkillsEnrichmentPersistenceError(
          `extraction_skill_id=${sid} no existe.`,
        );
      }
      if (db.extraction_id !== enrichment.extraction_id) {
        throw new CvSkillsEnrichmentPersistenceError(
          `extraction_skill_id=${sid} pertenece a extraction ${db.extraction_id}, ` +
            `no a ${enrichment.extraction_id}.`,
        );
      }
      const expected = expectedById.get(sid);
      if (!expected) {
        throw new CvSkillsEnrichmentPersistenceError(
          `extraction_skill_id=${sid} no está en expectedSkills.`,
        );
      }
      if (db.normalized_name !== item.normalizedName) {
        throw new CvSkillsEnrichmentPersistenceError(
          `normalized_name drift en ${sid}: item="${item.normalizedName}" db="${db.normalized_name}".`,
        );
      }
      if (expected.normalizedName !== item.normalizedName) {
        throw new CvSkillsEnrichmentPersistenceError(
          `normalized_name drift vs inventario de run en ${sid}.`,
        );
      }
    }
  }

  private async assertActivationHashesCompatible(
    manager: EntityManager,
    enrichment: CvSkillEnrichment,
  ): Promise<void> {
    const ext = (await manager.query(
      `SELECT id::text, pdf_sha256, status
         FROM organigrama.cv_extraction
        WHERE id = $1
        LIMIT 1`,
      [enrichment.extraction_id],
    )) as Array<{ id: string; pdf_sha256: string; status: string }>;

    if (ext.length === 0) {
      throw new EnrichmentActivationRejectedError(
        `extraction_id=${enrichment.extraction_id} ya no existe.`,
      );
    }
    if (ext[0].pdf_sha256.toLowerCase() !== enrichment.pdf_sha256.toLowerCase()) {
      throw new EnrichmentActivationRejectedError(
        'pdfSha256 incompatible con la extracción actual.',
      );
    }

    const skillRows = (await manager.query(
      `SELECT es.id::text AS extraction_skill_id,
              es.skill_id::text AS skill_id,
              s.normalized_name,
              s.skill_type,
              es.sort_order
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.extraction_id = $1
        ORDER BY es.sort_order ASC, es.id ASC`,
      [enrichment.extraction_id],
    )) as Array<{
      extraction_skill_id: string;
      skill_id: string;
      normalized_name: string;
      skill_type: string;
      sort_order: number;
    }>;

    const hash = computeInventoryHash(
      skillRows.map((r) => ({
        extractionSkillId: r.extraction_skill_id,
        skillId: r.skill_id,
        normalizedName: r.normalized_name,
        skillType: r.skill_type,
        sortOrder: Number(r.sort_order) || 0,
      })),
    );

    if (hash.inventoryHash !== enrichment.inventory_hash) {
      throw new EnrichmentActivationRejectedError(
        'inventoryHash incompatible con el inventario actual de la extracción.',
      );
    }
  }

  private assertSha256(value: string): void {
    if (!/^[a-fA-F0-9]{64}$/.test(value)) {
      throw new CvSkillsEnrichmentPersistenceError(
        'pdfSha256 inválido (se esperan 64 hex).',
      );
    }
  }
}
