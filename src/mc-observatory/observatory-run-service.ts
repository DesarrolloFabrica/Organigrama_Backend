/**
 * ObservatoryRunService — orquestación dry-run / execute del piloto.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Client } from 'pg';
import type { McCvSnapshotService } from '../mc-pipeline/p0/mc-cv-snapshot.service';
import { P0SnapshotError } from '../mc-pipeline/p0/p0.errors';
import {
  ANCHOR_SNAPSHOT_IDS,
  FROZEN_P1_CONFIG,
} from './observatory.constants';import { frozenConfigFingerprint } from './config-fingerprint';
import { CohortSpecBuilder } from './cohort-spec-builder';
import {
  estimateSegmentationForSnapshot,
  loadAnchors,
  loadCandidatePool,
} from './candidate-pool';
import { tryReuseAnchorArtifact } from './anchor-artifact-reuse';
import { EvidenceSignatureExtractor } from './evidence-signature-extractor';
import {
  ObservatoryReportBuilder,
  buildAggregateMetrics,
} from './observatory-report-builder';
import { ObservatoryArtifactWriter } from './observatory-artifact-writer';
import { hashObject } from './hash';
import { pickReviewSampleIds, runP1ForMember } from './p1-member-runner';
import type {
  CohortSpec,
  DryRunPlan,
  ObservatoryRun,
  ObservatoryRunManifest,
  ObservatoryRunMemberResult,
  ObservatoryRunStatus,
  EvidenceSignature,
} from './observatory.types';

const BAD_PARSE = new Set([
  'SCANNED_OR_IMAGE_ONLY',
  'EMPTY_DOCUMENT',
  'FAILED',
  'UNSUPPORTED_FORMAT',
]);

export class ObservatoryRunService {
  constructor(
    private readonly backendRoot: string,
    private readonly client: Client,
  ) {}

  async buildDryRunPlan(): Promise<DryRunPlan> {
    const anchors = await loadAnchors(this.client, [...ANCHOR_SNAPSHOT_IDS]);
    const pool = await loadCandidatePool(this.client);
    const cohort = new CohortSpecBuilder().build({ anchors, pool });
    const configFingerprint = frozenConfigFingerprint(cohort.reproHash);

    const anchorReusePlan: DryRunPlan['anchorReusePlan'] = [];
    for (const id of ANCHOR_SNAPSHOT_IDS) {
      const reuse = tryReuseAnchorArtifact(this.backendRoot, id);
      anchorReusePlan.push({
        snapshotId: id,
        prototypeId: reuse.prototypeId,
        reusable: reuse.reusable,
        reason: reuse.reason,
      });
    }

    let estimatedBatches = 0;
    let estimatedP1Calls = 0;
    const membersNeedingP0: number[] = [];
    const membersWithExistingSnapshot: number[] = [];

    for (const m of cohort.members) {
      if (m.role === 'ANCHOR') {
        const plan = anchorReusePlan.find((p) => p.snapshotId === m.snapshotId);
        if (plan?.reusable) {
          // no Gemini call
          continue;
        }
        if (m.snapshotId) {
          const est = await estimateSegmentationForSnapshot(
            this.client,
            m.snapshotId,
          );
          if (est) {
            estimatedBatches += est.batchCount;
            estimatedP1Calls += est.batchCount;
          }
        }
        continue;
      }

      if (m.snapshotId) {
        membersWithExistingSnapshot.push(m.memberIndex);
        const est = await estimateSegmentationForSnapshot(
          this.client,
          m.snapshotId,
        );
        if (est) {
          estimatedBatches += est.batchCount;
          estimatedP1Calls += est.batchCount;
        } else {
          estimatedBatches += 4;
          estimatedP1Calls += 4;
        }
      } else {
        membersNeedingP0.push(m.memberIndex);
        estimatedBatches += 4;
        estimatedP1Calls += 4;
      }
    }

    const blockReasons: string[] = [];
    if (cohort.members.length !== 5) blockReasons.push('COHORT_SIZE');
    if (anchorReusePlan.some((a) => !a.reusable)) {
      // no bloquea — se reprocesarán
    }

    const plan: DryRunPlan = {
      planVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      cohortSpec: cohort,
      reproHash: cohort.reproHash,
      configFingerprint,
      mdeOk: true,
      anchorsOk: true,
      estimatedP1Calls,
      estimatedBatches,
      estimatedDurationMs: estimatedBatches * 18_000,
      membersNeedingP0,
      membersWithExistingSnapshot,
      anchorReusePlan,
      blocked: blockReasons.length > 0,
      blockReasons,
      notes: [
        'Dry-run did not download PDFs',
        'Dry-run did not call Gemini',
        'Execute requires --execute --confirm',
      ],
    };

    return plan;
  }

  async writeDryRunArtifacts(plan: DryRunPlan): Promise<string> {
    const root = ObservatoryArtifactWriter.resolveDryRunRoot(this.backendRoot);
    const writer = new ObservatoryArtifactWriter(root);
    writer.writeDryRunPlan(plan);
    return root;
  }

  loadDryRunPlan(): DryRunPlan {
    const path = join(
      ObservatoryArtifactWriter.resolveDryRunRoot(this.backendRoot),
      'dry-run-plan.json',
    );
    if (!existsSync(path)) throw new Error('DRY_RUN_PLAN_MISSING');
    return JSON.parse(readFileSync(path, 'utf8')) as DryRunPlan;
  }

  async execute(params: {
    apiKey: string;
    model: string;
    p0: McCvSnapshotService;
    dryRunPlan: DryRunPlan;
  }): Promise<ObservatoryRun> {
    const tAll = Date.now();
    const runId = `OBS-PILOT5-${new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14)}-${randomUUID().slice(0, 8)}`;
    const artifactRoot = ObservatoryArtifactWriter.resolveRunRoot(
      this.backendRoot,
      runId,
    );
    const writer = new ObservatoryArtifactWriter(artifactRoot);
    writer.ensureRoot();

    const cohort = params.dryRunPlan.cohortSpec;
    const configFingerprint = frozenConfigFingerprint(cohort.reproHash);
    const runSalt = hashObject({ runId, configFingerprint });
    const sigExtractor = new EvidenceSignatureExtractor();

    const memberResults: ObservatoryRunMemberResult[] = [];
    const signatures: EvidenceSignature[] = [];
    let totalRetries = 0;
    let failedBatchCount = 0;
    const durationPerMember: Record<string, number> = {};

    const startedAt = new Date().toISOString();
    let status: ObservatoryRunStatus = 'RUNNING';

    for (const member of cohort.members) {
      const tMember = Date.now();
      let snapshotId = member.snapshotId;
      let p0Outcome = member.p0Status;
      let parseStatus = member.snapshotStatus;
      let pageCount: number | null = member.selectionMetrics.pageCount;
      let characterCount: number | null =
        member.selectionMetrics.normalizedCharacterCount;
      let warningCount = member.selectionMetrics.warningCount ?? 0;
      let errorCode: string | null = null;

      // P0 for non-anchors (and anchors only if missing — shouldn't happen)
      if (member.role !== 'ANCHOR') {
        try {
          const p0res = await params.p0.createOrReuseFromPersonCv(
            member.personCvId,
          );
          snapshotId = p0res.snapshotId;
          p0Outcome = p0res.outcome;
          parseStatus = p0res.parseStatus;
          pageCount = p0res.pageCount;
          warningCount = p0res.warnings?.length ?? 0;
          if (BAD_PARSE.has(p0res.parseStatus)) {
            const result: ObservatoryRunMemberResult = {
              memberIndex: member.memberIndex,
              personCvId: member.personCvId,
              role: member.role,
              snapshotId,
              p0Outcome,
              p1Status: 'BLOCKED_BAD_SNAPSHOT',
              parseStatus,
              pageCount,
              characterCount: null,
              warningCount,
              candidateCount: 0,
              batchCount: 0,
              evidenceUnitCount: 0,
              durationMs: Date.now() - tMember,
              artifactChecksum: null,
              reusedPrototypeId: null,
              signature: null,
              reviewSampleIds: [],
              errorCode: p0res.parseStatus,
            };
            memberResults.push(result);
            durationPerMember[String(member.memberIndex)] = result.durationMs;
            status = 'PARTIAL';
            continue;
          }
        } catch (e) {
          const code =
            e instanceof P0SnapshotError
              ? e.code
              : 'P0_FAILED';
          const result: ObservatoryRunMemberResult = {
            memberIndex: member.memberIndex,
            personCvId: member.personCvId,
            role: member.role,
            snapshotId,
            p0Outcome: 'FAILED',
            p1Status: 'FAILED',
            parseStatus: null,
            pageCount: null,
            characterCount: null,
            warningCount: 0,
            candidateCount: 0,
            batchCount: 0,
            evidenceUnitCount: 0,
            durationMs: Date.now() - tMember,
            artifactChecksum: null,
            reusedPrototypeId: null,
            signature: null,
            reviewSampleIds: [],
            errorCode: code,
          };
          memberResults.push(result);
          durationPerMember[String(member.memberIndex)] = result.durationMs;
          status = 'PARTIAL';
          continue;
        }
      }

      // Anchor reuse
      if (member.role === 'ANCHOR' && snapshotId) {
        const reuse = tryReuseAnchorArtifact(this.backendRoot, snapshotId);
        if (reuse.reusable) {
          // enrich page/char from DB
          const snap = await this.loadSnapshotRow(snapshotId);
          pageCount = snap?.pageCount ?? pageCount;
          characterCount = snap?.characterCount ?? characterCount;
          const signature = sigExtractor.extract({
            snapshotId,
            configFingerprint,
            runSalt,
            pageCount: pageCount ?? 0,
            characterCount: characterCount ?? 0,
            candidateCount: reuse.candidateCount,
            batchCount: reuse.batchCount,
            units: reuse.units,
            decisions: reuse.decisions.values(),
            unsupportedSpanCount: reuse.unsupportedSpanCount,
            validationFailureCount: 0,
            warningCount: reuse.warningCount,
          });
          sigExtractor.assertNoPii(signature);
          signatures.push(signature);
          const result: ObservatoryRunMemberResult = {
            memberIndex: member.memberIndex,
            personCvId: member.personCvId,
            role: member.role,
            snapshotId,
            p0Outcome: 'REUSED',
            p1Status: 'REUSED_ARTIFACT',
            parseStatus,
            pageCount,
            characterCount,
            warningCount,
            candidateCount: reuse.candidateCount,
            batchCount: reuse.batchCount,
            evidenceUnitCount: reuse.units.length,
            durationMs: Date.now() - tMember,
            artifactChecksum: reuse.checksum,
            reusedPrototypeId: reuse.prototypeId,
            signature,
            reviewSampleIds: pickReviewSampleIds(reuse.units),
            errorCode: null,
          };
          memberResults.push(result);
          durationPerMember[String(member.memberIndex)] = result.durationMs;
          continue;
        }
        // fall through to reprocess
      }

      if (!snapshotId) {
        memberResults.push({
          memberIndex: member.memberIndex,
          personCvId: member.personCvId,
          role: member.role,
          snapshotId: null,
          p0Outcome,
          p1Status: 'FAILED',
          parseStatus,
          pageCount,
          characterCount,
          warningCount,
          candidateCount: 0,
          batchCount: 0,
          evidenceUnitCount: 0,
          durationMs: Date.now() - tMember,
          artifactChecksum: null,
          reusedPrototypeId: null,
          signature: null,
          reviewSampleIds: [],
          errorCode: 'SNAPSHOT_MISSING',
        });
        status = 'PARTIAL';
        continue;
      }

      const snap = await this.loadSnapshotRow(snapshotId);
      if (!snap?.normalizedText) {
        memberResults.push({
          memberIndex: member.memberIndex,
          personCvId: member.personCvId,
          role: member.role,
          snapshotId,
          p0Outcome,
          p1Status: 'FAILED',
          parseStatus,
          pageCount,
          characterCount,
          warningCount,
          candidateCount: 0,
          batchCount: 0,
          evidenceUnitCount: 0,
          durationMs: Date.now() - tMember,
          artifactChecksum: null,
          reusedPrototypeId: null,
          signature: null,
          reviewSampleIds: [],
          errorCode: 'SNAPSHOT_TEXT_MISSING',
        });
        status = 'PARTIAL';
        continue;
      }
      pageCount = snap.pageCount;
      characterCount = snap.characterCount;

      const prototypeId = `${runId}-m${member.memberIndex}`;
      const outDir = join(artifactRoot, 'confidential', `member-${member.memberIndex}`);
      const p1 = await runP1ForMember({
        prototypeId,
        snapshotId,
        normalizedText: snap.normalizedText,
        pages: snap.pages,
        sectionedContent: snap.sectionedContent,
        apiKey: params.apiKey,
        model: params.model,
        outDir,
      });
      totalRetries += p1.retries;
      failedBatchCount += p1.failedBatches;

      const signature = sigExtractor.extract({
        snapshotId,
        configFingerprint,
        runSalt,
        pageCount: pageCount ?? 0,
        characterCount: characterCount ?? 0,
        candidateCount: p1.candidateCount,
        batchCount: p1.batchCount,
        units: p1.units,
        decisions: p1.decisions.values(),
        unsupportedSpanCount: p1.unsupportedSpanCount,
        validationFailureCount: p1.failedBatches,
        warningCount,
      });
      sigExtractor.assertNoPii(signature);
      signatures.push(signature);

      if (p1.status !== 'COMPLETED') {
        status = 'PARTIAL';
        errorCode = p1.errorCode;
      }

      const result: ObservatoryRunMemberResult = {
        memberIndex: member.memberIndex,
        personCvId: member.personCvId,
        role: member.role,
        snapshotId,
        p0Outcome,
        p1Status:
          p1.status === 'COMPLETED'
            ? 'COMPLETED'
            : p1.status === 'PARTIAL'
              ? 'PARTIAL'
              : 'FAILED',
        parseStatus,
        pageCount,
        characterCount,
        warningCount,
        candidateCount: p1.candidateCount,
        batchCount: p1.batchCount,
        evidenceUnitCount: p1.units.length,
        durationMs: Date.now() - tMember,
        artifactChecksum: null,
        reusedPrototypeId: null,
        signature,
        reviewSampleIds: pickReviewSampleIds(p1.units),
        errorCode,
      };
      memberResults.push(result);
      durationPerMember[String(member.memberIndex)] = result.durationMs;
    }

    const totalDurationMs = Date.now() - tAll;
    const aggregates = buildAggregateMetrics(
      memberResults,
      totalDurationMs,
      totalRetries,
      failedBatchCount,
      null,
    );

    if (status === 'RUNNING') {
      status =
        aggregates.membersFailed > 0 || aggregates.membersPartial > 0
          ? 'PARTIAL'
          : aggregates.unsupportedSpanCount > 0
            ? 'COMPLETED_WITH_WARNINGS'
            : 'COMPLETED';
    }

    const completedAt = new Date().toISOString();
    const manifest: ObservatoryRunManifest = {
      observatoryRunId: runId,
      operationType: 'OBSERVATORY_PILOT',
      cohortCode: cohort.cohortCode,
      cohortVersion: cohort.cohortVersion,
      cohortReproHash: cohort.reproHash,
      configFingerprint,
      frozenConfig: { ...FROZEN_P1_CONFIG },
      startedAt,
      completedAt,
      status,
      publisherInvoked: false,
      p2Invoked: false,
      databasePersistence: false,
      dryRunPlanHash: params.dryRunPlan.reproHash,
      artifactRoot,
    };

    const reports = new ObservatoryReportBuilder().buildAll({
      cohort,
      members: memberResults,
      aggregates,
      signatures,
      durationPerMember,
    });

    await writer.writeRunBundle({
      cohortSpec: cohort,
      dryRunPlan: params.dryRunPlan,
      runManifest: manifest,
      memberResults,
      signatures,
      aggregateMetrics: aggregates,
      reports,
      executionSummary: {
        observatoryRunId: runId,
        status,
        membersCompleted: aggregates.membersCompleted,
        membersPartial: aggregates.membersPartial,
        totalBatches: aggregates.totalBatches,
        retries: aggregates.totalRetries,
        durationMs: totalDurationMs,
        publisherInvoked: false,
        p2Invoked: false,
        databasePersistence: false,
      },
    });

    return {
      manifest,
      memberResults,
      aggregateMetrics: aggregates,
      reports,
    };
  }

  private async loadSnapshotRow(snapshotId: string): Promise<{
    pageCount: number;
    characterCount: number;
    normalizedText: string;
    pages: unknown;
    sectionedContent: unknown;
  } | null> {
    const res = await this.client.query(
      `SELECT page_count,
              CASE WHEN normalized_text IS NULL THEN NULL ELSE length(normalized_text) END AS char_count,
              normalized_text,
              pages,
              sectioned_content
         FROM organigrama.mc_cv_snapshot WHERE id = $1`,
      [Number(snapshotId)],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      pageCount: Number(row.page_count ?? 0),
      characterCount: Number(row.char_count ?? 0),
      normalizedText: row.normalized_text,
      pages:
        typeof row.pages === 'string' ? JSON.parse(row.pages) : row.pages,
      sectionedContent:
        typeof row.sectioned_content === 'string'
          ? JSON.parse(row.sectioned_content)
          : row.sectioned_content,
    };
  }
}

export function redactCohortForConsole(cohort: CohortSpec): Record<string, unknown> {
  return {
    cohortCode: cohort.cohortCode,
    cohortVersion: cohort.cohortVersion,
    reproHash: cohort.reproHash,
    members: cohort.members.map((m) => ({
      memberIndex: m.memberIndex,
      role: m.role,
      personCvId: m.personCvId,
      snapshotId: m.snapshotId,
      selectionReasonCode: m.selectionReasonCode,
      pageCount: m.selectionMetrics.pageCount,
      charCount: m.selectionMetrics.normalizedCharacterCount,
      diversityScore: m.selectionMetrics.diversityScore,
      edgeScore: m.selectionMetrics.edgeScore,
      fileSizeBytes: m.selectionMetrics.fileSizeBytes,
    })),
  };
}
