/**
 * P2 Field resolver determinístico.
 *
 * matchScore = número de EUs de origen (ACTION/RESPONSIBILITY/PROJECT/DELIVERABLE)
 * con práctica de catálogo en activity/object/result/scope.
 * toolOrMethod no origina.
 *
 * RESOLVED si el top tiene >= 2 orígenes y margen:
 *   second < 2  OR  top >= 2 * second
 * Si no, AMBIGUOUS. Si nadie llega a 2, INSUFFICIENT_EVIDENCE.
 */
import { compileFieldLexicon } from './catalog-lexicon';
import { matchUnitToField, strengthFromOriginCount } from './match';
import type {
  FieldCandidate,
  FieldResolverResult,
  ResolverEvidenceUnit,
} from './types';
import { RESOLVER_CODE, RESOLVER_VERSION } from './types';

const MIN_ORIGIN_FOR_RESOLVE = 2;

export function resolveFields(args: {
  snapshotId: string;
  units: ResolverEvidenceUnit[];
}): FieldResolverResult {
  const fields = compileFieldLexicon();
  const candidates: FieldCandidate[] = [];

  for (const field of fields) {
    const origin: string[] = [];
    const reinforce: string[] = [];
    const positives: string[] = [];
    const exclusions: string[] = [];
    const reasons: string[] = [];

    for (const u of args.units) {
      const m = matchUnitToField(u, field);
      if (m.role === 'ORIGIN') origin.push(u.evidenceId);
      if (m.role === 'REINFORCE') reinforce.push(u.evidenceId);
      positives.push(...m.positiveSignalsMatched);
      exclusions.push(...m.exclusionsTriggered);
    }

    if (origin.length === 0 && reinforce.length === 0) continue;

    if (origin.length >= MIN_ORIGIN_FOR_RESOLVE) {
      reasons.push('SUPPORT_PRACTICE_CLUSTER');
    } else if (origin.length === 1) {
      reasons.push('THIN_ORIGIN_CLUSTER');
    } else {
      reasons.push('KNOWLEDGE_OR_RESULT_ONLY');
    }
    if (exclusions.includes('TOOL_ONLY_IGNORED')) {
      reasons.push('TOOL_ONLY_IGNORED');
    }

    candidates.push({
      fieldCode: field.code,
      supportingEvidenceIds: [...origin, ...reinforce],
      originEvidenceIds: origin,
      reinforceEvidenceIds: reinforce,
      matchScore: origin.length,
      resolverStrength: strengthFromOriginCount(origin.length),
      reasonCodes: [...new Set(reasons)],
      positiveSignalsMatched: [...new Set(positives)].sort(),
      exclusionsTriggered: [...new Set(exclusions)].sort(),
    });
  }

  candidates.sort((a, b) => {
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    return a.fieldCode.localeCompare(b.fieldCode);
  });

  const viable = candidates.filter((c) => c.matchScore >= MIN_ORIGIN_FOR_RESOLVE);
  const reasonCodes: string[] = [];
  let decision: FieldResolverResult['decision'] = 'INSUFFICIENT_EVIDENCE';
  let resolvedFieldCode: string | null = null;
  let ambiguousFieldCodes: string[] = [];

  if (viable.length === 0) {
    decision = 'INSUFFICIENT_EVIDENCE';
    reasonCodes.push('NO_FIELD_WITH_MIN_ORIGIN');
  } else {
    const top = viable[0];
    const second = viable[1];
    const marginOk =
      !second ||
      second.matchScore < MIN_ORIGIN_FOR_RESOLVE ||
      top.matchScore >= second.matchScore * 2;
    if (marginOk) {
      decision = 'RESOLVED';
      resolvedFieldCode = top.fieldCode;
      reasonCodes.push('CLEAR_FIELD_MARGIN');
    } else {
      decision = 'AMBIGUOUS';
      ambiguousFieldCodes = viable
        .filter((c) => c.matchScore * 2 > top.matchScore)
        .map((c) => c.fieldCode);
      reasonCodes.push('MARGIN_INSUFFICIENT');
    }
  }

  return {
    resolverCode: RESOLVER_CODE,
    resolverVersion: RESOLVER_VERSION,
    snapshotId: args.snapshotId,
    decision,
    resolvedFieldCode,
    candidateFields: candidates,
    ambiguousFieldCodes,
    reasonCodes,
  };
}
