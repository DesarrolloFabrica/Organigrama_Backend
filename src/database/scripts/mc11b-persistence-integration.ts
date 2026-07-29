/**
 * Integración MC1.1B — persistencia multidominio real en PostgreSQL local.
 *
 * npm run test:mc1-persistence:local
 *
 * Requiere:
 *   docker compose -f docker-compose.mc1-local.yml up -d
 *   npm run mc:local:bootstrap -- --i-confirm-bootstrap --env-file=.env.mc1-local
 *
 * No usa AppModule completo (evita Cloud SQL / secretos cloud).
 */
import * as dotenv from 'dotenv';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import {
  McCatalogVersion,
  McDomain,
  McEvaluationSet,
  McEvaluationSetDomain,
  McProfileEvaluation,
  McProfileSpecialtyResult,
  McSkillDomainClassification,
  McSkillSpecialtyMapping,
  McSpecialty,
} from '../../mc-catalog/entities';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import type { McPa2EngineRunResult } from '../../mc-catalog/mc-pa2.types';
import { resolveMcPa2EngineConfig } from '../../mc-catalog/mc-pa2.config';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';
import { selectPrimaryDomainCodeForApiSummary } from '../../mc-catalog/mc-domain-qualification';

const TAG = '[MC1.1B Persistence IT]';

/** IDs reservados para fixtures (no colisionan con datos reales). */
export const FIXTURE = {
  personId: '900001',
  document: '9000010000',
  catalogCode: 'mc1-local-fixture',
  catalogVersion: 'mc1.1b-fixture-1',
} as const;

function loadEnv(): void {
  const envArg = process.argv.find((a) => a.startsWith('--env-file='));
  const envPath = envArg
    ? resolve(process.cwd(), envArg.slice('--env-file='.length))
    : resolve(process.cwd(), '.env.mc1-local');
  if (!existsSync(envPath)) {
    throw new Error(`Falta ${envPath}`);
  }
  dotenv.config({ path: envPath, override: true, quiet: true });
  // Evitar que un DB_SCHEMA residual del entorno desvíe TypeORM.
  delete process.env.DB_SCHEMA;
  process.env.DB_SSL = 'false';
}

function sha64(seed: string): string {
  let h = seed;
  while (h.length < 64) h += seed.replace(/\W/g, 'a');
  return h.slice(0, 64).replace(/[^a-f0-9]/gi, 'a').toLowerCase();
}

function emptyResult(
  domainCode: string,
  rulesVersion: string,
  counts: { active: number; emergent: number; hidden: number },
): McPa2EngineRunResult {
  return {
    domainCode,
    engineRulesVersion: rulesVersion,
    configHash: 'b'.repeat(64),
    specialtyResults: [],
    defaultSpecialtyCode: null,
    activeCount: counts.active,
    emergentCount: counts.emergent,
    hiddenCount: counts.hidden,
    warnings: [],
  };
}

async function createLocalDataSource(): Promise<DataSource> {
  assertLocalDatabaseHost(process.env.DB_HOST);
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5433),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
    database: process.env.DB_NAME,
    ssl: false,
    synchronize: false,
    logging: false,
    entities: [
      McCatalogVersion,
      McDomain,
      McSpecialty,
      McSkillDomainClassification,
      McSkillSpecialtyMapping,
      McProfileEvaluation,
      McProfileSpecialtyResult,
      McEvaluationSet,
      McEvaluationSetDomain,
    ],
  });
  await ds.initialize();
  const host = (ds.options as { host?: string }).host;
  assertLocalDatabaseHost(host);
  return ds;
}

function buildPa2(ds: DataSource): McPa2Service {
  return new McPa2Service(
    ds,
    ds.getRepository(McCatalogVersion),
    ds.getRepository(McDomain),
    ds.getRepository(McSpecialty),
    ds.getRepository(McSkillDomainClassification),
    ds.getRepository(McSkillSpecialtyMapping),
    ds.getRepository(McProfileEvaluation),
    ds.getRepository(McProfileSpecialtyResult),
  );
}

async function cleanupFixtures(ds: DataSource): Promise<void> {
  await ds.query(
    `DELETE FROM organigrama.mc_evaluation_set_domain
      WHERE evaluation_set_id IN (
        SELECT id FROM organigrama.mc_evaluation_set WHERE person_id = $1
      )`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.mc_evaluation_set WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.mc_profile_specialty_result
      WHERE profile_evaluation_id IN (
        SELECT id FROM organigrama.mc_profile_evaluation WHERE person_id = $1
      )`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.mc_profile_evaluation WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.cv_evidence_evaluation WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.cv_skill_enrichment WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.cv_extraction WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(
    `DELETE FROM organigrama.person_cv WHERE person_id = $1`,
    [FIXTURE.personId],
  );
  await ds.query(`DELETE FROM core.person WHERE id = $1`, [FIXTURE.personId]);
  await ds.query(
    `DELETE FROM organigrama.mc_specialty
      WHERE catalog_version_id IN (
        SELECT id FROM organigrama.mc_catalog_version
         WHERE code = $1 AND version = $2
      )`,
    [FIXTURE.catalogCode, FIXTURE.catalogVersion],
  );
  await ds.query(
    `DELETE FROM organigrama.mc_domain
      WHERE catalog_version_id IN (
        SELECT id FROM organigrama.mc_catalog_version
         WHERE code = $1 AND version = $2
      )`,
    [FIXTURE.catalogCode, FIXTURE.catalogVersion],
  );
  await ds.query(
    `DELETE FROM organigrama.mc_catalog_version
      WHERE code = $1 AND version = $2`,
    [FIXTURE.catalogCode, FIXTURE.catalogVersion],
  );
}

async function seedFixture(ds: DataSource): Promise<{
  personCvId: string;
  extractionId: string;
  enrichmentId: string;
  evidenceId: string;
  catalogVersionId: string;
  domains: Record<string, string>;
}> {
  await ds.query(
    `INSERT INTO core.person (id, document, full_name, is_active)
     VALUES ($1, $2, 'MC1 Fixture Synthetic', TRUE)
     ON CONFLICT (id) DO UPDATE SET is_active = TRUE`,
    [FIXTURE.personId, FIXTURE.document],
  );

  const cv = await ds.query(
    `INSERT INTO organigrama.person_cv
        (person_id, document, drive_file_id, drive_file_name, mime_type, is_active, synced_at)
     VALUES ($1, $2, 'fixture-drive-id', 'fixture.pdf', 'application/pdf', TRUE, NOW())
     RETURNING id::text`,
    [FIXTURE.personId, FIXTURE.document],
  );
  const personCvId = cv[0].id as string;

  const pdf = sha64('fixture-pdf');
  const ext = await ds.query(
    `INSERT INTO organigrama.cv_extraction
        (person_id, person_cv_id, document, drive_file_id, drive_file_name,
         pdf_sha256, pdf_byte_size, model, prompt_version, extractor_version,
         status, is_active, started_at, finished_at, skills_count)
     VALUES ($1,$2,$3,'fixture-drive-id','fixture.pdf',
             $4, 1024, 'fixture-model', 'c2.1-fixture', '1.0.0-fixture',
             'SUCCEEDED', TRUE, NOW(), NOW(), 3)
     RETURNING id::text`,
    [FIXTURE.personId, personCvId, FIXTURE.document, pdf],
  );
  const extractionId = ext[0].id as string;

  const enr = await ds.query(
    `INSERT INTO organigrama.cv_skill_enrichment
        (extraction_id, person_id, person_cv_id, pdf_sha256, inventory_hash,
         model, prompt_version, enricher_version, block_config_version,
         block_config, block_config_hash, status, is_active,
         input_skills_count, output_skills_count, blocks_total)
     VALUES ($1,$2,$3,$4,'inv-hash',
             'fixture-model','e1-fixture','1.0.0','b1',
             '{}'::jsonb, 'cfg-hash', 'SUCCEEDED', TRUE,
             3, 3, 1)
     RETURNING id::text`,
    [extractionId, FIXTURE.personId, personCvId, pdf],
  );
  const enrichmentId = enr[0].id as string;

  const ev = await ds.query(
    `INSERT INTO organigrama.cv_evidence_evaluation
        (enrichment_id, extraction_id, person_id,
         evidence_rules_version, source_weight_version, algorithm_version,
         config_hash, config_json, status, is_active, input_skills_count)
     VALUES ($1,$2,$3,
             'er1','sw1','algo1',
             'cfg', '{}'::jsonb, 'SUCCEEDED', TRUE, 3)
     RETURNING id::text`,
    [enrichmentId, extractionId, FIXTURE.personId],
  );
  const evidenceId = ev[0].id as string;

  const cat = await ds.query(
    `INSERT INTO organigrama.mc_catalog_version
        (code, name, version, status, is_active, config_hash)
     VALUES ($1, 'MC1 Local Fixture', $2, 'ACTIVE', TRUE, $3)
     RETURNING id::text`,
    [FIXTURE.catalogCode, FIXTURE.catalogVersion, sha64('catalog')],
  );
  const catalogVersionId = cat[0].id as string;

  const domainCodes = [
    'SOFTWARE',
    'VISUAL_DESIGN',
    'AUDIOVISUAL_PRODUCTION',
  ] as const;
  const domains: Record<string, string> = {};
  let sort = 1;
  for (const code of domainCodes) {
    const d = await ds.query(
      `INSERT INTO organigrama.mc_domain
          (catalog_version_id, code, name, sort_order, is_active)
       VALUES ($1, $2, $2, $3, TRUE)
       RETURNING id::text`,
      [catalogVersionId, code, sort++],
    );
    domains[code] = d[0].id as string;
  }

  return {
    personCvId,
    extractionId,
    enrichmentId,
    evidenceId,
    catalogVersionId,
    domains,
  };
}

function buildMeta(
  seed: Awaited<ReturnType<typeof seedFixture>>,
  domainCode: string,
  rulesVersion: string,
) {
  return {
    personId: FIXTURE.personId,
    personCvId: seed.personCvId,
    extractionId: seed.extractionId,
    enrichmentId: seed.enrichmentId,
    evidenceEvaluationId: seed.evidenceId,
    catalogVersionId: seed.catalogVersionId,
    catalogVersion: FIXTURE.catalogVersion,
    domainId: seed.domains[domainCode],
    domainCode,
    mappingHash: sha64(`map-${domainCode}`),
    configHash: sha64(`cfg-${rulesVersion}`),
    mappingPackCode: `${domainCode.toLowerCase()}-mappings`,
    mappingPackVersion: 'fixture-1.0.0',
    sourceHash: sha64('fixture-pdf'),
    algorithmVersion: 'pa2-algo-lexico-v1',
    evaluationContextHash: sha64(`ctx-${domainCode}`),
  };
}

async function countActive(ds: DataSource): Promise<number> {
  const rows = await ds.query(
    `SELECT COUNT(*)::int AS n
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 AND is_active = TRUE`,
    [FIXTURE.personId],
  );
  return Number(rows[0].n);
}

async function listEvals(ds: DataSource) {
  return ds.query(
    `SELECT id::text, domain_code, domain_qualification, is_active,
            mapping_pack_code, engine_rules_version, extraction_id::text,
            (SELECT COUNT(*)::int FROM organigrama.mc_profile_specialty_result s
              WHERE s.profile_evaluation_id = e.id) AS specialty_count
       FROM organigrama.mc_profile_evaluation e
      WHERE person_id = $1
      ORDER BY id`,
    [FIXTURE.personId],
  );
}

async function apiEquivalent(ds: DataSource) {
  const rows = await ds.query(
    `SELECT e.id::int AS id, e.domain_code, e.is_active, e.status,
            cv.is_active AS catalog_is_active, e.domain_qualification
       FROM organigrama.mc_profile_evaluation e
       JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
      WHERE e.person_id = $1 AND e.is_active = TRUE AND e.status = 'SUCCEEDED'
      ORDER BY cv.is_active DESC, e.id DESC`,
    [FIXTURE.personId],
  );
  const mapped = rows.map(
    (r: {
      id: number;
      domain_code: string;
      is_active: boolean;
      status: string;
      catalog_is_active: boolean;
      domain_qualification: string | null;
    }) => ({
      id: r.id,
      domain_code: r.domain_code,
      is_active: r.is_active,
      status: r.status,
      catalog_is_active: r.catalog_is_active,
      domain_qualification: r.domain_qualification,
    }),
  );
  return {
    rows: mapped,
    selected: selectPrimaryDomainCodeForApiSummary(mapped),
  };
}

export async function runMc11bPersistenceIntegration(): Promise<
  Record<string, unknown>
> {
  loadEnv();
  assertLocalDatabaseHost(process.env.DB_HOST);

  const report: Record<string, unknown> = {
    phase: 'MC1.1B-persistence-IT',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    at: new Date().toISOString(),
  };

  const ds = await createLocalDataSource();
  const pa2 = buildPa2(ds);

  try {
    await cleanupFixtures(ds);
    const seed = await seedFixture(ds);

    // ── Run 1: SOFTWARE gana ──────────────────────────────────────────
    const run1 = await pa2.persistMultidomainEvaluationRun([
      {
        meta: buildMeta(seed, 'SOFTWARE', 'pa2-software-1.1.0'),
        result: emptyResult('SOFTWARE', 'pa2-software-1.1.0', {
          active: 1,
          emergent: 0,
          hidden: 2,
        }),
        config: resolveMcPa2EngineConfig('pa2-software-1.1.0'),
        inputSkillsCount: 5,
        domainQualification: 'PRIMARY_MATCH',
        activateOnPersist: true,
      },
      {
        meta: buildMeta(seed, 'VISUAL_DESIGN', 'pa2-visual-design-1.1.0'),
        result: emptyResult('VISUAL_DESIGN', 'pa2-visual-design-1.1.0', {
          active: 0,
          emergent: 1,
          hidden: 2,
        }),
        config: resolveMcPa2EngineConfig('pa2-visual-design-1.1.0'),
        inputSkillsCount: 4,
        domainQualification: 'SECONDARY_SIGNAL',
        activateOnPersist: false,
      },
      {
        meta: buildMeta(
          seed,
          'AUDIOVISUAL_PRODUCTION',
          'pa2-audiovisual-production-1.0.0',
        ),
        result: emptyResult(
          'AUDIOVISUAL_PRODUCTION',
          'pa2-audiovisual-production-1.0.0',
          { active: 0, emergent: 0, hidden: 3 },
        ),
        config: resolveMcPa2EngineConfig('pa2-audiovisual-production-1.0.0'),
        inputSkillsCount: 2,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
    ]);

    if (!run1.evaluationSetId) {
      throw new Error('Run1 sin evaluationSetId');
    }
    if (run1.evaluationSetStatus !== 'COMPLETE') {
      throw new Error(`Run1 set status=${run1.evaluationSetStatus}`);
    }
    const run1Outcomes = run1.domainResults;
    void run1Outcomes;
    const active1 = await countActive(ds);
    const api1 = await apiEquivalent(ds);
    const evals1 = await listEvals(ds);
    if (active1 !== 1) throw new Error(`Run1 active=${active1}, esperado 1`);
    if (api1.selected !== 'SOFTWARE') {
      throw new Error(`Run1 API selected=${api1.selected}`);
    }
    const q = Object.fromEntries(
      (evals1 as Array<{ domain_code: string; domain_qualification: string }>).map(
        (e) => [e.domain_code, e.domain_qualification],
      ),
    );
    if (q.SOFTWARE !== 'PRIMARY_MATCH') throw new Error('Run1 SOFTWARE qual');
    if (q.VISUAL_DESIGN !== 'SECONDARY_SIGNAL') {
      throw new Error('Run1 VISUAL qual');
    }
    if (q.AUDIOVISUAL_PRODUCTION !== 'OUTSIDE') {
      throw new Error('Run1 AV qual');
    }

    // Evaluación inactiva con ID mayor no debe desplazar al ganador activo
    await ds.query(
      `INSERT INTO organigrama.mc_profile_evaluation
          (person_id, person_cv_id, extraction_id, enrichment_id,
           evidence_evaluation_id, catalog_version_id, domain_id, domain_code,
           engine_rules_version, config_hash, mapping_hash, status, is_active,
           input_skills_count, specialty_count, domain_qualification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'VISUAL_DESIGN',
               'pa2-visual-design-1.1.0', $8, $9, 'SUCCEEDED', FALSE,
               1, 0, 'SECONDARY_SIGNAL')`,
      [
        FIXTURE.personId,
        seed.personCvId,
        seed.extractionId,
        seed.enrichmentId,
        seed.evidenceId,
        seed.catalogVersionId,
        seed.domains.VISUAL_DESIGN,
        sha64('higher-id-cfg'),
        sha64('higher-id-map'),
      ],
    );
    const apiHigher = await apiEquivalent(ds);
    if (apiHigher.selected !== 'SOFTWARE') {
      throw new Error('ID mayor inactiva desplazó API');
    }

    report.run1 = {
      evaluationSetId: run1.evaluationSetId,
      evaluationSetStatus: run1.evaluationSetStatus,
      contextHash: run1.contextHash,
      outcomes: run1.domainResults,
      active: active1,
      api: api1,
      evals: evals1,
      apiAfterHigherInactiveId: apiHigher,
    };

    // ── Histórica NULL ────────────────────────────────────────────────
    const histIns = await ds.query(
      `INSERT INTO organigrama.mc_profile_evaluation
          (person_id, person_cv_id, extraction_id, enrichment_id,
           evidence_evaluation_id, catalog_version_id, domain_id, domain_code,
           engine_rules_version, config_hash, mapping_hash, status, is_active,
           input_skills_count, specialty_count, domain_qualification)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'SOFTWARE',
               'pa2-software-1.0.0', $8, $9, 'SUCCEEDED', FALSE,
               1, 0, NULL)
       RETURNING id::text`,
      [
        FIXTURE.personId,
        seed.personCvId,
        seed.extractionId,
        seed.enrichmentId,
        seed.evidenceId,
        seed.catalogVersionId,
        seed.domains.SOFTWARE,
        sha64('hist-cfg'),
        sha64('hist-map'),
      ],
    );
    const histEntity = await ds.getRepository(McProfileEvaluation).findOne({
      where: { id: histIns[0].id },
    });
    if (!histEntity || histEntity.domain_qualification !== null) {
      throw new Error('Histórica NULL no cargó en entidad TypeORM');
    }
    if (histEntity.domain_qualification === 'OUTSIDE') {
      throw new Error('NULL interpretado como OUTSIDE');
    }
    const apiHist = await apiEquivalent(ds);
    if (apiHist.selected !== 'SOFTWARE') {
      throw new Error('Histórica NULL desplazó API');
    }
    report.historicalNull = {
      id: histEntity.id,
      domain_qualification: histEntity.domain_qualification,
      is_active: histEntity.is_active,
    };

    // ── Run 2: VISUAL gana ────────────────────────────────────────────
    const run2 = await pa2.persistMultidomainEvaluationRun([
      {
        meta: buildMeta(seed, 'SOFTWARE', 'pa2-software-1.1.0'),
        result: emptyResult('SOFTWARE', 'pa2-software-1.1.0', {
          active: 0,
          emergent: 1,
          hidden: 2,
        }),
        config: resolveMcPa2EngineConfig('pa2-software-1.1.0'),
        inputSkillsCount: 5,
        domainQualification: 'SECONDARY_SIGNAL',
        activateOnPersist: false,
      },
      {
        meta: buildMeta(seed, 'VISUAL_DESIGN', 'pa2-visual-design-1.1.0'),
        result: emptyResult('VISUAL_DESIGN', 'pa2-visual-design-1.1.0', {
          active: 2,
          emergent: 0,
          hidden: 1,
        }),
        config: resolveMcPa2EngineConfig('pa2-visual-design-1.1.0'),
        inputSkillsCount: 6,
        domainQualification: 'PRIMARY_MATCH',
        activateOnPersist: true,
      },
      {
        meta: buildMeta(
          seed,
          'AUDIOVISUAL_PRODUCTION',
          'pa2-audiovisual-production-1.0.0',
        ),
        result: emptyResult(
          'AUDIOVISUAL_PRODUCTION',
          'pa2-audiovisual-production-1.0.0',
          { active: 0, emergent: 0, hidden: 3 },
        ),
        config: resolveMcPa2EngineConfig('pa2-audiovisual-production-1.0.0'),
        inputSkillsCount: 2,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
    ]);

    const active2 = await countActive(ds);
    const api2 = await apiEquivalent(ds);
    if (active2 !== 1) throw new Error(`Run2 active=${active2}`);
    if (api2.selected !== 'VISUAL_DESIGN') {
      throw new Error(`Run2 API selected=${api2.selected}`);
    }
    report.run2 = {
      evaluationSetId: run2.evaluationSetId,
      evaluationSetStatus: run2.evaluationSetStatus,
      outcomes: run2.domainResults,
      active: active2,
      api: api2,
    };

    // ── Run sin ganador: conserva activa previa ───────────────────────
    const beforeNoWin = await countActive(ds);
    await pa2.persistMultidomainEvaluationRun([
      {
        meta: buildMeta(seed, 'SOFTWARE', 'pa2-software-1.1.0'),
        result: emptyResult('SOFTWARE', 'pa2-software-1.1.0', {
          active: 0,
          emergent: 0,
          hidden: 3,
        }),
        config: resolveMcPa2EngineConfig('pa2-software-1.1.0'),
        inputSkillsCount: 3,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
      {
        meta: buildMeta(seed, 'VISUAL_DESIGN', 'pa2-visual-design-1.1.0'),
        result: emptyResult('VISUAL_DESIGN', 'pa2-visual-design-1.1.0', {
          active: 0,
          emergent: 1,
          hidden: 2,
        }),
        config: resolveMcPa2EngineConfig('pa2-visual-design-1.1.0'),
        inputSkillsCount: 3,
        domainQualification: 'SECONDARY_SIGNAL',
        activateOnPersist: false,
      },
    ]);
    const afterNoWin = await countActive(ds);
    const apiNoWin = await apiEquivalent(ds);
    if (afterNoWin !== beforeNoWin || afterNoWin !== 1) {
      throw new Error(
        `No-winner active before=${beforeNoWin} after=${afterNoWin}`,
      );
    }
    if (apiNoWin.selected !== 'VISUAL_DESIGN') {
      throw new Error('No-winner cambió publicación');
    }
    report.noWinner = { before: beforeNoWin, after: afterNoWin, api: apiNoWin };

    // ── Atomicidad: fallo FK en 2º dominio ────────────────────────────
    const countBeforeFail = (
      await ds.query(
        `SELECT COUNT(*)::int AS n FROM organigrama.mc_profile_evaluation
          WHERE person_id = $1`,
        [FIXTURE.personId],
      )
    )[0].n as number;
    const activeBeforeFail = await countActive(ds);

    let rolledBack = false;
    try {
      await pa2.persistMultidomainEvaluationRun([
        {
          meta: buildMeta(seed, 'SOFTWARE', 'pa2-software-1.1.0'),
          result: emptyResult('SOFTWARE', 'pa2-software-1.1.0', {
            active: 1,
            emergent: 0,
            hidden: 0,
          }),
          config: resolveMcPa2EngineConfig('pa2-software-1.1.0'),
          inputSkillsCount: 1,
          domainQualification: 'PRIMARY_MATCH',
          activateOnPersist: true,
        },
        {
          meta: {
            ...buildMeta(seed, 'VISUAL_DESIGN', 'pa2-visual-design-1.1.0'),
            domainId: '999999999',
          },
          result: emptyResult('VISUAL_DESIGN', 'pa2-visual-design-1.1.0', {
            active: 0,
            emergent: 0,
            hidden: 1,
          }),
          config: resolveMcPa2EngineConfig('pa2-visual-design-1.1.0'),
          inputSkillsCount: 1,
          domainQualification: 'OUTSIDE',
          activateOnPersist: false,
        },
      ]);
    } catch {
      rolledBack = true;
    }
    if (!rolledBack) throw new Error('Se esperaba fallo FK en atomicidad');

    const countAfterFail = (
      await ds.query(
        `SELECT COUNT(*)::int AS n FROM organigrama.mc_profile_evaluation
          WHERE person_id = $1`,
        [FIXTURE.personId],
      )
    )[0].n as number;
    const activeAfterFail = await countActive(ds);
    if (countAfterFail !== countBeforeFail) {
      throw new Error(
        `Atomicidad rota: count ${countBeforeFail} → ${countAfterFail}`,
      );
    }
    if (activeAfterFail !== activeBeforeFail || activeAfterFail !== 1) {
      throw new Error(
        `Atomicidad activa: ${activeBeforeFail} → ${activeAfterFail}`,
      );
    }
    const apiFail = await apiEquivalent(ds);
    if (apiFail.selected !== 'VISUAL_DESIGN') {
      throw new Error('Rollback dejó API incorrecta');
    }
    const orphanSpecs = (
      await ds.query(
        `SELECT COUNT(*)::int AS n
           FROM organigrama.mc_profile_specialty_result s
          WHERE NOT EXISTS (
            SELECT 1 FROM organigrama.mc_profile_evaluation e
             WHERE e.id = s.profile_evaluation_id
          )`,
      )
    )[0].n as number;
    if (orphanSpecs !== 0) {
      throw new Error(`Especialidades huérfanas: ${orphanSpecs}`);
    }

    report.atomicity = {
      rolledBack,
      countBefore: countBeforeFail,
      countAfter: countAfterFail,
      activeBefore: activeBeforeFail,
      activeAfter: activeAfterFail,
      api: apiFail,
      orphanSpecialtyResults: orphanSpecs,
    };

    report.status = 'PASSED';
    report.finalEvals = await listEvals(ds);
    return report;
  } finally {
    if (process.argv.includes('--cleanup')) {
      await cleanupFixtures(ds);
      console.log(`${TAG} fixtures eliminados`);
    }
    await ds.destroy();
  }
}

if (require.main === module) {
  runMc11bPersistenceIntegration()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
      writeFileSync(
        resolve(process.cwd(), 'tmp/mc11b-persistence-it.json'),
        JSON.stringify(report, null, 2),
      );
    })
    .catch((err) => {
      console.error(TAG, err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
