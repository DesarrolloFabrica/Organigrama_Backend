/**
 * Diagnóstico S9 Candidate.1 — solo lectura. No modifica reglas.
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack, isOriginKind } from '../src/mc-pipeline/experimental/deterministic-resolver/evidence';
import { resolveFieldsHardened } from '../src/mc-pipeline/experimental/deterministic-resolver/field-resolver-hardened';
import { matchUnitToField } from '../src/mc-pipeline/experimental/deterministic-resolver/match';
import { lexiconForField } from '../src/mc-pipeline/experimental/deterministic-resolver/catalog-lexicon';
import { fieldAliasHits } from '../src/mc-pipeline/experimental/deterministic-resolver/overlay-match';
import { evaluateP2SkipEligibility } from '../src/mc-pipeline/shadow-resolver/skip-eligibility';
import { stableStringify } from '../src/mc-pipeline/experimental/deterministic-resolver/run-prototype';

function dumpField(
  units: ReturnType<typeof loadEvidenceUnitsFromP1Pack>,
  code: string,
) {
  const lex = lexiconForField(code);
  if (!lex) return [];
  const rows = [];
  for (const u of units) {
    const cat = matchUnitToField(u, lex);
    const aliases = fieldAliasHits(u, code);
    if (cat.role === 'NONE' && aliases.length === 0 && cat.exclusionsTriggered.length === 0) {
      continue;
    }
    rows.push({
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      evidenceKind: u.evidenceKind,
      originKind: isOriginKind(u.evidenceKind),
      normalizedActivity: u.normalizedActivity,
      object: u.object,
      toolOrMethod: u.toolOrMethod,
      result: u.result,
      scope: u.scope,
      catalogRole: cat.role,
      catalogHits: cat.positiveSignalsMatched,
      overlayAliases: aliases,
      exclusions: cat.exclusionsTriggered,
    });
  }
  return rows;
}

function main() {
  const root = resolve(__dirname, '..');
  const p1 = join(root, 'tmp/mc1-p1-prototype/P1P-V11-6I-S9-20260810154742-ac98bc54');
  const units = loadEvidenceUnitsFromP1Pack(p1);
  const p2 = resolveFieldsHardened({ snapshotId: '9', units });
  const skip = evaluateP2SkipEligibility(p2, units);
  const body = {
    candidate: 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.1',
    snapshotId: '9',
    unitCount: units.length,
    decision: p2.decision,
    resolvedFieldCode: p2.resolvedFieldCode,
    reasonCodes: p2.reasonCodes,
    skip: skip.eligibility,
    skipReasons: skip.reasons,
    strongCompetitors: skip.strongCompetitorCodes,
    independentSourceCount: skip.independentSourceCount,
    candidates: p2.candidateFields.map((c) => ({
      fieldCode: c.fieldCode,
      independentSourceCount: c.independentSourceCount,
      originCount: c.originEvidenceIds.length,
      matchScore: c.matchScore,
      positiveSignalsMatched: c.positiveSignalsMatched,
      differentialSignalsMatched: c.differentialSignalsMatched,
      competitorFieldCodes: c.competitorFieldCodes,
      originEvidenceIds: c.originEvidenceIds,
    })),
    dataAnalyticsMatches: dumpField(units, 'DATA_ANALYTICS'),
    softwareEngineeringMatches: dumpField(units, 'SOFTWARE_ENGINEERING'),
    skipRule:
      'SKIP_ELIGIBLE because RESOLVED + independent>=2 + no other field with independent>=2 + SE↔DA not in overlay competitor map so no differential required',
  };
  // eslint-disable-next-line no-console
  console.log(stableStringify(body));
}

main();
