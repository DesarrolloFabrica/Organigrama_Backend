/**
 * MC1.6.1B.1 — auditoría RO: casos de referencia + integridad.
 * Sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import {
  resolveMcMappingPack,
} from '../../mc-catalog/mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';
import {
  computeMcPa2ConfigHash,
  resolveMcPa2EngineConfig,
} from '../../mc-catalog/mc-pa2.config';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const comps = app.get(OrgChartCompetenciesService);
  const viewer = (personId: string): OrgViewerContext => ({
    personId,
    eduEmail: 'audit@local',
    permissions: ['ORG_READ_ALL'],
  });

  // --- Reference cases ---
  const evals = await ds.query(
    `SELECT e.id::text, e.person_id::text, p.full_name, p.document,
            e.domain_code, e.is_active, e.status, e.engine_rules_version,
            e.default_specialty_code, e.catalog_version_id::text,
            cv.version AS catalog_version, cv.is_active AS catalog_active,
            cv.status AS catalog_status,
            e.domain_id::text, e.extraction_id::text, e.enrichment_id::text,
            e.evidence_evaluation_id::text, e.person_cv_id::text,
            e.mapping_hash, e.config_hash,
            e.active_count, e.emergent_count, e.hidden_count,
            e.completed_at, e.created_at
       FROM organigrama.mc_profile_evaluation e
       JOIN core.person p ON p.id = e.person_id
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
      WHERE e.id IN (2, 3, 4)
         OR e.person_id IN (1, 2, 1163)
      ORDER BY e.id`,
  );

  const specialtyResults = await ds.query(
    `SELECT r.id::text, r.profile_evaluation_id::text, r.specialty_code,
            r.presentation_status, r.is_default, r.rank,
            r.coverage, r.strength, r.confidence,
            r.mapped_skill_count, r.evidenced_skill_count
       FROM organigrama.mc_profile_specialty_result r
      WHERE r.profile_evaluation_id IN (2, 3, 4)
      ORDER BY r.profile_evaluation_id, r.rank`,
  );

  const catalogs = await ds.query(
    `SELECT id::text, code, version, status, is_active, config_hash, created_at
       FROM organigrama.mc_catalog_version ORDER BY id`,
  );

  const domains = await ds.query(
    `SELECT d.id::text, d.code, d.name, d.is_active, d.catalog_version_id::text,
            cv.version AS catalog_version, cv.is_active AS catalog_active
       FROM organigrama.mc_domain d
       JOIN organigrama.mc_catalog_version cv ON cv.id = d.catalog_version_id
      ORDER BY d.catalog_version_id, d.sort_order`,
  );

  // Nidia role diagnosis
  const nidiaPerson = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.role_id::text, ro.name AS role_name,
            p.area_id::text, a.name AS area_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.id = 1163 OR p.document = '1015482688'`,
  );

  const orgVersions = await ds.query(
    `SELECT id::text, code, name, is_active, is_locked, period_label, created_at
       FROM organigrama.org_chart_version
      ORDER BY id DESC LIMIT 10`,
  );

  const nidiaVisual = await ds.query(
    `SELECT v.id::text AS version_id, v.code AS version_code, v.name AS version_name,
            v.is_active AS version_active,
            r.id::text AS relation_id, r.is_active AS relation_active,
            child.id::text AS child_id, child.full_name AS child_name,
            cro.name AS child_role_from_core,
            parent.id::text AS parent_id, parent.full_name AS parent_name,
            pro.name AS parent_role
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation r ON r.version_id = v.id
       JOIN core.person child ON child.id = r.child_person_id
       LEFT JOIN core.role cro ON cro.id = child.role_id
       LEFT JOIN core.person parent ON parent.id = r.parent_person_id
       LEFT JOIN core.role pro ON pro.id = parent.role_id
      WHERE child.id = 1163
      ORDER BY v.id DESC, r.id
      LIMIT 20`,
  );

  const uxRoles = await ds.query(
    `SELECT id::text, name, is_active
       FROM core.role
      WHERE name ILIKE '%UX%' OR name ILIKE '%UI%' OR name ILIKE '%interfaz%'
         OR name ILIKE '%diseñador%' OR name ILIKE '%diseñadora%'
         OR name ILIKE '%DISEÑO%'
      ORDER BY id
      LIMIT 80`,
  );

  const nidiaRoleHistory = await ds.query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_name ILIKE '%role%hist%'
         OR table_name ILIKE '%person%hist%'
         OR table_name ILIKE '%audit%'
      ORDER BY table_schema, table_name
      LIMIT 40`,
  );

  // Integrity anomalies
  const multiActivePerPersonDomain = await ds.query(
    `SELECT person_id::text, domain_code, COUNT(*)::int AS n,
            array_agg(id::text ORDER BY id) AS eval_ids
       FROM organigrama.mc_profile_evaluation
      WHERE is_active = TRUE
      GROUP BY person_id, domain_code
     HAVING COUNT(*) > 1`,
  );

  const multiActivePerPerson = await ds.query(
    `SELECT person_id::text, COUNT(*)::int AS n,
            array_agg(domain_code || '#' || id::text ORDER BY id) AS evals
       FROM organigrama.mc_profile_evaluation
      WHERE is_active = TRUE
      GROUP BY person_id
     HAVING COUNT(*) > 1`,
  );

  const activeOnInactiveCatalog = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code, cv.version, cv.is_active
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
      WHERE e.is_active = TRUE AND cv.is_active = FALSE`,
  );

  const evalsWithoutResults = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code
       FROM organigrama.mc_profile_evaluation e
      WHERE NOT EXISTS (
        SELECT 1 FROM organigrama.mc_profile_specialty_result r
         WHERE r.profile_evaluation_id = e.id
      )`,
  );

  const orphanResults = await ds.query(
    `SELECT r.id::text, r.profile_evaluation_id::text
       FROM organigrama.mc_profile_specialty_result r
      WHERE NOT EXISTS (
        SELECT 1 FROM organigrama.mc_profile_evaluation e
         WHERE e.id = r.profile_evaluation_id
      )
      LIMIT 20`,
  );

  const nullHashes = await ds.query(
    `SELECT id::text, person_id::text, domain_code,
            mapping_hash IS NULL AS mapping_null,
            config_hash IS NULL AS config_null
       FROM organigrama.mc_profile_evaluation
      WHERE mapping_hash IS NULL OR config_hash IS NULL`,
  );

  const activeEvalStaleEvidence = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code,
            e.evidence_evaluation_id::text, ev.is_active AS evidence_active,
            ev.status AS evidence_status,
            e.extraction_id::text, x.is_active AS extraction_active
       FROM organigrama.mc_profile_evaluation e
       LEFT JOIN organigrama.cv_evidence_evaluation ev
         ON ev.id = e.evidence_evaluation_id
       LEFT JOIN organigrama.cv_extraction x ON x.id = e.extraction_id
      WHERE e.is_active = TRUE
        AND (ev.is_active IS DISTINCT FROM TRUE OR x.is_active IS DISTINCT FROM TRUE)`,
  );

  const domainsWithoutSpecs = await ds.query(
    `SELECT d.id::text, d.code, cv.version
       FROM organigrama.mc_domain d
       JOIN organigrama.mc_catalog_version cv ON cv.id = d.catalog_version_id
      WHERE d.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM organigrama.mc_specialty s
           WHERE s.domain_id = d.id AND s.is_active = TRUE
        )`,
  );

  const specsWithoutMappings = await ds.query(
    `SELECT s.id::text, s.code, d.code AS domain_code, cv.version
       FROM organigrama.mc_specialty s
       JOIN organigrama.mc_domain d ON d.id = s.domain_id
       JOIN organigrama.mc_catalog_version cv ON cv.id = s.catalog_version_id
      WHERE s.is_active = TRUE AND cv.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM organigrama.mc_skill_specialty_mapping m
           WHERE m.specialty_id = s.id AND m.is_active = TRUE
        )
      ORDER BY d.code, s.sort_order`,
  );

  const mappingCounts = await ds.query(
    `SELECT cv.version, d.code AS domain_code, COUNT(*)::int AS mapping_count
       FROM organigrama.mc_skill_specialty_mapping m
       JOIN organigrama.mc_specialty s ON s.id = m.specialty_id
       JOIN organigrama.mc_domain d ON d.id = s.domain_id
       JOIN organigrama.mc_catalog_version cv ON cv.id = m.catalog_version_id
      WHERE m.is_active = TRUE
      GROUP BY cv.version, d.code
      ORDER BY cv.version, d.code`,
  );

  // Hash determinism (local, no DB write)
  const softPack = resolveMcMappingPack('SOFTWARE');
  const visPack = resolveMcMappingPack('VISUAL_DESIGN');
  const softHash1 = computeMcMappingPackHash(softPack.pack);
  const softHash2 = computeMcMappingPackHash(softPack.pack);
  const visHash1 = computeMcMappingPackHash(visPack.pack);
  const visHash2 = computeMcMappingPackHash(visPack.pack);
  const softCfg = resolveMcPa2EngineConfig('pa2-software-1.1.0');
  const visCfg = resolveMcPa2EngineConfig('pa2-visual-design-1.0.0');
  const softCfgH1 = computeMcPa2ConfigHash(softCfg);
  const softCfgH2 = computeMcPa2ConfigHash(softCfg);
  const visCfgH1 = computeMcPa2ConfigHash(visCfg);
  const visCfgH2 = computeMcPa2ConfigHash(visCfg);

  // API structural compare
  const nidiaApi = await comps.getExplorerSummary(viewer('1163'), '1163', '0', {
    includeHidden: true,
    includeAudit: true,
  });
  const camiloApi = await comps.getExplorerSummary(viewer('1'), '1', '0', {
    includeHidden: true,
    includeAudit: true,
  });
  const johanApi = await comps.getExplorerSummary(viewer('2'), '2', '0', {
    includeHidden: true,
    includeAudit: true,
  });

  function shape(obj: unknown, path = ''): string[] {
    if (obj === null) return [`${path}:null`];
    if (Array.isArray(obj)) {
      if (obj.length === 0) return [`${path}:[]`];
      return shape(obj[0], `${path}[]`);
    }
    if (typeof obj === 'object') {
      return Object.keys(obj as object)
        .sort()
        .flatMap((k) =>
          shape((obj as Record<string, unknown>)[k], path ? `${path}.${k}` : k),
        );
    }
    return [`${path}:${typeof obj}`];
  }

  const out = {
    phase: 'MC1.6.1B.1-ro-audit',
    generatedAt: new Date().toISOString(),
    reference: { evals, specialtyResultCounts: {
      eval2: specialtyResults.filter((r: { profile_evaluation_id: string }) => r.profile_evaluation_id === '2').length,
      eval3: specialtyResults.filter((r: { profile_evaluation_id: string }) => r.profile_evaluation_id === '3').length,
      eval4: specialtyResults.filter((r: { profile_evaluation_id: string }) => r.profile_evaluation_id === '4').length,
    }, specialtyResults },
    catalogs,
    domains,
    nidiaRole: {
      person: nidiaPerson,
      orgVersions,
      visualRelations: nidiaVisual,
      uxLikeRoles: uxRoles,
      historyTables: nidiaRoleHistory,
    },
    integrity: {
      multiActivePerPersonDomain,
      multiActivePerPerson,
      activeOnInactiveCatalog,
      evalsWithoutResults,
      orphanResults,
      nullHashes,
      activeEvalStaleEvidence,
      domainsWithoutSpecs,
      specsWithoutMappings,
      mappingCounts,
    },
    hashesLocal: {
      softwarePackVersion: softPack.mappingRulesVersion,
      visualPackVersion: visPack.mappingRulesVersion,
      softHash: { h1: softHash1, h2: softHash2, equal: softHash1 === softHash2 },
      visHash: { h1: visHash1, h2: visHash2, equal: visHash1 === visHash2 },
      softCfg: {
        version: softCfg.engineRulesVersion,
        hash1: softCfgH1,
        hash2: softCfgH2,
        equal: softCfgH1 === softCfgH2,
        minimumActiveStrength: softCfg.minimumActiveStrength ?? null,
      },
      visCfg: {
        version: visCfg.engineRulesVersion,
        hash1: visCfgH1,
        hash2: visCfgH2,
        equal: visCfgH1 === visCfgH2,
        minimumActiveStrength: visCfg.minimumActiveStrength ?? null,
        activeCoverageThreshold: visCfg.activeCoverageThreshold,
      },
    },
    api: {
      nidia: {
        availability: nidiaApi.availabilityStatus,
        keys: shape(nidiaApi),
        summary: {
          role: nidiaApi.person?.role,
          domain: nidiaApi.domains?.[0]?.code,
          default: nidiaApi.domains?.[0]?.defaultSpecialtyCode,
          evalId: nidiaApi.evaluation?.id,
          rules: nidiaApi.evaluation?.rulesVersion,
          audit: nidiaApi.evaluation?.audit ?? null,
          specialtyCount: nidiaApi.domains?.[0]?.specialties?.length ?? 0,
        },
      },
      camilo: {
        availability: camiloApi.availabilityStatus,
        keys: shape(camiloApi),
        summary: {
          role: camiloApi.person?.role,
          domain: camiloApi.domains?.[0]?.code,
          default: camiloApi.domains?.[0]?.defaultSpecialtyCode,
          evalId: camiloApi.evaluation?.id,
          rules: camiloApi.evaluation?.rulesVersion,
          audit: camiloApi.evaluation?.audit ?? null,
          specialtyCount: camiloApi.domains?.[0]?.specialties?.length ?? 0,
        },
      },
      johan: {
        availability: johanApi.availabilityStatus,
        keys: shape(johanApi),
        summary: {
          role: johanApi.person?.role,
          domains: johanApi.domains?.length ?? 0,
          warnings: johanApi.warnings,
        },
      },
      shapeEqualNidiaCamilo:
        JSON.stringify(shape(nidiaApi)) === JSON.stringify(shape(camiloApi)),
    },
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161b1-ro-audit.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify({
    wrote: path,
    evalIds: evals.map((e: { id: string; is_active: boolean; domain_code: string }) => ({
      id: e.id,
      active: e.is_active,
      domain: e.domain_code,
    })),
    integrity: {
      multiActivePD: multiActivePerPersonDomain.length,
      multiActiveP: multiActivePerPerson.length,
      activeInactiveCat: activeOnInactiveCatalog.length,
      noResults: evalsWithoutResults.length,
      orphans: orphanResults.length,
      nullHashes: nullHashes.length,
      staleEvidence: activeEvalStaleEvidence.length,
      specsNoMap: specsWithoutMappings.map((s: { code: string }) => s.code),
    },
    hashes: {
      softEq: softHash1 === softHash2,
      visEq: visHash1 === visHash2,
      softCfgEq: softCfgH1 === softCfgH2,
      visCfgEq: visCfgH1 === visCfgH2,
      visMinStrength: visCfg.minimumActiveStrength ?? null,
    },
    api: {
      nidia: out.api.nidia.summary,
      camilo: out.api.camilo.summary,
      johan: out.api.johan.summary,
      shapeEqual: out.api.shapeEqualNidiaCamilo,
    },
    nidiaRole: nidiaPerson[0],
  }, null, 2));

  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
