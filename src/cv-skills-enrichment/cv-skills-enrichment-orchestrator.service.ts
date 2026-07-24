import { Injectable, Logger } from '@nestjs/common';
import {
  EnrichmentEmptyInventoryError,
  partitionSkillsIntoBlocks,
} from './cv-skills-enrichment.blocks';
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
import { computeInventoryHash } from './cv-skills-enrichment.hash';
import {
  CvSkillsEnrichmentService,
  EnrichmentGeminiError,
} from './cv-skills-enrichment.service';
import { validateEnrichmentBlockResponse } from './cv-skills-enrichment.validation';
import type {
  EnrichmentArtifact,
  EnrichmentBlockArtifact,
  EnrichmentBlockAttemptArtifact,
  EnrichmentBlockConfig,
  EnrichmentInputSkill,
  EnrichmentOutputSkill,
  EnrichmentRunInput,
  EnrichmentRunMetrics,
  EnrichmentRunStatus,
  BlockValidationIssue,
} from './cv-skills-enrichment.types';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function backoffMs(attempt: number): number {
  return Math.min(2000 * attempt, 6000);
}

export interface EnrichmentOrchestratorOptions {
  pdfBuffer: Buffer;
  input: EnrichmentRunInput;
  model?: string;
  blockConfig?: Partial<EnrichmentBlockConfig>;
  hooks?: EnrichmentRunHooks;
}

export interface EnrichmentBlockAttemptEvent {
  blockNumber: number;
  attemptNumber: number;
  attemptType: 'BLOCK' | 'MICRO_RETRY';
  inputSkillIds: string[];
  ok: boolean;
  rawResponse: unknown;
  validationErrors?: BlockValidationIssue[];
  validationWarnings?: string[];
  durationMs: number;
  startedAt: string;
  completedAt: string;
}

export interface EnrichmentRunHooks {
  onBlockAttempt?: (event: EnrichmentBlockAttemptEvent) => Promise<void>;
}

@Injectable()
export class CvSkillsEnrichmentOrchestratorService {
  private readonly logger = new Logger(
    CvSkillsEnrichmentOrchestratorService.name,
  );

  constructor(private readonly enrichment: CvSkillsEnrichmentService) {}

  /** Expone resolveModel para idempotencia pre-Gemini sin duplicar defaults. */
  resolveModelPublic(model?: string): string {
    return this.enrichment.resolveModel(model);
  }

  async runDry(
    options: EnrichmentOrchestratorOptions,
  ): Promise<EnrichmentArtifact> {
    const startedAt = new Date();
    const config: EnrichmentBlockConfig = {
      blockSize: options.blockConfig?.blockSize ?? DEFAULT_ENRICHER_BLOCK_SIZE,
      parallelism:
        options.blockConfig?.parallelism ?? DEFAULT_ENRICHER_PARALLELISM,
      maxBlockAttempts:
        options.blockConfig?.maxBlockAttempts ??
        DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS,
      microRetrySize:
        options.blockConfig?.microRetrySize ??
        DEFAULT_ENRICHER_MICRO_RETRY_SIZE,
      maxMicroRetryAttempts:
        options.blockConfig?.maxMicroRetryAttempts ??
        DEFAULT_ENRICHER_MAX_MICRO_RETRY_ATTEMPTS,
    };

    const model = this.enrichment.resolveModel(options.model);
    const hash = computeInventoryHash(options.input.skills);
    const warnings: string[] = [];
    const blocksArtifact: EnrichmentBlockArtifact[] = [];
    const outputById = new Map<string, EnrichmentOutputSkill>();
    const filledEmptyIds = new Set<string>();
    const hooks = options.hooks;

    let geminiCalls = 0;
    let blockRetries = 0;
    let microRetryCalls = 0;
    let unknownSkillsReturned = 0;
    let duplicateSkillsReturned = 0;

    let status: EnrichmentRunStatus = 'RUNNING';
    let fatalError: string | undefined;

    try {
      if (options.input.skills.length === 0) {
        throw new EnrichmentEmptyInventoryError();
      }

      const blocks = partitionSkillsIntoBlocks(
        options.input.skills,
        config.blockSize,
      );

      for (let bi = 0; bi < blocks.length; bi++) {
        const blockSkills = blocks[bi];
        const blockNumber = bi + 1;
        const attempts: EnrichmentBlockAttemptArtifact[] = [];
        let blockOk = false;
        let lastErrors: BlockValidationIssue[] = [];

        for (let attempt = 1; attempt <= config.maxBlockAttempts; attempt++) {
          if (attempt > 1) {
            blockRetries += 1;
            await sleep(backoffMs(attempt - 1));
          }
          const attemptStarted = new Date();
          try {
            geminiCalls += 1;
            const { raw } = await this.enrichment.enrichBlock({
              pdfBuffer: options.pdfBuffer,
              skills: blockSkills,
              model,
            });
            const validated = validateEnrichmentBlockResponse(
              blockSkills,
              raw,
            );
            unknownSkillsReturned += validated.unknownSkillsReturned;
            duplicateSkillsReturned += validated.duplicateSkillsReturned;
            warnings.push(...validated.warnings);

            const durationMs = Date.now() - attemptStarted.getTime();
            const completedAt = new Date().toISOString();
            attempts.push({
              attemptNumber: attempt,
              startedAt: attemptStarted.toISOString(),
              durationMs,
              rawResponse: raw,
              validationErrors: validated.identityErrors,
              validationWarnings: validated.warnings,
            });

            if (hooks?.onBlockAttempt) {
              await hooks.onBlockAttempt({
                blockNumber,
                attemptNumber: attempt,
                attemptType: 'BLOCK',
                inputSkillIds: blockSkills.map((s) => s.extractionSkillId),
                ok: validated.ok,
                rawResponse: raw,
                validationErrors: validated.identityErrors,
                validationWarnings: validated.warnings,
                durationMs,
                startedAt: attemptStarted.toISOString(),
                completedAt,
              });
            }

            if (validated.ok) {
              for (const s of validated.skills) {
                outputById.set(s.extractionSkillId, s);
              }
              blockOk = true;
              break;
            }
            lastErrors = validated.identityErrors;
            this.logger.warn(
              `Bloque ${blockNumber} intento ${attempt} integridad fallida: ${validated.identityErrors.map((e) => e.code).join(',')}`,
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            const durationMs = Date.now() - attemptStarted.getTime();
            const completedAt = new Date().toISOString();
            attempts.push({
              attemptNumber: attempt,
              startedAt: attemptStarted.toISOString(),
              durationMs,
              rawResponse: null,
              validationErrors: [
                { code: 'GEMINI_ERROR', message },
              ],
              validationWarnings: [],
            });
            if (hooks?.onBlockAttempt) {
              await hooks.onBlockAttempt({
                blockNumber,
                attemptNumber: attempt,
                attemptType: 'BLOCK',
                inputSkillIds: blockSkills.map((s) => s.extractionSkillId),
                ok: false,
                rawResponse: null,
                validationErrors: [{ code: 'GEMINI_ERROR', message }],
                validationWarnings: [],
                durationMs,
                startedAt: attemptStarted.toISOString(),
                completedAt,
              });
            }
            lastErrors = [{ code: 'GEMINI_ERROR', message }];
            if (!(error instanceof EnrichmentGeminiError)) {
              // seguir reintentando errores transitorios
            }
          }
        }

        if (blockOk) {
          blocksArtifact.push({
            blockNumber,
            inputSkillIds: blockSkills.map((s) => s.extractionSkillId),
            attempts,
            finalStatus: 'SUCCEEDED',
          });
          continue;
        }

        // Micro-reintentos para skills faltantes / conflictivas
        const missingIds = new Set(
          lastErrors
            .map((e) => e.extractionSkillId)
            .filter((id): id is string => !!id),
        );
        for (const s of blockSkills) {
          if (!outputById.has(s.extractionSkillId)) {
            missingIds.add(s.extractionSkillId);
          }
        }

        const missingSkills = blockSkills.filter((s) =>
          missingIds.has(s.extractionSkillId),
        );

        blocksArtifact.push({
          blockNumber,
          inputSkillIds: blockSkills.map((s) => s.extractionSkillId),
          attempts,
          finalStatus: missingSkills.length > 0 ? 'MICRO_RETRY' : 'FAILED',
        });

        for (
          let mi = 0;
          mi < missingSkills.length;
          mi += config.microRetrySize
        ) {
          const micro = missingSkills.slice(mi, mi + config.microRetrySize);
          let microOk = false;
          for (
            let attempt = 1;
            attempt <= config.maxMicroRetryAttempts;
            attempt++
          ) {
            if (attempt > 1) await sleep(backoffMs(attempt));
            const attemptStarted = new Date();
            const microAttemptNumber =
              blocksArtifact[blocksArtifact.length - 1].attempts.length + 1;
            try {
              geminiCalls += 1;
              microRetryCalls += 1;
              const { raw } = await this.enrichment.enrichBlock({
                pdfBuffer: options.pdfBuffer,
                skills: micro,
                model,
              });
              const validated = validateEnrichmentBlockResponse(micro, raw);
              unknownSkillsReturned += validated.unknownSkillsReturned;
              duplicateSkillsReturned += validated.duplicateSkillsReturned;
              warnings.push(...validated.warnings);
              const durationMs = Date.now() - attemptStarted.getTime();
              const completedAt = new Date().toISOString();
              blocksArtifact[blocksArtifact.length - 1].attempts.push({
                attemptNumber: microAttemptNumber,
                startedAt: attemptStarted.toISOString(),
                durationMs,
                rawResponse: raw,
                validationErrors: validated.identityErrors,
                validationWarnings: validated.warnings,
              });
              if (hooks?.onBlockAttempt) {
                await hooks.onBlockAttempt({
                  blockNumber,
                  attemptNumber: microAttemptNumber,
                  attemptType: 'MICRO_RETRY',
                  inputSkillIds: micro.map((s) => s.extractionSkillId),
                  ok: validated.ok,
                  rawResponse: raw,
                  validationErrors: validated.identityErrors,
                  validationWarnings: validated.warnings,
                  durationMs,
                  startedAt: attemptStarted.toISOString(),
                  completedAt,
                });
              }
              if (validated.ok) {
                for (const s of validated.skills) {
                  outputById.set(s.extractionSkillId, s);
                }
                microOk = true;
                break;
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : String(error);
              const durationMs = Date.now() - attemptStarted.getTime();
              const completedAt = new Date().toISOString();
              blocksArtifact[blocksArtifact.length - 1].attempts.push({
                attemptNumber: microAttemptNumber,
                startedAt: attemptStarted.toISOString(),
                durationMs,
                rawResponse: null,
                validationErrors: [{ code: 'GEMINI_ERROR', message }],
                validationWarnings: [],
              });
              if (hooks?.onBlockAttempt) {
                await hooks.onBlockAttempt({
                  blockNumber,
                  attemptNumber: microAttemptNumber,
                  attemptType: 'MICRO_RETRY',
                  inputSkillIds: micro.map((s) => s.extractionSkillId),
                  ok: false,
                  rawResponse: null,
                  validationErrors: [{ code: 'GEMINI_ERROR', message }],
                  validationWarnings: [],
                  durationMs,
                  startedAt: attemptStarted.toISOString(),
                  completedAt,
                });
              }
            }          }
          if (!microOk) {
            for (const s of micro) {
              if (!outputById.has(s.extractionSkillId)) {
                filledEmptyIds.add(s.extractionSkillId);
                outputById.set(s.extractionSkillId, {
                  extractionSkillId: s.extractionSkillId,
                  normalizedName: s.normalizedName,
                  evidenceItems: [],
                  warnings: [MISSING_SKILL_FILLED_EMPTY],
                });
                warnings.push(
                  `${MISSING_SKILL_FILLED_EMPTY}: ${s.extractionSkillId} (${s.normalizedName})`,
                );
              }
            }
          }
        }
      }

      // Asegurar orden del input original (tras sort de bloques)
      const orderedInput = [...options.input.skills].sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.extractionSkillId.localeCompare(b.extractionSkillId, 'en');
      });

      for (const s of orderedInput) {
        if (!outputById.has(s.extractionSkillId)) {
          filledEmptyIds.add(s.extractionSkillId);
          outputById.set(s.extractionSkillId, {
            extractionSkillId: s.extractionSkillId,
            normalizedName: s.normalizedName,
            evidenceItems: [],
            warnings: [MISSING_SKILL_FILLED_EMPTY],
          });
          warnings.push(
            `${MISSING_SKILL_FILLED_EMPTY}: ${s.extractionSkillId} (${s.normalizedName})`,
          );
        }
      }

      const validatedSkills = orderedInput.map(
        (s) => outputById.get(s.extractionSkillId)!,
      );

      if (filledEmptyIds.size > 0) {
        status = 'PARTIAL';
      } else if (validatedSkills.length === orderedInput.length) {
        status = 'SUCCEEDED';
      } else {
        status = 'FAILED';
        fatalError = 'No se pudo construir resultado completo.';
      }

      const finishedAt = new Date();
      const metrics = this.buildMetrics({
        input: orderedInput,
        output: validatedSkills,
        filledEmpty: filledEmptyIds.size,
        unknownSkillsReturned,
        duplicateSkillsReturned,
        warnings,
        geminiCalls,
        blockRetries,
        microRetryCalls,
      });

      return {
        meta: {
          document: options.input.document,
          pdfSha256: options.input.pdfSha256,
          inventoryHash: hash.inventoryHash,
          inventoryInputCount: options.input.skills.length,
          model,
          promptVersion: CV_SKILLS_ENRICHER_PROMPT_VERSION,
          enricherVersion: CV_SKILLS_ENRICHER_VERSION,
          blockConfigVersion: CV_SKILLS_ENRICHER_BLOCK_CONFIG_VERSION,
          blockSize: config.blockSize,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          status,
        },
        inventory: {
          source: options.input.inventorySource,
          skills: orderedInput,
          hash,
        },
        blocks: blocksArtifact,
        validatedResult: { skills: validatedSkills },
        metrics,
        warnings,
      };
    } catch (error) {
      status = 'FAILED';
      fatalError =
        error instanceof Error ? error.message : String(error);
      warnings.push(`FAILED: ${fatalError}`);
      const finishedAt = new Date();
      return {
        meta: {
          document: options.input.document,
          pdfSha256: options.input.pdfSha256,
          inventoryHash: hash.inventoryHash,
          inventoryInputCount: options.input.skills.length,
          model,
          promptVersion: CV_SKILLS_ENRICHER_PROMPT_VERSION,
          enricherVersion: CV_SKILLS_ENRICHER_VERSION,
          blockConfigVersion: CV_SKILLS_ENRICHER_BLOCK_CONFIG_VERSION,
          blockSize: config.blockSize,
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          durationMs: finishedAt.getTime() - startedAt.getTime(),
          status,
        },
        inventory: {
          source: options.input.inventorySource,
          skills: options.input.skills,
          hash,
        },
        blocks: blocksArtifact,
        validatedResult: { skills: [] },
        metrics: this.buildMetrics({
          input: options.input.skills,
          output: [],
          filledEmpty: 0,
          unknownSkillsReturned,
          duplicateSkillsReturned,
          warnings,
          geminiCalls,
          blockRetries,
          microRetryCalls,
        }),
        warnings,
      };
    }
  }

  private buildMetrics(params: {
    input: EnrichmentInputSkill[];
    output: EnrichmentOutputSkill[];
    filledEmpty: number;
    unknownSkillsReturned: number;
    duplicateSkillsReturned: number;
    warnings: string[];
    geminiCalls: number;
    blockRetries: number;
    microRetryCalls: number;
  }): EnrichmentRunMetrics {
    const sourceTypeCounts: Record<string, number> = {};
    let totalEvidenceItems = 0;
    let skillsWithEvidence = 0;
    let onlySkillsSectionCount = 0;
    let workExperienceCount = 0;
    let projectCount = 0;
    let exactIdentityMatches = 0;

    const inputById = new Map(
      params.input.map((s) => [s.extractionSkillId, s] as const),
    );

    for (const s of params.output) {
      const expected = inputById.get(s.extractionSkillId);
      if (expected && expected.normalizedName === s.normalizedName) {
        exactIdentityMatches += 1;
      }
      const items = s.evidenceItems || [];
      totalEvidenceItems += items.length;
      if (items.length > 0) skillsWithEvidence += 1;
      const types = new Set(items.map((e) => e.sourceType));
      if (types.size === 1 && types.has('SKILLS_SECTION')) {
        onlySkillsSectionCount += 1;
      }
      if (types.has('WORK_EXPERIENCE')) workExperienceCount += 1;
      if (types.has('PROJECT')) projectCount += 1;
      for (const e of items) {
        sourceTypeCounts[e.sourceType] =
          (sourceTypeCounts[e.sourceType] || 0) + 1;
      }
    }

    return {
      inputSkills: params.input.length,
      outputSkills: params.output.length,
      exactIdentityMatches,
      missingFilledEmpty: params.filledEmpty,
      unknownSkillsReturned: params.unknownSkillsReturned,
      duplicateSkillsReturned: params.duplicateSkillsReturned,
      skillsWithEvidence,
      skillsWithoutEvidence: params.output.length - skillsWithEvidence,
      totalEvidenceItems,
      averageEvidenceItems: params.output.length
        ? +(totalEvidenceItems / params.output.length).toFixed(2)
        : 0,
      sourceTypeCounts,
      onlySkillsSectionCount,
      workExperienceCount,
      projectCount,
      warningsCount: params.warnings.length,
      geminiCalls: params.geminiCalls,
      blockRetries: params.blockRetries,
      microRetryCalls: params.microRetryCalls,
    };
  }
}
