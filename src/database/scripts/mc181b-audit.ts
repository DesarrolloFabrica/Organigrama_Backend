/**
 * MC1.8.1B — Auditoría catálogo activo + integridad multidominio (solo lectura).
 * npm run build && node dist/database/scripts/mc181b-audit.js [--out=tmp/mc181b-audit.json]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McCatalogService } from '../../mc-catalog/mc-catalog.service';
import { DataSource } from 'typeorm';
import {
  listMcMappingDomainCodes,
  listMcMappingPackReleases,
  resolveMcMappingPack,
} from '../../mc-catalog/mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';
import {
  MC_PA2_PUBLISHED_RULE_FINGERPRINTS,
  assertMcPa2RuleFingerprint,
} from '../../mc-catalog/mc-pa2.algorithm';
import { resolveMcPa2EngineConfig } from '../../mc-catalog/mc-pa2.config';

const TAG = '[MC1.8.1B Audit]';

function parseArgs(argv: string[]): { out?: string } {
  const out: { out?: string } = {};
  for (const arg of argv) {
    if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const catalogSvc = app.select(McCatalogModule).get(McCatalogService);
    const ds = app.get(DataSource);

    const snapshot = await catalogSvc.loadSnapshot();

    const domainRows = await ds.query(
      `SELECT cv.version, cv.is_active, d.code AS domain_code,
              COUNT(DISTINCT c.id) FILTER (WHERE c.is_active) AS classifications,
              COUNT(DISTINCT m.id) FILTER (WHERE m.is_active) AS mappings
       FROM organigrama.mc_catalog_version cv
       JOIN organigrama.mc_domain d ON d.catalog_version_id = cv.id
       LEFT JOIN organigrama.mc_skill_domain_classification c
         ON c.catalog_version_id = cv.id AND c.domain_id = d.id
       LEFT JOIN organigrama.mc_skill_specialty_mapping m
         ON m.catalog_version_id = cv.id
       LEFT JOIN organigrama.mc_specialty s
         ON s.id = m.specialty_id AND s.domain_id = d.id
       WHERE d.code IN ('SOFTWARE','VISUAL_DESIGN','AUDIOVISUAL_PRODUCTION')
         AND (m.id IS NULL OR s.id IS NOT NULL)
       GROUP BY cv.version, cv.is_active, d.code
       ORDER BY cv.version, d.code`,
    );

    const packReleases = await ds.query(
      `SELECT pack_code, pack_version, content_hash, status, created_at
       FROM organigrama.mc_mapping_pack_release
       ORDER BY pack_code, pack_version`,
    );

    const evaluations = await ds.query(
      `SELECT pe.id, pe.person_id, pe.domain_code, pe.engine_rules_version,
              pe.mapping_hash, pe.config_hash, pe.evaluation_context_hash,
              pe.is_active, cv.version AS catalog_version
       FROM organigrama.mc_profile_evaluation pe
       JOIN organigrama.mc_catalog_version cv ON cv.id = pe.catalog_version_id
       WHERE pe.domain_code IN ('SOFTWARE','VISUAL_DESIGN','AUDIOVISUAL_PRODUCTION')
       ORDER BY pe.id::bigint`,
    );

    const registryHashes = Object.fromEntries(
      listMcMappingDomainCodes().map((code) => {
        const reg = resolveMcMappingPack(code);
        return [
          code,
          {
            packCode: reg.packCode,
            mappingRulesVersion: reg.mappingRulesVersion,
            hash: computeMcMappingPackHash(reg.pack),
          },
        ];
      }),
    );

    const pa2Fingerprints = MC_PA2_PUBLISHED_RULE_FINGERPRINTS.map((f) => {
      try {
        assertMcPa2RuleFingerprint(resolveMcPa2EngineConfig(f.engineRulesVersion));
        return { ...f, status: 'OK' };
      } catch (e) {
        return {
          ...f,
          status: 'DIVERGENT',
          error: e instanceof Error ? e.message : String(e),
        };
      }
    });

    const report = {
      generatedAt: new Date().toISOString(),
      activeCatalog: {
        id: snapshot.catalogVersionId,
        version: snapshot.catalogVersion,
        configHash: snapshot.configHash,
        isActive: snapshot.isActive,
        domains: snapshot.domains.map((d) => ({
          code: d.code,
          specialtyCount: d.specialties.length,
        })),
      },
      mappingCoverageByCatalogVersion: domainRows,
      packReleasesInDb: packReleases,
      registryPackHashes: registryHashes,
      registeredReleases: listMcMappingPackReleases().map((r) => ({
        packCode: r.packCode,
        version: r.mappingRulesVersion,
        hash: computeMcMappingPackHash(r.pack),
      })),
      pa2Fingerprints,
      persistedEvaluations: evaluations,
      rootCauseNote:
        'Mappings are scoped by catalog_version_id. Domains exist per catalog bump; ' +
        'classifications/mappings must be seeded per active catalog version.',
    };

    const json = JSON.stringify(report, null, 2);
    console.log(
      `${TAG} active=${snapshot.catalogVersion} id=${snapshot.catalogVersionId}`,
    );
    console.log(json);

    if (args.out) {
      const path = resolve(process.cwd(), args.out);
      writeFileSync(path, json, 'utf8');
      console.log(`${TAG} written=${path}`);
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
