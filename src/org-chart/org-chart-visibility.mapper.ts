import type { OrgChartSearchHit, OrgNode } from './types/org-node.type';

import type { OrgSummaryItemDto } from './types/org-summary.dto';



/**

 * Metadatos de organigrama (nivel, rol, tipo de nodo) necesarios para colores,

 * layout y expansión. No se consideran datos personales extendidos.

 */

function preserveOrgChartTechnicalFields(node: OrgNode): Pick<

  OrgNode,

  | 'nodeKind'

  | 'hierarchy_id'

  | 'hierarchy'

  | 'role_id'

  | 'role'

  | 'direct_reports_count'

> {

  return {

    nodeKind: node.nodeKind,

    hierarchy_id: node.hierarchy_id,

    hierarchy: node.hierarchy,

    role_id: node.role_id,

    role: node.role,

    direct_reports_count: node.direct_reports_count,

  };

}



/** Campos permitidos en nodos del árbol cuando no hay ficha completa. */

export function redactOrgNode(

  node: OrgNode,

  canViewFullProfile: boolean,

): OrgNode {

  if (canViewFullProfile) {

    return node;

  }



  return {

    id: node.id,

    name: node.name,

    edu_email: node.edu_email ?? null,

    photoUrl: node.photoUrl ?? null,

    ...preserveOrgChartTechnicalFields(node),

    children: [],

    document: '',

    area_id: null,

    area: null,

    school_id: null,

    school: null,

    program_id: null,

    program: null,

    city: null,

    campus: null,

    contract_type: null,

    region_id: null,

    location: null,

    email: null,

    phone: null,

  };

}



export function redactOrgNodeTreeForViewer(

  node: OrgNode,

  viewerPersonId: string,

  visibleDescendantIds: Set<string>,

): OrgNode {

  const canView =

    node.id === viewerPersonId || visibleDescendantIds.has(node.id);



  const redacted = redactOrgNode(node, canView);

  return {

    ...redacted,

    children: node.children.map((child) =>

      redactOrgNodeTreeForViewer(child, viewerPersonId, visibleDescendantIds),

    ),

  };

}



export function redactOrgChartSearchHit(

  hit: OrgChartSearchHit,

  canViewFullProfile: boolean,

): OrgChartSearchHit {

  if (canViewFullProfile) {

    return hit;

  }



  return {

    id: hit.id,

    name: hit.name,

    nodeKind: hit.nodeKind,

    edu_email: hit.edu_email ?? null,

    hierarchy_id: hit.hierarchy_id,

    hierarchy: hit.hierarchy,

    role_id: hit.role_id,

    role: hit.role,

    document: '',

    area_id: null,

    school_id: null,

    program_id: null,

    email: null,

    phone: null,

    path: [],

  };

}



/** Resumen jerárquico: sin permiso solo nombre (métricas de conteo se conservan). */

export function redactOrgSummaryItem(

  item: OrgSummaryItemDto,

  canViewFullProfile: boolean,

): OrgSummaryItemDto {

  if (canViewFullProfile) {

    return item;

  }

  return {

    ...item,

    roleName: null,

  };

}

