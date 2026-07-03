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
