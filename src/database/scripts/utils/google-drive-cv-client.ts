/**
 * Utilidad reutilizable para acceder a Google Drive (hojas de vida / CV).
 *
 * Responsabilidad ÚNICA: leer Google Drive en modo SOLO LECTURA.
 * - Autentica vía OAuth usando un token local guardado en disco.
 * - Lee el folder ID y la ruta del token desde variables de entorno.
 * - Crea un cliente de Google Drive API v3.
 * - Lista los PDFs ubicados DIRECTAMENTE dentro de la carpeta (sin subcarpetas).
 *
 * Esta utilidad NO toca la base de datos ni modifica nada en Drive.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google, drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

/**
 * Scope mínimo necesario: solo lectura sobre Drive.
 * Si el token fue emitido con un scope distinto, Drive responderá 403.
 */
export const GOOGLE_DRIVE_READONLY_SCOPE =
  'https://www.googleapis.com/auth/drive.readonly';

/** Estructura mínima que devolvemos por cada archivo PDF encontrado. */
export type DriveCvPdfFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string | null;
};

/**
 * Lee y valida el folder ID desde GOOGLE_DRIVE_CV_FOLDER_ID.
 * Lanza un error claro si falta, porque sin carpeta no hay nada que listar.
 */
export function getDriveCvFolderId(): string {
  const folderId = process.env.GOOGLE_DRIVE_CV_FOLDER_ID?.trim();
  if (!folderId) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_DRIVE_CV_FOLDER_ID. ' +
        'Defínela en el .env con el ID de la carpeta de Drive que contiene las hojas de vida.',
    );
  }
  return folderId;
}

/**
 * Lee y valida la ruta del token desde GOOGLE_DRIVE_CV_TOKEN_PATH.
 * Lanza un error claro si la variable falta o si el archivo no existe en disco.
 * Devuelve la ruta ABSOLUTA ya resuelta.
 */
export function getDriveCvTokenPath(): string {
  const tokenPath = process.env.GOOGLE_DRIVE_CV_TOKEN_PATH?.trim();
  if (!tokenPath) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_DRIVE_CV_TOKEN_PATH. ' +
        'Defínela en el .env apuntando al JSON del token OAuth (ej: ./secrets/google-drive-token.json).',
    );
  }

  const absolutePath = resolve(tokenPath);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `No se encontró el archivo de token OAuth en "${absolutePath}". ` +
        'Verifica GOOGLE_DRIVE_CV_TOKEN_PATH y que el archivo exista.',
    );
  }

  return absolutePath;
}

/**
 * Forma flexible del JSON de token que aceptamos.
 *
 * Soportamos dos casos comunes:
 *  1) Un token "plano" que mezcla credenciales de cliente + tokens:
 *     { client_id, client_secret, refresh_token, access_token, ... }
 *  2) Un JSON estilo Google OAuth con wrapper "installed" o "web" para las
 *     credenciales de cliente, más los tokens en el mismo objeto.
 */
type OAuthTokenFile = {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  redirect_uris?: string[];
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expiry_date?: number;
  installed?: OAuthTokenFile;
  web?: OAuthTokenFile;
};

/**
 * Construye un cliente OAuth2 a partir del token local.
 *
 * - Las credenciales de cliente (client_id/secret) permiten refrescar el
 *   access_token cuando expira, siempre que exista refresh_token.
 * - setCredentials() carga los tokens guardados; googleapis se encarga del
 *   refresco automático si dispone de client_id + client_secret + refresh_token.
 */
function loadOAuthClient(): OAuth2Client {
  const absolutePath = getDriveCvTokenPath();

  let parsed: OAuthTokenFile;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as OAuthTokenFile;
  } catch {
    throw new Error(
      `El archivo de token "${absolutePath}" no es un JSON válido. ` +
        'Revisa su contenido.',
    );
  }

  // Las credenciales de cliente pueden venir dentro de "installed"/"web"
  // (formato típico de Google) o directamente en la raíz del archivo.
  const clientInfo = parsed.installed ?? parsed.web ?? parsed;

  const redirectUri =
    clientInfo.redirect_uri ??
    (Array.isArray(clientInfo.redirect_uris)
      ? clientInfo.redirect_uris[0]
      : undefined);

  const oauth2Client = new google.auth.OAuth2(
    clientInfo.client_id,
    clientInfo.client_secret,
    redirectUri,
  );

  // Los tokens (access/refresh) viven en la raíz del archivo en ambos formatos.
  oauth2Client.setCredentials({
    access_token: parsed.access_token,
    refresh_token: parsed.refresh_token,
    scope: parsed.scope ?? GOOGLE_DRIVE_READONLY_SCOPE,
    token_type: parsed.token_type,
    expiry_date: parsed.expiry_date,
  });

  if (!parsed.access_token && !parsed.refresh_token) {
    throw new Error(
      `El archivo de token "${absolutePath}" no contiene access_token ni refresh_token. ` +
        'No es posible autenticar contra Google Drive.',
    );
  }

  return oauth2Client;
}

/**
 * Crea el cliente de Google Drive API v3 ya autenticado vía OAuth.
 */
export function createDriveCvClient(): drive_v3.Drive {
  const auth = loadOAuthClient();
  return google.drive({ version: 'v3', auth });
}

/**
 * Lista TODOS los PDFs ubicados directamente dentro de la carpeta configurada.
 *
 * - Filtra por mimeType application/pdf y por la carpeta como padre directo.
 * - No desciende a subcarpetas (no usa búsqueda recursiva).
 * - Maneja paginación (la carpeta puede tener cientos de archivos).
 * - Trae los campos mínimos: id, name, mimeType, webViewLink.
 */
export async function listCvPdfFiles(): Promise<DriveCvPdfFile[]> {
  const drive = createDriveCvClient();
  const folderId = getDriveCvFolderId();

  // Query: solo hijos directos de la carpeta, no en papelera y solo PDFs.
  const query = `'${folderId}' in parents and trashed = false and mimeType = 'application/pdf'`;

  const files: DriveCvPdfFile[] = [];
  let pageToken: string | undefined;

  // Recorremos todas las páginas hasta agotar nextPageToken.
  do {
    const response = await drive.files.list({
      q: query,
      // Pedimos solo los campos que necesitamos para que la respuesta sea liviana.
      fields: 'nextPageToken, files(id, name, mimeType, webViewLink)',
      pageSize: 1000,
      spaces: 'drive',
      // Soporte para Unidades compartidas (Shared Drives) por si la carpeta vive ahí.
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageToken,
    });

    const batch = response.data.files ?? [];
    for (const file of batch) {
      // id y name siempre deberían venir; los normalizamos por seguridad.
      files.push({
        id: file.id ?? '',
        name: file.name ?? '',
        mimeType: file.mimeType ?? 'application/pdf',
        webViewLink: file.webViewLink ?? null,
      });
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return files;
}
