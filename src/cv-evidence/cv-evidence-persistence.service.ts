/**
 * Persistencia del Evidence Engine. No llama Gemini. No modifica enrichment/inventario.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { sanitizePersistenceErrorMessage } from '../cv-skills/cv-skills-persistence.service';
import {
  EVIDENCE_EVAL_ADVISORY_LOCK_NS,
} from './cv-evidence.constants';
import { getDefaultEvidenceEngineConfig } from './cv-evidence.config';
import { evaluateEvidenceSkills } from './cv-evidence-engine.service';
import { computeEvidenceConfigHash } from './cv-evidence.hash';
import type {
  EvidenceEngineConfig,
  EvidenceEngineRunResult,
  EvidenceSkillInput,
  EvidenceSkillMetrics,
} from './cv-evidence.types';
import { CvEvidenceEvaluation } from './entities/cv-evidence-evaluation.entity';
import { CvEvidenceEvaluationItem } from './entities/cv-evidence-evaluation-item.entity';

export class CvEvidencePersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvEvidencePersistenceError';
  }
}

export class CvEvidenceActivationRejectedError extends CvEvidencePersistenceError {
  constructor(message: string) {
    super(message);
    this.name = 'CvEvidenceActivationRejectedError';
  }
}

export interface EvidenceIdempotencyKey {
  enrichmentId: string;
  evidenceRulesVersion: string;
  sourceWeightVersion: string;
  algorithmVersion: string;
  configHash: string;
}

export interface EvidencePersistOutcome {
  outcome: 'ALREADY_SUCCEEDED' | 'SUCCEEDED' | 'FAILED';
  evaluationId: string;
  status: string;
  isActive: boolean;
  activated: boolean;
  skippedEngine: boolean;
  metrics?: Record<string, unknown> | null;
  result?: EvidenceEngineRunResult | null;
}

@Injectable()
export class CvEvidencePersistenceService {
  private readonly logger = new Logger(CvEvidencePersistenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvEvidenceEvaluation)
    private readonly evaluations: Repository<CvEvidenceEvaluation>,
    @InjectRepository(CvEvidenceEvaluationItem)
    private readonly items: Repository<CvEvidenceEvaluationItem>,
  ) {}

  async loadEnrichmentForEvaluation(enrichmentId: string): Promise<{
    enrichment: {
      id: string;
      extraction_id: string;
      person_id: string;
      status: string;
      is_active: boolean;
      input_skills_count: number;
      output_skills_count: number;
      missing_filled_empty_count: number;
    };
    skills: EvidenceSkillInput[];
  }> {
    const rows = (await this.dataSource.query(
      `SELECT id::text, extraction_id::text, person_id::text, status, is_active,
              input_skills_count, output_skills_count, missing_filled_empty_count
         FROM organigrama.cv_skill_enrichment
        WHERE id = $1
        LIMIT 1`,
      [enrichmentId],
    )) as Array<{
      id: string;
      extraction_id: string;
      person_id: string;
      status: string;
      is_active: boolean;
      input_skills_count: number;
      output_skills_count: number;
      missing_filled_empty_count: number;
    }>;

    if (rows.length === 0) {
      throw new CvEvidencePersistenceError(
        `Enrichment id=${enrichmentId} no encontrado.`,
      );
    }
    const enrichment = rows[0];
    if (enrichment.status !== 'SUCCEEDED') {
      throw new CvEvidencePersistenceError(
        `Enrichment id=${enrichmentId} no está SUCCEEDED (status=${enrichment.status}).`,
      );
    }

    const itemRows = (await this.dataSource.query(
      `SELECT id::text AS enrichment_item_id,
              extraction_skill_id::text,
              normalized_name,
              evidence_items
         FROM organigrama.cv_skill_enrichment_item
        WHERE enrichment_id = $1
        ORDER BY id ASC`,
      [enrichmentId],
    )) as Array<{
      enrichment_item_id: string;
      extraction_skill_id: string;
      normalized_name: string;
      evidence_items: Array<{
        sourceType?: string;
        evidenceText?: string;
        occurrenceIndex?: number;
        isFallback?: boolean;
      }>;
    }>;

    if (itemRows.length === 0) {
      throw new CvEvidencePersistenceError(
        `Enrichment id=${enrichmentId} no tiene items.`,
      );
    }
    if (itemRows.length !== enrichment.output_skills_count) {
      throw new CvEvidencePersistenceError(
        `Items (${itemRows.length}) ≠ output_skills_count (${enrichment.output_skills_count}).`,
      );
    }

    const skills: EvidenceSkillInput[] = itemRows.map((r) => ({
      enrichmentItemId: r.enrichment_item_id,
      extractionSkillId: r.extraction_skill_id,
      normalizedName: r.normalized_name,
      evidenceItems: (r.evidence_items || []).map((e) => ({
        sourceType: String(e.sourceType || 'OTHER'),
        evidenceText: String(e.evidenceText ?? ''),
        occurrenceIndex: e.occurrenceIndex,
        isFallback: e.isFallback,
      })),
    }));

    return { enrichment, skills };
  }

  async findIdempotentSucceeded(
    key: EvidenceIdempotencyKey,
  ): Promise<CvEvidenceEvaluation | null> {
    return this.evaluations.findOne({
      where: {
        enrichment_id: String(key.enrichmentId),
        evidence_rules_version: key.evidenceRulesVersion,
        source_weight_version: key.sourceWeightVersion,
        algorithm_version: key.algorithmVersion,
        config_hash: key.configHash,
        status: 'SUCCEEDED',
      },
    });
  }

  async runDry(
    enrichmentId: string,
    config?: EvidenceEngineConfig,
  ) {
    const cfg = config ?? getDefaultEvidenceEngineConfig();
    const { enrichment, skills } =
      await this.loadEnrichmentForEvaluation(enrichmentId);
    const startedAt = new Date();
    const result = evaluateEvidenceSkills(skills, cfg);
    const finishedAt = new Date();
    return {
      meta: {
        enrichmentId: enrichment.id,
        extractionId: enrichment.extraction_id,
        personId: enrichment.person_id,
        evidenceRulesVersion: cfg.rulesVersion,
        sourceWeightVersion: cfg.sourceWeightVersion,
        algorithmVersion: cfg.algorithmVersion,
        configHash: computeEvidenceConfigHash(cfg),
        status: 'DRY_RUN' as const,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        enrichmentActive: enrichment.is_active,
        fills: enrichment.missing_filled_empty_count,
      },
      config: cfg,
      result,
    };
  }

  async runPersist(params: {
    enrichmentId: string;
    activate?: boolean;
    requireActiveEnrichment?: boolean;
    config?: EvidenceEngineConfig;
  }): Promise<EvidencePersistOutcome> {
    const cfg = params.config ?? getDefaultEvidenceEngineConfig();
    const configHash = computeEvidenceConfigHash(cfg);
    const { enrichment, skills } = await this.loadEnrichmentForEvaluation(
      params.enrichmentId,
    );

    if (params.requireActiveEnrichment !== false && !enrichment.is_active) {
      throw new CvEvidencePersistenceError(
        `Enrichment id=${enrichment.id} no está activo; no se evalúa por defecto.`,
      );
    }

    const existing = await this.findIdempotentSucceeded({
      enrichmentId: enrichment.id,
      evidenceRulesVersion: cfg.rulesVersion,
      sourceWeightVersion: cfg.sourceWeightVersion,
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
        evaluationId: existing.id,
        status: existing.status,
        isActive: activated,
        activated: params.activate ? activated : existing.is_active,
        skippedEngine: true,
        metrics: existing.metrics,
      };
    }

    const pending = await this.createPending({
      enrichmentId: enrichment.id,
      extractionId: enrichment.extraction_id,
      personId: enrichment.person_id,
      configHash,
      config: cfg,
      inputSkillsCount: skills.length,
    });

    await this.markRunning(pending.id);

    try {
      const result = evaluateEvidenceSkills(skills, cfg);
      if (result.skills.length !== skills.length) {
        throw new CvEvidencePersistenceError(
          `output (${result.skills.length}) ≠ input (${skills.length}).`,
        );
      }

      const completed = await this.completeSucceeded({
        evaluationId: pending.id,
        result,
        config: cfg,
      });

      let activated = false;
      if (params.activate) {
        const act = await this.activateSucceeded(completed.id);
        activated = act.activated;
      }

      return {
        outcome: 'SUCCEEDED',
        evaluationId: completed.id,
        status: completed.status,
        isActive: activated || completed.is_active,
        activated,
        skippedEngine: false,
        metrics: completed.metrics,
        result,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Evidence eval falló: ${message}`);
      try {
        await this.failRun(pending.id, {
          errorStage: 'engine',
          errorCode: 'EXCEPTION',
          errorMessage: message,
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
    enrichmentId: string;
    extractionId: string;
    personId: string;
    configHash: string;
    config: EvidenceEngineConfig;
    inputSkillsCount: number;
  }): Promise<CvEvidenceEvaluation> {
    const row = this.evaluations.create({
      enrichment_id: String(input.enrichmentId),
      extraction_id: String(input.extractionId),
      person_id: String(input.personId),
      evidence_rules_version: input.config.rulesVersion,
      source_weight_version: input.config.sourceWeightVersion,
      algorithm_version: input.config.algorithmVersion,
      config_hash: input.configHash,
      config_json: input.config as unknown as Record<string, unknown>,
      status: 'PENDING',
      is_active: false,
      input_skills_count: input.inputSkillsCount,
      output_skills_count: 0,
      strong_skills_count: 0,
      moderate_skills_count: 0,
      weak_skills_count: 0,
      no_evidence_skills_count: 0,
      applied_evidence_skills_count: 0,
      warnings_count: 0,
      metrics: null,
      warnings: null,
      error_stage: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
    });
    return this.evaluations.save(row);
  }

  async markRunning(evaluationId: string): Promise<CvEvidenceEvaluation> {
    const row = await this.evaluations.findOne({
      where: { id: String(evaluationId) },
    });
    if (!row) {
      throw new CvEvidencePersistenceError(
        `Evaluation id=${evaluationId} no encontrada.`,
      );
    }
    if (row.status !== 'PENDING' && row.status !== 'RUNNING') {
      throw new CvEvidencePersistenceError(
        `Evaluation id=${evaluationId} no puede pasar a RUNNING (status=${row.status}).`,
      );
    }
    row.status = 'RUNNING';
    row.started_at = row.started_at ?? new Date();
    return this.evaluations.save(row);
  }

  async completeSucceeded(params: {
    evaluationId: string;
    result: EvidenceEngineRunResult;
    config: EvidenceEngineConfig;
  }): Promise<CvEvidenceEvaluation> {
    const id = String(params.evaluationId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const evaluation = await manager.findOne(CvEvidenceEvaluation, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!evaluation) {
        throw new CvEvidencePersistenceError(
          `Evaluation id=${id} no encontrada.`,
        );
      }
      if (evaluation.status !== 'RUNNING' && evaluation.status !== 'PENDING') {
        throw new CvEvidencePersistenceError(
          `Evaluation id=${id} no completable (status=${evaluation.status}).`,
        );
      }

      for (const skill of params.result.skills) {
        await manager.save(
          CvEvidenceEvaluationItem,
          manager.create(CvEvidenceEvaluationItem, this.toItemRow(id, skill)),
        );
      }

      const m = params.result.metrics;
      evaluation.status = 'SUCCEEDED';
      evaluation.is_active = false;
      evaluation.output_skills_count = m.outputSkills;
      evaluation.strong_skills_count = m.strongSkills;
      evaluation.moderate_skills_count = m.moderateSkills;
      evaluation.weak_skills_count = m.weakSkills;
      evaluation.no_evidence_skills_count = m.noEvidenceSkills;
      evaluation.applied_evidence_skills_count = m.appliedEvidenceSkills;
      evaluation.warnings_count = m.warningsCount;
      evaluation.metrics = m as unknown as Record<string, unknown>;
      evaluation.warnings = params.result.warnings;
      evaluation.error_stage = null;
      evaluation.error_code = null;
      evaluation.error_message = null;
      evaluation.completed_at = new Date();
      if (!evaluation.started_at) evaluation.started_at = evaluation.completed_at;

      const saved = await manager.save(CvEvidenceEvaluation, evaluation);
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
    evaluationId: string,
    input: {
      errorStage: string;
      errorCode?: string;
      errorMessage: unknown;
    },
  ): Promise<CvEvidenceEvaluation> {
    const row = await this.evaluations.findOne({
      where: { id: String(evaluationId) },
    });
    if (!row) {
      throw new CvEvidencePersistenceError(
        `Evaluation id=${evaluationId} no encontrada.`,
      );
    }
    if (row.status === 'SUCCEEDED') {
      throw new CvEvidencePersistenceError(
        `Evaluation id=${evaluationId} ya SUCCEEDED; no se puede fail.`,
      );
    }
    row.status = 'FAILED';
    row.is_active = false;
    row.error_stage = input.errorStage.slice(0, 80);
    row.error_code = input.errorCode?.slice(0, 80) ?? null;
    row.error_message = sanitizePersistenceErrorMessage(input.errorMessage);
    row.completed_at = new Date();
    if (!row.started_at) row.started_at = row.completed_at;
    return this.evaluations.save(row);
  }

  async activateSucceeded(evaluationId: string): Promise<{
    evaluationId: string;
    enrichmentId: string;
    previousActiveId: string | null;
    activated: boolean;
    alreadyActive: boolean;
  }> {
    const id = String(evaluationId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const manager = queryRunner.manager;
      const evaluation = await manager.findOne(CvEvidenceEvaluation, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!evaluation) {
        throw new CvEvidenceActivationRejectedError(
          `Evaluation id=${id} no encontrada.`,
        );
      }
      if (evaluation.status !== 'SUCCEEDED') {
        throw new CvEvidenceActivationRejectedError(
          `Solo SUCCEEDED puede activarse (status=${evaluation.status}).`,
        );
      }

      const enrichmentIdNum = Number(evaluation.enrichment_id);
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        EVIDENCE_EVAL_ADVISORY_LOCK_NS,
        enrichmentIdNum,
      ]);

      const locked = await manager.findOne(CvEvidenceEvaluation, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== 'SUCCEEDED') {
        throw new CvEvidenceActivationRejectedError(
          `Evaluation id=${id} no activable tras lock.`,
        );
      }

      if (locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          evaluationId: locked.id,
          enrichmentId: locked.enrichment_id,
          previousActiveId: locked.id,
          activated: true,
          alreadyActive: true,
        };
      }

      const previous = await manager.findOne(CvEvidenceEvaluation, {
        where: {
          enrichment_id: locked.enrichment_id,
          is_active: true,
        },
      });
      if (previous && previous.id !== locked.id) {
        previous.is_active = false;
        await manager.save(CvEvidenceEvaluation, previous);
      }

      locked.is_active = true;
      await manager.save(CvEvidenceEvaluation, locked);
      await queryRunner.commitTransaction();

      return {
        evaluationId: locked.id,
        enrichmentId: locked.enrichment_id,
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

  async deactivate(evaluationId: string): Promise<{
    evaluationId: string;
    deactivated: boolean;
    alreadyInactive: boolean;
    status: string;
  }> {
    const id = String(evaluationId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const row = await manager.findOne(CvEvidenceEvaluation, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) {
        throw new CvEvidencePersistenceError(
          `Evaluation id=${id} no encontrada.`,
        );
      }
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        EVIDENCE_EVAL_ADVISORY_LOCK_NS,
        Number(row.enrichment_id),
      ]);
      const locked = await manager.findOne(CvEvidenceEvaluation, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new CvEvidencePersistenceError(
          `Evaluation id=${id} desapareció tras lock.`,
        );
      }
      if (!locked.is_active) {
        await queryRunner.commitTransaction();
        return {
          evaluationId: locked.id,
          deactivated: true,
          alreadyInactive: true,
          status: locked.status,
        };
      }
      locked.is_active = false;
      await manager.save(CvEvidenceEvaluation, locked);
      await queryRunner.commitTransaction();
      return {
        evaluationId: locked.id,
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
    enrichmentId?: string;
    evaluationId?: string;
  }): Promise<Record<string, unknown>> {
    let evaluation: CvEvidenceEvaluation | null = null;
    if (params.evaluationId) {
      evaluation = await this.evaluations.findOne({
        where: { id: String(params.evaluationId) },
      });
    } else if (params.enrichmentId) {
      evaluation =
        (await this.evaluations.findOne({
          where: {
            enrichment_id: String(params.enrichmentId),
            is_active: true,
          },
        })) ??
        (await this.evaluations.findOne({
          where: { enrichment_id: String(params.enrichmentId) },
          order: { created_at: 'DESC' },
        }));
    }
    if (!evaluation) {
      throw new CvEvidencePersistenceError(
        'No se encontró evaluation para el filtro dado.',
      );
    }

    const itemCount = await this.items.count({
      where: { evaluation_id: evaluation.id },
    });

    return {
      evaluationId: evaluation.id,
      enrichmentId: evaluation.enrichment_id,
      extractionId: evaluation.extraction_id,
      status: evaluation.status,
      isActive: evaluation.is_active,
      versions: {
        evidenceRulesVersion: evaluation.evidence_rules_version,
        sourceWeightVersion: evaluation.source_weight_version,
        algorithmVersion: evaluation.algorithm_version,
        configHash: evaluation.config_hash,
      },
      counts: {
        inputSkills: evaluation.input_skills_count,
        outputSkills: evaluation.output_skills_count,
        strong: evaluation.strong_skills_count,
        moderate: evaluation.moderate_skills_count,
        weak: evaluation.weak_skills_count,
        none: evaluation.no_evidence_skills_count,
        withApplied: evaluation.applied_evidence_skills_count,
        items: itemCount,
        warnings: evaluation.warnings_count,
      },
      metrics: evaluation.metrics,
      warnings: evaluation.warnings,
      timestamps: {
        startedAt: evaluation.started_at,
        completedAt: evaluation.completed_at,
        createdAt: evaluation.created_at,
        updatedAt: evaluation.updated_at,
      },
    };
  }

  async inspect(evaluationId: string): Promise<{
    evaluationId: string;
    enrichmentId: string;
    status: string;
    isActive: boolean;
    skills: Array<Record<string, unknown>>;
  }> {
    const evaluation = await this.evaluations.findOne({
      where: { id: String(evaluationId) },
    });
    if (!evaluation) {
      throw new CvEvidencePersistenceError(
        `Evaluation id=${evaluationId} no encontrada.`,
      );
    }
    const items = await this.items.find({
      where: { evaluation_id: evaluation.id },
      order: { id: 'ASC' },
    });

    return {
      evaluationId: evaluation.id,
      enrichmentId: evaluation.enrichment_id,
      status: evaluation.status,
      isActive: evaluation.is_active,
      skills: items.map((i) => ({
        extractionSkillId: i.extraction_skill_id,
        normalizedName: i.normalized_name,
        evidenceCount: i.evidence_count,
        uniqueEvidenceCount: i.unique_evidence_count,
        appliedEvidenceCount: i.applied_evidence_count,
        substantiveEvidenceCount: i.substantive_evidence_count,
        listingEvidenceCount: i.listing_evidence_count,
        ambiguousEvidenceCount: i.ambiguous_evidence_count,
        sourceDiversity: i.source_diversity,
        evidenceStrength: Number(i.evidence_strength),
        evidenceConfidence: Number(i.evidence_confidence),
        evidenceLevel: i.evidence_level,
        qualityFlags: i.quality_flags,
        explanation: i.explanation,
        sourceBreakdown: i.source_breakdown,
        scoringBreakdown: {
          sourceContribution: (i.scoring_breakdown as any)?.sourceContribution,
          diversityContribution: (i.scoring_breakdown as any)
            ?.diversityContribution,
          appliedContribution: (i.scoring_breakdown as any)?.appliedContribution,
          penalties: (i.scoring_breakdown as any)?.penalties,
          strengthCapsApplied: (i.scoring_breakdown as any)?.strengthCapsApplied,
          finalScore: (i.scoring_breakdown as any)?.finalScore,
          noneReason: (i.scoring_breakdown as any)?.noneReason,
          confidenceFinal: (i.scoring_breakdown as any)?.confidence?.final,
        },
      })),
    };
  }

  private toItemRow(
    evaluationId: string,
    skill: EvidenceSkillMetrics,
  ): Partial<CvEvidenceEvaluationItem> {
    return {
      evaluation_id: evaluationId,
      enrichment_item_id: skill.enrichmentItemId,
      extraction_skill_id: skill.extractionSkillId,
      normalized_name: skill.normalizedName,
      evidence_count: skill.evidenceCount,
      unique_evidence_count: skill.uniqueEvidenceCount,
      applied_evidence_count: skill.appliedEvidenceCount,
      substantive_evidence_count: skill.substantiveEvidenceCount,
      listing_evidence_count: skill.listingEvidenceCount,
      ambiguous_evidence_count: skill.ambiguousEvidenceCount,
      source_diversity: skill.sourceDiversity,
      repeated_mention_count: skill.repeatedMentionCount,
      has_work_experience: skill.hasWorkExperience,
      has_project: skill.hasProject,
      has_achievement: skill.hasAchievement,
      has_responsibility: skill.hasResponsibility,
      has_certification: skill.hasCertification,
      has_education: skill.hasEducation,
      has_profile_summary: skill.hasProfileSummary,
      has_skills_section: skill.hasSkillsSection,
      has_other: skill.hasOther,
      evidence_strength: skill.evidenceStrength.toFixed(2),
      evidence_confidence: skill.evidenceConfidence.toFixed(4),
      evidence_level: skill.evidenceLevel,
      quality_flags: skill.qualityFlags,
      source_breakdown: skill.sourceBreakdown,
      scoring_breakdown: skill.scoringBreakdown,
      explanation: skill.explanation,
    };
  }
}
