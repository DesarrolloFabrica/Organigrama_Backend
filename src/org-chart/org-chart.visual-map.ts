/**
 * Reglas declarativas del organigrama visual (capa Organigrama sobre Core).
 *
 * Core sigue siendo fuente de verdad; `hierarchy.level` no define el dibujo.
 * La jerarquía visual se resuelve por `role.name` (y en niveles futuros, filtros como edu_email).
 */

export type RoleMatchMode = 'exact' | 'ilike';

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
  childRoleName: string;
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
  {
    parentRoleName: 'COORDINADOR GENERAL OPERACIONES',
    parentMatch: 'ilike',
    childRoleName: 'COORDINADOR AREA FABRICA Y DESARROLLO',
    childMatch: 'ilike',
    visualLevel: 3,
    description: 'Nivel 3 bajo Coordinador General',
  },
  {
    parentRoleName: 'COORDINADOR AREA FABRICA Y DESARROLLO',
    parentMatch: 'ilike',
    childRoleName: 'DESARROLLADOR MULTIMEDIA',
    childMatch: 'ilike',
    visualLevel: 4,
    description: 'Nivel 4 bajo Coordinador Área Fábrica y Desarrollo',
  },
  {
    parentRoleName: 'DESARROLLADOR MULTIMEDIA',
    parentMatch: 'ilike',
    childRoleName: 'DESARROLLADOR',
    childMatch: 'exact',
    childEduEmails: [
      'alejandro_castro@cun.edu.co',
      'camilo_quintero@cun.edu.co',
      'jose_camachoc@cun.edu.co',
      'zuany_acuna@cun.edu.co',
    ],
    visualLevel: 5,
    description: 'Nivel 5: DESARROLLADOR acotado por edu_email en queries',
  },
] as const;

function matchesRolePattern(
  nameNormalized: string,
  pattern: string,
  mode: RoleMatchMode,
): boolean {
  const p = pattern.trim().toUpperCase();
  if (!p) return false;
  if (mode === 'exact') {
    return nameNormalized === p;
  }
  return nameNormalized.includes(p);
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
