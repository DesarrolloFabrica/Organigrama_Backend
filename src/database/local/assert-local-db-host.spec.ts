import {
  assertLocalDatabaseHost,
  isLocalDatabaseHost,
  LOCAL_DB_ALLOWED_HOSTS,
} from './assert-local-db-host';

describe('assertLocalDatabaseHost', () => {
  it.each(['localhost', '127.0.0.1', '::1', 'postgres', 'postgres-mc1-local'])(
    'permite %s',
    (host) => {
      expect(isLocalDatabaseHost(host)).toBe(true);
      expect(() => assertLocalDatabaseHost(host)).not.toThrow();
    },
  );

  it.each([
    '136.113.128.135',
    'cloudsql.googleapis.com',
    'prod.example.com',
    '',
    null,
    undefined,
    '  ',
  ])('bloquea %s', (host) => {
    expect(isLocalDatabaseHost(host as string)).toBe(false);
    expect(() => assertLocalDatabaseHost(host as string)).toThrow(
      /Operación bloqueada/,
    );
  });

  it('lista permitidos no vacía', () => {
    expect(LOCAL_DB_ALLOWED_HOSTS.length).toBeGreaterThan(0);
  });
});
