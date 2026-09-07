/**
 * FASE — MC1 WEAK EVIDENCE RADAR SEMANTICS
 *
 * Presentation overlay only. Does not mutate P1–P4 status, 12I skill
 * publishability, or the OBSERVED relativeCoverage formula.
 *
 * Weak band: FLAT 20. A 20–35 ladder was rejected because existing
 * OBSERVED relativeCoverage often sits in that range (min gt0 = 18.3).
 */
import type { P3ContractEnvelope, P3ObservedSpecialty } from '../p3/p3.types';
import type { P4ContractEnvelope, P4ObservedSkill } from '../p4/p4.types';
import { dimensionsForField } from './profile-dimensions';
import { mapSkillToDimensions } from './profile-skill-dimension-mapper';
import type { RadarAxisResult } from './profile-radar';

export const PROFILE_RADAR_WEAK_SEMANTICS_VERSION = '1.0.0' as const;
export const WEAK_EVIDENCE_FLOOR = 20 as const;
export const WEAK_EVIDENCE_BAND = 'FLAT_20' as const;

export type WeakRadarAxisSignal = {
  dimensionCode: string;
  uniqueEvidenceUnitIds: string[];
};

/**
 * Specialty → default radar dimension(s) when P3 is WEAK (or OBSERVED
 * without a public OBSERVED skill on that axis). Mirrors 12E mapper
 * fallbacks; VISUAL_DESIGN / EDUCATION are specialty-specific because
 * the skill mapper's empty-blob fallback is too coarse.
 */
export const WEAK_SPECIALTY_DEFAULT_DIMENSIONS: Record<string, string[]> = {
  DATA_GOVERNANCE: ['DA_GOVERNANCE_QUALITY'],
  DATA_ENGINEERING: ['DA_DATA_PIPELINE'],
  BUSINESS_INTELLIGENCE: ['DA_BUSINESS_REPORTING'],
  PREDICTIVE_ANALYTICS: ['DA_PREDICTIVE_MODELING'],
  FRONTEND_ENGINEERING: ['SE_FRONTEND'],
  BACKEND_ENGINEERING: ['SE_BACKEND'],
  MOBILE_ENGINEERING: ['SE_FRONTEND'],
  PLATFORM_DEVOPS_ENGINEERING: ['SE_CLOUD_INFRA'],
  GRAPHIC_DESIGN: ['VD_VISUAL_COMMUNICATION'],
  BRAND_IDENTITY_DESIGN: ['VD_BRAND_SYSTEMS'],
  EDITORIAL_DESIGN: ['VD_EDITORIAL'],
  UX_PRODUCT_DESIGN: ['VD_PRODUCT_INTERFACE'],
  ILLUSTRATION: ['VD_ILLUSTRATION'],
  MOTION_DESIGN: ['VD_MOTION'],
  INSTRUCTIONAL_DESIGN: ['ED_LEARNING_DESIGN'],
  TEACHING_FACILITATION: ['ED_FACILITATION'],
  CURRICULUM_DESIGN: ['ED_CURRICULUM'],
  ACADEMIC_MANAGEMENT: ['ED_ACADEMIC_OPS'],
  VIDEO_PRODUCTION: ['AV_PRODUCTION_REALIZATION'],
  VIDEO_POST_PRODUCTION: ['AV_EDITING_MONTAGE'],
  PHOTOGRAPHY: ['AV_CAPTURE'],
  AUDIO_PRODUCTION: ['AV_AUDIO'],
  CORPORATE_COMMUNICATIONS: ['COMM_SPOKESPERSONSHIP'],
  DIGITAL_COMMUNICATIONS: ['COMM_DIGITAL_CHANNELS'],
  PUBLIC_RELATIONS: ['COMM_SPOKESPERSONSHIP'],
  JOURNALISM: ['COMM_WRITING'],
  CAMPAIGN_MARKETING: ['DM_CAMPAIGN_EXECUTION'],
  GROWTH_MARKETING: ['DM_CONVERSION_OPTIMIZATION'],
  PRODUCT_MARKETING: ['DM_PRODUCT_GTM'],
  BRAND_DIGITAL_MARKETING: ['DM_BRAND_POSITIONING'],
  PMO_GOVERNANCE: ['PPM_IMPROVEMENT_GOVERNANCE'],
  PROCESS_IMPROVEMENT: ['PPM_IMPROVEMENT_GOVERNANCE'],
  PROGRAM_MANAGEMENT: ['PPM_COORDINATION_EXECUTION'],
  PROJECT_MANAGEMENT: ['PPM_COORDINATION_EXECUTION'],
  ACCOUNTING_OPERATIONS: ['FA_ACCOUNTING'],
  BUDGET_FINANCIAL_CONTROL: ['FA_FINANCIAL_CONTROL'],
  ADMINISTRATIVE_MANAGEMENT: ['FA_ADMIN_OPS'],
  FINANCIAL_MANAGEMENT: ['FA_FINANCIAL_PLANNING'],
  TALENT_ACQUISITION: ['HR_TALENT_ACQUISITION'],
  WORKFORCE_ADMINISTRATION: ['HR_WORKFORCE_OPS'],
  CUSTOMER_INTAKE_ONBOARDING: ['CS_INTAKE_ENROLLMENT'],
  CUSTOMER_LIFECYCLE_CARE: ['CS_LIFECYCLE_FOLLOWUP'],
  CUSTOMER_RETENTION_LOYALTY: ['CS_RETENTION_LOYALTY'],
  CUSTOMER_SERVICE_SUPPORT: ['CS_SERVICE_RESOLUTION'],
  NETWORK_INFRASTRUCTURE: ['IT_NETWORKING'],
  IT_SERVICE_DESK: ['IT_SERVICE_DESK'],
  SYSTEMS_ADMINISTRATION: ['IT_SYSADMIN'],
  IT_SECURITY_OPERATIONS: ['IT_SECURITY_OPS'],
  LEGAL_ADVISORY: ['LEGAL_ADVISORY'],
  LEGAL_DOCUMENT_DRAFTING: ['LEGAL_DOCUMENTATION'],
  PUBLIC_SECTOR_CONTRACTING: ['PUBLIC_CONTRACTING_LEGAL'],
  ADMINISTRATIVE_LAW: ['LEGAL_ANALYSIS_NORMATIVE'],
  LITIGATION_DISPUTES: ['LITIGATION_DISPUTES'],
};

export function dimensionsForWeakSpecialty(specialtyCode: string): string[] {
  return WEAK_SPECIALTY_DEFAULT_DIMENSIONS[specialtyCode] ?? [];
}

export function weakEvidenceFloorValue(): number {
  return WEAK_EVIDENCE_FLOOR;
}

function addSignal(
  acc: Map<string, Set<string>>,
  dimensionCode: string,
  evidenceUnitIds: string[],
): void {
  if (!acc.has(dimensionCode)) acc.set(dimensionCode, new Set());
  const set = acc.get(dimensionCode)!;
  for (const id of evidenceUnitIds) {
    if (id) set.add(id);
  }
}

function allowedDimensions(fieldCode: string): Set<string> {
  return new Set(dimensionsForField(fieldCode).map((d) => d.code));
}

function p3SpecialtiesInField(
  p3: P3ContractEnvelope,
  fieldCode: string,
): P3ObservedSpecialty[] {
  const out: P3ObservedSpecialty[] = [];
  for (const fr of p3.payload.fieldResults ?? []) {
    if (fr.fieldCode !== fieldCode) continue;
    for (const s of fr.observedSpecialties ?? []) out.push(s);
  }
  return out;
}

function p4SkillsInField(
  p4: P4ContractEnvelope,
  fieldCode: string,
): P4ObservedSkill[] {
  const out: P4ObservedSkill[] = [];
  for (const sr of p4.payload.specialtyResults ?? []) {
    if (sr.fieldCode !== fieldCode) continue;
    for (const sk of sr.observedSkills ?? []) out.push(sk);
  }
  return out;
}

function observedP3KeySet(
  p3: P3ContractEnvelope,
  fieldCode: string,
): Set<string> {
  const keys = new Set<string>();
  for (const s of p3SpecialtiesInField(p3, fieldCode)) {
    if (s.status === 'OBSERVED') {
      keys.add(`${s.parentFieldCode || fieldCode}::${s.specialtyCode}`);
    }
  }
  return keys;
}

/**
 * Collect WEAK presentation signals for one field.
 * Consumes resolved P3/P4 states only — never reinterprets Evidence Units.
 */
export function collectWeakRadarSignals(args: {
  fieldCode: string;
  p3: P3ContractEnvelope;
  p4: P4ContractEnvelope;
  /** Skill codes already contributing to OBSERVED radar (public 12I set). */
  observedRadarSkillCodes: Set<string>;
}): WeakRadarAxisSignal[] {
  const allowed = allowedDimensions(args.fieldCode);
  const acc = new Map<string, Set<string>>();
  const observedKeys = observedP3KeySet(args.p3, args.fieldCode);

  for (const spec of p3SpecialtiesInField(args.p3, args.fieldCode)) {
    if (spec.status === 'REJECTED') continue;
    if (spec.status !== 'WEAK' && spec.status !== 'OBSERVED') continue;
    const dims = dimensionsForWeakSpecialty(spec.specialtyCode).filter((d) =>
      allowed.has(d),
    );
    if (!dims.length) continue;
    if (spec.status === 'WEAK') {
      for (const d of dims) addSignal(acc, d, spec.supportingEvidenceUnitIds ?? []);
    }
  }

  for (const sk of p4SkillsInField(args.p4, args.fieldCode)) {
    const parentKey = `${sk.parentFieldCode}::${sk.parentSpecialtyCode}`;
    const parentObserved = observedKeys.has(parentKey);
    const hiddenObservedSkill =
      sk.status === 'OBSERVED' && !parentObserved;
    const weakSkill = sk.status === 'WEAK';
    if (!weakSkill && !hiddenObservedSkill) continue;
    if (args.observedRadarSkillCodes.has(sk.skillCode)) continue;

    const mapped = mapSkillToDimensions({
      skillCode: sk.skillCode,
      name: sk.name,
      parentFieldCode: sk.parentFieldCode,
      parentSpecialtyCode: sk.parentSpecialtyCode,
      supportingSignals: sk.supportingSignals ?? [],
      toolOrTechnologySignals: sk.toolOrTechnologySignals ?? [],
      supportingEvidenceUnitIds: sk.supportingEvidenceUnitIds ?? [],
    });
    const dims = (mapped.dimensionCodes.length
      ? mapped.dimensionCodes
      : dimensionsForWeakSpecialty(sk.parentSpecialtyCode)
    ).filter((d) => allowed.has(d));
    for (const d of dims) {
      addSignal(acc, d, sk.supportingEvidenceUnitIds ?? []);
    }
  }

  for (const spec of p3SpecialtiesInField(args.p3, args.fieldCode)) {
    if (spec.status !== 'OBSERVED') continue;
    const dims = dimensionsForWeakSpecialty(spec.specialtyCode).filter((d) =>
      allowed.has(d),
    );
    for (const d of dims) addSignal(acc, d, spec.supportingEvidenceUnitIds ?? []);
  }

  return [...acc.entries()].map(([dimensionCode, ids]) => ({
    dimensionCode,
    uniqueEvidenceUnitIds: [...ids].sort(),
  }));
}

export type WeakRadarOverlayWarning = {
  code: string;
  severity: string;
  messageSafe: string;
};

/**
 * Overlay WEAK floor onto axes that the OBSERVED formula left at 0.
 * Never mutates a positive OBSERVED relativeCoverage.
 */
export function applyWeakEvidenceRadarSemantics(args: {
  axes: RadarAxisResult[];
  weakSignals: WeakRadarAxisSignal[];
  fieldCode?: string;
}): {
  axes: RadarAxisResult[];
  warnings: WeakRadarOverlayWarning[];
} {
  const weakDims = new Set(args.weakSignals.map((s) => s.dimensionCode));
  const warnings: WeakRadarOverlayWarning[] = [];
  const observedBelowFloor = args.axes.filter(
    (a) => a.relativeCoverage > 0 && a.relativeCoverage < WEAK_EVIDENCE_FLOOR,
  );
  if (observedBelowFloor.length) {
    warnings.push({
      code: 'OBSERVED_BELOW_WEAK_FLOOR',
      severity: 'WARNING',
      messageSafe: `${args.fieldCode ?? 'FIELD'}:${observedBelowFloor
        .map((a) => `${a.dimensionCode}=${a.relativeCoverage}`)
        .join(',')}`,
    });
  }

  const axes = args.axes.map((a) => {
    if (a.evidenceState === 'WEAK_EVIDENCE') {
      return {
        ...a,
        relativeCoverage: WEAK_EVIDENCE_FLOOR,
        evidenceState: 'WEAK_EVIDENCE' as const,
      };
    }
    if (a.relativeCoverage > 0) {
      return { ...a, evidenceState: 'OBSERVED' as const };
    }
    if (weakDims.has(a.dimensionCode)) {
      return {
        ...a,
        relativeCoverage: WEAK_EVIDENCE_FLOOR,
        evidenceState: 'WEAK_EVIDENCE' as const,
      };
    }
    return { ...a, evidenceState: 'NO_EVIDENCE' as const };
  });

  return { axes, warnings };
}
