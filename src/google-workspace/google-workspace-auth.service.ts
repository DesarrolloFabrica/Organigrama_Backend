import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import type { JWT } from 'google-auth-library';
import type { admin_directory_v1 } from 'googleapis';
import {
  GOOGLE_DIRECTORY_USER_READONLY_SCOPE,
  getGoogleWorkspaceAdminEmail,
  loadServiceAccountCredentials,
} from './google-workspace.config';

@Injectable()
export class GoogleWorkspaceAuthService {
  createDirectoryClient(): admin_directory_v1.Admin {
    const credentials = loadServiceAccountCredentials();
    const adminEmail = getGoogleWorkspaceAdminEmail();

    if (!credentials) {
      throw new Error(
        'Credenciales de Service Account no configuradas (GOOGLE_SERVICE_ACCOUNT_JSON o GOOGLE_SERVICE_ACCOUNT_KEY_PATH)',
      );
    }
    if (!adminEmail) {
      throw new Error(
        'GOOGLE_WORKSPACE_ADMIN_EMAIL es requerido para Domain-Wide Delegation',
      );
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GOOGLE_DIRECTORY_USER_READONLY_SCOPE],
      subject: adminEmail,
    });

    return google.admin({ version: 'directory_v1', auth });
  }

  async getAuthorizedFetchHeaders(): Promise<Record<string, string>> {
    const credentials = loadServiceAccountCredentials();
    const adminEmail = getGoogleWorkspaceAdminEmail();

    if (!credentials || !adminEmail) {
      throw new Error('Google Workspace no está configurado');
    }

    const auth = new google.auth.JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: [GOOGLE_DIRECTORY_USER_READONLY_SCOPE],
      subject: adminEmail,
    }) as JWT;

    const token = await auth.getAccessToken();
    if (!token) {
      throw new Error('No se pudo obtener access token de Google');
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  }
}
