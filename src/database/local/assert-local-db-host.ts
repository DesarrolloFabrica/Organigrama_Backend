/**
 * Guarda de seguridad: operaciones destructivas / migraciones solo en BD local.
 * NODE_ENV=development NO es suficiente (el .env cloud usa development).
 */

export const LOCAL_DB_ALLOWED_HOSTS = [
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres',
  'postgres-mc1-local',
] as const;

export function isLocalDatabaseHost(host: string | undefined | null): boolean {
  if (!host || !String(host).trim()) return false;
  const h = String(host).trim().toLowerCase();
  return (LOCAL_DB_ALLOWED_HOSTS as readonly string[]).includes(h);
}

export function assertLocalDatabaseHost(host: string | undefined | null): void {
  if (!isLocalDatabaseHost(host)) {
    throw new Error(
      `Operación bloqueada: el host ${host ?? '(vacío)'} no es una base local permitida. ` +
        `Permitidos: ${LOCAL_DB_ALLOWED_HOSTS.join(', ')}.`,
    );
  }
}
