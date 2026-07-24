import {
  SKILL_TYPES,
  type ExtractedCertification,
  type ExtractedCvSkills,
  type ExtractedLanguage,
  type ExtractedSkill,
  type ExtractedSkillCategory,
  type SkillType,
} from './cv-skills.types';
import { resolveNormalizedName } from './cv-skills.normalize';
import {
  applyCategoryEvidenceFallback,
  parseSkillEvidenceItems,
} from './cv-skills.evidence';

/** Límites defensivos para evitar respuestas degeneradas del modelo. */
export const CV_SKILLS_LIMITS = {
  maxCategories: 40,
  maxSkillsPerCategory: 50,
  maxLanguages: 30,
  maxCertifications: 40,
  maxWarnings: 60,
  maxEvidenceLength: 2000,
  maxNameLength: 200,
  maxEvidenceItemsPerSkill: 5,
} as const;

export class CvSkillsValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvSkillsValidationError';
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function clampString(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}

function isSkillType(value: unknown): value is SkillType {
  return typeof value === 'string' && (SKILL_TYPES as readonly string[]).includes(value);
}

function optionalNullableString(
  value: unknown,
): { ok: true; value: string | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return { ok: true, value: trimmed.length > 0 ? trimmed : null };
  }
  return { ok: false };
}

function optionalNullableBoolean(
  value: unknown,
): { ok: true; value: boolean | null | undefined } | { ok: false } {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value === 'boolean') return { ok: true, value };
  return { ok: false };
}

/**
 * Valida una skill individual.
 * - Inválida estructuralmente / genérica aislada → solo warning (descartada).
 * - Normalización interpretativa rechazada → skill conservada + warning opcional.
 * - evidenceItems inválidos → skill conservada; fallback a category.evidence si aplica.
 */
function parseSkill(
  raw: unknown,
  path: string,
  categoryEvidence: string,
  warnings: string[],
): { skill: ExtractedSkill; warning?: string } | { warning: string } {
  if (!isPlainObject(raw)) {
    return { warning: `${path}: skill no es un objeto; descartada.` };
  }

  if (!isNonEmptyString(raw.originalName)) {
    return { warning: `${path}: originalName vacío o inválido; skill descartada.` };
  }
  if (!isNonEmptyString(raw.normalizedName)) {
    return {
      warning: `${path}: normalizedName vacío o inválido; skill descartada.`,
    };
  }
  if (!isSkillType(raw.skillType)) {
    return {
      warning: `${path}: skillType inválido (${String(raw.skillType)}); skill descartada.`,
    };
  }
  if (typeof raw.confidence !== 'number' || Number.isNaN(raw.confidence)) {
    return { warning: `${path}: confidence no es número; skill descartada.` };
  }
  if (raw.confidence < 0 || raw.confidence > 1) {
    return {
      warning: `${path}: confidence fuera de [0,1] (${raw.confidence}); skill descartada.`,
    };
  }
  if (raw.isExplicit !== true) {
    return {
      warning: `${path}: isExplicit !== true; skill descartada (solo se aceptan explícitas).`,
    };
  }

  const level = optionalNullableString(raw.level);
  if (!level.ok) {
    return { warning: `${path}: level inválido; skill descartada.` };
  }

  const originalName = clampString(
    raw.originalName,
    CV_SKILLS_LIMITS.maxNameLength,
  );
  const proposedNormalized = clampString(
    raw.normalizedName,
    CV_SKILLS_LIMITS.maxNameLength,
  );

  const normalization = resolveNormalizedName(
    originalName,
    proposedNormalized,
    path,
  );
  if (!normalization.ok) {
    return { warning: normalization.warning };
  }

  const evidenceItems = applyCategoryEvidenceFallback(
    parseSkillEvidenceItems(raw.evidenceItems, path, warnings),
    categoryEvidence,
    path,
    warnings,
  );

  const skill: ExtractedSkill = {
    originalName,
    normalizedName: clampString(
      normalization.normalizedName,
      CV_SKILLS_LIMITS.maxNameLength,
    ),
    skillType: raw.skillType,
    confidence: raw.confidence,
    isExplicit: true,
    evidenceItems,
  };

  if (level.value !== undefined) {
    skill.level = level.value;
  }

  return normalization.warning
    ? { skill, warning: normalization.warning }
    : { skill };
}

function parseCategory(
  raw: unknown,
  index: number,
  warnings: string[],
): ExtractedSkillCategory | null {
  const path = `categories[${index}]`;
  if (!isPlainObject(raw)) {
    warnings.push(`${path}: no es un objeto; categoría descartada.`);
    return null;
  }
  if (!isNonEmptyString(raw.category)) {
    warnings.push(`${path}: category vacío o inválido; categoría descartada.`);
    return null;
  }
  if (!isNonEmptyString(raw.evidence)) {
    warnings.push(`${path}: evidence vacía; categoría descartada.`);
    return null;
  }
  if (!Array.isArray(raw.skills)) {
    warnings.push(`${path}: skills no es un arreglo; categoría descartada.`);
    return null;
  }

  const categoryEvidence = clampString(
    raw.evidence,
    CV_SKILLS_LIMITS.maxEvidenceLength,
  );

  const skills: ExtractedSkill[] = [];
  for (let i = 0; i < raw.skills.length; i++) {
    if (skills.length >= CV_SKILLS_LIMITS.maxSkillsPerCategory) {
      warnings.push(
        `${path}: se alcanzó el límite de ${CV_SKILLS_LIMITS.maxSkillsPerCategory} skills; el resto se omite.`,
      );
      break;
    }
    const parsed = parseSkill(
      raw.skills[i],
      `${path}.skills[${i}]`,
      categoryEvidence,
      warnings,
    );
    if (!('skill' in parsed)) {
      warnings.push(parsed.warning);
      continue;
    }
    skills.push(parsed.skill);
    if (parsed.warning) {
      warnings.push(parsed.warning);
    }
  }

  return {
    category: clampString(raw.category, CV_SKILLS_LIMITS.maxNameLength),
    skills,
    evidence: categoryEvidence,
  };
}

function parseLanguage(
  raw: unknown,
  index: number,
  warnings: string[],
): ExtractedLanguage | null {
  const path = `languages[${index}]`;
  if (!isPlainObject(raw)) {
    warnings.push(`${path}: no es un objeto; idioma descartado.`);
    return null;
  }
  if (!isNonEmptyString(raw.name)) {
    warnings.push(`${path}: name vacío o inválido; idioma descartado.`);
    return null;
  }
  if (!isNonEmptyString(raw.evidence)) {
    warnings.push(`${path}: evidence vacía; idioma descartado.`);
    return null;
  }

  const level = optionalNullableString(raw.level);
  if (!level.ok) {
    warnings.push(`${path}: level inválido; idioma descartado.`);
    return null;
  }
  const isCertified = optionalNullableBoolean(raw.isCertified);
  if (!isCertified.ok) {
    warnings.push(`${path}: isCertified inválido; idioma descartado.`);
    return null;
  }

  const language: ExtractedLanguage = {
    name: clampString(raw.name, CV_SKILLS_LIMITS.maxNameLength),
    evidence: clampString(raw.evidence, CV_SKILLS_LIMITS.maxEvidenceLength),
  };
  if (level.value !== undefined) language.level = level.value;
  if (isCertified.value !== undefined) language.isCertified = isCertified.value;
  return language;
}

function parseCertification(
  raw: unknown,
  index: number,
  warnings: string[],
): ExtractedCertification | null {
  const path = `certifications[${index}]`;
  if (!isPlainObject(raw)) {
    warnings.push(`${path}: no es un objeto; certificación descartada.`);
    return null;
  }
  if (!isNonEmptyString(raw.name)) {
    warnings.push(`${path}: name vacío o inválido; certificación descartada.`);
    return null;
  }
  if (!isNonEmptyString(raw.evidence)) {
    warnings.push(`${path}: evidence vacía; certificación descartada.`);
    return null;
  }

  const issuer = optionalNullableString(raw.issuer);
  if (!issuer.ok) {
    warnings.push(`${path}: issuer inválido; certificación descartada.`);
    return null;
  }

  const certification: ExtractedCertification = {
    name: clampString(raw.name, CV_SKILLS_LIMITS.maxNameLength),
    evidence: clampString(raw.evidence, CV_SKILLS_LIMITS.maxEvidenceLength),
  };
  if (issuer.value !== undefined) certification.issuer = issuer.value;
  return certification;
}

/**
 * Valida y normaliza la respuesta cruda de Gemini.
 * - Estructura raíz inválida → lanza CvSkillsValidationError.
 * - Ítems inválidos → se descartan con warning explícito (nunca en silencio).
 */
export function validateExtractedCvSkills(raw: unknown): ExtractedCvSkills {
  if (!isPlainObject(raw)) {
    throw new CvSkillsValidationError(
      'La respuesta de skills no es un objeto JSON raíz válido.',
    );
  }

  if (!Array.isArray(raw.categories)) {
    throw new CvSkillsValidationError(
      'La respuesta de skills no incluye "categories" como arreglo.',
    );
  }
  if (!Array.isArray(raw.languages)) {
    throw new CvSkillsValidationError(
      'La respuesta de skills no incluye "languages" como arreglo.',
    );
  }
  if (!Array.isArray(raw.certifications)) {
    throw new CvSkillsValidationError(
      'La respuesta de skills no incluye "certifications" como arreglo.',
    );
  }
  if (!Array.isArray(raw.warnings)) {
    throw new CvSkillsValidationError(
      'La respuesta de skills no incluye "warnings" como arreglo.',
    );
  }

  const warnings: string[] = [];

  for (const w of raw.warnings) {
    if (warnings.length >= CV_SKILLS_LIMITS.maxWarnings) break;
    if (isNonEmptyString(w)) {
      warnings.push(clampString(w, CV_SKILLS_LIMITS.maxEvidenceLength));
    } else {
      warnings.push('warnings: elemento no string o vacío; omitido del modelo.');
    }
  }

  const categories: ExtractedSkillCategory[] = [];
  for (let i = 0; i < raw.categories.length; i++) {
    if (categories.length >= CV_SKILLS_LIMITS.maxCategories) {
      warnings.push(
        `categories: se alcanzó el límite de ${CV_SKILLS_LIMITS.maxCategories}; el resto se omite.`,
      );
      break;
    }
    const category = parseCategory(raw.categories[i], i, warnings);
    if (category) categories.push(category);
  }

  const languages: ExtractedLanguage[] = [];
  for (let i = 0; i < raw.languages.length; i++) {
    if (languages.length >= CV_SKILLS_LIMITS.maxLanguages) {
      warnings.push(
        `languages: se alcanzó el límite de ${CV_SKILLS_LIMITS.maxLanguages}; el resto se omite.`,
      );
      break;
    }
    const language = parseLanguage(raw.languages[i], i, warnings);
    if (language) languages.push(language);
  }

  const certifications: ExtractedCertification[] = [];
  for (let i = 0; i < raw.certifications.length; i++) {
    if (certifications.length >= CV_SKILLS_LIMITS.maxCertifications) {
      warnings.push(
        `certifications: se alcanzó el límite de ${CV_SKILLS_LIMITS.maxCertifications}; el resto se omite.`,
      );
      break;
    }
    const certification = parseCertification(
      raw.certifications[i],
      i,
      warnings,
    );
    if (certification) certifications.push(certification);
  }

  return { categories, languages, certifications, warnings };
}
