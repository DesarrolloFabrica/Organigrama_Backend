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
