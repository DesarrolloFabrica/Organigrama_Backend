/**
 * Persistencia del Attribute Engine (Fase E6).
 *
 * No llama Gemini, no lee PDF y no escribe en cv_extraction, cv_extraction_skill,
 * cv_skill_enrichment*, cv_evidence_evaluation ni cv_evidence_evaluation_item.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { sanitizePersistenceErrorMessage } from '../cv-skills/cv-skills-persistence.service';
import type { EvidenceLevel } from '../cv-evidence/cv-evidence.types';
import { CvAttributeCatalogService } from './cv-attributes-catalog.service';
import {
  AttributeEngineError,
  runAttributeEngine,
} from './cv-attributes-engine.service';
import { getDefaultAttributeEngineConfig } from './cv-attributes.config';
import { ATTRIBUTE_RUN_ADVISORY_LOCK_NS } from './cv-attributes.constants';
import {
  computeAttributeConfigHash,
  computeMappingHash,
} from './cv-attributes.hash';
import type {
  AttributeCatalog,
  AttributeEngineConfig,
  AttributeEngineDryRunArtifact,
  AttributeEngineRunResult,
  AttributeSkillInput,
  MacroattributeResult,
  SubattributeResult,
} from './cv-attributes.types';
import {
  CvAttributeResultSkill,
  CvAttributeRun,
  CvMacroattributeResult,
  CvSubattributeResult,
} from './entities';

export class CvAttributePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvAttributePersistenceError';
  }
}

export class CvAttributeActivationRejectedError extends CvAttributePersistenceError {
  constructor(message: string) {
    super(message);
    this.name = 'CvAttributeActivationRejectedError';
  }
}

export interface AttributeEvaluationContext {
  evaluationId: string;
  enrichmentId: string;
  extractionId: string;
  personId: string;
  evidenceRulesVersion: string;
  evaluationIsActive: boolean;
  skills: AttributeSkillInput[];
}

export interface AttributeIdempotencyKey {
  evidenceEvaluationId: string;
  catalogVersionId: string;
  mappingHash: string;
  algorithmVersion: string;
  configHash: string;
}

export interface AttributePersistOutcome {
  outcome: 'ALREADY_SUCCEEDED' | 'SUCCEEDED' | 'FAILED';
  attributeRunId: string;
  status: string;
  isActive: boolean;
  activated: boolean;
  skippedEngine: boolean;
  metrics?: Record<string, unknown> | null;
  result?: AttributeEngineRunResult | null;
}

@Injectable()
export class CvAttributePersistenceService {
  private readonly logger = new Logger(CvAttributePersistenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly catalogService: CvAttributeCatalogService,
    @InjectRepository(CvAttributeRun)
    private readonly runs: Repository<CvAttributeRun>,
    @InjectRepository(CvSubattributeResult)
    private readonly subResults: Repository<CvSubattributeResult>,
    @InjectRepository(CvMacroattributeResult)
    private readonly macroResults: Repository<CvMacroattributeResult>,
    @InjectRepository(CvAttributeResultSkill)
    private readonly traces: Repository<CvAttributeResultSkill>,
  ) {}

  /** Resuelve la evaluación activa de un enrichment. */
  async resolveActiveEvaluationId(enrichmentId: string): Promise<string> {
    const rows = (await this.dataSource.query(
      `SELECT id::text
         FROM organigrama.cv_evidence_evaluation
        WHERE enrichment_id = $1 AND is_active = TRUE
        LIMIT 1`,
      [String(enrichmentId)],
    )) as Array<{ id: string }>;
    if (rows.length === 0) {
      throw new CvAttributePersistenceError(
        `Enrichment id=${enrichmentId} no tiene evaluation activa.`,
      );
    }
    return rows[0].id;
  }

  /**
   * Carga los items de evidencia de una evaluation SUCCEEDED. Solo lectura.
   */
  async loadEvaluationForAttributes(
    evaluationId: string,
    options: { requireActiveEvaluation?: boolean } = {},
  ): Promise<AttributeEvaluationContext> {
    const rows = (await this.dataSource.query(
      `SELECT id::text, enrichment_id::text, extraction_id::text, person_id::text,
              evidence_rules_version, status, is_active, output_skills_count
         FROM organigrama.cv_evidence_evaluation
        WHERE id = $1
        LIMIT 1`,
      [String(evaluationId)],
    )) as Array<{
      id: string;
      enrichment_id: string;
      extraction_id: string;
      person_id: string;
      evidence_rules_version: string;
      status: string;
      is_active: boolean;
      output_skills_count: number;
    }>;

    if (rows.length === 0) {
      throw new CvAttributePersistenceError(
        `Evidence evaluation id=${evaluationId} no encontrada.`,
      );
    }
    const evaluation = rows[0];
    if (evaluation.status !== 'SUCCEEDED') {
      throw new CvAttributePersistenceError(
        `Evaluation id=${evaluationId} no está SUCCEEDED (status=${evaluation.status}).`,
      );
    }
    if (options.requireActiveEvaluation && !evaluation.is_active) {
      throw new CvAttributePersistenceError(
        `Evaluation id=${evaluationId} no está activa; no se ejecuta por defecto.`,
      );
    }

    const itemRows = (await this.dataSource.query(
      `SELECT i.id::text                AS evaluation_item_id,
              i.extraction_skill_id::text AS extraction_skill_id,
              es.skill_id::text         AS skill_id,
              i.normalized_name,
              i.evidence_strength::float8   AS evidence_strength,
              i.evidence_confidence::float8 AS evidence_confidence,
              i.evidence_level
         FROM organigrama.cv_evidence_evaluation_item i
         JOIN organigrama.cv_extraction_skill es ON es.id = i.extraction_skill_id
        WHERE i.evaluation_id = $1
        ORDER BY i.id ASC`,
      [String(evaluationId)],
    )) as Array<{
      evaluation_item_id: string;
      extraction_skill_id: string;
      skill_id: string;
      normalized_name: string;
      evidence_strength: number;
      evidence_confidence: number;
      evidence_level: EvidenceLevel;
    }>;

    if (itemRows.length === 0) {
      throw new CvAttributePersistenceError(
        `Evaluation id=${evaluationId} no tiene items.`,
      );
    }
    if (itemRows.length !== evaluation.output_skills_count) {
      throw new CvAttributePersistenceError(
        `Items (${itemRows.length}) ≠ output_skills_count (${evaluation.output_skills_count}).`,
      );
    }

    return {
      evaluationId: evaluation.id,
      enrichmentId: evaluation.enrichment_id,
      extractionId: evaluation.extraction_id,
      personId: evaluation.person_id,
      evidenceRulesVersion: evaluation.evidence_rules_version,
      evaluationIsActive: evaluation.is_active,
      skills: itemRows.map((r) => ({
        evaluationItemId: r.evaluation_item_id,
        extractionSkillId: r.extraction_skill_id,
        skillId: r.skill_id,
        normalizedName: r.normalized_name,
        evidenceStrength: Number(r.evidence_strength),
        evidenceConfidence: Number(r.evidence_confidence),
        evidenceLevel: r.evidence_level,
      })),
    };
  }

  async findIdempotentSucceeded(
    key: AttributeIdempotencyKey,
  ): Promise<CvAttributeRun | null> {
    return this.runs.findOne({
      where: {
        evidence_evaluation_id: String(key.evidenceEvaluationId),
        catalog_version_id: String(key.catalogVersionId),
        mapping_hash: key.mappingHash,
        algorithm_version: key.algorithmVersion,
        config_hash: key.configHash,
        status: 'SUCCEEDED',
      },
    });
  }

  async runDry(params: {
    evaluationId: string;
    catalog?: AttributeCatalog;
    config?: AttributeEngineConfig;
    requireActiveEvaluation?: boolean;
    requireActiveCatalog?: boolean;
  }): Promise<AttributeEngineDryRunArtifact> {
    const cfg = params.config ?? getDefaultAttributeEngineConfig();
    const catalog =
      params.catalog ?? (await this.catalogService.loadCatalog({ activeOnly: false }));
    const context = await this.loadEvaluationForAttributes(params.evaluationId, {
      requireActiveEvaluation: params.requireActiveEvaluation,
    });

    const startedAt = new Date();
    const result = runAttributeEngine(context.skills, catalog, cfg, {
      requireActiveCatalog: params.requireActiveCatalog,
    });
    const finishedAt = new Date();

    return {
      meta: {
        evidenceEvaluationId: context.evaluationId,
        enrichmentId: context.enrichmentId,
        extractionId: context.extractionId,
        personId: context.personId,
        evidenceRulesVersion: context.evidenceRulesVersion,
        catalogCode: catalog.catalogCode,
        catalogVersion: catalog.catalogVersion,
        catalogVersionId: catalog.catalogVersionId,
        algorithmVersion: cfg.algorithmVersion,
        configVersion: cfg.configVersion,
        configHash: computeAttributeConfigHash(cfg),
        mappingHash: computeMappingHash(catalog),
        status: 'DRY_RUN',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
      },
      config: cfg,
      skills: context.skills,
      result,
    };
  }

  async runPersist(params: {
    evaluationId: string;
    activate?: boolean;
    catalog?: AttributeCatalog;
    config?: AttributeEngineConfig;
    requireActiveEvaluation?: boolean;
  }): Promise<AttributePersistOutcome> {
    const cfg = params.config ?? getDefaultAttributeEngineConfig();
    const configHash = computeAttributeConfigHash(cfg);
    const catalog =
      params.catalog ?? (await this.catalogService.loadCatalog({ activeOnly: true }));
    const mappingHash = computeMappingHash(catalog);

    const context = await this.loadEvaluationForAttributes(params.evaluationId, {
      requireActiveEvaluation: params.requireActiveEvaluation !== false,
    });

    const existing = await this.findIdempotentSucceeded({
      evidenceEvaluationId: context.evaluationId,
      catalogVersionId: catalog.catalogVersionId,
      mappingHash,
      algorithmVersion: cfg.algorithmVersion,
      configHash,
    });

    if (existing) {
      let activated = existing.is_active;
      if (params.activate && !existing.is_active) {
        const act = await this.activateSucceeded(existing.id);
        activated = act.activated;
      }
      return {
        outcome: 'ALREADY_SUCCEEDED',
        attributeRunId: existing.id,
        status: existing.status,
        isActive: activated,
        activated: params.activate ? activated : existing.is_active,
        skippedEngine: true,
        metrics: existing.metrics,
      };
    }

    const pending = await this.createPending({
      context,
      catalog,
      config: cfg,
      configHash,
      mappingHash,
    });

    await this.markRunning(pending.id);

    try {
      const result = runAttributeEngine(context.skills, catalog, cfg, {
        requireActiveCatalog: true,
      });

      const completed = await this.completeSucceeded({
        attributeRunId: pending.id,
        result,
      });

      let activated = false;
      if (params.activate) {
        const act = await this.activateSucceeded(completed.id);
        activated = act.activated;
      }

      return {
        outcome: 'SUCCEEDED',
        attributeRunId: completed.id,
        status: completed.status,
        isActive: activated || completed.is_active,
        activated,
        skippedEngine: false,
        metrics: completed.metrics,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Attribute run falló: ${message}`);
      const issues =
        error instanceof AttributeEngineError ? error.issues : [message];
      try {
        await this.failRun(pending.id, {
          errorStage: 'engine',
          errorCode:
            error instanceof AttributeEngineError ? 'INVALID_CATALOG' : 'EXCEPTION',
          errorMessage: message,
          errors: issues,
        });
      } catch (failErr) {
        this.logger.error(
          `No se pudo marcar FAILED: ${
            failErr instanceof Error ? failErr.message : failErr
          }`,
        );
      }
      throw error;
    }
  }

  async createPending(input: {
    context: AttributeEvaluationContext;
    catalog: AttributeCatalog;
    config: AttributeEngineConfig;
    configHash: string;
    mappingHash: string;
  }): Promise<CvAttributeRun> {
    const row = this.runs.create({
      evidence_evaluation_id: input.context.evaluationId,
      enrichment_id: input.context.enrichmentId,
      extraction_id: input.context.extractionId,
      person_id: input.context.personId,
      catalog_version_id: input.catalog.catalogVersionId,
      mapping_hash: input.mappingHash,
      algorithm_version: input.config.algorithmVersion,
      config_version: input.config.configVersion,
      config_hash: input.configHash,
      config_json: input.config as unknown as Record<string, unknown>,
      status: 'PENDING',
      is_active: false,
      input_skills_count: input.context.skills.length,
      mapped_skills_count: 0,
      unmapped_skills_count: 0,
      contributing_skills_count: 0,
      ignored_none_skills_count: 0,
      subattributes_with_support_count: 0,
      macroattributes_with_support_count: 0,
      warnings_count: 0,
      metrics: null,
      warnings: null,
      errors: null,
      error_stage: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
    });
    return this.runs.save(row);
  }

  async markRunning(attributeRunId: string): Promise<CvAttributeRun> {
    const row = await this.runs.findOne({ where: { id: String(attributeRunId) } });
    if (!row) {
      throw new CvAttributePersistenceError(
        `Attribute run id=${attributeRunId} no encontrado.`,
      );
    }
    if (row.status !== 'PENDING' && row.status !== 'RUNNING') {
      throw new CvAttributePersistenceError(
        `Attribute run id=${attributeRunId} no puede pasar a RUNNING (status=${row.status}).`,
      );
    }
    row.status = 'RUNNING';
    row.started_at = row.started_at ?? new Date();
    return this.runs.save(row);
  }

  async completeSucceeded(params: {
    attributeRunId: string;
    result: AttributeEngineRunResult;
  }): Promise<CvAttributeRun> {
    const id = String(params.attributeRunId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const run = await manager.findOne(CvAttributeRun, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new CvAttributePersistenceError(
          `Attribute run id=${id} no encontrado.`,
        );
      }
      if (run.status !== 'RUNNING' && run.status !== 'PENDING') {
        throw new CvAttributePersistenceError(
          `Attribute run id=${id} no completable (status=${run.status}).`,
        );
      }

      for (const sub of params.result.subattributes) {
        const savedSub = await manager.save(
          CvSubattributeResult,
          manager.create(CvSubattributeResult, this.toSubResultRow(id, sub)),
        );
        for (const trace of sub.traces) {
          await manager.save(
            CvAttributeResultSkill,
            manager.create(
              CvAttributeResultSkill,
              this.toTraceRow(id, savedSub.id, trace),
            ),
          );
        }
      }

      for (const macro of params.result.macroattributes) {
        await manager.save(
          CvMacroattributeResult,
          manager.create(CvMacroattributeResult, this.toMacroResultRow(id, macro)),
        );
      }

      const m = params.result.metrics;
      run.status = 'SUCCEEDED';
      run.is_active = false;
      run.mapped_skills_count = m.mappedSkills;
      run.unmapped_skills_count = m.unmappedSkills;
      run.contributing_skills_count = m.contributingSkills;
      run.ignored_none_skills_count = m.ignoredNoneSkills;
      run.subattributes_with_support_count = m.subattributesWithSupport;
      run.macroattributes_with_support_count = m.macroattributesWithSupport;
      run.warnings_count = m.warningsCount;
      run.metrics = m as unknown as Record<string, unknown>;
      run.warnings = params.result.warnings;
      run.errors = null;
      run.error_stage = null;
      run.error_code = null;
      run.error_message = null;
      run.completed_at = new Date();
      if (!run.started_at) run.started_at = run.completed_at;

      const saved = await manager.save(CvAttributeRun, run);
      await queryRunner.commitTransaction();
      return saved;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async failRun(
    attributeRunId: string,
    input: {
      errorStage: string;
      errorCode?: string;
      errorMessage: unknown;
      errors?: string[];
    },
  ): Promise<CvAttributeRun> {
    const row = await this.runs.findOne({ where: { id: String(attributeRunId) } });
    if (!row) {
      throw new CvAttributePersistenceError(
        `Attribute run id=${attributeRunId} no encontrado.`,
      );
    }
    if (row.status === 'SUCCEEDED') {
      throw new CvAttributePersistenceError(
        `Attribute run id=${attributeRunId} ya SUCCEEDED; no se puede fail.`,
      );
    }
    row.status = 'FAILED';
    row.is_active = false;
    row.error_stage = input.errorStage.slice(0, 80);
    row.error_code = input.errorCode?.slice(0, 80) ?? null;
    row.error_message = sanitizePersistenceErrorMessage(input.errorMessage);
    row.errors = input.errors ?? null;
    row.completed_at = new Date();
    if (!row.started_at) row.started_at = row.completed_at;
    return this.runs.save(row);
  }

  async activateSucceeded(attributeRunId: string): Promise<{
    attributeRunId: string;
    evidenceEvaluationId: string;
    previousActiveId: string | null;
    activated: boolean;
    alreadyActive: boolean;
  }> {
    const id = String(attributeRunId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const run = await manager.findOne(CvAttributeRun, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!run) {
        throw new CvAttributeActivationRejectedError(
          `Attribute run id=${id} no encontrado.`,
        );
      }
      if (run.status !== 'SUCCEEDED') {
        throw new CvAttributeActivationRejectedError(
          `Solo SUCCEEDED puede activarse (status=${run.status}).`,
        );
      }

      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ATTRIBUTE_RUN_ADVISORY_LOCK_NS,
        Number(run.evidence_evaluation_id),
      ]);

      const locked = await manager.findOne(CvAttributeRun, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== 'SUCCEEDED') {
        throw new CvAttributeActivationRejectedError(
          `Attribute run id=${id} no activable tras lock.`,
        );
      }

      if (locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          attributeRunId: locked.id,
          evidenceEvaluationId: locked.evidence_evaluation_id,
          previousActiveId: locked.id,
          activated: true,
          alreadyActive: true,
        };
      }

      const previous = await manager.findOne(CvAttributeRun, {
        where: {
          evidence_evaluation_id: locked.evidence_evaluation_id,
          is_active: true,
        },
      });
      if (previous && previous.id !== locked.id) {
        previous.is_active = false;
        await manager.save(CvAttributeRun, previous);
      }

      locked.is_active = true;
      await manager.save(CvAttributeRun, locked);
      await queryRunner.commitTransaction();

      return {
        attributeRunId: locked.id,
        evidenceEvaluationId: locked.evidence_evaluation_id,
        previousActiveId:
          previous && previous.id !== locked.id ? previous.id : null,
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

  async deactivate(attributeRunId: string): Promise<{
    attributeRunId: string;
    deactivated: boolean;
    alreadyInactive: boolean;
    status: string;
  }> {
    const id = String(attributeRunId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const row = await manager.findOne(CvAttributeRun, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new CvAttributePersistenceError(
          `Attribute run id=${id} no encontrado.`,
        );
      }
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ATTRIBUTE_RUN_ADVISORY_LOCK_NS,
        Number(row.evidence_evaluation_id),
      ]);
      const locked = await manager.findOne(CvAttributeRun, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new CvAttributePersistenceError(
          `Attribute run id=${id} desapareció tras lock.`,
        );
      }
      if (!locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          attributeRunId: locked.id,
          deactivated: true,
          alreadyInactive: true,
          status: locked.status,
        };
      }
      locked.is_active = false;
      await manager.save(CvAttributeRun, locked);
      await queryRunner.commitTransaction();
      return {
        attributeRunId: locked.id,
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

  async statusSummary(params: {
    attributeRunId?: string;
    evaluationId?: string;
  }): Promise<Record<string, unknown>> {
    let run: CvAttributeRun | null = null;
    if (params.attributeRunId) {
      run = await this.runs.findOne({
        where: { id: String(params.attributeRunId) },
      });
    } else if (params.evaluationId) {
      run =
        (await this.runs.findOne({
          where: {
            evidence_evaluation_id: String(params.evaluationId),
            is_active: true,
          },
        })) ??
        (await this.runs.findOne({
          where: { evidence_evaluation_id: String(params.evaluationId) },
          order: { created_at: 'DESC' },
        }));
    }
    if (!run) {
      throw new CvAttributePersistenceError(
        'No se encontró attribute run para el filtro dado.',
      );
    }

    const [subCount, macroCount, traceCount] = await Promise.all([
      this.subResults.count({ where: { attribute_run_id: run.id } }),
      this.macroResults.count({ where: { attribute_run_id: run.id } }),
      this.traces.count({ where: { attribute_run_id: run.id } }),
    ]);

    return {
      attributeRunId: run.id,
      evidenceEvaluationId: run.evidence_evaluation_id,
      enrichmentId: run.enrichment_id,
      extractionId: run.extraction_id,
      personId: run.person_id,
      status: run.status,
      isActive: run.is_active,
      versions: {
        catalogVersionId: run.catalog_version_id,
        mappingHash: run.mapping_hash,
        algorithmVersion: run.algorithm_version,
        configVersion: run.config_version,
        configHash: run.config_hash,
      },
      counts: {
        inputSkills: run.input_skills_count,
        mappedSkills: run.mapped_skills_count,
        unmappedSkills: run.unmapped_skills_count,
        contributingSkills: run.contributing_skills_count,
        ignoredNoneSkills: run.ignored_none_skills_count,
        subattributesWithSupport: run.subattributes_with_support_count,
        macroattributesWithSupport: run.macroattributes_with_support_count,
        subattributeResults: subCount,
        macroattributeResults: macroCount,
        traces: traceCount,
        warnings: run.warnings_count,
      },
      metrics: run.metrics,
      warnings: run.warnings,
      errors: run.errors,
      timestamps: {
        startedAt: run.started_at,
        completedAt: run.completed_at,
        createdAt: run.created_at,
        updatedAt: run.updated_at,
      },
    };
  }

  /** Inspección legible: macro → sub → top skills aportantes. */
  async inspect(attributeRunId: string): Promise<Record<string, unknown>> {
    const run = await this.runs.findOne({
      where: { id: String(attributeRunId) },
    });
    if (!run) {
      throw new CvAttributePersistenceError(
        `Attribute run id=${attributeRunId} no encontrado.`,
      );
    }

    const catalog = await this.catalogService.loadCatalog({
      catalogVersionId: run.catalog_version_id,
    });
    const macroById = new Map(catalog.macroattributes.map((m) => [m.id, m]));
    const subById = new Map(catalog.subattributes.map((s) => [s.id, s]));

    const [macroRows, subRows, traceRows] = await Promise.all([
      this.macroResults.find({
        where: { attribute_run_id: run.id },
        order: { id: 'ASC' },
      }),
      this.subResults.find({
        where: { attribute_run_id: run.id },
        order: { id: 'ASC' },
      }),
      this.traces.find({
        where: { attribute_run_id: run.id },
        order: { subattribute_result_id: 'ASC', contribution_rank: 'ASC' },
      }),
    ]);

    const skillNameByExtractionSkillId = await this.loadExtractionSkillNames(
      traceRows.map((t) => t.extraction_skill_id),
    );

    const tracesBySubResult = new Map<string, typeof traceRows>();
    for (const trace of traceRows) {
      const list = tracesBySubResult.get(trace.subattribute_result_id) ?? [];
      list.push(trace);
      tracesBySubResult.set(trace.subattribute_result_id, list);
    }

    const subsByMacroId = new Map<string, typeof subRows>();
    for (const sub of subRows) {
      const macroId = subById.get(sub.subattribute_id)?.macroattributeId ?? '';
      const list = subsByMacroId.get(macroId) ?? [];
      list.push(sub);
      subsByMacroId.set(macroId, list);
    }

    return {
      attributeRunId: run.id,
      evidenceEvaluationId: run.evidence_evaluation_id,
      status: run.status,
      isActive: run.is_active,
      catalogVersion: catalog.catalogVersion,
      macroattributes: macroRows
        .map((macro) => {
          const def = macroById.get(macro.macroattribute_id);
          return {
            code: def?.code ?? `macroId=${macro.macroattribute_id}`,
            name: def?.name ?? '',
            score: Number(macro.score),
            confidence: Number(macro.confidence),
            coverage: Number(macro.coverage),
            level: macro.level,
            supportedSubattributes: macro.supported_subattributes_count,
            totalSubattributes: macro.total_subattributes_count,
            qualityFlags: macro.quality_flags,
            explanation: macro.explanation,
            subattributes: (subsByMacroId.get(macro.macroattribute_id) ?? [])
              .map((sub) => {
                const subDef = subById.get(sub.subattribute_id);
                const traces = (tracesBySubResult.get(sub.id) ?? []).filter(
                  (t) => Number(t.normalized_contribution) > 0,
                );
                return {
                  code: subDef?.code ?? `subId=${sub.subattribute_id}`,
                  name: subDef?.name ?? '',
                  score: Number(sub.score),
                  confidence: Number(sub.confidence),
                  coverage: Number(sub.coverage),
                  level: sub.level,
                  supportingSkills: sub.supporting_skills_count,
                  contributingSkills: sub.contributing_skills_count,
                  support: {
                    strong: sub.strong_support_count,
                    moderate: sub.moderate_support_count,
                    weak: sub.weak_support_count,
                    none: sub.none_support_count,
                  },
                  qualityFlags: sub.quality_flags,
                  explanation: sub.explanation,
                  topSupportingSkills: traces.slice(0, 5).map((t) => ({
                    skill:
                      skillNameByExtractionSkillId.get(t.extraction_skill_id) ??
                      `extractionSkillId=${t.extraction_skill_id}`,
                    mappingWeight: Number(t.mapping_weight),
                    evidenceStrength: Number(t.evidence_strength),
                    evidenceConfidence: Number(t.evidence_confidence),
                    rawContribution: Number(t.raw_contribution),
                    normalizedContribution: Number(t.normalized_contribution),
                    rank: t.contribution_rank,
                  })),
                  contributionBreakdown: (
                    sub.scoring_breakdown as Record<string, unknown>
                  )?.contributions,
                };
              })
              .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)),
          };
        })
        .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code)),
    };
  }

  private async loadExtractionSkillNames(
    extractionSkillIds: string[],
  ): Promise<Map<string, string>> {
    const unique = [...new Set(extractionSkillIds.map(String))];
    if (unique.length === 0) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT es.id::text, s.normalized_name
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.id = ANY($1::bigint[])`,
      [unique],
    )) as Array<{ id: string; normalized_name: string }>;
    return new Map(rows.map((r) => [r.id, r.normalized_name] as const));
  }

  private toSubResultRow(
    attributeRunId: string,
    sub: SubattributeResult,
  ): Partial<CvSubattributeResult> {
    return {
      attribute_run_id: attributeRunId,
      subattribute_id: sub.subattributeId,
      score: sub.score.toFixed(2),
      confidence: sub.confidence.toFixed(4),
      coverage: sub.coverage.toFixed(4),
      level: sub.level,
      supporting_skills_count: sub.supportingSkillsCount,
      contributing_skills_count: sub.contributingSkillsCount,
      strong_support_count: sub.strongSupportCount,
      moderate_support_count: sub.moderateSupportCount,
      weak_support_count: sub.weakSupportCount,
      none_support_count: sub.noneSupportCount,
      quality_flags: sub.qualityFlags,
      scoring_breakdown: sub.scoringBreakdown,
      explanation: sub.explanation,
    };
  }

  private toMacroResultRow(
    attributeRunId: string,
    macro: MacroattributeResult,
  ): Partial<CvMacroattributeResult> {
    return {
      attribute_run_id: attributeRunId,
      macroattribute_id: macro.macroattributeId,
      score: macro.score.toFixed(2),
      confidence: macro.confidence.toFixed(4),
      coverage: macro.coverage.toFixed(4),
      level: macro.level,
      supported_subattributes_count: macro.supportedSubattributesCount,
      total_subattributes_count: macro.totalSubattributesCount,
      quality_flags: macro.qualityFlags,
      scoring_breakdown: macro.scoringBreakdown,
      explanation: macro.explanation,
    };
  }

  private toTraceRow(
    attributeRunId: string,
    subattributeResultId: string,
    trace: SubattributeResult['traces'][number],
  ): Partial<CvAttributeResultSkill> {
    return {
      attribute_run_id: attributeRunId,
      subattribute_result_id: subattributeResultId,
      extraction_skill_id: trace.extractionSkillId,
      evidence_evaluation_item_id: trace.evaluationItemId,
      mapping_id: trace.mappingId,
      mapping_weight: trace.mappingWeight.toFixed(3),
      evidence_strength: trace.evidenceStrength.toFixed(2),
      evidence_confidence: trace.evidenceConfidence.toFixed(4),
      raw_contribution: trace.rawContribution.toFixed(4),
      normalized_contribution: trace.normalizedContribution.toFixed(4),
      contribution_rank: trace.contributionRank,
    };
  }
}
