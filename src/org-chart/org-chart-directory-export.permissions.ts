import { ORG_PERMISSION } from '../permissions/entities/person-permission.entity';

/** Formatos de exportación del organigrama activo. */
export type DirectoryExportFormat = 'html' | 'xls';

export const DIRECTORY_EXPORT_FORMATS: readonly DirectoryExportFormat[] = [
  'html',
  'xls',
] as const;

/**
 * Permiso exigido por cada formato. Es la única fuente de autorización de los
 * exportadores: no hay listas de correos ni privilegios implícitos de
 * ORG_ADMIN / ORG_READ_ALL / ORG_CONTACT_READ_ALL.
 */
export const DIRECTORY_EXPORT_PERMISSION: Readonly<
  Record<DirectoryExportFormat, string>
> = {
  html: ORG_PERMISSION.DIRECTORY_EXPORT_HTML,
  xls: ORG_PERMISSION.DIRECTORY_EXPORT_XLS,
};

/** Respuesta de GET /api/org-chart/export/permissions (leída de PostgreSQL). */
export type DirectoryExportPermissionsDto = Record<
  DirectoryExportFormat,
  boolean
>;
