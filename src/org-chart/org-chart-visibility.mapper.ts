import type { OrgChartSearchHit, OrgNode } from './types/org-node.type';

import type { OrgSummaryItemDto } from './types/org-summary.dto';

/**

 * Metadatos de organigrama (nivel, rol, tipo de nodo) necesarios para colores,

 * layout y expansión. No se consideran datos personales extendidos.

 */

function preserveOrgChartTechnicalFields(
  node: OrgNode,
): Pick<
  OrgNode,
  | 'nodeKind'
  | 'hierarchy_id'
  | 'hierarchy'
  | 'role_id'
  | 'role'
  | 'relation_id'
  | 'parent_person_id'
  | 'assignment_status'
  | 'assignment_label'
  | 'direct_reports_count'
  | 'current_workforce_event'
  | 'current_workforce_event_count'
> {
  return {
    nodeKind: node.nodeKind,

    hierarchy_id: node.hierarchy_id,

    hierarchy: node.hierarchy,

    role_id: node.role_id,

    role: node.role,

    relation_id: node.relation_id ?? null,

    parent_person_id: node.parent_person_id ?? null,

    assignment_status: node.assignment_status ?? null,

    assignment_label: node.assignment_label ?? null,

    direct_reports_count: node.direct_reports_count,

    current_workforce_event: node.current_workforce_event ?? null,

    current_workforce_event_count: node.current_workforce_event_count ?? 0,
  };
}

/**

 * Permisos puntuales que amplían lo que un viewer TIENE DERECHO a ver.

 *

 * Responden a "¿puede ver este dato?" (CAN_VIEW_PHONE), NUNCA a "¿debe ir este

 * dato en esta respuesta?" (SHOULD_INCLUDE_PHONE_IN_THIS_RESPONSE). Son dos

 * decisiones distintas y se resuelven en funciones distintas a propósito.

 */

export type OrgRedactionOptions = {
  /**

   * ORG_CONTACT_READ_ALL: da derecho al `phone` de cualquier persona visible,

   * aunque su ficha siga redactada. No habilita ningún otro campo privado.

   */

  canReadAllContacts?: boolean;
};

/**

 * CAN_VIEW_PHONE — ¿este viewer tiene derecho al teléfono de esta persona?

 *

 * Tener derecho NO implica que el teléfono viaje en cualquier respuesta: eso lo

 * decide cada superficie por separado (ver `resolveVisiblePhone`).

 */

export function viewerCanViewPhone(
  canViewFullProfile: boolean,

  options?: OrgRedactionOptions,
): boolean {
  return canViewFullProfile || options?.canReadAllContacts === true;
}

/**

 * SHOULD_INCLUDE_PHONE_IN_THIS_RESPONSE — fuente única de verdad para emitir el

 * teléfono, y RESERVADA A LA FICHA INDIVIDUAL (`GET /org-chart/person/:id`).

 *

 * La ficha individual es una consulta deliberada sobre una persona concreta. Las

 * superficies masivas (árbol, hijos, búsqueda) NO deben llamar a esta función:

 * de lo contrario una sola petición devolvería el directorio telefónico entero.

 * Por eso `redactOrgNode` y `redactOrgChartSearchHit` ni siquiera aceptan

 * `OrgRedactionOptions`: no existe forma de pedirles que revelen el teléfono.

 */

export function resolveVisiblePhone(
  phone: string | null | undefined,

  canViewFullProfile: boolean,

  options?: OrgRedactionOptions,
): string | null {
  return viewerCanViewPhone(canViewFullProfile, options)
    ? (phone ?? null)
    : null;
}

/** Campos permitidos en nodos del árbol cuando no hay ficha completa. */

/**

 * Superficie MASIVA: nunca expone `phone` de un tercero redactado, ni siquiera

 * con ORG_CONTACT_READ_ALL. Deliberadamente sin `OrgRedactionOptions`.

 */

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

    // Superficie masiva: el teléfono nunca viaja aquí para un tercero.
    phone: null,
  };
}

/** Superficie MASIVA (árbol y subárboles). Ver `redactOrgNode`. */

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

/**

 * Superficie MASIVA (búsqueda). Nunca expone `phone` de un tercero redactado:

 * la búsqueda sirve para localizar a la persona y abrir su ficha, no para

 * extraer contactos en lote. Deliberadamente sin `OrgRedactionOptions`.

 */

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

    // Superficie masiva: el teléfono nunca viaja aquí para un tercero.
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
