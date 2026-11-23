/**
 * Cuentas técnicas con lectura total del organigrama.
 * No dependen de ORG_ADMIN_EMAILS ni de core.person_permission.
 */
export const DEFAULT_ORG_ADMIN_EMAILS = [
  'desarrollofabrica@cun.edu.co',
] as const;

export function isBuiltInOrgAdminEmail(
  email: string | null | undefined,
): boolean {
  const normalized = email?.trim().toLowerCase() ?? '';
  if (!normalized) return false;
  return (DEFAULT_ORG_ADMIN_EMAILS as readonly string[]).includes(normalized);
}
