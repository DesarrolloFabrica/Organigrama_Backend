export const ALLOWED_EMAIL_DOMAIN = 'cun.edu.co';

export function parseInstitutionalEmail(
  email: string,
): { local: string; domain: string } | null {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0) {
    return null;
  }

  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!local || !domain) {
    return null;
  }

  return { local, domain };
}

export function isAllowedCunDomain(domain: string): boolean {
  return domain === ALLOWED_EMAIL_DOMAIN;
}

/** Compara camilo.quintero y camilo_quintero como el mismo usuario. */
export function normalizeEmailLocalPart(local: string): string {
  return local.replace(/\./g, '_');
}

export function normalizeInstitutionalEmail(email: string): string | null {
  const parsed = parseInstitutionalEmail(email);
  if (!parsed || !isAllowedCunDomain(parsed.domain)) {
    return null;
  }

  return `${normalizeEmailLocalPart(parsed.local)}@${parsed.domain}`;
}

/** Colaboradores en Core usan `_` en la parte local del edu_email. */
export function isCollaboratorEduEmail(eduEmail: string): boolean {
  const parsed = parseInstitutionalEmail(eduEmail);
  if (!parsed) {
    return false;
  }

  return parsed.local.includes('_');
}
