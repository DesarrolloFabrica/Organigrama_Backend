/**
 * Carga y valida inventory.private.json de Fase 2B (sin Drive).
 */
import { readFileSync } from 'node:fs';
import type { DriveVideoPlanItemInput } from './drive-video-plan-types';

export type LoadedDriveVideoInventory = {
  sourcePath: string;
  generatedAt: string | null;
  rootFolderId: string | null;
  items: DriveVideoPlanItemInput[];
};

function requireString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== 'string') {
    throw new Error(`Inventario inválido: falta string "${key}"`);
  }
  return v;
}

function optionalString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  if (v == null) return null;
  if (typeof v !== 'string') {
    throw new Error(`Inventario inválido: "${key}" debe ser string|null`);
  }
  return v;
}

function optionalNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  if (v == null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Inventario inválido: "${key}" debe ser number|null`);
  }
  return v;
}

function parseItem(raw: unknown, index: number): DriveVideoPlanItemInput {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Inventario inválido: items[${index}] no es objeto`);
  }
  const o = raw as Record<string, unknown>;
  const driveFileId = requireString(o, 'driveFileId');
  const driveFileName = requireString(o, 'driveFileName');
  const mimeType = requireString(o, 'mimeType');
  const relativePath = requireString(o, 'relativePath');
  const formatClass = requireString(o, 'formatClass');

  if (typeof o.validName !== 'boolean') {
    throw new Error(`Inventario inválido: items[${index}].validName`);
  }
  if (typeof o.mimeExtensionInconsistent !== 'boolean') {
    throw new Error(
      `Inventario inválido: items[${index}].mimeExtensionInconsistent`,
    );
  }

  return {
    driveFileId,
    driveFileName,
    mimeType,
    relativePath,
    modifiedTime: optionalString(o, 'modifiedTime'),
    md5Checksum: optionalString(o, 'md5Checksum'),
    size: optionalNumber(o, 'size'),
    document: optionalString(o, 'document'),
    extension: optionalString(o, 'extension'),
    validName: o.validName,
    nameReason: optionalString(o, 'nameReason'),
    formatClass,
    mimeExtensionInconsistent: o.mimeExtensionInconsistent,
  };
}

/**
 * Lee y valida el JSON privado de inventario.
 */
export function loadDriveVideoInventoryFile(
  absolutePath: string,
): LoadedDriveVideoInventory {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, 'utf8'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`No se pudo leer inventario en ${absolutePath}: ${msg}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Inventario inválido: raíz no es objeto');
  }
  const root = parsed as Record<string, unknown>;
  if (!Array.isArray(root.items)) {
    throw new Error('Inventario inválido: falta array "items"');
  }
  if (root.items.length === 0) {
    throw new Error('Inventario inválido: items vacío');
  }

  const summary =
    root.summary && typeof root.summary === 'object'
      ? (root.summary as Record<string, unknown>)
      : null;

  const items = root.items.map((it, i) => parseItem(it, i));

  return {
    sourcePath: absolutePath,
    generatedAt:
      summary && typeof summary.generatedAt === 'string'
        ? summary.generatedAt
        : null,
    rootFolderId:
      summary && typeof summary.rootFolderId === 'string'
        ? summary.rootFolderId
        : null,
    items,
  };
}
