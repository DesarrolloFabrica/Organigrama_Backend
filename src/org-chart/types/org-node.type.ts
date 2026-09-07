export type OrgNodeRole = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgNodeHierarchy = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgNodeArea = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgNodeSchool = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgNodeProgram = {
  id: string;
  name: string;
  description: string | null;
  school_id: string | null;
};

export type OrgNodeCity = {
  id: string;
  name: string;
};

export type OrgNodeCampus = {
  id: number;
  name: string;
};

export type OrgNodeContractType = {
  id: string;
  name: string;
  description: string | null;
};

export type OrgNodeRegion = {
  id: number;
  name: string;
};

export type OrgNodeLocation = {
  region: OrgNodeRegion | null;
  city: OrgNodeCity | null;
  campus: OrgNodeCampus | null;
};

export type OrgHierarchyPathSegment = {
  id: string;
  name: string;
  role_id: string | null;
  role: OrgNodeRole | null;
  hierarchy_id: string | null;
  hierarchy: OrgNodeHierarchy | null;
};

export type OrgNodeKind = 'person' | 'vacancy';

/** Resultado de GET /api/org-chart/search?q= */
export type OrgChartSearchHit = {
  id: string;
  document: string;
  name: string;
  nodeKind?: OrgNodeKind;
  role_id: string | null;
  role: OrgNodeRole | null;
  hierarchy_id: string | null;
  hierarchy: OrgNodeHierarchy | null;
  area_id: string | null;
  school_id: string | null;
  program_id: string | null;
  email: string | null;
  edu_email: string | null;
  phone: string | null;
  path: OrgHierarchyPathSegment[];
};

/**
 * Estado de asignación visible para una posición/relación específica.
 * `MATERNITY_LEAVE` se muestra en el nodo como «LICENCIA DE MATERNIDAD».
 */
export type OrgAssignmentStatus =
  | 'PERMANENT'
  | 'TEMPORAL'
  | 'MATERNITY_LEAVE';

/** Novedad vigente de `workforce_events` (solo lectura, schema Orbit). */
export type OrgNodeWorkforceEvent = {
  id: string;
  eventTypeName: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
};

export type OrgNode = {
  id: string;
  document: string;
  name: string;
  role_id: string | null;
  role: OrgNodeRole | null;
  /**
   * Identidad visual de la posición: arista `org_visual_relation.id` que produjo
   * este nodo. `null` para el nodo raíz/padre y para nodos del fallback por rol.
   * Permite al frontend diferenciar posiciones de la misma persona (multi-padre).
   */
  relation_id: string | null;
  /** Padre de esta posición (de la relación). `null` si no proviene de una arista. */
  parent_person_id: string | null;
  /**
   * Estado de asignación visible (proviene de un override por relación).
   * `null` cuando no hay override para la relación que produjo este nodo.
   */
  assignment_status: string | null;
  /**
   * Etiqueta visible de la asignación (proviene de un override por relación).
   * `null` cuando no hay override.
   */
  assignment_label: string | null;
  /**
   * Novedad vigente hoy (licencia, incapacidad, permiso, etc.).
   * `null` si la persona no tiene eventos activos en `workforce_events`.
   */
  current_workforce_event: OrgNodeWorkforceEvent | null;
  /** Cantidad de novedades vigentes (si > 1, el badge muestra +N). */
  current_workforce_event_count: number;
  hierarchy_id: string | null;
  area_id: string | null;
  school_id: string | null;
  program_id: string | null;
  email: string | null;
  edu_email: string | null;
  phone: string | null;
  /**
   * `person`: colaborador real; `vacancy`: placeholder en core.person (rol vacante).
   * La vacante hereda hierarchy del puesto (NIVEL 2–5), no es un NIVEL 6.
   */
  nodeKind?: OrgNodeKind;
  /** Número de relaciones directas padre→persona (siempre coherente con BD). */
  direct_reports_count: number;
  children: OrgNode[];
  hierarchy: OrgNodeHierarchy | null;
  area: OrgNodeArea | null;
  school: OrgNodeSchool | null;
  program: OrgNodeProgram | null;
  city: OrgNodeCity | null;
  campus: OrgNodeCampus | null;
  contract_type: OrgNodeContractType | null;
  region_id: number | null;
  location: OrgNodeLocation | null;
  /** URL provisional de foto; null si no hay imagen disponible. */
  photoUrl: string | null;
};
