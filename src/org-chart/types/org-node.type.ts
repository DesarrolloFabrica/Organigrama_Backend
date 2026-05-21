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

/** Resultado de GET /api/org-chart/search?q= */
export type OrgChartSearchHit = {
  id: string;
  document: string;
  name: string;
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

export type OrgNode = {
  id: string;
  document: string;
  name: string;
  role_id: string | null;
  role: OrgNodeRole | null;
  hierarchy_id: string | null;
  area_id: string | null;
  school_id: string | null;
  program_id: string | null;
  email: string | null;
  edu_email: string | null;
  phone: string | null;
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
};
