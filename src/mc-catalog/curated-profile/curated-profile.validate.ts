/**
 * Validador semántico RO del perfil curado (estructura + persona + catálogo).
 *
 * Confianza del JSON = seguridad de curaduría humana.
 * No calcula ni sustituye scores PA2 (coverage/confidence/strength).
 */

import type { SkillType } from '../../cv-skills/cv-skills.types';
import { CURATED_PROFILE_SCHEMA_VERSION } from './curated-profile.constants';
import type { CuratedCatalogLookup } from './curated-profile.catalog-lookup';
import {
  maskDocument,
  resolveSafeAliasCanonicalName,
  toCanonicalKey,
} from './curated-profile.normalize';
import type {
  CuratedProfileDocument,
  CuratedSkillInput,
} from './curated-profile.schema';
import type {
  CuratedDomainResolution,
  CuratedIssue,
  CuratedPersonResolution,
  CuratedProfileValidationReport,
  CuratedSkillResolution,
  CuratedSkillsBuckets,
  CuratedSpecialtyResolution,
} from './curated-profile.types';
import { validateCuratedProfileStructure } from './curated-profile.validate-structure';

function emptyBuckets(): CuratedSkillsBuckets {
  return {
    existing: [],
    resolvedAliases: [],
    proposed: [],
    ambiguous: [],
    invalid: [],
  };
}

function emptyPerson(documentMasked: string): CuratedPersonResolution {
  return {
    found: false,
    personId: null,
    documentMasked,
    isActive: null,
    personCvId: null,
    activeCvCount: 0,
    ambiguousPersonCount: 0,
  };
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

function bucketPush(
  buckets: CuratedSkillsBuckets,
  skill: CuratedSkillResolution,
): void {
  switch (skill.status) {
    case 'EXISTING':
      buckets.existing.push(skill);
      break;
    case 'ALIAS':
      buckets.resolvedAliases.push(skill);
      break;
    case 'PROPOSED':
      buckets.proposed.push(skill);
      break;
    case 'AMBIGUOUS':
      buckets.ambiguous.push(skill);
      break;
    default:
      buckets.invalid.push(skill);
  }
}

function buildReport(params: {
  person: CuratedPersonResolution;
  domain: CuratedDomainResolution | null;
  specialties: CuratedSpecialtyResolution[];
  skills: CuratedSkillsBuckets;
  errors: CuratedIssue[];
  warnings: CuratedIssue[];
}): CuratedProfileValidationReport {
  const { errors, warnings, skills } = params;
  return {
    schemaVersion: CURATED_PROFILE_SCHEMA_VERSION,
    valid: errors.length === 0,
    person: params.person,
    domain: params.domain,
    specialties: params.specialties,
    skills,
    errors,
    warnings,
    summary: {
      errorCount: errors.length,
      warningCount: warnings.length,
      existingSkillCount: skills.existing.length,
      aliasSkillCount: skills.resolvedAliases.length,
      proposedSkillCount: skills.proposed.length,
      ambiguousSkillCount: skills.ambiguous.length,
      invalidSkillCount: skills.invalid.length,
    },
  };
}

async function resolvePerson(
  lookup: CuratedCatalogLookup,
  document: string,
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): Promise<CuratedPersonResolution> {
  const masked = maskDocument(document);
  const persons = await lookup.findPersonsByDocument(document);
  if (persons.length === 0) {
    pushError(
      errors,
      'PERSON_NOT_FOUND',
      '$.person.document',
      `No se encontró persona para document=${masked}.`,
    );
    return emptyPerson(masked);
  }
  if (persons.length > 1) {
    pushError(
      errors,
      'PERSON_AMBIGUOUS',
      '$.person.document',
      `Documento ambiguo: ${persons.length} personas con document=${masked}.`,
    );
    return {
      ...emptyPerson(masked),
      ambiguousPersonCount: persons.length,
    };
  }

  const person = persons[0];
  if (!person.isActive) {
    pushWarning(
      warnings,
      'PERSON_INACTIVE',
      '$.person.document',
      `Persona ${person.personId} está inactiva (is_active=false).`,
    );
  }

  const cvs = await lookup.findActivePersonCvs(person.personId);
  if (cvs.length === 0) {
    pushError(
      errors,
      'PERSON_CV_MISSING',
      '$.person.document',
      `Persona ${person.personId} no tiene person_cv activo.`,
    );
    return {
      found: true,
      personId: person.personId,
      documentMasked: masked,
      isActive: person.isActive,
      personCvId: null,
      activeCvCount: 0,
      ambiguousPersonCount: 0,
    };
  }
  if (cvs.length > 1) {
    pushWarning(
      warnings,
      'PERSON_CV_MULTIPLE',
      '$.person.document',
      `Persona ${person.personId} tiene ${cvs.length} person_cv activos; se usará el de menor id.`,
    );
  }

  return {
    found: true,
    personId: person.personId,
    documentMasked: masked,
    isActive: person.isActive,
    personCvId: cvs[0].id,
    activeCvCount: cvs.length,
    ambiguousPersonCount: 0,
  };
}

async function resolveDomain(
  lookup: CuratedCatalogLookup,
  document: CuratedProfileDocument,
  errors: CuratedIssue[],
): Promise<CuratedDomainResolution> {
  const code = document.domain.code;
  const row = await lookup.findActiveDomainByCode(code);
  if (!row) {
    pushError(
      errors,
      'DOMAIN_PROPOSED_OR_MISSING',
      '$.domain.code',
      `Dominio "${code}" no existe en el catálogo activo. PROPOSED/creación automática no permitida en el piloto.`,
    );
    return {
      inputCode: code,
      inputName: document.domain.name ?? null,
      matchedDomainId: null,
      matchedName: null,
      status: 'PROPOSED',
      catalogVersionId: null,
      catalogVersion: null,
    };
  }
  if (!row.isActive) {
    pushError(
      errors,
      'DOMAIN_INACTIVE',
      '$.domain.code',
      `Dominio "${code}" está inactivo en catálogo.`,
    );
    return {
      inputCode: code,
      inputName: document.domain.name ?? null,
      matchedDomainId: row.id,
      matchedName: row.name,
      status: 'INVALID',
      catalogVersionId: row.catalogVersionId,
      catalogVersion: row.catalogVersion,
    };
  }
  return {
    inputCode: code,
    inputName: document.domain.name ?? null,
    matchedDomainId: row.id,
    matchedName: row.name,
    status: 'EXISTING',
    catalogVersionId: row.catalogVersionId,
    catalogVersion: row.catalogVersion,
  };
}

async function resolveSpecialties(
  lookup: CuratedCatalogLookup,
  document: CuratedProfileDocument,
  domain: CuratedDomainResolution,
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): Promise<CuratedSpecialtyResolution[]> {
  const codes = document.specialties.map((s) => s.code);
  const rows = await lookup.findSpecialtiesByCodes(codes);
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const results: CuratedSpecialtyResolution[] = [];

  document.specialties.forEach((specialty, index) => {
    const path = `$.specialties[${index}]`;
    const row = byCode.get(specialty.code);
    if (!row) {
      // Decisión piloto: especialidad no catalogada = PROPOSED → WARNING (no se crea).
      // Las skills aún se validan; PA2 mapeará por skill→specialty mappings existentes.
      pushWarning(
        warnings,
        'SPECIALTY_PROPOSED',
        path,
        `Especialidad "${specialty.code}" no está en el catálogo activo (PROPOSED; no se creará).`,
      );
      results.push({
        inputCode: specialty.code,
        inputName: specialty.name ?? null,
        matchedSpecialtyId: null,
        matchedName: null,
        domainCode: null,
        lifecycleStatus: null,
        status: 'PROPOSED',
        mappingSkillCount: 0,
      });
      return;
    }

    if (domain.matchedDomainId && row.domainCode !== document.domain.code) {
      pushError(
        errors,
        'SPECIALTY_WRONG_DOMAIN',
        path,
        `Especialidad "${specialty.code}" pertenece a dominio ${row.domainCode}, no a ${document.domain.code}.`,
      );
      results.push({
        inputCode: specialty.code,
        inputName: specialty.name ?? null,
        matchedSpecialtyId: row.id,
        matchedName: row.name,
        domainCode: row.domainCode,
        lifecycleStatus: row.lifecycleStatus,
        status: 'INVALID',
        mappingSkillCount: row.mappingSkillCount,
      });
      return;
    }

    if (!row.isActive || row.lifecycleStatus === 'INACTIVE') {
      pushError(
        errors,
        'SPECIALTY_INACTIVE',
        path,
        `Especialidad "${specialty.code}" inactiva (lifecycle=${row.lifecycleStatus}).`,
      );
      results.push({
        inputCode: specialty.code,
        inputName: specialty.name ?? null,
        matchedSpecialtyId: row.id,
        matchedName: row.name,
        domainCode: row.domainCode,
        lifecycleStatus: row.lifecycleStatus,
        status: 'INVALID',
        mappingSkillCount: row.mappingSkillCount,
      });
      return;
    }

    if (row.lifecycleStatus === 'EXPERIMENTAL') {
      pushWarning(
        warnings,
        'SPECIALTY_EXPERIMENTAL',
        path,
        `Especialidad "${specialty.code}" tiene lifecycle EXPERIMENTAL.`,
      );
    }

    if (row.mappingSkillCount === 0) {
      pushWarning(
        warnings,
        'SPECIALTY_NO_MAPPINGS',
        path,
        `Especialidad "${specialty.code}" no tiene skill mappings en el catálogo activo.`,
      );
    }

    results.push({
      inputCode: specialty.code,
      inputName: specialty.name ?? null,
      matchedSpecialtyId: row.id,
      matchedName: row.name,
      domainCode: row.domainCode,
      lifecycleStatus: row.lifecycleStatus,
      status: 'EXISTING',
      mappingSkillCount: row.mappingSkillCount,
    });
  });

  return results;
}

async function resolveSkills(
  lookup: CuratedCatalogLookup,
  document: CuratedProfileDocument,
  specialtyResolutions: CuratedSpecialtyResolution[],
  errors: CuratedIssue[],
  warnings: CuratedIssue[],
): Promise<CuratedSkillsBuckets> {
  const buckets = emptyBuckets();
  const specialtyByCode = new Map(
    specialtyResolutions.map((s) => [s.inputCode, s]),
  );

  type Pending = {
    specialtyCode: string;
    specialtyIndex: number;
    skillIndex: number;
    skill: CuratedSkillInput;
    inputKey: string;
    safeCanonical: string | null;
    safeKey: string | null;
  };

  const pending: Pending[] = [];
  document.specialties.forEach((specialty, specialtyIndex) => {
    specialty.skills.forEach((skill, skillIndex) => {
      const inputKey = toCanonicalKey(skill.canonicalName);
      const safeCanonical = resolveSafeAliasCanonicalName(skill.canonicalName);
      pending.push({
        specialtyCode: specialty.code,
        specialtyIndex,
        skillIndex,
        skill,
        inputKey,
        safeCanonical,
        safeKey: safeCanonical ? toCanonicalKey(safeCanonical) : null,
      });
    });
  });

  const keysToLookup = [
    ...new Set(
      pending.flatMap((p) =>
        [p.inputKey, p.safeKey].filter((k): k is string => !!k),
      ),
    ),
  ];
  const [skillRows, aliasRows] = await Promise.all([
    lookup.findSkillsByNormalizedKeys(keysToLookup),
    lookup.findAliasesByKeys(keysToLookup),
  ]);

  const skillsByKey = new Map<string, typeof skillRows>();
  for (const row of skillRows) {
    const list = skillsByKey.get(row.normalizedKey) ?? [];
    list.push(row);
    skillsByKey.set(row.normalizedKey, list);
  }
  const aliasesByKey = new Map(aliasRows.map((a) => [a.aliasKey, a]));

  for (const item of pending) {
    const path = `$.specialties[${item.specialtyIndex}].skills[${item.skillIndex}]`;
    const base: CuratedSkillResolution = {
      inputCanonicalName: item.skill.canonicalName,
      inputDisplayName: item.skill.displayName ?? null,
      inputSkillType: item.skill.skillType ?? null,
      specialtyCode: item.specialtyCode,
      status: 'INVALID',
      matchedSkillId: null,
      matchedNormalizedName: null,
      matchedSkillType: null,
      matchedAliasKey: null,
      matchedAliasName: null,
      normalizationMethod: 'NONE',
      evidenceCount: item.skill.evidence.length,
      hasMappingToSpecialty: null,
      confidence: item.skill.confidence,
    };

    if (!item.inputKey) {
      pushError(
        errors,
        'SKILL_KEY_EMPTY',
        path,
        `canonicalName no produce normalized_key válido.`,
      );
      bucketPush(buckets, base);
      continue;
    }

    const filterByType = (
      rows: typeof skillRows,
      type: SkillType | undefined,
    ) => (type ? rows.filter((r) => r.skillType === type) : rows);

    // 1) Match exacto por normalized_key (+ skillType opcional)
    let candidates = filterByType(
      skillsByKey.get(item.inputKey) ?? [],
      item.skill.skillType,
    );
    let normalizationMethod: CuratedSkillResolution['normalizationMethod'] =
      'EXACT_KEY';
    let matchedAliasKey: string | null = null;
    let matchedAliasName: string | null = null;

    // 2) Alias en BD
    if (candidates.length === 0) {
      const alias = aliasesByKey.get(item.inputKey);
      if (alias && alias.skillIsActive) {
        if (
          !item.skill.skillType ||
          alias.skillType === item.skill.skillType
        ) {
          candidates = [
            {
              id: alias.skillId,
              normalizedName: alias.skillNormalizedName,
              normalizedKey: alias.skillNormalizedKey,
              skillType: alias.skillType,
              isActive: alias.skillIsActive,
            },
          ];
          normalizationMethod = 'CV_SKILL_ALIAS';
          matchedAliasKey = alias.aliasKey;
          matchedAliasName = alias.aliasName;
        }
      }
    }

    // 3) SAFE_SKILL_ALIASES → lookup canónico
    if (candidates.length === 0 && item.safeKey) {
      candidates = filterByType(
        skillsByKey.get(item.safeKey) ?? [],
        item.skill.skillType,
      );
      if (candidates.length > 0) {
        normalizationMethod = 'SAFE_SKILL_ALIASES';
        matchedAliasKey = item.inputKey;
        matchedAliasName = item.skill.canonicalName;
      }
    }

    if (candidates.length === 0) {
      const resolution: CuratedSkillResolution = {
        ...base,
        status: 'PROPOSED',
        normalizationMethod: 'NONE',
      };
      pushWarning(
        warnings,
        'SKILL_PROPOSED',
        path,
        `Skill propuesta (no está en cv_skill/alias): "${item.skill.canonicalName}". No se creará en Fase 1.`,
      );
      bucketPush(buckets, resolution);
      continue;
    }

    if (candidates.length > 1) {
      const resolution: CuratedSkillResolution = {
        ...base,
        status: 'AMBIGUOUS',
        normalizationMethod,
        matchedAliasKey,
        matchedAliasName,
      };
      pushError(
        errors,
        'SKILL_AMBIGUOUS',
        path,
        `Skill ambigua "${item.skill.canonicalName}" (${candidates.length} coincidencias; especifique skillType).`,
      );
      bucketPush(buckets, resolution);
      continue;
    }

    const matched = candidates[0];
    if (!matched.isActive) {
      const resolution: CuratedSkillResolution = {
        ...base,
        status: 'INVALID',
        matchedSkillId: matched.id,
        matchedNormalizedName: matched.normalizedName,
        matchedSkillType: matched.skillType,
        normalizationMethod,
        matchedAliasKey,
        matchedAliasName,
      };
      pushError(
        errors,
        'SKILL_INACTIVE',
        path,
        `Skill resuelta inactiva: ${matched.normalizedName} (${matched.id}).`,
      );
      bucketPush(buckets, resolution);
      continue;
    }

    const specialty = specialtyByCode.get(item.specialtyCode);
    let hasMapping: boolean | null = null;
    if (specialty?.matchedSpecialtyId) {
      hasMapping = await lookup.hasSpecialtyMapping({
        specialtyId: specialty.matchedSpecialtyId,
        skillId: matched.id,
      });
      if (!hasMapping) {
        pushWarning(
          warnings,
          'SKILL_NO_SPECIALTY_MAPPING',
          path,
          `Skill "${matched.normalizedName}" no tiene mapping a especialidad ${item.specialtyCode} en catálogo activo.`,
        );
      }
    }

    const status =
      normalizationMethod === 'EXACT_KEY' ? 'EXISTING' : 'ALIAS';
    const resolution: CuratedSkillResolution = {
      ...base,
      status,
      matchedSkillId: matched.id,
      matchedNormalizedName: matched.normalizedName,
      matchedSkillType: matched.skillType,
      matchedAliasKey,
      matchedAliasName,
      normalizationMethod,
      hasMappingToSpecialty: hasMapping,
    };

    if (status === 'ALIAS') {
      pushWarning(
        warnings,
        'SKILL_ALIAS_RESOLVED',
        path,
        `Alias resuelto: recibido="${item.skill.canonicalName}" → canónica="${matched.normalizedName}" (skill_id=${matched.id}` +
          (matchedAliasKey ? `, alias_key=${matchedAliasKey}` : '') +
          `).`,
      );
    }

    bucketPush(buckets, resolution);
  }

  return buckets;
}

export interface ValidateCuratedProfileOptions {
  /** Sobrescribe person.document (útil para fixtures sin cédula real). */
  documentOverride?: string;
}

/**
 * Valida estructura + semántica contra BD (solo SELECT).
 */
export async function validateCuratedProfile(
  input: unknown,
  lookup: CuratedCatalogLookup,
  options: ValidateCuratedProfileOptions = {},
): Promise<CuratedProfileValidationReport> {
  const structure = validateCuratedProfileStructure(input);
  const errors = [...structure.errors];
  const warnings = [...structure.warnings];

  if (!structure.ok || !structure.document) {
    return buildReport({
      person: emptyPerson(
        maskDocument(
          options.documentOverride ??
            (typeof (input as { person?: { document?: string } })?.person
              ?.document === 'string'
              ? (input as { person: { document: string } }).person.document
              : '????'),
        ),
      ),
      domain: null,
      specialties: [],
      skills: emptyBuckets(),
      errors,
      warnings,
    });
  }

  const document: CuratedProfileDocument = {
    ...structure.document,
    person: {
      document: (
        options.documentOverride ?? structure.document.person.document
      ).trim(),
    },
  };

  const person = await resolvePerson(
    lookup,
    document.person.document,
    errors,
    warnings,
  );
  const domain = await resolveDomain(lookup, document, errors);
  const specialties = await resolveSpecialties(
    lookup,
    document,
    domain,
    errors,
    warnings,
  );
  const skills = await resolveSkills(
    lookup,
    document,
    specialties,
    errors,
    warnings,
  );

  return buildReport({
    person,
    domain,
    specialties,
    skills,
    errors,
    warnings,
  });
}
