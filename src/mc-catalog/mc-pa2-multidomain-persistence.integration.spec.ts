/**
 * Integración PostgreSQL local — MC1.1B persistencia multidominio.
 *
 * No corre en `npm test` por defecto (requiere Docker + bootstrap).
 * Activar con:
 *   MC1_LOCAL_IT=1 npm run test:mc1-persistence:jest
 * o:
 *   npm run test:mc1-persistence:local
 */
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertLocalDatabaseHost,
  isLocalDatabaseHost,
} from '../database/local/assert-local-db-host';

const envPath = resolve(process.cwd(), '.env.mc1-local');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true, quiet: true });
}

const enabled = process.env.MC1_LOCAL_IT === '1';

(enabled ? describe : describe.skip)(
  'mc-pa2-multidomain-persistence (PostgreSQL local)',
  () => {
    it('rechaza hosts no locales antes de cualquier escritura', () => {
      expect(isLocalDatabaseHost('136.113.1.1')).toBe(false);
      expect(() => assertLocalDatabaseHost('cloudsql.example.com')).toThrow(
        /Operación bloqueada/,
      );
      assertLocalDatabaseHost(process.env.DB_HOST);
    });

    it(
      'ejecuta suite de persistencia real',
      async () => {
        const { runMc11bPersistenceIntegration } = await import(
          '../database/scripts/mc11b-persistence-integration'
        );
        const report = await runMc11bPersistenceIntegration();
        expect(report.status).toBe('PASSED');
        expect(report.host).toBe('127.0.0.1');
      },
      120_000,
    );
  },
);
