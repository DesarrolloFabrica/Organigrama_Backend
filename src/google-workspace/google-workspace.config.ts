import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const GOOGLE_DIRECTORY_USER_READONLY_SCOPE =
  'https://www.googleapis.com/auth/admin.directory.user.readonly';

export type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export function isGooglePhotoDiagEnabled(): boolean {
  if (process.env.GOOGLE_WORKSPACE_PHOTO_DIAG_ENABLED !== 'true') {
    return false;
  }
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.GOOGLE_WORKSPACE_PHOTO_DIAG_ALLOW_IN_PRODUCTION !== 'true'
  ) {
    return false;
  }
  return true;
}

export function loadServiceAccountCredentials(): ServiceAccountCredentials | null {
  const jsonInline = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (jsonInline) {
    return parseServiceAccountJson(jsonInline);
  }

  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim();
  if (keyPath) {
    const absolutePath = resolve(keyPath);
    return parseServiceAccountJson(readFileSync(absolutePath, 'utf8'));
  }

  return null;
}

function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const parsed = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_JSON debe incluir client_email y private_key',
    );
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

export function getGoogleWorkspaceAdminEmail(): string | null {
  const email = process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL?.trim();
  return email || null;
}
