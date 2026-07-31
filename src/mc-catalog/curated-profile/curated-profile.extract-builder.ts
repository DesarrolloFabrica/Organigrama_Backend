/**
 * Construye ExtractedCvSkills determinista desde el JSON curado.
 * Sin Gemini; no inventa skills ni reformula evidencias.
 */

import type {
  ExtractedCvSkills,
  ExtractedSkill,
  EvidenceSourceType,
  SkillEvidenceItem,
  SkillType,
} from '../../cv-skills/cv-skills.types';
import {
  CURATED_EXTRACTION_MAPPING,
} from './curated-profile.constants';
import type { CuratedProfileDocument, CuratedSkillInput } from './curated-profile.schema';
import { resolveSafeAliasCanonicalName } from './curated-profile.normalize';
import type { CuratedSkillResolution } from './curated-profile.types';

export interface CuratedSkillImportPlanItem {
  specialtyCode: string;
  skill: CuratedSkillInput;
  resolution: CuratedSkillResolution;
  action: 'INCLUDE' | 'OMIT' | 'CREATE_THEN_INCLUDE';
  omitReason?: string;
}

function mapSourceSection(
  section: EvidenceSourceType | undefined,
): EvidenceSourceType {
  return section ?? 'OTHER';
}

function toExtractedSkill(
  skill: CuratedSkillInput,
  resolution: CuratedSkillResolution,
): ExtractedSkill {
  const safe = resolveSafeAliasCanonicalName(skill.canonicalName);
  const normalizedName =
    resolution.matchedNormalizedName ??
    safe ??
    skill.displayName ??
    skill.canonicalName;

  const evidenceItems: SkillEvidenceItem[] = skill.evidence.map((e, idx) => ({
    sourceType: mapSourceSection(e.sourceSection),
    evidenceText: e.text.trim(),
    occurrenceIndex: idx + 1,
  }));

  return {
    originalName: skill.canonicalName,
    normalizedName,
    skillType: (skill.skillType ??
      resolution.matchedSkillType ??
      'OTHER') as SkillType,
    confidence: skill.confidence,
    isExplicit: true,
    evidenceItems,
  };
}

/**
 * Agrupa skills INCLUDE/CREATE por especialidad → categories ExtractedCvSkills.
 */
export function buildExtractedCvSkillsFromCurated(params: {
  document: CuratedProfileDocument;
  skillPlans: CuratedSkillImportPlanItem[];
  contentFingerprint: string;
}): ExtractedCvSkills {
  const included = params.skillPlans.filter(
    (p) => p.action === 'INCLUDE' || p.action === 'CREATE_THEN_INCLUDE',
  );

  const bySpecialty = new Map<string, ExtractedSkill[]>();
  for (const plan of included) {
    const list = bySpecialty.get(plan.specialtyCode) ?? [];
    list.push(toExtractedSkill(plan.skill, plan.resolution));
    bySpecialty.set(plan.specialtyCode, list);
  }

  const categories = [...bySpecialty.entries()].map(([category, skills]) => ({
    category,
    skills,
    evidence: skills[0]?.evidenceItems?.[0]?.evidenceText ?? category,
  }));

  const warnings = [
    CURATED_EXTRACTION_MAPPING.warningSourceTag,
    `schemaVersion=${params.document.schemaVersion}`,
    `contentFingerprint=${params.contentFingerprint}`,
    ...(params.document.warnings ?? []),
  ];

  for (const plan of params.skillPlans) {
    if (plan.action === 'OMIT' && plan.omitReason) {
      warnings.push(`OMITTED_SKILL:${plan.skill.canonicalName}:${plan.omitReason}`);
    }
  }

  return {
    categories,
    languages: [],
    certifications: [],
    warnings,
  };
}
