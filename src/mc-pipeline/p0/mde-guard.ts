/**
 * Guard MDE — falla si host/puerto/base no son el entorno aislado.
 * No imprime passwords. No lee .env raíz por defecto.
 */
import { mdeGuardFailed, P0SnapshotError } from './p0.errors';

export type MdeConnectionTarget = {
  host: string;
  port: number | string;
  database: string;
};

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Valida que el destino sea el MDE local (loopback + 5434 + nombre con `_mde`).
 * @throws {P0SnapshotError} MDE_GUARD_FAILED
 */
export function assertMdeTarget(target: MdeConnectionTarget): void {
  const host = String(target.host ?? '').trim().toLowerCase();
  const port = Number(target.port);
  const database = String(target.database ?? '').trim();

  if (!LOOPBACK.has(host)) {
    throw mdeGuardFailed('host is not loopback');
  }
  if (port !== 5434) {
    throw mdeGuardFailed('port is not 5434');
  }
  if (!database.includes('_mde')) {
    throw mdeGuardFailed('database name does not contain _mde');
  }
}

export function isMdeTarget(target: MdeConnectionTarget): boolean {
  try {
    assertMdeTarget(target);
    return true;
  } catch (e) {
    if (e instanceof P0SnapshotError) return false;
    throw e;
  }
}
