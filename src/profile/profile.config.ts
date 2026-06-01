import { normalizeInstitutionalEmail } from '../auth/auth-email.util';

export function isProfileDevResetEnabled(): boolean {
  if (process.env.PROFILE_DEV_RESET_ENABLED !== 'true') {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return true;
}

export function getProfileDevResetAllowedEmails(): Set<string> {
  const raw = process.env.PROFILE_DEV_RESET_ALLOWED_EMAILS?.trim();
  if (!raw) {
    return new Set();
  }

  const emails = raw
    .split(',')
    .map((entry) => normalizeInstitutionalEmail(entry.trim()))
    .filter((entry): entry is string => Boolean(entry));

  return new Set(emails);
}

export function isEmailAllowedForProfileDevReset(email: string): boolean {
  const normalized = normalizeInstitutionalEmail(email);
  if (!normalized) {
    return false;
  }

  return getProfileDevResetAllowedEmails().has(normalized);
}
