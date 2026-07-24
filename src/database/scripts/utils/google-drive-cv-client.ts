/**
 * Utilidad reutilizable para acceder a Google Drive (hojas de vida / CV).
 *
 * Responsabilidad ÚNICA: leer Google Drive en modo SOLO LECTURA.
 * - Autentica vía OAuth usando un token local guardado en disco.
 * - Inventario RECURSIVO de PDFs bajo GOOGLE_DRIVE_CV_FOLDER_ID (cualquier profundidad).
 * - Descarga el contenido de un PDF por file ID (`downloadCvPdfBuffer`).
 * - (Auxiliar) Busca un PDF por cédula sobre el inventario recursivo.
 *
 * Esta utilidad NO toca la base de datos ni modifica nada en Drive.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { google, drive_v3 } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { buildDriveCvFile } from './drive-cv-path';
import type {
  DriveCvFile,
  DriveCvInventoryStats,
  DriveCvPdfFile,
  DriveFolderChild,
} from './drive-cv-types';
import { toLegacyDriveCvPdfFile } from './drive-cv-types';

export type {
  DriveCvFile,
  DriveCvInventoryStats,
  DriveCvPdfFile,
  DriveFolderChild,
} from './drive-cv-types';
export { toLegacyDriveCvPdfFile } from './drive-cv-types';

/** MIME de carpeta en Google Drive. */
export const DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder';
/** MIME de PDF. */
export const DRIVE_PDF_MIME = 'application/pdf';

/**
 * Scope mínimo necesario: solo lectura sobre Drive.
 * Si el token fue emitido con un scope distinto, Drive responderá 403.
 */
export const GOOGLE_DRIVE_READONLY_SCOPE =
  'https://www.googleapis.com/auth/drive.readonly';

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

/** Crea el cliente de Google Drive API v3 ya autenticado vía OAuth. */
export function createDriveCvClient(): drive_v3.Drive {
  const auth = loadOAuthClient();
  return google.drive({ version: 'v3', auth });
}

/** Metadatos mínimos de una carpeta (id + nombre). */
export type DriveFolderMeta = {
  id: string;
  name: string;
};

/**
 * Obtiene id y nombre de una carpeta de Drive.
 */
export async function getDriveFolderMeta(
  folderId: string,
  drive?: drive_v3.Drive,
): Promise<DriveFolderMeta> {
  const client = drive ?? createDriveCvClient();
  try {
    const response = await client.files.get({
      fileId: folderId,
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    return {
      id: response.data.id ?? folderId,
      name: response.data.name ?? '(sin nombre)',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo leer la carpeta de Drive folderId=${folderId}: ${message}`,
    );
  }
}

/**
 * Lista TODOS los hijos directos de una carpeta (carpetas, PDFs y otros),
 * con paginación y soporte de Shared Drives. No desciende.
 */
export async function listFolderChildren(
  folderId: string,
  options?: {
    drive?: drive_v3.Drive;
    /** Ruta legible solo para mensajes de error. */
    pathLabel?: string;
  },
): Promise<DriveFolderChild[]> {
  const drive = options?.drive ?? createDriveCvClient();
  const pathLabel = options?.pathLabel ?? folderId;
  const query = `'${folderId}' in parents and trashed = false`;

  const children: DriveFolderChild[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const response = await drive.files.list({
        q: query,
        fields:
          'nextPageToken, files(id, name, mimeType, webViewLink, parents, modifiedTime, md5Checksum, size)',
        pageSize: 1000,
        spaces: 'drive',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
        pageToken,
      });

      for (const file of response.data.files ?? []) {
        const sizeRaw = file.size;
        let size: number | null = null;
        if (sizeRaw != null && sizeRaw !== '') {
          const n = Number(sizeRaw);
          size = Number.isFinite(n) ? n : null;
        }

        children.push({
          id: file.id ?? '',
          name: file.name ?? '',
          mimeType: file.mimeType ?? '',
          webViewLink: file.webViewLink ?? null,
          parents: file.parents ?? [],
          modifiedTime: file.modifiedTime ?? null,
          md5Checksum: file.md5Checksum ?? null,
          size,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Error listando hijos de Drive folderId=${folderId} path="${pathLabel}": ${message}`,
    );
  }

  return children.filter((c) => c.id);
}

function childToDriveCvFile(
  child: DriveFolderChild,
  parentFolderId: string,
  folderPath: string[],
): DriveCvFile {
  return buildDriveCvFile({
    driveFileId: child.id,
    driveFileName: child.name,
    parentFolderId,
    folderPath,
    driveWebUrl: child.webViewLink ?? '',
    mimeType: child.mimeType || DRIVE_PDF_MIME,
    modifiedTime: child.modifiedTime,
    md5Checksum: child.md5Checksum,
    fileSize: child.size,
  });
}

/**
 * Inventario recursivo de PDFs bajo una carpeta raíz.
 *
 * - Recorre carpetas con Set de visitados (evita ciclos).
 * - Ignora papelera (trashed=false en la query).
 * - No descarga contenido.
 * - Ordena por relativePath y luego driveFileId.
 */
export async function inventoryCvPdfFiles(
  rootFolderId?: string,
  drive?: drive_v3.Drive,
): Promise<DriveCvInventoryStats> {
  const client = drive ?? createDriveCvClient();
  const folderId = (rootFolderId ?? getDriveCvFolderId()).trim();
  if (!folderId) {
    throw new Error('folderId vacío: no se puede inventariar Drive.');
  }

  let rootFolderName: string | null = null;
  try {
    const meta = await getDriveFolderMeta(folderId, client);
    rootFolderName = meta.name;
  } catch {
    rootFolderName = null;
  }

  const pdfs: DriveCvFile[] = [];
  let nonPdfFileCount = 0;
  const visited = new Set<string>();

  type QueueItem = { folderId: string; folderPath: string[] };
  const queue: QueueItem[] = [{ folderId, folderPath: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current.folderId)) {
      continue;
    }
    visited.add(current.folderId);

    const pathLabel =
      current.folderPath.length > 0
        ? current.folderPath.join('/')
        : '(raíz)';

    const children = await listFolderChildren(current.folderId, {
      drive: client,
      pathLabel,
    });

    for (const child of children) {
      if (child.mimeType === DRIVE_FOLDER_MIME) {
        queue.push({
          folderId: child.id,
          folderPath: [...current.folderPath, child.name],
        });
        continue;
      }

      if (child.mimeType === DRIVE_PDF_MIME) {
        pdfs.push(
          childToDriveCvFile(child, current.folderId, current.folderPath),
        );
        continue;
      }

      nonPdfFileCount += 1;
    }
  }

  pdfs.sort((a, b) => {
    const byPath = a.relativePath.localeCompare(b.relativePath, 'es');
    if (byPath !== 0) return byPath;
    return a.driveFileId.localeCompare(b.driveFileId);
  });

  return {
    rootFolderId: folderId,
    rootFolderName,
    foldersVisited: visited.size,
    pdfCount: pdfs.length,
    nonPdfFileCount,
    files: pdfs,
  };
}

/**
 * Lista todos los PDFs bajo la carpeta raíz (recursivo).
 * Por defecto usa GOOGLE_DRIVE_CV_FOLDER_ID.
 */
export async function listCvPdfFiles(
  rootFolderId?: string,
): Promise<DriveCvFile[]> {
  const inventory = await inventoryCvPdfFiles(rootFolderId);
  return inventory.files;
}

/**
 * Busca un PDF por cédula sobre el inventario recursivo.
 *
 * - 0 coincidencias → null
 * - 1 coincidencia → DriveCvFile
 * - >1 → Error explícito (nunca toma el primero en silencio)
 */
export async function findCvPdfByDocument(
  document: string,
  rootFolderId?: string,
): Promise<DriveCvFile | null> {
  const trimmed = document.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `Documento inválido "${document}": se esperan solo dígitos (cédula).`,
    );
  }

  const files = await listCvPdfFiles(rootFolderId);
  const matches = files.filter((f) => f.document === trimmed);

  if (matches.length === 0) {
    return null;
  }
  if (matches.length > 1) {
    const paths = matches.map((m) => m.relativePath).join(', ');
    throw new Error(
      `Documento ${trimmed} duplicado en Drive (${matches.length} archivos): ${paths}`,
    );
  }

  return matches[0];
}

/**
 * Variante legacy: lanza si no encuentra (compatibilidad con callers antiguos).
 * Preferir `findCvPdfByDocument` que puede devolver null.
 */
export async function findCvPdfByDocumentOrThrow(
  document: string,
  rootFolderId?: string,
): Promise<DriveCvPdfFile> {
  const found = await findCvPdfByDocument(document, rootFolderId);
  if (!found) {
    throw new Error(
      `No se encontró el PDF "${document}.pdf" en el inventario recursivo de Drive.`,
    );
  }
  return toLegacyDriveCvPdfFile(found);
}

/**
 * Descarga el contenido binario de un archivo de Drive por su file ID.
 *
 * - Reutiliza el mismo cliente OAuth readonly (`createDriveCvClient`).
 * - Usa `files.get` con `alt: 'media'` (no escribe nada en disco).
 * - Valida que el Buffer no esté vacío.
 *
 * Ruta principal esperada: `person_cv.drive_file_id` → este método.
 * No depende del folder ID ni de la ubicación del archivo.
 */
export async function downloadCvPdfBuffer(fileId: string): Promise<Buffer> {
  const trimmedId = fileId.trim();
  if (!trimmedId) {
    throw new Error('drive_file_id vacío: no se puede descargar el PDF.');
  }

  const drive = createDriveCvClient();

  const response = await drive.files.get(
    {
      fileId: trimmedId,
      alt: 'media',
      supportsAllDrives: true,
    },
    {
      responseType: 'arraybuffer',
    },
  );

  const data = response.data;
  const buffer = Buffer.isBuffer(data)
    ? data
    : Buffer.from(data as ArrayBuffer);

  if (buffer.length === 0) {
    throw new Error(
      `La descarga de Drive para fileId="${trimmedId}" devolvió un Buffer vacío.`,
    );
  }

  return buffer;
}
