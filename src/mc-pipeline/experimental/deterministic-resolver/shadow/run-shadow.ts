/**
 * Simulador SHADOW offline.
 * Lee P1 existente + canónico P2/P3 SOLO para comparar.
 * Nunca usa P2/P3 productivo como input del resolver.
 * Nunca llama Gemini. Nunca escribe packs productivos.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../../../catalog/professional-fields';
import { SPECIALTY_CATALOG_VERSION } from '../../../catalog/specialties-visual-education';
import { COHORT } from '../cohort';
import { loadEvidenceUnitsFromP1Pack } from '../evidence';
import {
  EXPERIMENTAL_POLICY_VERSION,
  EXPERIMENTAL_RESOLVER_POLICY,
} from '../experimental-policy';
import { resolveFieldsHardened } from '../field-resolver-hardened';
import { stableStringify } from '../run-prototype';
import { resolveSpecialtiesHardened } from '../specialty-resolver-hardened';
import { RESOLVER_HARDENING_VERSION } from '../types';
import { catalogGapFromP2, catalogGapFromP3 } from './catalog-gap';
import { CRITICAL_CONTROLS, REGRESSION_GATE } from './critical-controls';
import { SHADOW_CATALOG_VERSION_LABEL, shadowInputFingerprint } from './fingerprint';
import { FUTURE_P2_SKIP_GATE, FUTURE_P3_SKIP_GATE } from './future-gates';
import { compareShadowP2, compareShadowP3 } from './shadow-compare';
import { ledgerSnapshot, ShadowEventStore, writeIsolatedJson } from './shadow-store';
import {
  SHADOW_NAMESPACE,
  SHADOW_EVENT_TYPE,
  SIMULATION_CREATED_AT,
  type CatalogGapRecord,
  type ProductionP2Snapshot,
  type ProductionP3Snapshot,
  type ShadowComparison,
  type ShadowDecision,
  type ShadowP3Decision,
} from './shadow-types';

const MEASURED_P2_TOKENS = 18359;
const MEASURED_P3_TOKENS = 11590;

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function canonicalP2(packDir: string): ProductionP2Snapshot {
  const summary = readJson(join(packDir, 'summary.json')) as {
    ranks?: Array<{ domainCode: string; status: string; rank: number }>;
  };
  const ranks = summary.ranks ?? [];
  return {
    rank1: ranks.find((r) => r.rank === 1)?.domainCode ?? null,
    active: ranks.filter((r) => r.status === 'ACTIVE' && r.domainCode).map((r) => r.domainCode),
    source: 'CANONICAL_PACK_SUMMARY',
  };
}

function canonicalP3(packDir: string): ProductionP3Snapshot[] {
  const summary = readJson(join(packDir, 'summary.json')) as {
    observed?: Array<{ fieldCode: string; specialtyCode: string; status: string }>;
  };
  return (summary.observed ?? []).map((o) => ({
    fieldCode: o.fieldCode,
    specialtyCode: o.specialtyCode,
    status: o.status === 'OBSERVED' || o.status === 'WEAK' ? o.status : 'NOT_EMITTED',
    source: 'CANONICAL_PACK_SUMMARY' as const,
  }));
}

function baseDecision(args: {
  phase: 'P2' | 'P3';
  personId: number;
  personLabel: string;
  snapshotId: string;
  catalogVersion: string;
  fingerprint: string;
  reused: boolean;
}): Pick<
  ShadowDecision,
  | 'namespace'
  | 'eventType'
  | 'notAProductionResult'
  | 'phase'
  | 'personId'
  | 'personLabel'
  | 'snapshotId'
  | 'resolverVersion'
  | 'policyVersion'
  | 'catalogVersion'
  | 'inputFingerprint'
  | 'createdAt'
  | 'reused'
> {
  return {
    namespace: SHADOW_NAMESPACE,
    eventType: SHADOW_EVENT_TYPE,
    notAProductionResult: true,
    phase: args.phase,
    personId: args.personId,
    personLabel: args.personLabel,
    snapshotId: args.snapshotId,
    resolverVersion: RESOLVER_HARDENING_VERSION,
    policyVersion: EXPERIMENTAL_POLICY_VERSION,
    catalogVersion: args.catalogVersion,
    inputFingerprint: args.fingerprint,
    createdAt: SIMULATION_CREATED_AT,
    reused: args.reused,
  };
}

export function runShadowSimulation(backendRoot: string) {
  const ledgerBefore = ledgerSnapshot(backendRoot);
  const outDir = join(backendRoot, 'tmp', 'mc1-hybrid-resolver-shadow');
  const store = new ShadowEventStore(outDir);
  const p2Rows: ShadowDecision[] = [];
  const p3Rows: ShadowP3Decision[] = [];
  const comparisons: ShadowComparison[] = [];
  const gaps: CatalogGapRecord[] = [];
  let p2Resolved = 0;
  let p2Amb = 0;
  let p2Ins = 0;
  let p2WouldSkip = 0;
  let p3Resolved = 0;
  let p3Amb = 0;
  let p3Ins = 0;
  let p3PersonWouldSkip = 0;
  let reusedCount = 0;

  for (const member of COHORT) {
    const units = loadEvidenceUnitsFromP1Pack(resolve(backendRoot, member.p1PackRel));
    const p2Fp = shadowInputFingerprint({ units, phase: 'P2' });
    const cachedP2 = store.get(p2Fp);
    let p2Shadow: ShadowDecision;
    if (cachedP2) {
      reusedCount += 1;
      p2Shadow = { ...cachedP2, reused: true };
    } else {
      const resolved = resolveFieldsHardened({ snapshotId: member.snapshotId, units });
      const top = resolved.candidateFields[0];
      const wouldSkip = resolved.decision === 'RESOLVED';
      p2Shadow = {
        ...baseDecision({
          phase: 'P2',
          personId: member.personId,
          personLabel: member.person,
          snapshotId: member.snapshotId,
          catalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
          fingerprint: p2Fp,
          reused: false,
        }),
        decision: resolved.decision,
        candidateCode: resolved.resolvedFieldCode,
        supportingEvidenceIds: top?.originEvidenceIds ?? [],
        independentSourceCount: top?.independentSourceCount ?? 0,
        reasonCodes: resolved.reasonCodes,
        competitors:
          resolved.decision === 'AMBIGUOUS'
            ? resolved.ambiguousFieldCodes
            : (top?.competitorFieldCodes ?? []),
        wouldSkipGemini: wouldSkip,
        differentialSignalsMatched: top?.differentialSignalsMatched ?? [],
      };
      store.put(p2Shadow);
    }
    p2Rows.push(p2Shadow);
    if (p2Shadow.decision === 'RESOLVED') p2Resolved += 1;
    if (p2Shadow.decision === 'AMBIGUOUS') p2Amb += 1;
    if (p2Shadow.decision === 'INSUFFICIENT_EVIDENCE') p2Ins += 1;
    if (p2Shadow.wouldSkipGemini) p2WouldSkip += 1;

    const fieldCodes =
      p2Shadow.decision === 'RESOLVED' && p2Shadow.candidateCode
        ? [p2Shadow.candidateCode]
        : p2Shadow.decision === 'AMBIGUOUS'
          ? p2Shadow.competitors
          : [];
    const p3Fp = shadowInputFingerprint({ units, phase: 'P3', fieldContext: fieldCodes });
    const p3ResolvedItems = resolveSpecialtiesHardened({
      snapshotId: member.snapshotId,
      units,
      fieldCodes,
      allowObservedEquivalent: p2Shadow.decision === 'RESOLVED',
    });

    const personP3: ShadowP3Decision[] = [];
    for (const item of p3ResolvedItems.items) {
      const itemFp = shaShort(`${p3Fp}:${item.fieldCode}:${item.specialtyCode}`);
      const cached = store.get(itemFp) as ShadowP3Decision | undefined;
      let row: ShadowP3Decision;
      if (cached && cached.phase === 'P3') {
        reusedCount += 1;
        row = { ...cached, reused: true };
      } else {
        row = {
          ...baseDecision({
            phase: 'P3',
            personId: member.personId,
            personLabel: member.person,
            snapshotId: member.snapshotId,
            catalogVersion: SPECIALTY_CATALOG_VERSION,
            fingerprint: itemFp,
            reused: false,
          }),
          fieldCode: item.fieldCode,
          specialtyCode: item.specialtyCode,
          observedEquivalent: item.observedEquivalent,
          decision: item.decision,
          candidateCode: item.specialtyCode,
          supportingEvidenceIds: item.originEvidenceIds,
          independentSourceCount: item.independentSourceCount ?? 0,
          reasonCodes: item.reasonCodes,
          competitors: [],
          wouldSkipGemini: false,
          differentialSignalsMatched: [],
        };
        store.put(row);
      }
      personP3.push(row);
      p3Rows.push(row);
      if (row.decision === 'RESOLVED') p3Resolved += 1;
      if (row.decision === 'AMBIGUOUS') p3Amb += 1;
      if (row.decision === 'INSUFFICIENT_EVIDENCE') p3Ins += 1;
    }

    const p3HasAmb = personP3.some((i) => i.decision === 'AMBIGUOUS');
    const p3HasResolved = personP3.some((i) => i.decision === 'RESOLVED');
    const p3WouldSkip = p2Shadow.wouldSkipGemini && p3HasResolved && !p3HasAmb;
    if (p3WouldSkip) p3PersonWouldSkip += 1;
    for (const row of personP3) {
      row.wouldSkipGemini = p3WouldSkip;
    }

    const prodP2 = canonicalP2(resolve(backendRoot, member.p2PackRel));
    comparisons.push(
      compareShadowP2({
        personId: member.personId,
        snapshotId: member.snapshotId,
        shadow: p2Shadow,
        production: prodP2,
      }),
    );
    const p2Gap = catalogGapFromP2({
      personLabel: member.person,
      shadow: p2Shadow,
      canonicalActive: prodP2.active,
    });
    if (p2Gap) gaps.push(p2Gap);

    const prodP3 = canonicalP3(resolve(backendRoot, member.p3PackRel));
    const prodMap = new Map(prodP3.map((o) => [`${o.fieldCode}::${o.specialtyCode}`, o]));
    for (const row of personP3) {
      const prod = prodMap.get(`${row.fieldCode}::${row.specialtyCode}`) ?? {
        fieldCode: row.fieldCode,
        specialtyCode: row.specialtyCode,
        status: 'NOT_EMITTED' as const,
        source: 'CANONICAL_PACK_SUMMARY' as const,
      };
      comparisons.push(
        compareShadowP3({
          personId: member.personId,
          snapshotId: member.snapshotId,
          shadow: row,
          production: prod,
        }),
      );
      const g = catalogGapFromP3({
        personLabel: member.person,
        shadow: row,
        canonicalStatus: prod.status,
      });
      if (g) gaps.push(g);
    }
  }

  const n = COHORT.length;
  const actualTokens = n * MEASURED_P2_TOKENS + n * MEASURED_P3_TOKENS;
  const avoidable =
    p2WouldSkip * MEASURED_P2_TOKENS + p3PersonWouldSkip * MEASURED_P3_TOKENS;
  const classCounts: Record<string, number> = {};
  for (const c of comparisons) {
    classCounts[c.comparisonClass] = (classCounts[c.comparisonClass] ?? 0) + 1;
  }
  const reviewConflicts = comparisons.filter((c) => c.needsHumanReview);
  const controlResults = evaluateCriticalControls(p2Rows, p3Rows);
  const ledgerAfter = ledgerSnapshot(backendRoot);

  return {
    namespace: SHADOW_NAMESPACE,
    isolation: {
      productionRunnersUntouched: true,
      shadowStoreKind: 'mc1_shadow_resolver_event',
      outDir,
      neverReadsProductionAsInput: true,
    },
    catalogVersionLabel: SHADOW_CATALOG_VERSION_LABEL,
    resolverVersion: RESOLVER_HARDENING_VERSION,
    policyVersion: EXPERIMENTAL_POLICY_VERSION,
    overlayPolicyCode: EXPERIMENTAL_RESOLVER_POLICY.policyCode,
    futureGates: {
      p2: FUTURE_P2_SKIP_GATE,
      p3: FUTURE_P3_SKIP_GATE,
      skipGeminiEnabled: false,
    },
    p2: p2Rows,
    p3: p3Rows,
    comparisons,
    catalogGaps: gaps,
    metrics: {
      p2: {
        evaluated: n,
        resolved: p2Resolved,
        ambiguous: p2Amb,
        insufficient: p2Ins,
        coverage: n === 0 ? 0 : p2Resolved / n,
        wouldSkip: p2WouldSkip,
        matches: comparisons.filter(
          (c) =>
            c.phase === 'P2' &&
            (c.comparisonClass === 'EXACT_MATCH' || c.comparisonClass === 'COMPATIBLE_MATCH'),
        ).length,
        conflicts: comparisons.filter(
          (c) => c.phase === 'P2' && c.needsHumanReview,
        ).length,
      },
      p3: {
        evaluated: p3Rows.length,
        resolved: p3Resolved,
        ambiguous: p3Amb,
        insufficient: p3Ins,
        coverage: p3Rows.length === 0 ? 0 : p3Resolved / p3Rows.length,
        wouldSkip: p3PersonWouldSkip,
        matches: comparisons.filter(
          (c) =>
            c.phase === 'P3' &&
            (c.comparisonClass === 'EXACT_MATCH' || c.comparisonClass === 'COMPATIBLE_MATCH'),
        ).length,
        conflicts: comparisons.filter(
          (c) => c.phase === 'P3' && c.needsHumanReview,
        ).length,
      },
      abstentionP2: p2Amb + p2Ins,
      comparisonClassCounts: classCounts,
      humanReviewCount: reviewConflicts.length,
      reusedCount,
      precisionCandidateP2:
        p2Resolved === 0
          ? null
          : comparisons.filter(
              (c) =>
                c.phase === 'P2' &&
                c.shadowDecision === 'RESOLVED' &&
                (c.comparisonClass === 'EXACT_MATCH' ||
                  c.comparisonClass === 'COMPATIBLE_MATCH'),
            ).length / p2Resolved,
      precisionCandidateP3:
        p3Resolved === 0
          ? null
          : comparisons.filter(
              (c) =>
                c.phase === 'P3' &&
                c.shadowDecision === 'RESOLVED' &&
                (c.comparisonClass === 'EXACT_MATCH' ||
                  c.comparisonClass === 'COMPATIBLE_MATCH'),
            ).length / p3Resolved,
    },
    criticalControls: controlResults,
    regressionGate: REGRESSION_GATE,
    costCounterfactual: {
      label: 'HISTORICAL_COUNTERFACTUAL',
      notAGuaranteedFutureSaving: true,
      historicalTokens: actualTokens,
      theoreticallyAvoidable: avoidable,
      percentage: actualTokens === 0 ? 0 : avoidable / actualTokens,
      wouldSkipP2Calls: p2WouldSkip,
      wouldSkipP3Calls: p3PersonWouldSkip,
    },
    humanReview: reviewConflicts,
    ledger: {
      before: ledgerBefore,
      after: ledgerAfter,
      callsDelta: ledgerAfter.calls - ledgerBefore.calls,
      tokensDelta: ledgerAfter.tokens - ledgerBefore.tokens,
      newGeminiEvents: 0,
    },
    missingProfiles141: 'NOT_PROCESSED',
    p4: 'OUT_OF_SCOPE',
    productionImpact: 'NONE',
  };
}

function shaShort(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function evaluateCriticalControls(p2: ShadowDecision[], p3: ShadowP3Decision[]) {
  const rows = CRITICAL_CONTROLS.map((ctrl) => {
    let actual = 'MISSING';
    let pass = false;
    if (ctrl.phase === 'P2') {
      const row = p2.find((r) => r.personLabel === ctrl.person);
      if (!row) return { ...ctrl, actual, pass: false };
      if (ctrl.code === 'VD_VS_AV') {
        const codes = [row.candidateCode, ...row.competitors].filter(Boolean);
        const hasVd = codes.includes('VISUAL_DESIGN');
        const hasAv = codes.includes('AUDIOVISUAL_PRODUCTION');
        actual = row.decision;
        pass = row.decision === 'AMBIGUOUS' && (hasVd || hasAv || row.reasonCodes.includes('COMPETING_FIELDS'));
      } else if (ctrl.code === 'DM_VS_COMM') {
        actual = row.decision;
        pass =
          row.decision !== 'RESOLVED' &&
          row.candidateCode !== 'DIGITAL_MARKETING' &&
          row.candidateCode !== 'COMMUNICATIONS';
      } else {
        actual = `${row.decision}:${row.candidateCode ?? ''}`;
        pass = ctrl.expect === 'RESOLVED' ? row.decision === 'RESOLVED' : row.decision !== 'RESOLVED';
      }
    } else {
      const row = p3.find(
        (r) => r.personLabel === ctrl.person && r.specialtyCode === ctrl.code,
      );
      if (!row) return { ...ctrl, actual, pass: false };
      actual = row.decision;
      if (ctrl.expect === 'RESOLVED') pass = row.decision === 'RESOLVED';
      else if (ctrl.expect === 'NOT_RESOLVED') pass = row.decision !== 'RESOLVED';
      else if (ctrl.expect === 'AMBIGUOUS') pass = row.decision === 'AMBIGUOUS';
      else pass = row.decision !== 'RESOLVED';
    }
    return { ...ctrl, actual, pass };
  });
  const haiderGov = p3.find(
    (r) => r.personLabel === 'Haider' && r.specialtyCode === 'DATA_GOVERNANCE',
  );
  const blocking = haiderGov?.decision === 'RESOLVED';
  return {
    rows,
    allPass: rows.every((r) => r.pass) && !blocking,
    criticalFalsePositives: blocking ? 1 : 0,
    versionBlocked: blocking,
  };
}

export function writeShadowArtifacts(
  backendRoot: string,
  sim: ReturnType<typeof runShadowSimulation>,
): string {
  const outDir = join(backendRoot, 'tmp', 'mc1-hybrid-resolver-shadow');
  const store = new ShadowEventStore(outDir);
  for (const row of sim.p2) store.put(row);
  for (const row of sim.p3) store.put(row);
  store.persistJsonl();
  writeIsolatedJson(outDir, 'shadow-p2.json', {
    namespace: SHADOW_NAMESPACE,
    notAProductionResult: true,
    results: sim.p2,
  });
  writeIsolatedJson(outDir, 'shadow-p3.json', {
    namespace: SHADOW_NAMESPACE,
    notAProductionResult: true,
    results: sim.p3,
  });
  writeIsolatedJson(outDir, 'comparisons.json', {
    namespace: SHADOW_NAMESPACE,
    sourceOfTruth: 'canonical pack summary (latest validated; Sara GOV = OBSERVED post-fix)',
    productionIsNotGold: true,
    results: sim.comparisons,
  });
  writeIsolatedJson(outDir, 'metrics.json', sim.metrics);
  writeIsolatedJson(outDir, 'critical-controls.json', sim.criticalControls);
  writeIsolatedJson(outDir, 'cost-counterfactual.json', sim.costCounterfactual);
  writeIsolatedJson(outDir, 'catalog-gaps.json', sim.catalogGaps);
  writeIsolatedJson(outDir, 'ledger-delta.json', sim.ledger);
  return outDir;
}

export function comparableShadowPayload(sim: ReturnType<typeof runShadowSimulation>) {
  const { reusedCount: _reusedCount, ...metrics } = sim.metrics;
  return {
    p2: sim.p2.map(({ reused: _reused, ...rest }) => rest),
    p3: sim.p3.map(({ reused: _reused, ...rest }) => rest),
    comparisons: sim.comparisons,
    metrics,
    criticalControls: sim.criticalControls,
    costCounterfactual: sim.costCounterfactual,
  };
}
