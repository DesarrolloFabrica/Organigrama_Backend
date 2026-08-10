import {
  isKnownSpecialtyCode,
  parentFieldOfSpecialty,
  SPECIALTY_CATALOG_VERSION,
} from '../catalog/specialties-visual-education';
import {
  P4_CONTRACT_CODE,
  P4_CONTRACT_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  type P4ContractEnvelope,
  type P4ModelRawOutput,
  type P4ObservedSkill,
  type P4OutcomeStatus,
  type P4RationaleCode,
  type P4SkillStatus,
  type P4SpecialtyEvaluated,
  type P4SpecialtyResult,
} from './p4.types';

const STATUSES = new Set<P4SkillStatus>(['OBSERVED', 'WEAK']);
const RATIONALES = new Set<P4RationaleCode>([
  'RECURRENT_PRACTICE',
  'EQUIVALENT_EXPRESSION_CLUSTER',
  'TRACEABLE_CAPACITY',
  'THIN_BUT_TRACABLE',
  'TOOL_ONLY_REJECTED',
  'GENERIC_REJECTED',
  'SINGLE_UNIT_INSUFFICIENT',
  'OUT_OF_SPECIALTY_REJECTED',
]);

/** Generic undifferentiable labels — reject unless somehow not matching. */
const GENERIC_SKILL_BLOCKLIST = new Set(
  [
    'communication',
    'creativity',
    'leadership',
    'management',
    'teamwork',
    'soft_skills',
    'soft skills',
    'comunicacion',
    'comunicación',
    'creatividad',
    'liderazgo',
    'gestion',
    'gestión',
  ].map((s) => s.toLowerCase()),
);

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function asStatus(raw: string | undefined): P4SkillStatus {
  const s = (raw ?? '').toUpperCase() as P4SkillStatus;
  return STATUSES.has(s) ? s : 'WEAK';
}

function asRationale(raw: string | undefined): P4RationaleCode {
  const s = (raw ?? '').toUpperCase() as P4RationaleCode;
  return RATIONALES.has(s) ? s : 'THIN_BUT_TRACABLE';
}

function sanitizeSkillCode(raw: string, fallback: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return cleaned || fallback;
}

function isGenericSkill(name: string, skillCode: string): boolean {
  const n = name.trim().toLowerCase();
  const c = skillCode.trim().toLowerCase();
  return GENERIC_SKILL_BLOCKLIST.has(n) || GENERIC_SKILL_BLOCKLIST.has(c);
}

function looksLikeToolAsSkill(name: string, skillCode: string): boolean {
  const blob = `${name} ${skillCode}`.toLowerCase();
  // Single-token tool-ish names without capacity wording
  const toolish =
    /^(photoshop|illustrator|indesign|figma|sketch|after\s*effects|premiere|react|nestjs|nodejs|moodle|canva|coreldraw|blender|wordpress)$/i;
  return toolish.test(name.trim()) || toolish.test(skillCode.replace(/_/g, ' '));
}

export function normalizeP4ModelOutput(args: {
  raw: P4ModelRawOutput;
  executionId: string;
  configFingerprint: string;
  snapshotId: string;
  specialtiesEvaluated: P4SpecialtyEvaluated[];
  r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
  unitIds: string[];
  campaignId: string;
  pipelineRunId: string;
  registryFingerprint: string;
  modelWarnings: string[];
  r1PackDir: string;
  p3PackDir: string;
  p1ArtifactDigest: string;
  geminiInvoked: boolean;
}): { envelope: P4ContractEnvelope } {
  const unitSet = new Set(args.unitIds);
  const normalizeWarnings: string[] = [...args.modelWarnings];
  const evalKey = new Set(
    args.specialtiesEvaluated.map(
      (s) => `${s.fieldCode}::${s.specialtyCode}`,
    ),
  );

  const rawResults = Array.isArray(args.raw.specialtyResults)
    ? args.raw.specialtyResults
    : [];
  const byKey = new Map<string, P4SpecialtyResult>();

  for (const sr of rawResults) {
    const fieldCode = (sr.fieldCode ?? '').trim();
    const specialtyCode = (sr.specialtyCode ?? '').trim();
    const key = `${fieldCode}::${specialtyCode}`;
    if (!fieldCode || !specialtyCode || !evalKey.has(key)) {
      if (fieldCode || specialtyCode) {
        normalizeWarnings.push('SPECIALTY_RESULT_OUTSIDE_EVAL_SET');
      }
      continue;
    }
    if (!isKnownSpecialtyCode(specialtyCode)) {
      normalizeWarnings.push('UNKNOWN_SPECIALTY_DROPPED');
      continue;
    }
    const expectedParent = parentFieldOfSpecialty(specialtyCode);
    if (expectedParent !== fieldCode) {
      normalizeWarnings.push('PARENT_FIELD_MISMATCH_DROPPED');
      continue;
    }

    const skills: P4ObservedSkill[] = [];
    const seenCodes = new Set<string>();

    for (const [idx, sk] of (sr.observedSkills ?? []).entries()) {
      const name = (sk.name ?? '').trim();
      if (!name) continue;
      const skillCode = sanitizeSkillCode(
        sk.skillCode ?? name,
        `skill_${idx + 1}`,
      );

      if (isGenericSkill(name, skillCode)) {
        normalizeWarnings.push('GENERIC_SKILL_DROPPED');
        continue;
      }
      if (looksLikeToolAsSkill(name, skillCode)) {
        normalizeWarnings.push('TOOL_PROMOTED_AS_SKILL_DROPPED');
        continue;
      }

      const parentField =
        (sk.parentFieldCode ?? '').trim() || fieldCode;
      const parentSpecialty =
        (sk.parentSpecialtyCode ?? '').trim() || specialtyCode;
      if (parentField !== fieldCode || parentSpecialty !== specialtyCode) {
        normalizeWarnings.push('SKILL_OUTSIDE_SPECIALTY_DROPPED');
        continue;
      }
      if (seenCodes.has(skillCode)) {
        normalizeWarnings.push('DUPLICATE_SKILL_CODE_DROPPED');
        continue;
      }
      seenCodes.add(skillCode);

      const supporting = (sk.supportingEvidenceUnitIds ?? []).filter((id) =>
        unitSet.has(id),
      );
      if (
        (sk.supportingEvidenceUnitIds ?? []).length > 0 &&
        supporting.length === 0
      ) {
        normalizeWarnings.push('ALL_SUPPORT_REFS_ORPHAN_DROPPED');
        continue;
      }

      let status = asStatus(sk.status);
      let rationale = asRationale(sk.rationaleCode);
      if (status === 'OBSERVED' && supporting.length < 2) {
        status = 'WEAK';
        rationale =
          supporting.length === 1
            ? 'SINGLE_UNIT_INSUFFICIENT'
            : 'TOOL_ONLY_REJECTED';
        normalizeWarnings.push('OBSERVED_DEMOTED_INSUFFICIENT_SUPPORT');
      }
      if (supporting.length === 0) {
        normalizeWarnings.push('SKILL_WITHOUT_EVIDENCE_DROPPED');
        continue;
      }

      const tools = (sk.toolOrTechnologySignals ?? [])
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20);
      const signals = (sk.supportingSignals ?? [])
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20);

      skills.push({
        skillCode,
        name,
        parentFieldCode: fieldCode,
        parentSpecialtyCode: specialtyCode,
        status,
        confidence: clamp01(Number(sk.confidence)),
        supportingEvidenceUnitIds: supporting,
        supportingSignals: signals,
        toolOrTechnologySignals: tools,
        rationaleCode: rationale,
      });
    }

    byKey.set(key, {
      fieldCode,
      specialtyCode,
      observedSkills: skills,
      notes: sr.notes,
    });
  }

  for (const s of args.specialtiesEvaluated) {
    const key = `${s.fieldCode}::${s.specialtyCode}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        fieldCode: s.fieldCode,
        specialtyCode: s.specialtyCode,
        observedSkills: [],
      });
      normalizeWarnings.push('SPECIALTY_RESULT_BACKFILLED_EMPTY');
    }
  }

  const specialtyResults = args.specialtiesEvaluated.map(
    (s) => byKey.get(`${s.fieldCode}::${s.specialtyCode}`)!,
  );

  let outcome: P4OutcomeStatus =
    (args.raw.outcomeStatus as P4OutcomeStatus) || 'INSUFFICIENT_SIGNAL';
  if (args.specialtiesEvaluated.length === 0) {
    outcome = 'ABSTAINED_NO_OBSERVED_SPECIALTY';
  } else {
    const any = specialtyResults.some((r) => r.observedSkills.length > 0);
    if (any) outcome = 'SKILLS_OBSERVED';
    else if (
      outcome !== 'REVIEW_REQUIRED' &&
      outcome !== 'INSUFFICIENT_SIGNAL'
    ) {
      outcome = 'NO_SKILL_EVIDENCE';
    }
  }

  const envelope: P4ContractEnvelope = {
    contractCode: P4_CONTRACT_CODE,
    contractVersion: P4_CONTRACT_VERSION,
    stageCode: 'P4',
    registryFingerprint: args.registryFingerprint,
    campaignId: args.campaignId,
    pipelineRunId: args.pipelineRunId,
    producedAt: new Date().toISOString(),
    abstained: outcome === 'ABSTAINED_NO_OBSERVED_SPECIALTY',
    abstentionReason:
      outcome === 'ABSTAINED_NO_OBSERVED_SPECIALTY'
        ? 'NO_P3_OBSERVED_SPECIALTY'
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
      specialtiesEvaluated: args.specialtiesEvaluated,
      outcomeStatus: outcome,
      specialtyResults,
      r1Unchanged: true,
      p3Unchanged: true,
      r1PackDir: args.r1PackDir,
      p3PackDir: args.p3PackDir,
      p1ArtifactDigest: args.p1ArtifactDigest,
      artifactProvenance: {
        stageCode: 'P4',
        contractCode: P4_CONTRACT_CODE,
        contractVersion: P4_CONTRACT_VERSION,
        inputSource: 'R1_P3_PLUS_P1_EVIDENCE_ARTIFACT_ONLY',
        generativeResultOrigin: args.geminiInvoked ? 'LIVE' : 'NONE',
        mode: 'ARTIFACT_ONLY',
        promptVersion: P4_PROMPT_VERSION,
        reasoningPolicyVersion: P4_REASONING_POLICY_VERSION,
      },
    },
  };

  return { envelope };
}

export function assertP4ReferentialIntegrity(
  envelope: P4ContractEnvelope,
  unitIds: string[],
  specialtiesEvaluated: P4SpecialtyEvaluated[],
): void {
  const unitSet = new Set(unitIds);
  const evalKey = new Set(
    specialtiesEvaluated.map((s) => `${s.fieldCode}::${s.specialtyCode}`),
  );
  for (const sr of envelope.payload.specialtyResults) {
    const key = `${sr.fieldCode}::${sr.specialtyCode}`;
    if (!evalKey.has(key)) {
      throw new Error(`P4_SPECIALTY_OUTSIDE_EVAL:${key}`);
    }
    for (const sk of sr.observedSkills) {
      if (
        sk.parentFieldCode !== sr.fieldCode ||
        sk.parentSpecialtyCode !== sr.specialtyCode
      ) {
        throw new Error(`P4_SKILL_PARENT_MISMATCH:${sk.skillCode}`);
      }
      for (const id of sk.supportingEvidenceUnitIds) {
        if (!unitSet.has(id)) {
          throw new Error(`P4_ORPHAN_SUPPORT:${id}`);
        }
      }
    }
  }
  if (envelope.payload.r1Unchanged !== true || envelope.payload.p3Unchanged !== true) {
    throw new Error('P4_UPSTREAM_MUST_REMAIN_UNCHANGED');
  }
}
