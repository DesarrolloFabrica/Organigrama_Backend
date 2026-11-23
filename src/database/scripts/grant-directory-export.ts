/**
 * Script:
 *   npm run org:grant-directory-export -- correo@cun.edu.co --format=html|xls|both [--dry-run] [--revoke]
 *
 * Concede o revoca ÚNICAMENTE ORG_DIRECTORY_EXPORT_HTML y/o
 * ORG_DIRECTORY_EXPORT_XLS (descarga de los informes HTML / Excel del
 * organigrama activo, que contienen datos personales de toda la planta).
 *
 * Garantías (ver utils/grant-directory-export.core.ts):
 *  - Persona activa y única por edu_email.
 *  - Muestra los permisos previos antes de escribir.
 *  - Idempotente: INSERT ... ON CONFLICT DO NOTHING / DELETE solo si existe.
 *  - Escritura y verificación en una transacción; cualquier cambio a otros
 *    códigos (ORG_ADMIN, ORG_READ_ALL, ORG_CONTACT_READ_ALL...) revierte todo.
 *  - Nunca concede ni revoca otros códigos.
 *  - --dry-run: solo verificaciones, no escribe nada.
 *  - Salida con person_id y correo enmascarado; sin nombres.
 *
 * Requiere 004_core_person_permission.sql. Para que las descargas funcionen
 * también debe estar aplicada 040_org_chart_directory_export_audit.sql.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  GRANT_DIRECTORY_EXPORT_TAG as TAG,
  GRANT_DIRECTORY_EXPORT_USAGE,
  parseGrantDirectoryExportArgs,
  runGrantDirectoryExport,
  type GrantDirectoryExportDb,
} from './utils/grant-directory-export.core';

async function main() {
  const parsed = parseGrantDirectoryExportArgs(process.argv.slice(2));
  if (!parsed.ok) {
    console.error(`${TAG} ERROR: ${parsed.error}`);
    console.error(`${TAG} ${GRANT_DIRECTORY_EXPORT_USAGE}`);
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const db: GrantDirectoryExportDb = {
      query: <T>(sql: string, params?: unknown[]) => ds.query<T>(sql, params),
      transaction: <T>(
        fn: Parameters<GrantDirectoryExportDb['transaction']>[0],
      ) =>
        ds.transaction((manager) =>
          fn({
            query: <R>(sql: string, params?: unknown[]) =>
              manager.query<R>(sql, params),
          }),
        ) as Promise<T>,
    };

    const outcome = await runGrantDirectoryExport(db, parsed.args, {
      info: (line) => console.log(line),
      error: (line) => console.error(line),
    });
    process.exitCode = outcome.exitCode;
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  console.error(
    `${TAG} Error inesperado: ${err instanceof Error ? err.name : 'desconocido'}`,
  );
  process.exit(1);
});
