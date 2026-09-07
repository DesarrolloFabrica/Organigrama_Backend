import { ORG_PERMISSION } from '../permissions/entities/person-permission.entity';

/**
 * Contexto del viewer para operaciones del organigrama.
 * Reemplaza el uso de parámetros sueltos (viewerPersonId, viewerPermissions).
 *
 * Se construye en OrgChartController a partir de la sesión JWT y se propaga
 * a OrgChartService y OrgChartVisibilityService.
 */
export type OrgViewerContext = {
  /** ID de la persona autenticada en core.person. */
  personId: string;
  /** Correo institucional (core.person.edu_email). */
  eduEmail: string | null;
  /** Permisos técnicos de la sesión (vacío para usuarios normales). */
  permissions: string[];
};
/** Devuelve true si el viewer tiene acceso total al organigrama (sin redacción). */
export function viewerHasGlobalReadAccess(viewer: OrgViewerContext): boolean {
  return viewer.permissions.includes(ORG_PERMISSION.READ_ALL);
}

/**
 * ORG_CONTACT_READ_ALL: el viewer puede leer el teléfono (`phone`) de cualquier
 * persona visible en el organigrama, aunque su ficha siga redactada.
 *
 * Deliberadamente NO contempla ORG_READ_ALL: ese permiso ya omite la redacción
 * completa antes de llegar aquí. Mantenerlos separados evita que este permiso se
 * convierta en un alias o subtipo del acceso global, y hace que la matriz de
 * permisos sea auditable campo por campo.
 */
export function viewerCanReadAllContacts(viewer: OrgViewerContext): boolean {
  return viewer.permissions.includes(ORG_PERMISSION.CONTACT_READ_ALL);
}
