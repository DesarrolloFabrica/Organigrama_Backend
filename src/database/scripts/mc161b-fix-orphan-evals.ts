/**
 * MC1.6.1B — desactiva evaluaciones SOFTWARE activas huérfanas (catálogo retirado).
 * Idempotente. Requiere --i-confirm-fix.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

async function main() {
  const confirm = process.argv.includes('--i-confirm-fix');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const orphans = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code, e.catalog_version_id::text,
            cv.version AS catalog_version, cv.is_active AS catalog_active
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
      WHERE e.is_active = TRUE
        AND cv.is_active = FALSE`,
  );

  console.log(JSON.stringify({ orphans, dryRun: !confirm }, null, 2));

  if (!confirm) {
    console.log('[MC1.6.1B] Dry-run. Use --i-confirm-fix para aplicar.');
    await app.close();
    return;
  }

  const result = await ds.query(
    `UPDATE organigrama.mc_profile_evaluation e
        SET is_active = FALSE
       FROM organigrama.mc_catalog_version cv
      WHERE cv.id = e.catalog_version_id
        AND e.is_active = TRUE
        AND cv.is_active = FALSE
      RETURNING e.id::text`,
  );
  console.log(JSON.stringify({ deactivated: result }, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
