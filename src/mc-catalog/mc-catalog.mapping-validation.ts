/**
 * Validación pura del pack de clasificación + mappings (sin I/O).
 */

import type {
  McDomainMappingPack,
  McSkillClassificationStatus,
} from './mc-catalog.types';
import { MC_SKILL_CLASSIFICATION_STATUSES } from './mc-catalog.types';

export class McMappingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McMappingValidationError';
  }
}

export interface McMappingValidationResult {
  ok: true;
  classificationCounts: Record<McSkillClassificationStatus, number>;
  mappingCount: number;
  domainSpecialtySkillCount: number;
}

export function seedSkillKey(skillKey: string, skillType: string): string {
  return `${skillKey}|${skillType}`;
}

export function validateMappingPack(
  pack: McDomainMappingPack,
  activeSpecialtyCodes: ReadonlySet<string>,
): McMappingValidationResult {
  if (!pack.domainCode?.trim()) {
    throw new McMappingValidationError('domainCode vacío');
  }

  const classificationCounts: Record<McSkillClassificationStatus, number> = {
    DOMAIN_SPECIALTY: 0,
    TRANSVERSAL_FUTURE: 0,
    OUTSIDE_SOFTWARE_DOMAIN: 0,
    AMBIGUOUS: 0,
    CATALOG_GAP: 0,
  };

  const classifiedKeys = new Set<string>();
  for (const c of pack.classifications) {
    const key = seedSkillKey(c.skillKey, c.skillType);
    if (classifiedKeys.has(key)) {
      throw new McMappingValidationError(
        `Clasificación duplicada para skill ${key}`,
      );
    }
    classifiedKeys.add(key);
    if (
      !MC_SKILL_CLASSIFICATION_STATUSES.includes(
        c.classification as McSkillClassificationStatus,
      )
    ) {
      throw new McMappingValidationError(
        `Clasificación inválida ${c.classification} en ${key}`,
      );
    }
    classificationCounts[c.classification] += 1;
  }

  const domainSpecialtyKeys = new Set(
    pack.classifications
      .filter((c) => c.classification === 'DOMAIN_SPECIALTY')
      .map((c) => seedSkillKey(c.skillKey, c.skillType)),
  );
  const nonDomainKeys = new Set(
    pack.classifications
      .filter((c) => c.classification !== 'DOMAIN_SPECIALTY')
      .map((c) => seedSkillKey(c.skillKey, c.skillType)),
  );

  const pairKeys = new Set<string>();
  const weightBySkill = new Map<string, number>();
  const primaryBySkill = new Map<string, number>();

  for (const m of pack.mappings) {
    const skillKey = seedSkillKey(m.skillKey, m.skillType);
    if (!classifiedKeys.has(skillKey)) {
      throw new McMappingValidationError(
        `Mapping sin clasificación: ${skillKey}`,
      );
    }
    if (nonDomainKeys.has(skillKey)) {
      throw new McMappingValidationError(
        `Skill no DOMAIN_SPECIALTY no puede mapearse: ${skillKey}`,
      );
    }
    if (!domainSpecialtyKeys.has(skillKey)) {
      throw new McMappingValidationError(
        `Mapping fuera de DOMAIN_SPECIALTY: ${skillKey}`,
      );
    }
    if (!activeSpecialtyCodes.has(m.specialtyCode)) {
      throw new McMappingValidationError(
        `Especialidad inexistente o inactiva: ${m.specialtyCode}`,
      );
    }
    if (!(m.weight > 0 && m.weight <= 1)) {
      throw new McMappingValidationError(
        `Peso inválido ${m.weight} en ${skillKey} → ${m.specialtyCode}`,
      );
    }
    if (m.mappingType !== 'PRIMARY' && m.mappingType !== 'SECONDARY') {
      throw new McMappingValidationError(
        `mappingType inválido en ${skillKey} → ${m.specialtyCode}`,
      );
    }

    const pair = `${skillKey}→${m.specialtyCode}`;
    if (pairKeys.has(pair)) {
      throw new McMappingValidationError(`Mapping duplicado: ${pair}`);
    }
    pairKeys.add(pair);

    weightBySkill.set(
      skillKey,
      (weightBySkill.get(skillKey) ?? 0) + m.weight,
    );
    if (m.mappingType === 'PRIMARY') {
      primaryBySkill.set(
        skillKey,
        (primaryBySkill.get(skillKey) ?? 0) + 1,
      );
    }
  }

  for (const [skillKey, sum] of weightBySkill) {
    if (sum > 1.0001) {
      throw new McMappingValidationError(
        `Suma de pesos > 1 para ${skillKey}: ${sum}`,
      );
    }
  }

  for (const skillKey of domainSpecialtyKeys) {
    if (!weightBySkill.has(skillKey)) {
      throw new McMappingValidationError(
        `DOMAIN_SPECIALTY sin mapping: ${skillKey}`,
      );
    }
    if ((primaryBySkill.get(skillKey) ?? 0) !== 1) {
      throw new McMappingValidationError(
        `DOMAIN_SPECIALTY debe tener exactamente un PRIMARY: ${skillKey}`,
      );
    }
  }

  return {
    ok: true,
    classificationCounts,
    mappingCount: pack.mappings.length,
    domainSpecialtySkillCount: domainSpecialtyKeys.size,
  };
}

export function assertExpectedDistribution(
  counts: Record<McSkillClassificationStatus, number>,
  expected: Record<McSkillClassificationStatus, number> & { total: number },
): void {
  const total =
    counts.DOMAIN_SPECIALTY +
    counts.TRANSVERSAL_FUTURE +
    counts.OUTSIDE_SOFTWARE_DOMAIN +
    counts.AMBIGUOUS +
    counts.CATALOG_GAP;

  if (total !== expected.total) {
    throw new McMappingValidationError(
      `Total clasificaciones ${total} ≠ esperado ${expected.total}`,
    );
  }

  for (const status of MC_SKILL_CLASSIFICATION_STATUSES) {
    if (counts[status] !== expected[status]) {
      throw new McMappingValidationError(
        `Mismatch ${status}: actual=${counts[status]} esperado=${expected[status]}`,
      );
    }
  }
}
