/**
 * Fixtures adversariales + mutación del semantic fingerprint candidato.
 * Offline. No toca fingerprints productivos.
 */
import { CSET_V2_FIXTURES } from './candidate-set-v2-fixtures';
import { eu } from './gate-fixtures';
import {
  computeActualP3PromptIdentity,
  computeSemanticP3Fingerprint,
  computeSemanticP4Fingerprint,
  type ReuseSafetyClass,
} from './semantic-reuse-design';
import { P3_PROMPT_VERSION } from '../p3/p3.types';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';

export type NamedTest = {
  id: string;
  expected: ReuseSafetyClass | 'ROLE_CONTRACT_NOT_YET_ACTIVE';
  observed: ReuseSafetyClass | 'ROLE_CONTRACT_NOT_YET_ACTIVE';
  pass: boolean;
  note: string;
};

const BASE_UNITS = CSET_V2_FIXTURES.primaryPlusLegitimateContext;

function p3Base() {
  return {
    units: BASE_UNITS,
    fields: [
      { fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', role: 'SECONDARY' },
    ],
    specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
    promptVersion: P3_PROMPT_VERSION,
  };
}

export function runAdversarialReuseTests(): NamedTest[] {
  const base = computeSemanticP3Fingerprint(p3Base());
  const actualBase = computeActualP3PromptIdentity({
    units: BASE_UNITS,
    fieldCodes: ['SOFTWARE_ENGINEERING', 'VISUAL_DESIGN'],
    r1FieldResolutionStatus: 'MULTI_FIELD',
  });

  const producerSameSemantic = computeSemanticP3Fingerprint(p3Base()) === base;

  const fieldChanged =
    computeSemanticP3Fingerprint({
      ...p3Base(),
      fields: [{ fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' }],
    }) !== base;

  const roleChangedSemantic =
    computeSemanticP3Fingerprint({
      ...p3Base(),
      fields: [
        { fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' },
        { fieldCode: 'VISUAL_DESIGN', role: 'CONTEXT' },
      ],
    }) !== base;

  const roleUnchangedInActualPrompt =
    computeActualP3PromptIdentity({
      units: BASE_UNITS,
      fieldCodes: ['SOFTWARE_ENGINEERING', 'VISUAL_DESIGN'],
      r1FieldResolutionStatus: 'MULTI_FIELD',
    }) === actualBase;

  const evidenceChanged =
    computeSemanticP3Fingerprint({
      ...p3Base(),
      units: [
        ...BASE_UNITS,
        eu('extra', 'ACTION', {
          normalizedActivity: 'otra practica',
          object: 'otro',
          startOffset: 2000,
          endOffset: 2060,
        }),
      ],
    }) !== base;

  const catalogChanged =
    computeSemanticP3Fingerprint({
      ...p3Base(),
      specialtyCatalogVersion: 'MUTATED.CATALOG',
    }) !== base;

  const promptChanged =
    computeSemanticP3Fingerprint({
      ...p3Base(),
      promptVersion: 'MUTATED.PROMPT',
    }) !== base;

  const p4Base = computeSemanticP4Fingerprint({
    units: BASE_UNITS,
    specialties: [
      {
        fieldCode: 'SOFTWARE_ENGINEERING',
        specialtyCode: 'FRONTEND_ENGINEERING',
        evaluationRole: 'AUTHORITATIVE_TARGET',
        p3Status: 'OBSERVED',
      },
    ],
  });
  const p4SameAfterProducerOnly = computeSemanticP4Fingerprint({
    units: BASE_UNITS,
    specialties: [
      {
        fieldCode: 'SOFTWARE_ENGINEERING',
        specialtyCode: 'FRONTEND_ENGINEERING',
        evaluationRole: 'AUTHORITATIVE_TARGET',
        p3Status: 'OBSERVED',
      },
    ],
  }) === p4Base;
  const p4SpecialtyChanged =
    computeSemanticP4Fingerprint({
      units: BASE_UNITS,
      specialties: [
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'BACKEND_ENGINEERING',
          evaluationRole: 'AUTHORITATIVE_TARGET',
          p3Status: 'OBSERVED',
        },
      ],
    }) !== p4Base;

  const rows: NamedTest[] = [
    {
      id: 'producer_changes_semantic_input_same',
      expected: 'SAFE_REUSE',
      observed: producerSameSemantic ? 'SAFE_REUSE' : 'RECOMPUTE_REQUIRED',
      pass: producerSameSemantic,
      note: 'producedBy no entra al semantic fp P3',
    },
    {
      id: 'field_set_changes',
      expected: 'RECOMPUTE_REQUIRED',
      observed: fieldChanged ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: fieldChanged,
      note: 'SE+VD → SE only',
    },
    {
      id: 'same_field_role_changes_semantic_candidate',
      expected: 'RECOMPUTE_REQUIRED',
      observed: roleChangedSemantic ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: roleChangedSemantic,
      note: 'SECONDARY → CONTEXT cambia semantic fp candidato',
    },
    {
      id: 'same_field_role_changes_actual_p3_prompt',
      expected: 'ROLE_CONTRACT_NOT_YET_ACTIVE',
      observed: roleUnchangedInActualPrompt
        ? 'ROLE_CONTRACT_NOT_YET_ACTIVE'
        : 'RECOMPUTE_REQUIRED',
      pass: roleUnchangedInActualPrompt,
      note: 'Prompt P3 actual no recibe fieldRole',
    },
    {
      id: 'evidence_set_changes',
      expected: 'RECOMPUTE_REQUIRED',
      observed: evidenceChanged ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: evidenceChanged,
      note: '',
    },
    {
      id: 'catalog_changes',
      expected: 'RECOMPUTE_REQUIRED',
      observed: catalogChanged ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: catalogChanged,
      note: '',
    },
    {
      id: 'prompt_changes',
      expected: 'RECOMPUTE_REQUIRED',
      observed: promptChanged ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: promptChanged,
      note: '',
    },
    {
      id: 'p4_producer_only_same_specialties',
      expected: 'SAFE_REUSE',
      observed: p4SameAfterProducerOnly ? 'SAFE_REUSE' : 'RECOMPUTE_REQUIRED',
      pass: p4SameAfterProducerOnly,
      note: 'semantic P4 no incluye p3ResultIdentity',
    },
    {
      id: 'p4_specialty_changes',
      expected: 'RECOMPUTE_REQUIRED',
      observed: p4SpecialtyChanged ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: p4SpecialtyChanged,
      note: '',
    },
  ];
  return rows;
}

export function runMutationTests(): NamedTest[] {
  const baseInput = p3Base();
  const base = computeSemanticP3Fingerprint(baseInput);
  const mutations: Array<{ id: string; changed: boolean; shouldChange: boolean }> = [
    { id: 'producer', changed: computeSemanticP3Fingerprint(baseInput) !== base, shouldChange: false },
    {
      id: 'field',
      changed:
        computeSemanticP3Fingerprint({
          ...baseInput,
          fields: [{ fieldCode: 'COMMUNICATIONS', role: 'PRIMARY' }],
        }) !== base,
      shouldChange: true,
    },
    {
      id: 'role',
      changed:
        computeSemanticP3Fingerprint({
          ...baseInput,
          fields: [
            { fieldCode: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' },
            { fieldCode: 'VISUAL_DESIGN', role: 'CONTEXT' },
          ],
        }) !== base,
      shouldChange: true,
    },
    {
      id: 'evidence',
      changed:
        computeSemanticP3Fingerprint({
          ...baseInput,
          units: BASE_UNITS.slice(0, -1),
        }) !== base,
      shouldChange: true,
    },
    {
      id: 'catalog',
      changed:
        computeSemanticP3Fingerprint({
          ...baseInput,
          specialtyCatalogVersion: 'X',
        }) !== base,
      shouldChange: true,
    },
    {
      id: 'prompt',
      changed:
        computeSemanticP3Fingerprint({
          ...baseInput,
          promptVersion: 'X',
        }) !== base,
      shouldChange: true,
    },
  ];
  return mutations.map((m) => ({
    id: `mutate_${m.id}`,
    expected: m.shouldChange ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
    observed: m.changed ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
    pass: m.changed === m.shouldChange,
    note: `one-at-a-time: ${m.id}`,
  }));
}
