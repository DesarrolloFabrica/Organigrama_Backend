import type {
  CatalogGapRecord,
  ShadowDecision,
  ShadowP3Decision,
} from './shadow-types';

const GAP_REASONS = new Set([
  'NO_ORIGIN_PRACTICE',
  'NO_FIELD_WITH_MIN_ORIGIN',
  'TOOL_ONLY_REJECTED',
  'CATALOG_GAP',
]);

export function catalogGapFromP2(args: {
  personLabel: string;
  shadow: ShadowDecision;
  canonicalActive: string[];
}): CatalogGapRecord | null {
  if (args.shadow.decision === 'RESOLVED') return null;
  if (args.canonicalActive.length === 0) return null;
  if (!args.shadow.reasonCodes.some((r) => GAP_REASONS.has(r))) return null;
  return {
    personLabel: args.personLabel,
    field: args.canonicalActive[0] ?? null,
    specialty: null,
    missingAlias: args.shadow.reasonCodes.includes('NO_FIELD_WITH_MIN_ORIGIN'),
    missingDifferentialSignal: args.shadow.reasonCodes.includes(
      'INSUFFICIENT_DIFFERENTIAL_SIGNAL',
    ),
    missingExclusion: false,
    missingEvidenceRequirement: args.shadow.reasonCodes.includes('SINGLE_SOURCE_THIN'),
    reasonCodes: args.shadow.reasonCodes,
  };
}

export function catalogGapFromP3(args: {
  personLabel: string;
  shadow: ShadowP3Decision;
  canonicalStatus: 'OBSERVED' | 'WEAK' | 'NOT_EMITTED';
}): CatalogGapRecord | null {
  if (args.canonicalStatus !== 'OBSERVED') return null;
  if (args.shadow.decision === 'RESOLVED') return null;
  if (args.shadow.reasonCodes.includes('FIELD_NOT_UNIQUELY_RESOLVED')) return null;
  if (args.shadow.reasonCodes.includes('SINGLE_SOURCE_THIN')) return null;
  if (
    !args.shadow.reasonCodes.includes('NO_ORIGIN_PRACTICE') &&
    !args.shadow.reasonCodes.includes('TOOL_ONLY_REJECTED')
  ) {
    return null;
  }
  return {
    personLabel: args.personLabel,
    field: args.shadow.fieldCode,
    specialty: args.shadow.specialtyCode,
    missingAlias: args.shadow.reasonCodes.includes('NO_ORIGIN_PRACTICE'),
    missingDifferentialSignal: false,
    missingExclusion: false,
    missingEvidenceRequirement: args.shadow.reasonCodes.includes('TOOL_ONLY_REJECTED'),
    reasonCodes: args.shadow.reasonCodes,
  };
}
