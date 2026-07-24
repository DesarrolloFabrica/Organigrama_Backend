import type { AttributeCatalog } from './cv-attributes.types';

export interface MappingValidationIssue {
  code:
    | 'WEIGHT_OUT_OF_RANGE'
    | 'WEIGHT_SUM_EXCEEDED'
    | 'DUPLICATE_MAPPING'
    | 'UNKNOWN_SUBATTRIBUTE'
    | 'INACTIVE_SUBATTRIBUTE'
    | 'UNKNOWN_MACROATTRIBUTE'
    | 'CATALOG_NOT_ACTIVE'
    | 'EMPTY_CATALOG';
  message: string;
  skillId?: string;
  subattributeId?: string;
}

export interface MappingValidationResult {
  ok: boolean;
  errors: MappingValidationIssue[];
  warnings: MappingValidationIssue[];
  weightSumBySkill: Record<string, number>;
}

/**
 * Valida catálogo y mappings antes de ejecutar. Determinista y sin IO.
 *
 * Errores (bloquean el run):
 * - weight fuera de (0, 1];
 * - suma de weights activos por skill > 1;
 * - mapping duplicado (skillId, subattributeId);
 * - subatributo desconocido o inactivo;
 * - subatributo sin macroatributo válido;
 * - catálogo vacío.
 *
 * Advertencias (no bloquean):
 * - catálogo no ACTIVE (permitido en dry-run).
 */
export function validateAttributeCatalog(
  catalog: AttributeCatalog,
  options: { requireActiveCatalog?: boolean } = {},
): MappingValidationResult {
  const errors: MappingValidationIssue[] = [];
  const warnings: MappingValidationIssue[] = [];

  const activeSubs = new Map(
    catalog.subattributes.filter((s) => s.isActive).map((s) => [s.id, s]),
  );
  const allSubs = new Map(catalog.subattributes.map((s) => [s.id, s]));
  const macroIds = new Set(
    catalog.macroattributes.filter((m) => m.isActive).map((m) => m.id),
  );

  if (activeSubs.size === 0 || macroIds.size === 0) {
    errors.push({
      code: 'EMPTY_CATALOG',
      message:
        'El catálogo no tiene macroatributos o subatributos activos; no se puede ejecutar.',
    });
  }

  for (const sub of activeSubs.values()) {
    if (!macroIds.has(sub.macroattributeId)) {
      errors.push({
        code: 'UNKNOWN_MACROATTRIBUTE',
        message: `Subatributo ${sub.code} apunta a un macroatributo inexistente o inactivo.`,
        subattributeId: sub.id,
      });
    }
  }

  if (catalog.status !== 'ACTIVE') {
    const issue: MappingValidationIssue = {
      code: 'CATALOG_NOT_ACTIVE',
      message: `Catálogo ${catalog.catalogVersion} no está ACTIVE (status=${catalog.status}).`,
    };
    if (options.requireActiveCatalog) {
      errors.push(issue);
    } else {
      warnings.push(issue);
    }
  }

  const seen = new Set<string>();
  const weightSumBySkill: Record<string, number> = {};

  for (const mapping of catalog.mappings) {
    if (!mapping.isActive) continue;

    const key = `${mapping.skillId}|${mapping.subattributeId}`;
    if (seen.has(key)) {
      errors.push({
        code: 'DUPLICATE_MAPPING',
        message: `Mapping duplicado skillId=${mapping.skillId} subattributeId=${mapping.subattributeId}.`,
        skillId: mapping.skillId,
        subattributeId: mapping.subattributeId,
      });
      continue;
    }
    seen.add(key);

    const weight = Number(mapping.weight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) {
      errors.push({
        code: 'WEIGHT_OUT_OF_RANGE',
        message: `weight=${mapping.weight} inválido para skillId=${mapping.skillId} (debe ser >0 y <=1).`,
        skillId: mapping.skillId,
        subattributeId: mapping.subattributeId,
      });
      continue;
    }

    if (!allSubs.has(mapping.subattributeId)) {
      errors.push({
        code: 'UNKNOWN_SUBATTRIBUTE',
        message: `Mapping apunta a subattributeId=${mapping.subattributeId} inexistente en el catálogo.`,
        skillId: mapping.skillId,
        subattributeId: mapping.subattributeId,
      });
      continue;
    }
    if (!activeSubs.has(mapping.subattributeId)) {
      errors.push({
        code: 'INACTIVE_SUBATTRIBUTE',
        message: `Mapping activo apunta a un subatributo inactivo (subattributeId=${mapping.subattributeId}).`,
        skillId: mapping.skillId,
        subattributeId: mapping.subattributeId,
      });
      continue;
    }

    weightSumBySkill[mapping.skillId] =
      round4((weightSumBySkill[mapping.skillId] ?? 0) + weight);
  }

  for (const [skillId, sum] of Object.entries(weightSumBySkill)) {
    if (sum > 1.0001) {
      errors.push({
        code: 'WEIGHT_SUM_EXCEEDED',
        message: `Suma de weights activos de skillId=${skillId} es ${sum.toFixed(3)} (> 1).`,
        skillId,
      });
    }
  }

  return { ok: errors.length === 0, errors, warnings, weightSumBySkill };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}
