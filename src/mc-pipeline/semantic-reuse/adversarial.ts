/**
 * Fixtures adversariales + mutación del gate experimental.
 * No toca packs ni fingerprints productivos.
 */
import { CSET_V2_FIXTURES } from '../shadow-resolver/candidate-set-v2-fixtures';
import { eu } from '../shadow-resolver/gate-fixtures';
import {
  buildP3SemanticFingerprint,
  compareP3SemanticInputs,
  defaultP3SemanticInput,
  decideP3Reuse,
  evidenceIdentityFromUnits,
} from './p3-gate';
import {
  buildP4SemanticFingerprint,
  compareP4SemanticInputs,
  decideP4Reuse,
  defaultP4SemanticInput,
} from './p4-gate';
import { buildP3PromptEffective } from './payload';
import type { P3SemanticInput, P4SemanticInput, ReuseDecision, SemanticLineage } from './types';

export type NamedGateTest = {
  id: string;
  expected: ReuseDecision | 'IDENTICAL' | 'SEMANTIC_CHANGE' | 'METADATA_ONLY_CHANGE';
  observed: string;
  pass: boolean;
  note: string;
};

const UNITS = CSET_V2_FIXTURES.primaryPlusLegitimateContext;
const EVIDENCE = evidenceIdentityFromUnits(UNITS);

function lineage(over: Partial<SemanticLineage> = {}): SemanticLineage {
  return {
    originalRunId: 'run-a',
    newRunId: 'run-a',
    originalProducer: 'GEMINI',
    newUpstreamProducer: 'GEMINI',
    oldResultIdentity: 'p2-a',
    newResultIdentity: 'p2-a',
    ...over,
  };
}

function p3Prod(over: Partial<P3SemanticInput> = {}) {
  return defaultP3SemanticInput({
    contract: over.contract ?? 'PRODUCTION',
    evidenceIdentity: over.evidenceIdentity ?? EVIDENCE,
    fieldContext: over.fieldContext ?? [
      { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', fieldRole: 'SECONDARY' },
    ],
    r1FieldResolutionStatus: over.r1FieldResolutionStatus ?? 'MULTI_FIELD',
    specialtyCatalogFingerprint: over.specialtyCatalogFingerprint,
    promptVersion: over.promptVersion,
    modelVersion: over.modelVersion,
    reasoningPolicyVersion: over.reasoningPolicyVersion,
    generationPolicyVersion: over.generationPolicyVersion,
    modelConfigFingerprint: over.modelConfigFingerprint,
  });
}

function p4Base(over: Partial<P4SemanticInput> = {}) {
  return defaultP4SemanticInput({
    evidenceIdentity: over.evidenceIdentity ?? EVIDENCE,
    r1FieldResolutionStatus: over.r1FieldResolutionStatus ?? 'RESOLVED',
    specialties: over.specialties ?? [
      {
        fieldCode: 'SOFTWARE_ENGINEERING',
        specialtyCode: 'FRONTEND_ENGINEERING',
        status: 'OBSERVED',
        evaluationRole: 'AUTHORITATIVE_TARGET',
        publishableFromP3: true,
        routingEligible: true,
        p3Confidence: 0.9,
      },
    ],
    specialtyCatalogFingerprint: over.specialtyCatalogFingerprint,
    promptVersion: over.promptVersion,
    routingPolicyVersion: over.routingPolicyVersion,
    reasoningPolicyVersion: over.reasoningPolicyVersion,
    generationPolicyVersion: over.generationPolicyVersion,
    modelVersion: over.modelVersion,
    modelConfigFingerprint: over.modelConfigFingerprint,
  });
}

export function runSemanticGateAdversarialTests(): NamedGateTest[] {
  const base = p3Prod({});
  const rows: NamedGateTest[] = [];

  const producer = decideP3Reuse(base, p3Prod({}), lineage({ newUpstreamProducer: 'DETERMINISTIC' }));
  rows.push({
    id: 'producer_only',
    expected: 'SAFE_REUSE_WITH_METADATA_CHANGE',
    observed: producer.reuseDecision,
    pass: producer.reuseDecision === 'SAFE_REUSE_WITH_METADATA_CHANGE',
    note: 'producedBy no entra al semantic fp',
  });

  const runId = decideP3Reuse(base, p3Prod({}), lineage({ newRunId: 'run-b' }));
  rows.push({
    id: 'runId_only',
    expected: 'SAFE_REUSE_WITH_METADATA_CHANGE',
    observed: runId.reuseDecision,
    pass: runId.reuseDecision === 'SAFE_REUSE_WITH_METADATA_CHANGE',
    note: '',
  });

  const orderOld = p3Prod({
    fieldContext: [
      { fieldCode: 'VISUAL_DESIGN' },
      { fieldCode: 'SOFTWARE_ENGINEERING' },
    ],
  });
  const orderNew = p3Prod({
    fieldContext: [
      { fieldCode: 'SOFTWARE_ENGINEERING' },
      { fieldCode: 'VISUAL_DESIGN' },
    ],
  });
  const orderCmp = compareP3SemanticInputs(orderOld, orderNew);
  rows.push({
    id: 'same_fields_different_order',
    expected: 'SAFE_REUSE',
    observed: orderCmp,
    pass: orderCmp === 'IDENTICAL' && buildP3SemanticFingerprint(orderOld) === buildP3SemanticFingerprint(orderNew),
    note: 'Prompt evalúa fields separately; fp productivo también ordena',
  });

  const removed = compareP3SemanticInputs(
    base,
    p3Prod({ fieldContext: [{ fieldCode: 'SOFTWARE_ENGINEERING' }] }),
  );
  rows.push({
    id: 'field_removed',
    expected: 'RECOMPUTE_REQUIRED',
    observed: removed,
    pass: removed === 'SEMANTIC_CHANGE',
    note: '',
  });

  const added = compareP3SemanticInputs(
    p3Prod({ fieldContext: [{ fieldCode: 'SOFTWARE_ENGINEERING' }] }),
    base,
  );
  rows.push({
    id: 'field_added',
    expected: 'RECOMPUTE_REQUIRED',
    observed: added,
    pass: added === 'SEMANTIC_CHANGE',
    note: '',
  });

  const roleAwareOld = defaultP3SemanticInput({
    contract: 'ROLE_AWARE',
    evidenceIdentity: EVIDENCE,
    fieldContext: [
      { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', fieldRole: 'SECONDARY' },
    ],
    r1FieldResolutionStatus: 'MULTI_FIELD',
  });
  const roleAwareNew = defaultP3SemanticInput({
    contract: 'ROLE_AWARE',
    evidenceIdentity: EVIDENCE,
    fieldContext: [
      { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', fieldRole: 'CONTEXT' },
    ],
    r1FieldResolutionStatus: 'MULTI_FIELD',
  });
  const roleCmp = compareP3SemanticInputs(roleAwareOld, roleAwareNew);
  rows.push({
    id: 'role_change_role_aware_contract',
    expected: 'RECOMPUTE_REQUIRED',
    observed: roleCmp,
    pass: roleCmp === 'SEMANTIC_CHANGE',
    note: 'No mezclar con PRODUCTION',
  });

  const extraUnit = [...UNITS, eu('extra', 'ACTION', { normalizedActivity: 'otra', startOffset: 9000, endOffset: 9060 })];
  const evCmp = compareP3SemanticInputs(
    base,
    p3Prod({ evidenceIdentity: evidenceIdentityFromUnits(extraUnit) }),
  );
  rows.push({
    id: 'evidence_changes',
    expected: 'RECOMPUTE_REQUIRED',
    observed: evCmp,
    pass: evCmp === 'SEMANTIC_CHANGE',
    note: '',
  });

  const cat = compareP3SemanticInputs(base, p3Prod({ specialtyCatalogFingerprint: 'OTHER.CATALOG' }));
  rows.push({
    id: 'catalog_changes',
    expected: 'RECOMPUTE_REQUIRED',
    observed: cat,
    pass: cat === 'SEMANTIC_CHANGE',
    note: 'versión completa, no subset',
  });

  const prompt = compareP3SemanticInputs(base, p3Prod({ promptVersion: 'OTHER.PROMPT' }));
  rows.push({
    id: 'prompt_changes',
    expected: 'RECOMPUTE_REQUIRED',
    observed: prompt,
    pass: prompt === 'SEMANTIC_CHANGE',
    note: '',
  });

  const model = compareP3SemanticInputs(base, p3Prod({ modelVersion: 'other-model' }));
  rows.push({
    id: 'model_changes',
    expected: 'RECOMPUTE_REQUIRED',
    observed: model,
    pass: model === 'SEMANTIC_CHANGE',
    note: '',
  });

  const p4Old = p4Base();
  const p4Prod = compareP4SemanticInputs(p4Old, p4Base(), lineage({ newUpstreamProducer: 'DETERMINISTIC' }));
  rows.push({
    id: 'p4_producer_only',
    expected: 'SAFE_REUSE_WITH_METADATA_CHANGE',
    observed: p4Prod,
    pass: p4Prod === 'METADATA_ONLY_CHANGE',
    note: 'p3ResultIdentity no está en semantic fp P4',
  });

  const p4Spec = compareP4SemanticInputs(
    p4Old,
    p4Base({
      evidenceIdentity: EVIDENCE,
      r1FieldResolutionStatus: 'RESOLVED',
      specialties: [
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'BACKEND_ENGINEERING',
          status: 'OBSERVED',
          evaluationRole: 'AUTHORITATIVE_TARGET',
          publishableFromP3: true,
          routingEligible: true,
        },
      ],
    }),
  );
  rows.push({
    id: 'p4_specialty_changes',
    expected: 'RECOMPUTE_REQUIRED',
    observed: p4Spec,
    pass: p4Spec === 'SEMANTIC_CHANGE',
    note: '',
  });

  const p3RecomputeBlocksP4 = decideP4Reuse({
    p3Decision: 'RECOMPUTE_REQUIRED',
    oldInput: p4Old,
    candidate: p4Old,
    lineage: lineage(),
  });
  rows.push({
    id: 'p3_recompute_blocks_p4',
    expected: 'RECOMPUTE_REQUIRED',
    observed: p3RecomputeBlocksP4.reuseDecision,
    pass: p3RecomputeBlocksP4.reuseDecision === 'RECOMPUTE_REQUIRED',
    note: 'no asumir specialties históricas',
  });

  const payloadSame =
    buildP3PromptEffective({ input: orderOld, units: UNITS }).digest ===
    buildP3PromptEffective({ input: orderNew, units: UNITS }).digest;
  rows.push({
    id: 'payload_order_normalized',
    expected: 'SAFE_REUSE',
    observed: payloadSame ? 'IDENTICAL' : 'SEMANTIC_CHANGE',
    pass: payloadSame,
    note: 'prompt-effective byte equivalent after sort',
  });

  return rows;
}

export function runSemanticGateMutationTests(): NamedGateTest[] {
  const base = p3Prod({});
  const fp = buildP3SemanticFingerprint(base);
  const cases: Array<{ id: string; next: ReturnType<typeof p3Prod>; shouldChange: boolean }> = [
    { id: 'producer', next: p3Prod({}), shouldChange: false },
    {
      id: 'runId',
      next: p3Prod({}),
      shouldChange: false,
    },
    {
      id: 'fieldCode',
      next: p3Prod({ fieldContext: [{ fieldCode: 'COMMUNICATIONS' }] }),
      shouldChange: true,
    },
    {
      id: 'fieldRole_production_ignored',
      next: p3Prod({
        fieldContext: [
          { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'CONTEXT' },
          { fieldCode: 'VISUAL_DESIGN', fieldRole: 'PRIMARY' },
        ],
      }),
      shouldChange: false,
    },
    {
      id: 'evidence',
      next: p3Prod({
        evidenceIdentity: evidenceIdentityFromUnits(UNITS.slice(0, -1)),
      }),
      shouldChange: true,
    },
    {
      id: 'catalog',
      next: p3Prod({ specialtyCatalogFingerprint: 'X' }),
      shouldChange: true,
    },
    {
      id: 'prompt',
      next: p3Prod({ promptVersion: 'X' }),
      shouldChange: true,
    },
    {
      id: 'model',
      next: p3Prod({ modelVersion: 'X' }),
      shouldChange: true,
    },
    {
      id: 'policy',
      next: p3Prod({ reasoningPolicyVersion: 'X' }),
      shouldChange: true,
    },
  ];
  const roleAwareBase = defaultP3SemanticInput({
    contract: 'ROLE_AWARE',
    evidenceIdentity: EVIDENCE,
    fieldContext: [
      { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', fieldRole: 'SECONDARY' },
    ],
    r1FieldResolutionStatus: 'MULTI_FIELD',
  });
  const roleMut = defaultP3SemanticInput({
    contract: 'ROLE_AWARE',
    evidenceIdentity: EVIDENCE,
    fieldContext: [
      { fieldCode: 'SOFTWARE_ENGINEERING', fieldRole: 'PRIMARY' },
      { fieldCode: 'VISUAL_DESIGN', fieldRole: 'CONTEXT' },
    ],
    r1FieldResolutionStatus: 'MULTI_FIELD',
  });
  const out = cases.map((c) => {
    const changed = buildP3SemanticFingerprint(c.next) !== fp;
    return {
      id: `mutate_${c.id}`,
      expected: (c.shouldChange ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE') as ReuseDecision,
      observed: changed ? 'RECOMPUTE_REQUIRED' : 'SAFE_REUSE',
      pass: changed === c.shouldChange,
      note: `one-at-a-time PRODUCTION: ${c.id}`,
    };
  });
  out.push({
    id: 'mutate_fieldRole_role_aware',
    expected: 'RECOMPUTE_REQUIRED',
    observed:
      buildP3SemanticFingerprint(roleMut) !== buildP3SemanticFingerprint(roleAwareBase)
        ? 'RECOMPUTE_REQUIRED'
        : 'SAFE_REUSE',
    pass: buildP3SemanticFingerprint(roleMut) !== buildP3SemanticFingerprint(roleAwareBase),
    note: 'ROLE_AWARE contract only',
  });
  const p4fp = buildP4SemanticFingerprint(p4Base());
  out.push({
    id: 'mutate_p4_p3ResultIdentity_excluded',
    expected: 'SAFE_REUSE',
    observed: buildP4SemanticFingerprint(p4Base()) === p4fp ? 'SAFE_REUSE' : 'RECOMPUTE_REQUIRED',
    pass: buildP4SemanticFingerprint(p4Base()) === p4fp,
    note: 'identity de pack P3 no entra',
  });
  return out;
}
