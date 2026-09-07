/**
 * Specialty resolver hardened (policy 0.2.0).
 */
import { lexiconForField } from './catalog-lexicon';
import { isOriginKind } from './evidence';
import { EXPERIMENTAL_RESOLVER_POLICY } from './experimental-policy';
import { independentSourceCount } from './independence';
import { matchUnitToSpecialty, strengthFromOriginCount } from './match';
import { specialtyAliasHits } from './overlay-match';
import {
  RESOLVER_CODE,
  RESOLVER_HARDENING_VERSION,
  type ResolverEvidenceUnit,
  type SpecialtyResolverItem,
  type SpecialtyResolverResult,
} from './types';

const MIN = EXPERIMENTAL_RESOLVER_POLICY.minIndependentSources;

export function resolveSpecialtiesHardened(args: {
  snapshotId: string;
  units: ResolverEvidenceUnit[];
  fieldCodes: string[];
  allowObservedEquivalent?: boolean;
}): SpecialtyResolverResult {
  const items: SpecialtyResolverItem[] = [];
  const fields = [...new Set(args.fieldCodes)].sort();
  const allow = args.allowObservedEquivalent !== false;

  for (const fieldCode of fields) {
    const lex = lexiconForField(fieldCode);
    if (!lex) continue;
    for (const spec of lex.specialties) {
      const originUnits: ResolverEvidenceUnit[] = [];
      const reinforce: string[] = [];
      const practices: string[] = [];
      const positives: string[] = [];
      const exclusions: string[] = [];

      for (const u of args.units) {
        const catalog = matchUnitToSpecialty(u, spec);
        const aliases = specialtyAliasHits(u, spec.code);
        const originated =
          isOriginKind(u.evidenceKind) &&
          (catalog.role === 'ORIGIN' || aliases.length > 0) &&
          !(catalog.role === 'EXCLUDED' && aliases.length === 0);
        if (originated) originUnits.push(u);
        if (catalog.role === 'REINFORCE') reinforce.push(u.evidenceId);
        practices.push(...catalog.matchedPractices, ...aliases);
        positives.push(...catalog.positiveSignalsMatched, ...aliases);
        exclusions.push(...catalog.exclusionsTriggered);
      }

      const independent = independentSourceCount(originUnits);
      const originIds = originUnits.map((u) => u.evidenceId);
      const strength = strengthFromOriginCount(independent);
      let decision: SpecialtyResolverItem['decision'] = 'INSUFFICIENT_EVIDENCE';
      const reasonCodes: string[] = [];

      if (independent >= MIN) {
        if (allow) {
          decision = 'RESOLVED';
          reasonCodes.push(
            spec.requiresOutcomeForOrigin
              ? 'ACTION_OUTCOME_MATCH'
              : 'MULTI_ACTION_CLUSTER',
          );
        } else {
          decision = 'AMBIGUOUS';
          reasonCodes.push('FIELD_NOT_UNIQUELY_RESOLVED');
        }
      } else if (independent === 1) {
        decision = 'AMBIGUOUS';
        reasonCodes.push('SINGLE_SOURCE_THIN');
      } else {
        decision = 'INSUFFICIENT_EVIDENCE';
        if (reinforce.length > 0) reasonCodes.push('KNOWLEDGE_REINFORCEMENT');
        if (exclusions.includes('TECH_WITHOUT_GOVERNANCE_OUTCOME')) {
          reasonCodes.push('TECH_WITHOUT_GOVERNANCE_OUTCOME');
        }
        if (exclusions.includes('KNOWLEDGE_CANNOT_ORIGINATE')) {
          reasonCodes.push('KNOWLEDGE_CANNOT_ORIGINATE');
        }
        if (exclusions.includes('TOOL_ONLY_IGNORED')) {
          reasonCodes.push('TOOL_ONLY_REJECTED');
        }
        if (reasonCodes.length === 0) reasonCodes.push('NO_ORIGIN_PRACTICE');
      }

      items.push({
        fieldCode,
        specialtyCode: spec.code,
        decision,
        observedEquivalent: decision === 'RESOLVED',
        supportingEvidenceIds: [...originIds, ...reinforce],
        originEvidenceIds: originIds,
        reinforceEvidenceIds: reinforce,
        matchScore: independent,
        resolverStrength: strength,
        matchedPractices: [...new Set(practices)].sort(),
        positiveSignalsMatched: [...new Set(positives)].sort(),
        exclusionsTriggered: [...new Set(exclusions)].sort(),
        reasonCodes: [...new Set(reasonCodes)],
        independentSourceCount: independent,
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
    resolverVersion: RESOLVER_HARDENING_VERSION,
    snapshotId: args.snapshotId,
    inputFieldCodes: fields,
    items,
  };
}
