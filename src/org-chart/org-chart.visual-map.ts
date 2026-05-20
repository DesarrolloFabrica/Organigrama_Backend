/**
 * Reglas declarativas del organigrama visual (capa Organigrama sobre Core).
 *
 * Core sigue siendo fuente de verdad; `hierarchy.level` no define el dibujo.
 * La jerarquía visual se resuelve por `role.name` (y en niveles futuros, filtros como edu_email).
 */

export type RoleMatchMode = 'exact' | 'ilike' | 'any';

/** `ilike` aquí significa: el nombre normalizado contiene el literal del patrón (equivalente a SQL ILIKE '%patrón%'). */
export type OrgVisualRootRule = {
  description: string;
  roleName: string;
  match: RoleMatchMode;
  visualLevel: number;
};

export type OrgVisualEdgeRule = {
  parentRoleName: string;
  parentMatch: RoleMatchMode;
  childRoleName: string | null;
  childMatch: RoleMatchMode;
  /** Opcional: acota hijos por correo institucional (se usa en queries, no en resolveOrgLevelFromRoleName). */
  childEduEmails?: readonly string[];
  visualLevel: number;
  description?: string;
};

export const ORG_VISUAL_ROOT_RULE: OrgVisualRootRule = {
  description: 'Raíz del organigrama visual',
  roleName: 'DIRECTOR DE OPERACIONES',
  match: 'ilike',
  visualLevel: 1,
};

export const ORG_VISUAL_EDGE_RULES: readonly OrgVisualEdgeRule[] = [
  {
    parentRoleName: 'DIRECTOR DE OPERACIONES',
    parentMatch: 'ilike',
    childRoleName: 'COORDINADOR GENERAL OPERACIONES',
    childMatch: 'ilike',
    visualLevel: 2,
    description: 'Nivel 2 bajo Director',
  },
] as const;

function matchesRolePattern(
  roleName: string | null | undefined,
  pattern: string | null,
  match: RoleMatchMode,
): boolean {
  // Si el match es "any", no importa el nombre del rol.
  if (match === 'any') {
    return true;
  }

  // Para exact/ilike sí necesitamos roleName y pattern.
  if (!roleName || !pattern) {
    return false;
  }

  const normalizedRoleName = roleName.trim().toUpperCase();
  const normalizedPattern = pattern.trim().toUpperCase();

  if (match === 'exact') {
    return normalizedRoleName === normalizedPattern;
  }

  return normalizedRoleName.includes(normalizedPattern);
}

/**
 * Aristas visuales cuyo padre coincide con el nombre de rol indicado (según parentMatch).
 */
export function getEdgesForParentRole(
  parentRoleName: string | null | undefined,
): readonly OrgVisualEdgeRule[] {
  const parent = (parentRoleName ?? '').trim().toUpperCase();
  if (!parent) {
    return [];
  }
  return ORG_VISUAL_EDGE_RULES.filter((edge) =>
    matchesRolePattern(parent, edge.parentRoleName, edge.parentMatch),
  );
}

/**
 * Nivel visual del organigrama asociado al nombre de rol en Core.
 *
 * Orden de evaluación: raíz, luego aristas en `ORG_VISUAL_EDGE_RULES` (niveles 2→5),
 * de modo que "DESARROLLADOR MULTIMEDIA" gana sobre "DESARROLLADOR" exacto.
 */
export function resolveOrgLevelFromRoleName(
  roleName: string | null | undefined,
): number | null {
  const n = (roleName ?? '').trim().toUpperCase();
  if (!n) {
    return null;
  }

  if (
    matchesRolePattern(
      n,
      ORG_VISUAL_ROOT_RULE.roleName,
      ORG_VISUAL_ROOT_RULE.match,
    )
  ) {
    return ORG_VISUAL_ROOT_RULE.visualLevel;
  }

  for (const edge of ORG_VISUAL_EDGE_RULES) {
    if (matchesRolePattern(n, edge.childRoleName, edge.childMatch)) {
      return edge.visualLevel;
    }
  }

  return null;
}
