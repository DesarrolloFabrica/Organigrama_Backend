/**
 * Orquesta dry-run o persistencia del Enricher sin mezclar Gemini en el
 * PersistenceService.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  CV_SKILLS_ENRICHER_BLOCK_CONFIG_VERSION,
  CV_SKILLS_ENRICHER_PROMPT_VERSION,
  CV_SKILLS_ENRICHER_VERSION,
  DEFAULT_ENRICHER_BLOCK_SIZE,
  DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS,
  DEFAULT_ENRICHER_MAX_MICRO_RETRY_ATTEMPTS,
  DEFAULT_ENRICHER_MICRO_RETRY_SIZE,
  DEFAULT_ENRICHER_PARALLELISM,
  MISSING_SKILL_FILLED_EMPTY,
} from './cv-skills-enrichment.constants';
import {
  buildBlockConfigSnapshot,
  computeBlockConfigHash,
  computeInventoryHash,
} from './cv-skills-enrichment.hash';
import { partitionSkillsIntoBlocks } from './cv-skills-enrichment.blocks';
import {
  CvSkillsEnrichmentOrchestratorService,
  EnrichmentOrchestratorOptions,
} from './cv-skills-enrichment-orchestrator.service';
import { CvSkillsEnrichmentPersistenceService } from './cv-skills-enrichment-persistence.service';
import {
  CvSkillsEnrichmentPersistenceError,
  PersistRunOutcome,
} from './cv-skills-enrichment-persistence.types';
import type {
  EnrichmentArtifact,
  EnrichmentBlockConfig,
  EnrichmentInputSkill,
  EnrichmentOutputSkill,
  EnrichmentRunInput,
} from './cv-skills-enrichment.types';
import type { EnrichmentItemStatus } from './entities/cv-skill-enrichment-item.entity';
import type { EnrichmentBlockAttemptStatus } from './entities/cv-skill-enrichment-block.entity';

export interface PersistEnrichmentOptions {
  pdfBuffer: Buffer;
  input: EnrichmentRunInput & {
    extractionId: string;
    personId: number;
    personCvId: string | number;
  };
  model?: string;
  blockConfig?: Partial<EnrichmentBlockConfig>;
  activate?: boolean;
}

function resolveBlockConfig(
  partial?: Partial<EnrichmentBlockConfig>,
): EnrichmentBlockConfig {
  return {
    blockSize: partial?.blockSize ?? DEFAULT_ENRICHER_BLOCK_SIZE,
    parallelism: partial?.parallelism ?? DEFAULT_ENRICHER_PARALLELISM,
    maxBlockAttempts:
      partial?.maxBlockAttempts ?? DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS,
    microRetrySize:
      partial?.microRetrySize ?? DEFAULT_ENRICHER_MICRO_RETRY_SIZE,
    maxMicroRetryAttempts:
      partial?.maxMicroRetryAttempts ??
      DEFAULT_ENRICHER_MAX_MICRO_RETRY_ATTEMPTS,
  };
}

function mapAttemptStatus(
  errors: Array<{ code?: string }> | undefined,
  ok: boolean,
): EnrichmentBlockAttemptStatus {
  if (ok) return 'SUCCEEDED';
  const codes = (errors || []).map((e) => e.code || '');
  if (codes.some((c) => c === 'GEMINI_ERROR')) return 'TRANSIENT_ERROR';
  if (codes.length > 0) return 'IDENTITY_ERROR';
  return 'FAILED';
}

function itemStatus(skill: EnrichmentOutputSkill, filled: boolean): EnrichmentItemStatus {
  if (filled) return 'FILLED_EMPTY';
  if ((skill.evidenceItems?.length ?? 0) === 0) return 'EMPTY';
  return 'OK';
}

@Injectable()
export class CvSkillsEnrichmentPersistRunnerService {
  private readonly logger = new Logger(
    CvSkillsEnrichmentPersistRunnerService.name,
  );

  constructor(
    private readonly orchestrator: CvSkillsEnrichmentOrchestratorService,
    private readonly persistence: CvSkillsEnrichmentPersistenceService,
  ) {}

  async runPersist(
    options: PersistEnrichmentOptions,
  ): Promise<{ outcome: PersistRunOutcome; artifact: EnrichmentArtifact | null }> {
    const input = options.input;
    if (!input.extractionId) {
      throw new CvSkillsEnrichmentPersistenceError(
        'Persistencia requiere extractionId (inventario DATABASE).',
      );
    }
    if (input.skills.some((s) => s.syntheticExtractionSkillId)) {
      throw new CvSkillsEnrichmentPersistenceError(
        'No se puede persistir inventario ARTIFACT con IDs sintéticos.',
      );
    }

    const config = resolveBlockConfig(options.blockConfig);
    const model =
      options.model?.trim() ||
      // resolve via orchestrator path: enrichment service inside orchestrator
      undefined;

    const hash = computeInventoryHash(input.skills);
    const blockConfigHash = computeBlockConfigHash(config);
    const blocks = partitionSkillsIntoBlocks(input.skills, config.blockSize);

    // Model se resuelve en runDry; para idempotencia necesitamos el mismo.
    // Pre-resolvemos con un dry probe via orchestrator options después.
    const orchOptions: EnrichmentOrchestratorOptions = {
      pdfBuffer: options.pdfBuffer,
      input,
      model: options.model,
      blockConfig: config,
    };

    // Ejecutamos un path que obtiene model efectivo sin Gemini: duplicamos resolve.
    // El orchestrator usa enrichment.resolveModel — lo obtenemos tras run o vía artifact meta.
    // Para idempotencia pre-Gemini: usamos el model CLI o default del servicio.
    const resolvedModel = await this.resolveModelForIdempotency(options.model);

    const idempotent = await this.persistence.findIdempotentSucceededRun({
      extractionId: input.extractionId,
      pdfSha256: input.pdfSha256,
      inventoryHash: hash.inventoryHash,
      model: resolvedModel,
      promptVersion: CV_SKILLS_ENRICHER_PROMPT_VERSION,
      enricherVersion: CV_SKILLS_ENRICHER_VERSION,
      blockConfigHash,
    });

    if (idempotent) {
      this.logger.log(
        `ALREADY_SUCCEEDED enrichmentId=${idempotent.id}; no se llama Gemini.`,
      );
      let activated = idempotent.is_active;
      if (options.activate && !idempotent.is_active) {
        const act = await this.persistence.activateSucceededRun(idempotent.id);
        activated = act.activated;
      }
      return {
        outcome: {
          outcome: 'ALREADY_SUCCEEDED',
          enrichmentId: idempotent.id,
          status: idempotent.status,
          isActive: activated,
          activated: options.activate ? activated : idempotent.is_active,
          skippedGemini: true,
          metrics: idempotent.metrics,
          warnings: idempotent.warnings,
        },
        artifact: null,
      };
    }

    const pending = await this.persistence.createPendingRun({
      extractionId: input.extractionId,
      personId: input.personId,
      personCvId: input.personCvId,
      pdfSha256: input.pdfSha256,
      inventoryHash: hash.inventoryHash,
      model: resolvedModel,
      promptVersion: CV_SKILLS_ENRICHER_PROMPT_VERSION,
      enricherVersion: CV_SKILLS_ENRICHER_VERSION,
      blockConfigVersion: CV_SKILLS_ENRICHER_BLOCK_CONFIG_VERSION,
      blockConfig: buildBlockConfigSnapshot(config),
      blockConfigHash,
      inputSkillsCount: input.skills.length,
      blocksTotal: blocks.length,
    });

    await this.persistence.markRunning(pending.id);

    let artifact: EnrichmentArtifact | null = null;
    try {
      artifact = await this.orchestrator.runDry({
        ...orchOptions,
        model: resolvedModel,
        hooks: {
          onBlockAttempt: async (event) => {
            await this.persistence.appendBlockAttempt({
              enrichmentId: pending.id,
              blockNumber: event.blockNumber,
              attemptNumber: event.attemptNumber,
              attemptType: event.attemptType,
              inputSkillIds: event.inputSkillIds,
              status: mapAttemptStatus(
                event.validationErrors,
                event.ok,
              ),
              rawResponse: event.rawResponse,
              validationErrors: event.validationErrors ?? null,
              validationWarnings: event.validationWarnings ?? null,
              durationMs: event.durationMs,
              startedAt: event.startedAt,
              completedAt: event.completedAt,
            });
          },
        },
      });

      // Si el model efectivo difiere (no debería), registrar warning
      if (artifact.meta.model !== resolvedModel) {
        artifact.warnings.push(
          `MODEL_RESOLVE_DRIFT: pre=${resolvedModel} post=${artifact.meta.model}`,
        );
      }

      if (artifact.meta.status === 'FAILED') {
        await this.persistence.failRun({
          enrichmentId: pending.id,
          errorStage: 'enricher',
          errorCode: 'RUN_FAILED',
          errorMessage:
            artifact.warnings.find((w) => w.startsWith('FAILED:')) ||
            'Enricher FAILED',
          attemptsTotal: artifact.metrics.geminiCalls,
          warnings: artifact.warnings,
        });
        return {
          outcome: {
            outcome: 'FAILED',
            enrichmentId: pending.id,
            status: 'FAILED',
            isActive: false,
            activated: false,
            skippedGemini: false,
            metrics: artifact.metrics,
            warnings: artifact.warnings,
          },
          artifact,
        };
      }

      const filledIds = new Set(
        artifact.validatedResult.skills
          .filter((s) =>
            (s.warnings || []).includes(MISSING_SKILL_FILLED_EMPTY),
          )
          .map((s) => s.extractionSkillId),
      );

      const items = artifact.validatedResult.skills.map((s) => {
        const filled = filledIds.has(s.extractionSkillId);
        const sourceTypes = [
          ...new Set((s.evidenceItems || []).map((e) => e.sourceType)),
        ];
        return {
          extractionSkillId: s.extractionSkillId,
          normalizedName: s.normalizedName,
          evidenceItems: (s.evidenceItems || []) as unknown as Record<
            string,
            unknown
          >[],
          sourceTypes,
          warnings: s.warnings?.length ? s.warnings : null,
          status: itemStatus(s, filled),
          wasFilledEmpty: filled,
        };
      });

      const blocksSucceeded = artifact.blocks.filter(
        (b) => b.finalStatus === 'SUCCEEDED',
      ).length;
      const blocksFailed = artifact.blocks.filter(
        (b) => b.finalStatus === 'FAILED',
      ).length;
      const attemptsTotal = artifact.blocks.reduce(
        (acc, b) => acc + b.attempts.length,
        0,
      );

      const completePayload = {
        enrichmentId: pending.id,
        items,
        metrics: artifact.metrics,
        warnings: artifact.warnings,
        validatedResultJson: {
          skills: artifact.validatedResult.skills,
        },
        blocksSucceeded,
        blocksFailed,
        attemptsTotal,
        expectedSkills: input.skills.map((s) => ({
          extractionSkillId: s.extractionSkillId,
          normalizedName: s.normalizedName,
        })),
      };

      let completed;
      if (artifact.meta.status === 'PARTIAL' || filledIds.size > 0) {
        completed = await this.persistence.completePartial(completePayload);
      } else {
        completed = await this.persistence.completeSucceeded(completePayload);
      }

      let activated = false;
      if (options.activate) {
        if (completed.status !== 'SUCCEEDED') {
          this.logger.warn(
            `Activate solicitado pero status=${completed.status}; no se activa.`,
          );
        } else {
          const act = await this.persistence.activateSucceededRun(completed.id);
          activated = act.activated;
        }
      }

      return {
        outcome: {
          outcome: completed.status === 'PARTIAL' ? 'PARTIAL' : 'SUCCEEDED',
          enrichmentId: completed.id,
          status: completed.status,
          isActive: activated || completed.is_active,
          activated,
          skippedGemini: false,
          metrics: artifact.metrics,
          warnings: artifact.warnings,
        },
        artifact,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Persist run falló: ${message}`);
      try {
        await this.persistence.failRun({
          enrichmentId: pending.id,
          errorStage: 'persist_runner',
          errorCode: 'EXCEPTION',
          errorMessage: message,
        });
      } catch (failError) {
        this.logger.error(
          `No se pudo marcar FAILED id=${pending.id}: ${
            failError instanceof Error ? failError.message : failError
          }`,
        );
      }
      throw error;
    }
  }

  private async resolveModelForIdempotency(
    model?: string,
  ): Promise<string> {
    // Acceso indirecto: el orchestrator/enrichment resuelve el default.
    // Para no acoplar, reutilizamos runDry no es viable; importamos el servicio.
    // El PersistRunner está en el mismo módulo — inyectamos vía orchestrator interno.
    return this.orchestrator.resolveModelPublic(model);
  }
}

/** Re-export helper tipado para tests. */
export function buildItemsFromSkills(
  skills: EnrichmentOutputSkill[],
  input: EnrichmentInputSkill[],
): Array<{
  extractionSkillId: string;
  normalizedName: string;
  wasFilledEmpty: boolean;
}> {
  const filled = new Set(
    skills
      .filter((s) => (s.warnings || []).includes(MISSING_SKILL_FILLED_EMPTY))
      .map((s) => s.extractionSkillId),
  );
  return skills.map((s) => ({
    extractionSkillId: s.extractionSkillId,
    normalizedName: s.normalizedName,
    wasFilledEmpty: filled.has(s.extractionSkillId),
  }));
}
