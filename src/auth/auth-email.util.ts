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

/**
 * Devuelve el Set de correos técnicos autorizados (ORG_TECHNICAL_EMAILS).
 * Son usuarios que pueden autenticarse aunque su edu_email no contenga `_`.
 * Se normalizan a trim + lowercase.
 */
export function getTechnicalEmailsSet(): Set<string> {
  const raw = process.env.ORG_TECHNICAL_EMAILS ?? '';
  if (!raw.trim()) {
    return new Set();
  }
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Indica si el correo corresponde a un usuario técnico registrado en ORG_TECHNICAL_EMAILS.
 * Estos usuarios pasan la validación institucional aunque su email no contenga `_`.
 */
export function isTechnicalUser(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return getTechnicalEmailsSet().has(normalized);
}
