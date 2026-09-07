/**
 * P3 Specialty resolver determinístico.
 * Input: EUs + field codes (del resolver P2, no del P3 histórico).
 * Una EU puede originar más de una specialty (dual attribution).
 *
 * RESOLVED (observed-equivalent) si origin >= 2.
 * AMBIGUOUS si origin === 1 (thin).
 * INSUFFICIENT si origin === 0.
 * KNOWLEDGE_STATEMENT refuerza, no origina OBSERVED-equivalent.
 */
import { lexiconForField } from './catalog-lexicon';
import { matchUnitToSpecialty, strengthFromOriginCount } from './match';
import type {
  ResolverEvidenceUnit,
  SpecialtyResolverItem,
  SpecialtyResolverResult,
} from './types';
import { RESOLVER_CODE, RESOLVER_VERSION } from './types';

const MIN_ORIGIN_FOR_RESOLVE = 2;

export function resolveSpecialties(args: {
  snapshotId: string;
  units: ResolverEvidenceUnit[];
  fieldCodes: string[];
  /** If parent field is not uniquely resolved, never emit OBSERVED-equivalent. */
  allowObservedEquivalent?: boolean;
}): SpecialtyResolverResult {
  const items: SpecialtyResolverItem[] = [];
  const fields = [...new Set(args.fieldCodes)].sort();

  for (const fieldCode of fields) {
    const lex = lexiconForField(fieldCode);
    if (!lex) continue;
    for (const spec of lex.specialties) {
      const origin: string[] = [];
      const reinforce: string[] = [];
      const practices: string[] = [];
      const positives: string[] = [];
      const exclusions: string[] = [];

      for (const u of args.units) {
        const m = matchUnitToSpecialty(u, spec);
        if (m.role === 'ORIGIN') origin.push(u.evidenceId);
        if (m.role === 'REINFORCE') reinforce.push(u.evidenceId);
        practices.push(...m.matchedPractices);
        positives.push(...m.positiveSignalsMatched);
        exclusions.push(...m.exclusionsTriggered);
      }

      const originN = origin.length;
      const strength = strengthFromOriginCount(originN);
      let decision: SpecialtyResolverItem['decision'] = 'INSUFFICIENT_EVIDENCE';
      const reasonCodes: string[] = [];
      const allow = args.allowObservedEquivalent !== false;

      if (originN >= MIN_ORIGIN_FOR_RESOLVE) {
        if (allow) {
          decision = 'RESOLVED';
          reasonCodes.push(
            spec.requiresOutcomeForOrigin
              ? 'MULTI_ACTION_OUTCOME_MATCH'
              : 'SUPPORT_PRACTICE_CLUSTER',
          );
        } else {
          decision = 'AMBIGUOUS';
          reasonCodes.push('FIELD_NOT_UNIQUELY_RESOLVED');
        }
      } else if (originN === 1) {
        decision = 'AMBIGUOUS';
        reasonCodes.push('THIN_BUT_TRACEABLE_ORIGIN');
      } else {
        decision = 'INSUFFICIENT_EVIDENCE';
        if (reinforce.length > 0) reasonCodes.push('KNOWLEDGE_OR_RESULT_ONLY');
        if (exclusions.includes('TECH_WITHOUT_GOVERNANCE_OUTCOME')) {
          reasonCodes.push('TECH_WITHOUT_GOVERNANCE_OUTCOME');
        }
        if (exclusions.includes('KNOWLEDGE_CANNOT_ORIGINATE')) {
          reasonCodes.push('KNOWLEDGE_CANNOT_ORIGINATE');
        }
        if (reasonCodes.length === 0) reasonCodes.push('NO_ORIGIN_PRACTICE');
      }

      items.push({
        fieldCode,
        specialtyCode: spec.code,
        decision,
        observedEquivalent: decision === 'RESOLVED',
        supportingEvidenceIds: [...origin, ...reinforce],
        originEvidenceIds: origin,
        reinforceEvidenceIds: reinforce,
        matchScore: originN,
        resolverStrength: strength,
        matchedPractices: [...new Set(practices)].sort(),
        positiveSignalsMatched: [...new Set(positives)].sort(),
        exclusionsTriggered: [...new Set(exclusions)].sort(),
        reasonCodes: [...new Set(reasonCodes)],
      });
    }
  }

  items.sort((a, b) => {
    const f = a.fieldCode.localeCompare(b.fieldCode);
    if (f !== 0) return f;
    return a.specialtyCode.localeCompare(b.specialtyCode);
  });

  return {
    resolverCode: RESOLVER_CODE,
    resolverVersion: RESOLVER_VERSION,
    snapshotId: args.snapshotId,
    inputFieldCodes: fields,
    items,
  };
}
