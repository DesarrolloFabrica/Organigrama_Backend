/** Vacante lista para el frontend (camelCase, IDs numéricos). */
export interface VacancyResponseDto {
  id: number;
  areaId: number | null;
  schoolId: number | null;
  programId: number | null;
  positionName: string | null;
  curricularLine: string | null;
  quantity: number | null;
  operationStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;

  /** Enriquecidos desde core cuando existe la referencia por ID. */
  areaName: string | null;
  schoolName: string | null;
  programName: string | null;
}

/** Envoltura de la respuesta del endpoint de vacantes. */
export interface VacancyListResponseDto {
  items: VacancyResponseDto[];
}

/**
 * Alcance resuelto para `GET /vacancies?personId=` (ver org-chart-vacancy-scope).
 * - `global`: raíz del mapa, todas las requisiciones.
 * - `coordination`: cabeza de coordinación, requisiciones de su área.
 * - `none`: otro nodo; `items` vacío y el panel omite el bloque.
 */
export interface VacancyScopeDto {
  kind: 'global' | 'coordination' | 'none';
  personId: string;
  /** Solo en `coordination`: área oficial de la coordinación. */
  areaName: string | null;
}

/** Respuesta con alcance: misma lista `items` más el alcance aplicado. */
export interface ScopedVacancyListResponseDto extends VacancyListResponseDto {
  scope: VacancyScopeDto;
}
