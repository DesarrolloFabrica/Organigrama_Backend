/**
 * MC1.6.1B postcheck RO + summary API vía servicio.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const comps = app.get(OrgChartCompetenciesService);

  const evals = await ds.query(
    `SELECT id::text, person_id::text, domain_code, is_active, status,
            engine_rules_version, default_specialty_code,
            catalog_version_id::text, extraction_id::text,
            LEFT(mapping_hash, 16) AS mapping_hash16,
            LEFT(config_hash, 16) AS config_hash16,
            active_count, emergent_count, hidden_count
       FROM organigrama.mc_profile_evaluation
      WHERE person_id IN (1, 1163)
      ORDER BY id`,
  );
  const role = await ds.query(
    `SELECT p.id::text, p.full_name, p.role_id::text, ro.name AS role_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
      WHERE p.id = 1163`,
  );
  const cats = await ds.query(
    `SELECT id::text, version, is_active, status
       FROM organigrama.mc_catalog_version ORDER BY id`,
  );
  const maps = await ds.query(
    `SELECT d.code, COUNT(*)::int AS n
       FROM organigrama.mc_skill_specialty_mapping m
       JOIN organigrama.mc_specialty s ON s.id = m.specialty_id
       JOIN organigrama.mc_domain d ON d.id = s.domain_id
       JOIN organigrama.mc_catalog_version cv
         ON cv.id = m.catalog_version_id AND cv.is_active = TRUE
      WHERE m.is_active = TRUE
      GROUP BY d.code ORDER BY d.code`,
  );

  // Direct service call without auth: use resolvePrimaryEvaluation + build via query
  const nidiaResolved = await comps.resolvePrimaryEvaluation('1163');
  const camiloResolved = await comps.resolvePrimaryEvaluation('1');
  const emptyResolved = await comps.resolvePrimaryEvaluation('999999');

  const out = {
    phase: 'MC1.6.1B-postcheck',
    role,
    cats,
    maps,
    evals,
    apiResolved: {
      nidia: {
        availability: nidiaResolved.availabilityStatus,
        domain: nidiaResolved.evaluation?.domain_code ?? null,
        default: nidiaResolved.evaluation?.default_specialty_code ?? null,
        rules: nidiaResolved.evaluation?.engine_rules_version ?? null,
        evaluationId: nidiaResolved.evaluation?.id ?? null,
        warnings: nidiaResolved.warnings,
      },
      camilo: {
        availability: camiloResolved.availabilityStatus,
        domain: camiloResolved.evaluation?.domain_code ?? null,
        default: camiloResolved.evaluation?.default_specialty_code ?? null,
        rules: camiloResolved.evaluation?.engine_rules_version ?? null,
        evaluationId: camiloResolved.evaluation?.id ?? null,
        warnings: camiloResolved.warnings,
      },
      empty: {
        availability: emptyResolved.availabilityStatus,
        warnings: emptyResolved.warnings,
      },
    },
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161b-postcheck.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  console.log(`[MC1.6.1B] wrote ${path}`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
