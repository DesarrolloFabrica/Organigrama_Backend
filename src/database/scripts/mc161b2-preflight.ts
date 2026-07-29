/**
 * MC1.6.1B.2 preflight RO — sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import {
  computeMcPa2ConfigHash,
  getMcPa2EngineConfigV100,
  getMcPa2EngineConfigV110,
  getMcPa2EngineConfigVisualDesignV100,
} from '../../mc-catalog/mc-pa2.config';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';
import { resolveMcMappingPack } from '../../mc-catalog/mc-catalog.mapping-registry';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const ds = app.get(DataSource);

  const evals = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code, e.is_active,
            e.engine_rules_version, e.default_specialty_code,
            e.mapping_hash, e.config_hash,
            e.catalog_version_id::text, e.extraction_id::text,
            e.enrichment_id::text, e.evidence_evaluation_id::text,
            e.active_count, e.emergent_count, e.hidden_count,
            x.pdf_sha256 AS extraction_hash,
            en.pdf_sha256 AS enrichment_hash,
            (SELECT COUNT(*)::int
               FROM organigrama.mc_profile_specialty_result r
              WHERE r.profile_evaluation_id = e.id) AS result_count
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.cv_extraction x ON x.id = e.extraction_id
       JOIN organigrama.cv_skill_enrichment en ON en.id = e.enrichment_id
      ORDER BY e.id`,
  );

  const integrity = await ds.query(
    `SELECT
       (SELECT COUNT(*)::int FROM (
          SELECT person_id, domain_code
            FROM organigrama.mc_profile_evaluation
           WHERE is_active = TRUE
           GROUP BY person_id, domain_code
          HAVING COUNT(*) > 1
       ) t) AS dup_active,
       (SELECT COUNT(*)::int FROM organigrama.mc_profile_evaluation e
         WHERE NOT EXISTS (
           SELECT 1 FROM organigrama.mc_profile_specialty_result r
            WHERE r.profile_evaluation_id = e.id
         )) AS no_results,
       (SELECT COUNT(*)::int FROM organigrama.mc_profile_evaluation
         WHERE mapping_hash IS NULL OR config_hash IS NULL) AS null_hashes`,
  );

  const catalogs = await ds.query(
    `SELECT id::text, version, status, is_active FROM organigrama.mc_catalog_version ORDER BY id`,
  );

  const sw = resolveMcMappingPack('SOFTWARE');
  const vd = resolveMcMappingPack('VISUAL_DESIGN');

  const out = {
    phase: 'MC1.6.1B.2-preflight',
    generatedAt: new Date().toISOString(),
    evals,
    catalogs,
    integrity: integrity[0],
    localCfg: {
      v100: computeMcPa2ConfigHash(getMcPa2EngineConfigV100()),
      v110: computeMcPa2ConfigHash(getMcPa2EngineConfigV110()),
      visual: computeMcPa2ConfigHash(getMcPa2EngineConfigVisualDesignV100()),
    },
    localPack: {
      software: {
        version: sw.mappingRulesVersion,
        hash: computeMcMappingPackHash(sw.pack),
      },
      visual: {
        version: vd.mappingRulesVersion,
        hash: computeMcMappingPackHash(vd.pack),
      },
    },
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161b2-preflight.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
