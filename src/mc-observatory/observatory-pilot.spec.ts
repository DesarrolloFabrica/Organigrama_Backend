/**
 * Tests unitarios Evidence Observatory Pilot (FASE 5G.1).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CohortSpecBuilder,
  computeReproHash,
  isEligibleCandidate,
} from './cohort-spec-builder';
import { computeConfigFingerprint, frozenConfigFingerprint } from './config-fingerprint';
import { EvidenceSignatureExtractor } from './evidence-signature-extractor';
import {
  buildAggregateMetrics,
  detectOutliers,
  ObservatoryReportBuilder,
} from './observatory-report-builder';
import { ObservatoryArtifactWriter } from './observatory-artifact-writer';
import { ObservatoryRunDiff } from './observatory-run-diff';
import {
  assertExecuteFlags,
  evaluateGuardrails,
} from './observatory-guardrails';
import { pageCountBucket, characterCountBucket } from './buckets';
import {
  COHORT_CODE,
  COHORT_VERSION,
  FROZEN_P1_CONFIG,
  MAX_COHORT_MEMBERS,
  SELECTION_POLICY_VERSION,
} from './observatory.constants';
import type { CandidatePoolRow, ObservatoryRunMemberResult } from './observatory.types';

function poolRow(overrides: Partial<CandidatePoolRow> & { personCvId: number; personId: number }): CandidatePoolRow {
  return {
    mimeType: 'application/pdf',
    fileSizeBytes: 50_000 + overrides.personCvId * 1000,
    isActive: true,
    driveFileIdPresent: true,
    existingSnapshotId: null,
    existingParseStatus: null,
    existingPageCount: null,
    existingCharCount: null,
    existingWarningsJson: null,
    legacySkillCount: overrides.personCvId % 10,
    legacyEvidenceCount: overrides.personCvId % 20,
    legacyExtractionOk: true,
    ...overrides,
  };
}

const anchors = [
  {
    snapshotId: '1',
    personCvId: 7,
    parseStatus: 'PARSED',
    pageCount: 2,
    characterCount: 3212,
    warningCount: 0,
    headingCountEstimated: 11,
    candidateCountEstimated: 57,
    lineDensity: 40,
    listDensity: 0.2,
    meanCandidateLength: 55,
  },
  {
    snapshotId: '2',
    personCvId: 10,
    parseStatus: 'PARSED',
    pageCount: 3,
    characterCount: 3739,
    warningCount: 1,
    headingCountEstimated: 8,
    candidateCountEstimated: 60,
    lineDensity: 35,
    listDensity: 0.3,
    meanCandidateLength: 50,
  },
];

describe('CohortSpecBuilder', () => {
  const builder = new CohortSpecBuilder();

  const pool: CandidatePoolRow[] = [
    poolRow({ personCvId: 7, personId: 1163, existingSnapshotId: '1', existingPageCount: 2 }),
    poolRow({ personCvId: 10, personId: 1188, existingSnapshotId: '2', existingPageCount: 3 }),
    poolRow({ personCvId: 20, personId: 200, fileSizeBytes: 10_000, legacySkillCount: 1 }),
    poolRow({ personCvId: 21, personId: 201, fileSizeBytes: 400_000, legacySkillCount: 30, legacyEvidenceCount: 70 }),
    poolRow({ personCvId: 22, personId: 202, fileSizeBytes: 80_000, legacySkillCount: 5 }),
    poolRow({ personCvId: 23, personId: 203, fileSizeBytes: 90_000, legacySkillCount: 6 }),
    poolRow({ personCvId: 24, personId: 204, fileSizeBytes: 100_000, isActive: false }),
    poolRow({ personCvId: 25, personId: 205, mimeType: 'image/png' }),
  ];

  it('produce exactamente 5 miembros con roles esperados', () => {
    const spec = builder.build({ anchors, pool, createdAt: '2026-08-06T00:00:00.000Z' });
    expect(spec.members).toHaveLength(MAX_COHORT_MEMBERS);
    expect(spec.cohortCode).toBe(COHORT_CODE);
    expect(spec.cohortVersion).toBe(COHORT_VERSION);
    const roles = spec.members.map((m) => m.role).sort();
    expect(roles).toEqual(['ANCHOR', 'ANCHOR', 'CONTROL', 'DIVERSITY', 'EDGE'].sort());
  });

  it('reproHash estable ante misma entrada', () => {
    const a = builder.build({ anchors, pool, createdAt: '2026-08-06T00:00:00.000Z' });
    const b = builder.build({ anchors, pool, createdAt: '2026-08-06T12:00:00.000Z' });
    expect(a.reproHash).toBe(b.reproHash);
    expect(a.reproHash).toBe(
      computeReproHash({
        cohortCode: COHORT_CODE,
        cohortVersion: COHORT_VERSION,
        selectionPolicyVersion: SELECTION_POLICY_VERSION,
        members: a.members.map((m) => ({
          personCvId: m.personCvId,
          snapshotId: m.snapshotId,
          role: m.role,
          selectionReasonCode: m.selectionReasonCode,
        })),
      }),
    );
  });

  it('selección determinística (mismos personCvId)', () => {
    const a = builder.build({ anchors, pool });
    const b = builder.build({ anchors, pool });
    expect(a.members.map((m) => m.personCvId)).toEqual(b.members.map((m) => m.personCvId));
  });

  it('excluye inactivos, no-PDF y personas ya representadas', () => {
    expect(
      isEligibleCandidate(
        poolRow({ personCvId: 99, personId: 1163 }),
        new Set([1163]),
        new Set(),
      ).ok,
    ).toBe(false);
    expect(
      isEligibleCandidate(poolRow({ personCvId: 24, personId: 204, isActive: false }), new Set(), new Set())
        .reason,
    ).toBe('INACTIVE');
    expect(
      isEligibleCandidate(
        poolRow({ personCvId: 25, personId: 205, mimeType: 'image/png' }),
        new Set(),
        new Set(),
      ).reason,
    ).toBe('NOT_PDF');
  });
});

describe('EvidenceSignatureExtractor', () => {
  const extractor = new EvidenceSignatureExtractor();

  it('firma sin PII y con buckets', () => {
    const sig = extractor.extract({
      snapshotId: '1',
      configFingerprint: 'abc',
      runSalt: 'salt',
      pageCount: 2,
      characterCount: 3000,
      candidateCount: 50,
      batchCount: 4,
      units: [
        {
          evidenceKind: 'ACTION',
          explicitness: 'EXPLICIT',
          decision: 'ACCEPTED',
          reviewRequired: false,
        },
        {
          evidenceKind: 'TOOL_USAGE',
          explicitness: 'STRONGLY_SUPPORTED',
          decision: 'ACCEPTED',
          reviewRequired: false,
        },
      ],
      decisions: ['ACCEPTED', 'ACCEPTED', 'REJECTED_CONTEXT_ONLY'],
      unsupportedSpanCount: 0,
      validationFailureCount: 0,
      warningCount: 0,
    });
    expect(sig.pageCountBucket).toBe(pageCountBucket(2));
    expect(sig.characterCountBucket).toBe(characterCountBucket(3000));
    expect(sig.evidenceUnitCount).toBe(2);
    expect(JSON.stringify(sig)).not.toMatch(/sourceText|startOffset|email|cargo/i);
    expect(() => extractor.assertNoPii(sig)).not.toThrow();
  });
});

describe('configFingerprint', () => {
  it('cambia si cambia prompt', () => {
    const a = computeConfigFingerprint({
      contractVersion: '2.0.0',
      segmenterVersion: '1.1.0',
      promptVersion: 'A',
      modelProvider: 'google-genai',
      modelVersion: 'gemini-3.6-flash',
      batchBuilderVersion: '1.0.0',
      validatorVersion: '1.0.0',
      signatureVersion: '1.0.0',
      cohortReproHash: 'x',
    });
    const b = computeConfigFingerprint({
      contractVersion: '2.0.0',
      segmenterVersion: '1.1.0',
      promptVersion: 'B',
      modelProvider: 'google-genai',
      modelVersion: 'gemini-3.6-flash',
      batchBuilderVersion: '1.0.0',
      validatorVersion: '1.0.0',
      signatureVersion: '1.0.0',
      cohortReproHash: 'x',
    });
    expect(a).not.toBe(b);
    expect(frozenConfigFingerprint('x')).toHaveLength(64);
  });
});

describe('aggregates y outliers', () => {
  function member(
    idx: number,
    units: number,
    review = 0,
  ): ObservatoryRunMemberResult {
    return {
      memberIndex: idx,
      personCvId: idx,
      role: 'CONTROL',
      snapshotId: String(idx),
      p0Outcome: 'REUSED',
      p1Status: 'COMPLETED',
      parseStatus: 'PARSED',
      pageCount: 2,
      characterCount: 3000,
      warningCount: 0,
      candidateCount: 40,
      batchCount: 3,
      evidenceUnitCount: units,
      durationMs: 100,
      artifactChecksum: null,
      reusedPrototypeId: null,
      signature: {
        signatureVersion: '1.0.0',
        snapshotFingerprint: `fp${idx}`,
        configFingerprint: 'cfg',
        pageCountBucket: 'MEDIUM',
        characterCountBucket: 'MEDIUM',
        candidateCount: 40,
        batchCount: 3,
        evidenceUnitCount: units,
        acceptedCandidateCount: units,
        rejectedCandidateCount: 0,
        ambiguousCount: 0,
        reviewRequiredCount: review,
        evidenceKindCounts: { ACTION: units },
        evidenceKindRatios: { ACTION: 1 },
        explicitnessCounts: {
          EXPLICIT: 1,
          STRONGLY_SUPPORTED: units - 1,
          INFERRED: 0,
        },
        explicitnessRatios: {},
        evidencePerPageBucket: 'MEDIUM',
        candidatePerPageBucket: 'HIGH',
        unitsPerAcceptedCandidate: 1,
        duplicateCount: 0,
        unsupportedSpanCount: 0,
        validationFailureCount: 0,
        warningCount: 0,
      },
      reviewSampleIds: [],
      errorCode: null,
    };
  }

  it('detecta outlier por z-score', () => {
    const members = [member(0, 10), member(1, 12), member(2, 11), member(3, 80)];
    expect(detectOutliers(members)).toContain(3);
  });

  it('agrega métricas', () => {
    const agg = buildAggregateMetrics(
      [member(0, 10), member(1, 12)],
      1000,
      1,
      0,
      null,
    );
    expect(agg.totalEvidenceUnits).toBe(22);
    expect(agg.membersCompleted).toBe(2);
    expect(agg.estimatedCost).toBeNull();
  });

  it('reportes R1–R8', () => {
    const members = [member(0, 10), member(1, 12)];
    const cohort = new CohortSpecBuilder().build({
      anchors,
      pool: [
        poolRow({ personCvId: 7, personId: 1 }),
        poolRow({ personCvId: 10, personId: 2 }),
        poolRow({ personCvId: 30, personId: 3, fileSizeBytes: 10_000 }),
        poolRow({ personCvId: 31, personId: 4, fileSizeBytes: 450_000, legacySkillCount: 40 }),
        poolRow({ personCvId: 32, personId: 5, fileSizeBytes: 80_000 }),
      ],
    });
    // override members for report builder — use cohort shape
    const reports = new ObservatoryReportBuilder().buildAll({
      cohort,
      members: cohort.members.map((m, i) => ({
        ...members[i % members.length],
        memberIndex: m.memberIndex,
        role: m.role,
        personCvId: m.personCvId,
      })),
      aggregates: buildAggregateMetrics(members, 500, 0, 0, null),
      signatures: members.map((m) => m.signature!).filter(Boolean),
      durationPerMember: { '0': 100, '1': 200 },
    });
    expect(reports.map((r) => r.reportId)).toEqual([
      'R1',
      'R2',
      'R3',
      'R4',
      'R5',
      'R6',
      'R7',
      'R8',
    ]);
    expect(reports.every((r) => r.gitSafe)).toBe(true);
  });
});

describe('guardrails', () => {
  it('bloquea execute sin confirm', () => {
    expect(() => assertExecuteFlags(['--execute'])).toThrow('EXECUTE_REQUIRES_CONFIRM');
  });

  it('requiere modo', () => {
    expect(() => assertExecuteFlags([])).toThrow('MODE_REQUIRED');
  });

  it('bloquea cohorte > 5', () => {
    const cohort = new CohortSpecBuilder().build({
      anchors,
      pool: [
        poolRow({ personCvId: 7, personId: 1 }),
        poolRow({ personCvId: 10, personId: 2 }),
        poolRow({ personCvId: 40, personId: 3 }),
        poolRow({ personCvId: 41, personId: 4, fileSizeBytes: 400_000, legacySkillCount: 35 }),
        poolRow({ personCvId: 42, personId: 5 }),
      ],
    });
    cohort.members.push({ ...cohort.members[0], memberIndex: 5, personCvId: 999 });
    const r = evaluateGuardrails({
      mde: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
      cohort,
      modelVersion: FROZEN_P1_CONFIG.modelVersion,
      segmenterVersion: FROZEN_P1_CONFIG.segmenterVersion,
      promptVersion: FROZEN_P1_CONFIG.promptVersion,
      contractVersion: FROZEN_P1_CONFIG.contractVersion,
      geminiApiKeyPresent: true,
      publisherEnabled: false,
      p2Enabled: false,
      cloudConfigPresent: false,
      execute: false,
      confirm: false,
      dryRunPlanHash: null,
      expectedDryRunPlanHash: null,
    });
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('COHORT_TOO_LARGE');
  });

  it('bloquea publisher/p2/cloud', () => {
    const cohort = new CohortSpecBuilder().build({
      anchors,
      pool: [
        poolRow({ personCvId: 7, personId: 1 }),
        poolRow({ personCvId: 10, personId: 2 }),
        poolRow({ personCvId: 50, personId: 3 }),
        poolRow({ personCvId: 51, personId: 4, fileSizeBytes: 400_000, legacySkillCount: 35 }),
        poolRow({ personCvId: 52, personId: 5 }),
      ],
    });
    const r = evaluateGuardrails({
      mde: { host: '127.0.0.1', port: 5434, database: 'organigrama_mde' },
      cohort,
      modelVersion: FROZEN_P1_CONFIG.modelVersion,
      segmenterVersion: FROZEN_P1_CONFIG.segmenterVersion,
      promptVersion: FROZEN_P1_CONFIG.promptVersion,
      contractVersion: FROZEN_P1_CONFIG.contractVersion,
      geminiApiKeyPresent: true,
      publisherEnabled: true,
      p2Enabled: true,
      cloudConfigPresent: true,
      execute: true,
      confirm: true,
      dryRunPlanHash: 'a',
      expectedDryRunPlanHash: 'a',
    });
    expect(r.errors).toEqual(
      expect.arrayContaining(['PUBLISHER_ENABLED', 'P2_ENABLED', 'CLOUD_CONFIG_PRESENT']),
    );
  });
});

describe('artifact writer', () => {
  it('escribe bundle y checksums', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'obs-'));
    try {
      const writer = new ObservatoryArtifactWriter(dir);
      const cohort = new CohortSpecBuilder().build({
        anchors,
        pool: [
          poolRow({ personCvId: 7, personId: 1 }),
          poolRow({ personCvId: 10, personId: 2 }),
          poolRow({ personCvId: 60, personId: 3 }),
          poolRow({ personCvId: 61, personId: 4, fileSizeBytes: 400_000, legacySkillCount: 35 }),
          poolRow({ personCvId: 62, personId: 5 }),
        ],
      });
      await writer.writeRunBundle({
        cohortSpec: cohort,
        dryRunPlan: null,
        runManifest: {
          observatoryRunId: 'test-run',
          operationType: 'OBSERVATORY_PILOT',
          cohortCode: cohort.cohortCode,
          cohortVersion: cohort.cohortVersion,
          cohortReproHash: cohort.reproHash,
          configFingerprint: 'cfg',
          frozenConfig: { ...FROZEN_P1_CONFIG },
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          status: 'COMPLETED',
          publisherInvoked: false,
          p2Invoked: false,
          databasePersistence: false,
          dryRunPlanHash: null,
          artifactRoot: dir,
        },
        memberResults: [],
        signatures: [],
        aggregateMetrics: buildAggregateMetrics([], 0, 0, 0, null),
        reports: new ObservatoryReportBuilder().buildAll({
          cohort,
          members: [],
          aggregates: buildAggregateMetrics([], 0, 0, 0, null),
          signatures: [],
          durationPerMember: {},
        }),
        executionSummary: { ok: true },
      });
      const checksums = readFileSync(join(dir, 'checksums.sha256'), 'utf8');
      expect(checksums).toContain('cohort-spec.json');
      expect(checksums).toContain('reports/R1.json');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('ObservatoryRunDiff', () => {
  it('marca COHORT_CHANGED si reproHash difiere', () => {
    const diff = new ObservatoryRunDiff().compare({
      a: {
        manifest: {
          observatoryRunId: 'a',
          operationType: 'OBSERVATORY_PILOT',
          cohortCode: COHORT_CODE,
          cohortVersion: COHORT_VERSION,
          cohortReproHash: 'h1',
          configFingerprint: 'c1',
          frozenConfig: { promptVersion: 'A' },
          startedAt: '',
          completedAt: null,
          status: 'COMPLETED',
          publisherInvoked: false,
          p2Invoked: false,
          databasePersistence: false,
          dryRunPlanHash: null,
          artifactRoot: '',
        },
        aggregates: buildAggregateMetrics([], 0, 0, 0, null),
        signatureIds: ['x'],
      },
      b: {
        manifest: {
          observatoryRunId: 'b',
          operationType: 'OBSERVATORY_PILOT',
          cohortCode: COHORT_CODE,
          cohortVersion: COHORT_VERSION,
          cohortReproHash: 'h2',
          configFingerprint: 'c1',
          frozenConfig: { promptVersion: 'A' },
          startedAt: '',
          completedAt: null,
          status: 'COMPLETED',
          publisherInvoked: false,
          p2Invoked: false,
          databasePersistence: false,
          dryRunPlanHash: null,
          artifactRoot: '',
        },
        aggregates: buildAggregateMetrics([], 0, 0, 0, null),
        signatureIds: ['x'],
      },
    });
    expect(diff.comparable).toBe(false);
    expect(diff.reason).toBe('COHORT_CHANGED');
  });
});
