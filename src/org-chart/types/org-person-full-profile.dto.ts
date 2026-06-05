import type {
  OrgHierarchyPathSegment,
  OrgNodeArea,
  OrgNodeContractType,
  OrgNodeHierarchy,
  OrgNodeLocation,
  OrgNodeProgram,
  OrgNodeRole,
  OrgNodeSchool,
} from './org-node.type';

/** Bloque extendido cuando `canViewFullProfile === true`. */
export type OrgPersonFullProfileDto = {
  document: string;
  type_document: string | null;
  full_name: string;
  role_id: string | null;
  role: OrgNodeRole | null;
  hierarchy_id: string | null;
  hierarchy: OrgNodeHierarchy | null;
  area_id: string | null;
  area: OrgNodeArea | null;
  school_id: string | null;
  school: OrgNodeSchool | null;
  program_id: string | null;
  program: OrgNodeProgram | null;
  contract_type_id: string | null;
  contract_type: OrgNodeContractType | null;
  email: string | null;
  edu_email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: {
    name: string | null;
    phone: string | null;
    relationship: string | null;
  };
  gender: string | null;
  marital_status: string | null;
  born_date: string | null;
  born_city: string | null;
  location: OrgNodeLocation;
  hierarchy_path: OrgHierarchyPathSegment[];
  direct_reports_count: number;
  direct_reports: Array<{
    id: string;
    full_name: string;
    role_id: string | null;
    hierarchy_id: string | null;
  }>;
};
