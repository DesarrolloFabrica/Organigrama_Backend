/**
 * Validación estructural del JSON curado (sin BD).
 */

import {
  EVIDENCE_SOURCE_TYPES,
  SKILL_TYPES,
  type EvidenceSourceType,
  type SkillType,
} from '../../cv-skills/cv-skills.types';
import {
  CURATED_EVIDENCE_TYPES,
  CURATED_LIMITS,
  CURATED_PROFILE_SCHEMA_VERSIONS,
  CURATED_REVIEW_STATUSES,
  CURATED_ROLE_INFERENCE_PATTERNS,
  CURATED_SKILL_REVIEW_DECISIONS,
  CURATED_SOURCE_METHODS,
  CURATED_SOURCE_TYPES,
} from './curated-profile.constants';
import type {
  CuratedEvidenceItem,
  CuratedProfileDocument,
  CuratedSkillInput,
  CuratedSpecialtyInput,
} from './curated-profile.schema';
import type { CuratedIssue } from './curated-profile.types';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushError(
  errors: CuratedIssue[],
  code: string,
  path: string,
  message: string,
): void {
  errors.push({ code, severity: 'error', path, message });
}

function pushWarning(
  warnings: CuratedIssue[],
  code: string,
  path: string,
  message: string,
): void {
  warnings.push({ code, severity: 'warning', path, message });
}

function isConfidence(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateConfidence(
  value: unknown,
  path: string,
  errors: CuratedIssue[],
): number | null {
  if (!isConfidence(value)) {
    pushError(
      errors,
      'CONFIDENCE_TYPE',
      path,
      'confidence debe ser un número finito entre 0 y 1.',
    );
    return null;
  }
  if (value < 0 || value > 1) {
    pushError(
      errors,
      'CONFIDENCE_RANGE',
      path,
      `confidence fuera de rango 0..1 (recibido ${value}).`,
    );
    return null;
  }
  return value;
}

function validateEvidenceList(
  raw: unknown,
  path: string,
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): CuratedEvidenceItem[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    pushError(
      errors,
      'EVIDENCE_REQUIRED',
      path,
      'Cada skill requiere al menos una evidencia.',
    );
    return [];
  }
  if (raw.length > CURATED_LIMITS.maxEvidencePerSkill) {
    pushError(
      errors,
      'EVIDENCE_TOO_MANY',
      path,
      `Máximo ${CURATED_LIMITS.maxEvidencePerSkill} evidencias por skill.`,
    );
  }

  const items: CuratedEvidenceItem[] = [];
  const seenTexts = new Set<string>();

  raw.forEach((entry, index) => {
    const itemPath = `${path}[${index}]`;
    if (!isPlainObject(entry)) {
      pushError(errors, 'EVIDENCE_SHAPE', itemPath, 'Evidencia debe ser objeto.');
      return;
    }
    if (!isNonEmptyString(entry.text)) {
      pushError(
        errors,
        'EVIDENCE_EMPTY',
        `${itemPath}.text`,
        'Evidencia vacía o ausente.',
      );
      return;
    }
    const text = entry.text.trim().slice(0, CURATED_LIMITS.maxEvidenceLength);
    if (text.length < CURATED_LIMITS.minEvidenceLength) {
      pushWarning(
        warnings,
        'EVIDENCE_TOO_SHORT',
        `${itemPath}.text`,
        `Evidencia muy corta (<${CURATED_LIMITS.minEvidenceLength} chars); revisar.`,
      );
    }
    const textKey = text.toLowerCase();
    if (seenTexts.has(textKey)) {
      pushWarning(
        warnings,
        'EVIDENCE_DUPLICATE',
        itemPath,
        'Evidencia duplicada dentro de la skill.',
      );
    }
    seenTexts.add(textKey);

    if (
      !isNonEmptyString(entry.evidenceType) ||
      !(CURATED_EVIDENCE_TYPES as readonly string[]).includes(entry.evidenceType)
    ) {
      pushError(
        errors,
        'EVIDENCE_TYPE',
        `${itemPath}.evidenceType`,
        `evidenceType inválido (esperado EXPLICIT|CONTEXTUAL).`,
      );
      return;
    }

    let sourceSection: EvidenceSourceType | undefined;
    if (entry.sourceSection !== undefined) {
      if (
        !isNonEmptyString(entry.sourceSection) ||
        !(EVIDENCE_SOURCE_TYPES as readonly string[]).includes(
          entry.sourceSection,
        )
      ) {
        pushError(
          errors,
          'EVIDENCE_SOURCE_SECTION',
          `${itemPath}.sourceSection`,
          `sourceSection inválido; usar catálogo EvidenceSourceType de extracción.`,
        );
        return;
      }
      sourceSection = entry.sourceSection as EvidenceSourceType;
    }

    for (const pattern of CURATED_ROLE_INFERENCE_PATTERNS) {
      if (pattern.test(text)) {
        pushWarning(
          warnings,
          'EVIDENCE_ROLE_HEURISTIC',
          itemPath,
          'La evidencia menciona términos de cargo/jerarquía/área; revisar que no sea la evidencia principal.',
        );
        break;
      }
    }

    items.push({
      text,
      evidenceType: entry.evidenceType as CuratedEvidenceItem['evidenceType'],
      sourceSection,
    });
  });

  return items;
}

function validateSkill(
  raw: unknown,
  path: string,
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): CuratedSkillInput | null {
  if (!isPlainObject(raw)) {
    pushError(errors, 'SKILL_SHAPE', path, 'Skill debe ser objeto.');
    return null;
  }
  if (!isNonEmptyString(raw.canonicalName)) {
    pushError(
      errors,
      'SKILL_NAME',
      `${path}.canonicalName`,
      'canonicalName requerido.',
    );
    return null;
  }
  const confidence = validateConfidence(
    raw.confidence,
    `${path}.confidence`,
    errors,
  );
  if (confidence === null) return null;

  let skillType: SkillType | undefined;
  if (raw.skillType !== undefined) {
    if (
      !isNonEmptyString(raw.skillType) ||
      !(SKILL_TYPES as readonly string[]).includes(raw.skillType)
    ) {
      pushError(
        errors,
        'SKILL_TYPE',
        `${path}.skillType`,
        `skillType inválido; usar ${SKILL_TYPES.join('|')}.`,
      );
      return null;
    }
    skillType = raw.skillType as SkillType;
  }

  const evidence = validateEvidenceList(
    raw.evidence,
    `${path}.evidence`,
    errors,
    warnings,
  );

  let reviewDecision: CuratedSkillInput['reviewDecision'];
  if (raw.reviewDecision !== undefined) {
    if (
      !isNonEmptyString(raw.reviewDecision) ||
      !(CURATED_SKILL_REVIEW_DECISIONS as readonly string[]).includes(
        raw.reviewDecision,
      )
    ) {
      pushError(
        errors,
        'SKILL_REVIEW_DECISION',
        `${path}.reviewDecision`,
        `reviewDecision inválido; usar ${CURATED_SKILL_REVIEW_DECISIONS.join('|')}.`,
      );
      return null;
    }
    reviewDecision =
      raw.reviewDecision as CuratedSkillInput['reviewDecision'];
    if (
      reviewDecision === 'APPROVED_FOR_CREATION' &&
      skillType === undefined
    ) {
      pushError(
        errors,
        'SKILL_TYPE_REQUIRED_FOR_CREATION',
        `${path}.skillType`,
        'APPROVED_FOR_CREATION requiere skillType explícito.',
      );
      return null;
    }
  }

  return {
    canonicalName: raw.canonicalName.trim().slice(0, CURATED_LIMITS.maxNameLength),
    displayName: isNonEmptyString(raw.displayName)
      ? raw.displayName.trim().slice(0, CURATED_LIMITS.maxNameLength)
      : undefined,
    skillType,
    confidence,
    evidence,
    reviewDecision,
    skillCode: isNonEmptyString(raw.skillCode) ? raw.skillCode.trim() : undefined,
    matchedSkillId: isNonEmptyString(raw.matchedSkillId)
      ? raw.matchedSkillId.trim()
      : undefined,
    matchedAlias: isNonEmptyString(raw.matchedAlias)
      ? raw.matchedAlias.trim()
      : undefined,
    normalizationMethod: isNonEmptyString(raw.normalizationMethod)
      ? raw.normalizationMethod.trim()
      : undefined,
  };
}

function validateSpecialty(
  raw: unknown,
  path: string,
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): CuratedSpecialtyInput | null {
  if (!isPlainObject(raw)) {
    pushError(errors, 'SPECIALTY_SHAPE', path, 'Especialidad debe ser objeto.');
    return null;
  }
  if (!isNonEmptyString(raw.code)) {
    pushError(errors, 'SPECIALTY_CODE', `${path}.code`, 'code requerido.');
    return null;
  }
  const confidence = validateConfidence(
    raw.confidence,
    `${path}.confidence`,
    errors,
  );
  if (confidence === null) return null;

  if (!Array.isArray(raw.skills) || raw.skills.length === 0) {
    pushError(
      errors,
      'SPECIALTY_SKILLS_EMPTY',
      `${path}.skills`,
      'Cada especialidad requiere al menos una skill.',
    );
    return null;
  }
  if (raw.skills.length > CURATED_LIMITS.maxSkillsPerSpecialty) {
    pushError(
      errors,
      'SPECIALTY_SKILLS_TOO_MANY',
      `${path}.skills`,
      `Máximo ${CURATED_LIMITS.maxSkillsPerSpecialty} skills por especialidad.`,
    );
  }

  const skills: CuratedSkillInput[] = [];
  const seenSkillKeys = new Set<string>();
  raw.skills.forEach((skillRaw, index) => {
    const skill = validateSkill(
      skillRaw,
      `${path}.skills[${index}]`,
      errors,
      warnings,
    );
    if (!skill) return;
    const dupKey = `${skill.canonicalName.trim().toLowerCase()}|${skill.skillType ?? ''}`;
    if (seenSkillKeys.has(dupKey)) {
      pushError(
        errors,
        'SKILL_DUPLICATE',
        `${path}.skills[${index}]`,
        `Skill duplicada en la especialidad: "${skill.canonicalName}".`,
      );
      return;
    }
    seenSkillKeys.add(dupKey);
    skills.push(skill);
  });

  return {
    code: raw.code.trim().toUpperCase(),
    name: isNonEmptyString(raw.name) ? raw.name.trim() : undefined,
    confidence,
    skills,
  };
}

export interface CuratedStructureValidationResult {
  ok: boolean;
  document: CuratedProfileDocument | null;
  errors: CuratedIssue[];
  warnings: CuratedIssue[];
}

/**
 * Parsea y valida la forma del JSON curado. No consulta BD.
 */
export function validateCuratedProfileStructure(
  input: unknown,
): CuratedStructureValidationResult {
  const errors: CuratedIssue[] = [];
  const warnings: CuratedIssue[] = [];

  if (!isPlainObject(input)) {
    pushError(errors, 'ROOT_SHAPE', '$', 'El JSON raíz debe ser un objeto.');
    return { ok: false, document: null, errors, warnings };
  }

  if (
    !isNonEmptyString(input.schemaVersion) ||
    !(CURATED_PROFILE_SCHEMA_VERSIONS as readonly string[]).includes(
      input.schemaVersion,
    )
  ) {
    pushError(
      errors,
      'SCHEMA_VERSION',
      '$.schemaVersion',
      `schemaVersion no soportada (esperado una de [${CURATED_PROFILE_SCHEMA_VERSIONS.join(', ')}], recibido "${String(input.schemaVersion)}").`,
    );
  }

  if (!isPlainObject(input.source)) {
    pushError(errors, 'SOURCE_SHAPE', '$.source', 'source requerido.');
  } else {
    if (
      !isNonEmptyString(input.source.type) ||
      !(CURATED_SOURCE_TYPES as readonly string[]).includes(input.source.type)
    ) {
      pushError(
        errors,
        'SOURCE_TYPE',
        '$.source.type',
        'source.type debe ser MANUAL_CURATED.',
      );
    }
    if (
      !isNonEmptyString(input.source.method) ||
      !(CURATED_SOURCE_METHODS as readonly string[]).includes(
        input.source.method,
      )
    ) {
      pushError(
        errors,
        'SOURCE_METHOD',
        '$.source.method',
        'source.method debe ser CHATGPT_HUMAN_REVIEW.',
      );
    }
    if (
      !isNonEmptyString(input.source.reviewStatus) ||
      !(CURATED_REVIEW_STATUSES as readonly string[]).includes(
        input.source.reviewStatus,
      )
    ) {
      pushError(
        errors,
        'SOURCE_REVIEW_STATUS',
        '$.source.reviewStatus',
        'source.reviewStatus debe ser REVIEWED|DRAFT.',
      );
    }
  }

  if (!isPlainObject(input.person) || !isNonEmptyString(input.person.document)) {
    pushError(
      errors,
      'PERSON_DOCUMENT',
      '$.person.document',
      'person.document requerido (no vacío).',
    );
  } else if (!/^\d{5,20}$/.test(input.person.document.trim())) {
    pushWarning(
      warnings,
      'PERSON_DOCUMENT_FORMAT',
      '$.person.document',
      'document no parece una cédula numérica típica (5–20 dígitos).',
    );
  }

  if (
    !isPlainObject(input.profile) ||
    !isNonEmptyString(input.profile.primaryDomainCode)
  ) {
    pushError(
      errors,
      'PROFILE_PRIMARY_DOMAIN',
      '$.profile.primaryDomainCode',
      'profile.primaryDomainCode requerido.',
    );
  }

  if (!isPlainObject(input.domain) || !isNonEmptyString(input.domain.code)) {
    pushError(errors, 'DOMAIN_CODE', '$.domain.code', 'domain.code requerido.');
  } else {
    validateConfidence(input.domain.confidence, '$.domain.confidence', errors);
  }

  if (
    isPlainObject(input.profile) &&
    isPlainObject(input.domain) &&
    isNonEmptyString(input.profile.primaryDomainCode) &&
    isNonEmptyString(input.domain.code) &&
    input.profile.primaryDomainCode.trim().toUpperCase() !==
      input.domain.code.trim().toUpperCase()
  ) {
    pushError(
      errors,
      'DOMAIN_PROFILE_MISMATCH',
      '$.profile.primaryDomainCode',
      'primaryDomainCode debe coincidir con domain.code.',
    );
  }

  if (!Array.isArray(input.specialties) || input.specialties.length === 0) {
    pushError(
      errors,
      'SPECIALTIES_EMPTY',
      '$.specialties',
      'Se requiere al menos una especialidad.',
    );
  } else if (input.specialties.length > CURATED_LIMITS.maxSpecialties) {
    pushError(
      errors,
      'SPECIALTIES_TOO_MANY',
      '$.specialties',
      `Máximo ${CURATED_LIMITS.maxSpecialties} especialidades.`,
    );
  }

  const specialties: CuratedSpecialtyInput[] = [];
  const seenSpecialtyCodes = new Set<string>();
  if (Array.isArray(input.specialties)) {
    input.specialties.forEach((raw, index) => {
      const specialty = validateSpecialty(
        raw,
        `$.specialties[${index}]`,
        errors,
        warnings,
      );
      if (!specialty) return;
      if (seenSpecialtyCodes.has(specialty.code)) {
        pushError(
          errors,
          'SPECIALTY_DUPLICATE',
          `$.specialties[${index}]`,
          `Especialidad duplicada: ${specialty.code}.`,
        );
        return;
      }
      seenSpecialtyCodes.add(specialty.code);
      specialties.push(specialty);
    });
  }

  if (Array.isArray(input.warnings) && input.warnings.length > CURATED_LIMITS.maxWarnings) {
    pushWarning(
      warnings,
      'FILE_WARNINGS_TRIM',
      '$.warnings',
      `Archivo declara más de ${CURATED_LIMITS.maxWarnings} warnings; se conservarán todas en dry-run.`,
    );
  }

  if (errors.length > 0) {
    return { ok: false, document: null, errors, warnings };
  }

  const source = input.source as Record<string, unknown>;
  const person = input.person as Record<string, unknown>;
  const profile = input.profile as Record<string, unknown>;
  const domain = input.domain as Record<string, unknown>;

  const document: CuratedProfileDocument = {
    schemaVersion: String(input.schemaVersion),
    source: {
      type: source.type as CuratedProfileDocument['source']['type'],
      method: source.method as CuratedProfileDocument['source']['method'],
      reviewStatus:
        source.reviewStatus as CuratedProfileDocument['source']['reviewStatus'],
      reviewedAt: isNonEmptyString(source.reviewedAt)
        ? source.reviewedAt.trim()
        : undefined,
      notes: isNonEmptyString(source.notes) ? source.notes.trim() : undefined,
    },
    person: { document: String(person.document).trim() },
    profile: {
      primaryDomainCode: String(profile.primaryDomainCode).trim().toUpperCase(),
      summary: isNonEmptyString(profile.summary)
        ? profile.summary.trim()
        : undefined,
    },
    domain: {
      code: String(domain.code).trim().toUpperCase(),
      name: isNonEmptyString(domain.name) ? domain.name.trim() : undefined,
      confidence: domain.confidence as number,
    },
    specialties,
    warnings: Array.isArray(input.warnings)
      ? input.warnings.filter((w): w is string => typeof w === 'string')
      : [],
    notes: Array.isArray(input.notes)
      ? input.notes.filter((n): n is string => typeof n === 'string')
      : [],
  };

  return { ok: true, document, errors, warnings };
}
