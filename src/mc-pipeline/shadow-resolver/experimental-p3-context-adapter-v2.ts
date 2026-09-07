/**
 * Adapter P3 experimental: PRIMARY + SECONDARIES + CONTEXT.
 * No modifica p3-context-loader productivo. No ejecuta P3.
 *
 * CONTEXT permite evaluación; no implica specialties OBSERVED.
 */
import { SPECIALTY_CATALOG_SCOPE } from '../catalog/specialties-visual-education';
import type { CandidateSetV2Result } from './candidate-set-v2';
import type { CandidateSetV2Role, FieldEvidenceStrength } from './candidate-set-policy-v2';

export type ExperimentalP3FieldContext = {
  fieldCode: string;
  role: CandidateSetV2Role;
  strength: FieldEvidenceStrength;
  note: 'CONTEXT_DOES_NOT_IMPLY_OBSERVED';
};

export function adaptCandidateSetV2ToExperimentalP3(
  set: CandidateSetV2Result,
): ExperimentalP3FieldContext[] {
  const out: ExperimentalP3FieldContext[] = [];
  const push = (
    fieldCode: string,
    role: CandidateSetV2Role,
    strength: FieldEvidenceStrength,
  ) => {
    if (!SPECIALTY_CATALOG_SCOPE.has(fieldCode)) return;
    if (out.some((x) => x.fieldCode === fieldCode)) return;
    out.push({
      fieldCode,
      role,
      strength,
      note: 'CONTEXT_DOES_NOT_IMPLY_OBSERVED',
    });
  };

  if (set.decision === 'AMBIGUOUS') {
    for (const c of set.competitors) push(c.fieldCode, 'COMPETITOR', c.strength);
    return out.sort((a, b) => a.fieldCode.localeCompare(b.fieldCode));
  }

  if (set.primary) push(set.primary.fieldCode, 'PRIMARY', set.primary.strength);
  for (const s of set.secondaries) push(s.fieldCode, 'SECONDARY', s.strength);
  for (const c of set.contextFields) push(c.fieldCode, 'CONTEXT', c.strength);
  return out.sort((a, b) => a.fieldCode.localeCompare(b.fieldCode));
}
