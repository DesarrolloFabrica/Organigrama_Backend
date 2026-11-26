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

/**
 * Grupo (coordinación o Dirección) al que pertenece el área de la
 * requisición; solo en la respuesta con alcance (`?personId=`).
 */
export interface VacancyCoordinationDto {
  kind: 'coordination' | 'direction';
  /** Área oficial del grupo. */
  areaName: string;
  /** Cabezas de la coordinación, o raíz de la Dirección. */
  headPersonIds: string[];
}

/** Vacante con su grupo; null si el área no corresponde a ninguno. */
export interface ScopedVacancyResponseDto extends VacancyResponseDto {
  coordination: VacancyCoordinationDto | null;
}

/** Envoltura de la respuesta del endpoint de vacantes. */
export interface VacancyListResponseDto {
  items: VacancyResponseDto[];
}

/**
 * Alcance resuelto para `GET /vacancies?personId=` (ver org-chart-vacancy-scope).
 * - `global`: raíz del mapa, todas las requisiciones.
 * - `coordination`: cabeza de coordinación, requisiciones de su área.
 * - `direction`: jefe de coordinaciones en la Dirección (Coordinación
 *   General), requisiciones de esas coordinaciones y de su propia área.
 * - `none`: otro nodo; `items` vacío y el panel omite el bloque.
 */
export interface VacancyScopeDto {
  kind: 'global' | 'coordination' | 'direction' | 'none';
  personId: string;
  /**
   * `coordination`: área oficial de la coordinación; `direction`: área de la
   * persona. null en los demás alcances.
   */
  areaName: string | null;
}

/**
 * Respuesta con alcance: la lista `items` (cada una con su grupo) más el
 * alcance aplicado.
 */
export interface ScopedVacancyListResponseDto {
  items: ScopedVacancyResponseDto[];
  scope: VacancyScopeDto;
}
