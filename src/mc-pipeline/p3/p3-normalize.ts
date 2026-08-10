import {
  isReservedFutureSkillCode,
  parentFieldOfSpecialty,
  resolveToKnownSpecialtyCode,
  SPECIALTY_CATALOG_VERSION,
  specialtiesForField,
} from '../catalog/specialties-visual-education';
import {
  P3_CONTRACT_CODE,
  P3_CONTRACT_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
  type P3ContractEnvelope,
  type P3FieldResult,
  type P3ModelRawOutput,
  type P3ObservedSpecialty,
  type P3OutcomeStatus,
  type P3RationaleCode,
  type P3SpecialtyStatus,
} from './p3.types';

const STATUSES = new Set<P3SpecialtyStatus>(['OBSERVED', 'WEAK', 'REJECTED']);
const RATIONALES = new Set<P3RationaleCode>([
  'COHERENT_PRACTICE_CLUSTER',
  'MIXED_KIND_SUPPORT',
  'THIN_BUT_TRACABLE',
  'TOOL_ONLY_REJECTED',
  'OUT_OF_FIELD_REJECTED',
  'SINGLE_UNIT_INSUFFICIENT',
  'CATALOG_GAP_SIGNAL',
]);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asStatus(raw: string | undefined): P3SpecialtyStatus {
  const s = (raw ?? '').toUpperCase() as P3SpecialtyStatus;
  return STATUSES.has(s) ? s : 'WEAK';
}

function asRationale(raw: string | undefined): P3RationaleCode {
  const s = (raw ?? '').toUpperCase() as P3RationaleCode;
  return RATIONALES.has(s) ? s : 'THIN_BUT_TRACABLE';
}

export function normalizeP3ModelOutput(args: {
  raw: P3ModelRawOutput;
  executionId: string;
  configFingerprint: string;
  snapshotId: string;
  fieldsEvaluated: string[];
  r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
  unitIds: string[];
  campaignId: string;
  pipelineRunId: string;
  registryFingerprint: string;
  modelWarnings: string[];
  r1PackDir: string;
  p1ArtifactDigest: string;
  geminiInvoked: boolean;
}): { envelope: P3ContractEnvelope } {
  const unitSet = new Set(args.unitIds);
  const normalizeWarnings: string[] = [...args.modelWarnings];
  const fieldSet = new Set(args.fieldsEvaluated);

  const rawResults = Array.isArray(args.raw.fieldResults)
    ? args.raw.fieldResults
    : [];

  const byField = new Map<string, P3FieldResult>();

  for (const fr of rawResults) {
    const fieldCode = (fr.fieldCode ?? '').trim();
    if (!fieldCode || !fieldSet.has(fieldCode)) {
      if (fieldCode) normalizeWarnings.push('FIELD_RESULT_OUTSIDE_EVAL_SET');
      continue;
    }

    const allowedCodes = new Set(
      specialtiesForField(fieldCode).map((s) => s.code),
    );
    const observed: P3ObservedSpecialty[] = [];
    const seen = new Set<string>();

    for (const s of fr.observedSpecialties ?? []) {
      const rawCode = (s.specialtyCode ?? '').trim();
      if (!rawCode) continue;

      if (isReservedFutureSkillCode(rawCode)) {
        normalizeWarnings.push('RESERVED_FUTURE_SKILL_CODE_DROPPED');
        continue;
      }

      const code = resolveToKnownSpecialtyCode(rawCode);
      if (!code || !allowedCodes.has(code)) {
        normalizeWarnings.push('UNKNOWN_OR_OUT_OF_FIELD_SPECIALTY_DROPPED');
        continue;
      }
      if (rawCode !== code) {
        normalizeWarnings.push('LEGACY_SPECIALTY_ALIAS_MAPPED');
      }

      const parent = parentFieldOfSpecialty(code);
      if (parent !== fieldCode) {
        normalizeWarnings.push('PARENT_FIELD_MISMATCH_DROPPED');
        continue;
      }
      if (seen.has(code)) {
        normalizeWarnings.push('DUPLICATE_SPECIALTY_DROPPED');
        continue;
      }
      seen.add(code);

      const supporting = (s.supportingEvidenceUnitIds ?? []).filter((id) =>
        unitSet.has(id),
      );
      if (
        (s.supportingEvidenceUnitIds ?? []).length > 0 &&
        supporting.length === 0
      ) {
        normalizeWarnings.push('ALL_SUPPORT_REFS_ORPHAN_DROPPED');
        continue;
      }

      let status = asStatus(s.status);
      let rationale = asRationale(s.rationaleCode);
      if (status === 'OBSERVED' && supporting.length < 2) {
        status = supporting.length === 1 ? 'WEAK' : 'REJECTED';
        rationale =
          supporting.length === 1
            ? 'SINGLE_UNIT_INSUFFICIENT'
            : 'TOOL_ONLY_REJECTED';
        normalizeWarnings.push('OBSERVED_DEMOTED_INSUFFICIENT_SUPPORT');
      }

      observed.push({
        specialtyCode: code,
        parentFieldCode: fieldCode,
        status,
        confidence: clamp01(Number(s.confidence)),
        supportingEvidenceUnitIds: supporting,
        rationaleCode: rationale,
      });
    }

    byField.set(fieldCode, {
      fieldCode,
      observedSpecialties: observed,
      notes: fr.notes,
    });
  }

  for (const f of args.fieldsEvaluated) {
    if (!byField.has(f)) {
      byField.set(f, { fieldCode: f, observedSpecialties: [] });
      normalizeWarnings.push('FIELD_RESULT_BACKFILLED_EMPTY');
    }
  }

  const fieldResults = args.fieldsEvaluated.map((f) => byField.get(f)!);

  let outcome: P3OutcomeStatus =
    (args.raw.outcomeStatus as P3OutcomeStatus) || 'INSUFFICIENT_SIGNAL';
  if (args.fieldsEvaluated.length === 0) {
    outcome = 'ABSTAINED_NO_FIELD';
  } else {
    const anyObserved = fieldResults.some((fr) =>
      fr.observedSpecialties.some(
        (s) => s.status === 'OBSERVED' || s.status === 'WEAK',
      ),
    );
    if (anyObserved) outcome = 'SPECIALTIES_OBSERVED';
    else if (
      outcome !== 'REVIEW_REQUIRED' &&
      outcome !== 'INSUFFICIENT_SIGNAL'
    ) {
      outcome = 'NO_SPECIALTY_EVIDENCE';
    }
  }

  const envelope: P3ContractEnvelope = {
    contractCode: P3_CONTRACT_CODE,
    contractVersion: P3_CONTRACT_VERSION,
    stageCode: 'P3',
    registryFingerprint: args.registryFingerprint,
    campaignId: args.campaignId,
    pipelineRunId: args.pipelineRunId,
    producedAt: new Date().toISOString(),
    abstained: outcome === 'ABSTAINED_NO_FIELD',
    abstentionReason:
      outcome === 'ABSTAINED_NO_FIELD'
        ? 'NO_IN_SCOPE_FIELD_FROM_R1'
        : undefined,
    errors: [],
    warnings: normalizeWarnings.map((code) => ({
      code,
      severity: 'WARNING',
      messageSafe: code,
    })),
    payload: {
      executionId: args.executionId,
      snapshotId: args.snapshotId,
      configFingerprint: args.configFingerprint,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      r1FieldResolutionStatus: args.r1FieldResolutionStatus,
      fieldsEvaluated: args.fieldsEvaluated,
      outcomeStatus: outcome,
      fieldResults,
      r1Unchanged: true,
      r1PackDir: args.r1PackDir,
      p1ArtifactDigest: args.p1ArtifactDigest,
      artifactProvenance: {
        stageCode: 'P3',
        contractCode: P3_CONTRACT_CODE,
        contractVersion: P3_CONTRACT_VERSION,
        inputSource: 'R1_CONTRACT_PLUS_P1_EVIDENCE_ARTIFACT_ONLY',
        generativeResultOrigin: args.geminiInvoked ? 'LIVE' : 'NONE',
        mode: 'ARTIFACT_ONLY',
        promptVersion: P3_PROMPT_VERSION,
        reasoningPolicyVersion: P3_REASONING_POLICY_VERSION,
      },
    },
  };

  return { envelope };
}

/** Guard: no specialties outside evaluated fields; supports ⊆ unitIds. */
export function assertP3ReferentialIntegrity(
  envelope: P3ContractEnvelope,
  unitIds: string[],
  fieldsEvaluated: string[],
): void {
  const unitSet = new Set(unitIds);
  const fieldSet = new Set(fieldsEvaluated);
  for (const fr of envelope.payload.fieldResults) {
    if (!fieldSet.has(fr.fieldCode)) {
      throw new Error(`P3_FIELD_OUTSIDE_EVAL:${fr.fieldCode}`);
    }
    for (const s of fr.observedSpecialties) {
      if (s.parentFieldCode !== fr.fieldCode) {
        throw new Error(`P3_PARENT_MISMATCH:${s.specialtyCode}`);
      }
      if (isReservedFutureSkillCode(s.specialtyCode)) {
        throw new Error(`P3_RESERVED_SKILL_AS_SPECIALTY:${s.specialtyCode}`);
      }
      const parent = parentFieldOfSpecialty(s.specialtyCode);
      if (parent !== fr.fieldCode) {
        throw new Error(`P3_SPECIALTY_OUT_OF_FIELD:${s.specialtyCode}`);
      }
      if (
        s.specialtyCode === 'UI_DESIGN' ||
        s.specialtyCode === 'LEARNING_ASSESSMENT'
      ) {
        throw new Error(`P3_FROZEN_OUT_CODE:${s.specialtyCode}`);
      }
      for (const id of s.supportingEvidenceUnitIds) {
        if (!unitSet.has(id)) {
          throw new Error(`P3_ORPHAN_SUPPORT:${id}`);
        }
      }
    }
  }
  if (envelope.payload.r1Unchanged !== true) {
    throw new Error('P3_R1_MUST_REMAIN_UNCHANGED');
  }
  if (envelope.payload.specialtyCatalogVersion !== SPECIALTY_CATALOG_VERSION) {
    throw new Error('P3_CATALOG_VERSION_MISMATCH');
  }
}
