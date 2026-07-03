import { DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS } from './org-chart-versioning.constants';

/**
 * Correos autorizados para versionamiento del organigrama (ORG_CHART_VERSION_ADMIN_EMAILS).
 * Separados por coma; trim + lowercase.
 */
export function getOrgChartVersionAdminEmailsSet(): Set<string> {
  const raw = process.env.ORG_CHART_VERSION_ADMIN_EMAILS?.trim();
  const source =
    raw && raw.length > 0 ? raw : DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS.join(',');

  return new Set(
    source
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isOrgChartVersionAdminEmail(
  email: string | null | undefined,
): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return getOrgChartVersionAdminEmailsSet().has(normalized);
}
