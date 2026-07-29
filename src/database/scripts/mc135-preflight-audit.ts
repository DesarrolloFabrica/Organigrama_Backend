/**
 * MC1.3.5 — Auditoría previa de solo lectura (Cloud).
 * No escribe. No muestra secretos.
 *
 * npx ts-node -r tsconfig-paths/register src/database/scripts/mc135-preflight-audit.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TAG = '[MC1.3.5 Preflight]';
const EXPECTED = {
  personCvId: '187',
  extractionId: '206',
  enrichmentId: '2',
  evidenceEvaluationId: '3',
  skillCount: 59,
};

function maskHost(host: string | undefined): string {
  if (!host) return '(unset)';
  // Keep first octet + last label hint without full address dump of secrets
  const parts = host.split('.');
  if (parts.length >= 4 && /^\d+$/.test(parts[0])) {
    return `${parts[0]}.x.x.${parts[parts.length - 1]} (IPv4 Cloud)`;
  }
  if (host.includes('/cloudsql/')) return '(Cloud SQL socket)';
  if (host === 'localhost' || host === '127.0.0.1') return host;
  return `${host.slice(0, 8)}…`;
}

async function tableExists(
  ds: DataSource,
  schema: string,
  table: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1
       FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2
      LIMIT 1`,
    [schema, table],
  );
  return rows.length > 0;
}

async function main() {
  const host = process.env.DB_HOST;
  const dbName = process.env.DB_NAME;
  const schema = process.env.DB_SCHEMA ?? 'core';
  const ssl = process.env.DB_SSL;
  const nodeEnv = process.env.NODE_ENV;

  const isLocal =
    !host ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.startsWith('::1');

  const envReport = {
    dbHostMasked: maskHost(host),
    dbName,
    dbSchema: schema,
    dbSsl: ssl,
    nodeEnv,
    isLocalHost: isLocal,
    environmentClass: isLocal ? 'LOCAL' : 'REMOTE_CLOUD_LIKE',
    gcpProject: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || null,
    note: 'gcloud CLI no disponible en este entorno; proyecto inferido solo si hay env var.',
  };

  console.log(TAG, 'Entorno:', JSON.stringify(envReport, null, 2));

  if (isLocal) {
    console.error(TAG, 'ABORT: host parece local. No continuar escrituras.');
    process.exit(2);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  try {
    const mcTables = [
      'mc_catalog_version',
      'mc_domain',
      'mc_specialty',
      'mc_skill_domain_classification',
      'mc_skill_specialty_mapping',
      'mc_profile_evaluation',
      'mc_profile_specialty_result',
    ];

    const tableStatus: Record<string, boolean> = {};
    for (const t of mcTables) {
      tableStatus[t] = await tableExists(ds, 'organigrama', t);
    }

    // Migration history mechanisms
    const historyCandidates = [
      { schema: 'organigrama', table: 'schema_migrations' },
      { schema: 'public', table: 'schema_migrations' },
      { schema: 'core', table: 'schema_migrations' },
      { schema: 'organigrama', table: 'typeorm_migrations' },
      { schema: 'public', table: 'typeorm_migrations' },
      { schema: 'core', table: 'migrations' },
    ];
    const historyFound: string[] = [];
    for (const c of historyCandidates) {
      if (await tableExists(ds, c.schema, c.table)) {
        historyFound.push(`${c.schema}.${c.table}`);
      }
    }

    // Column checks for lifecycle (018)
    let lifecycleConstraint: string | null = null;
    if (tableStatus.mc_specialty) {
      const cons = await ds.query(
        `SELECT pg_get_constraintdef(c.oid) AS def
           FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
          WHERE n.nspname = 'organigrama'
            AND t.relname = 'mc_specialty'
            AND c.conname = 'chk_mc_specialty_lifecycle_status'`,
      );
      lifecycleConstraint = cons[0]?.def ?? null;
    }

    const migrationMatrix = {
      '018': {
        applied:
          tableStatus.mc_catalog_version &&
          tableStatus.mc_domain &&
          tableStatus.mc_specialty,
        evidence: {
          mc_catalog_version: tableStatus.mc_catalog_version,
          mc_domain: tableStatus.mc_domain,
          mc_specialty: tableStatus.mc_specialty,
          lifecycleConstraint,
        },
      },
      '019': {
        applied:
          tableStatus.mc_skill_domain_classification &&
          tableStatus.mc_skill_specialty_mapping,
        evidence: {
          mc_skill_domain_classification:
            tableStatus.mc_skill_domain_classification,
          mc_skill_specialty_mapping: tableStatus.mc_skill_specialty_mapping,
        },
      },
      '020': {
        applied:
          tableStatus.mc_profile_evaluation &&
          tableStatus.mc_profile_specialty_result,
        evidence: {
          mc_profile_evaluation: tableStatus.mc_profile_evaluation,
          mc_profile_specialty_result: tableStatus.mc_profile_specialty_result,
        },
      },
    };

    // Pilot dependencies
    const pcv = await ds.query(
      `SELECT id::text, person_id::text, document, is_active
         FROM organigrama.person_cv
        WHERE id = $1`,
      [EXPECTED.personCvId],
    );
    const extraction = await ds.query(
      `SELECT id::text, person_id::text, person_cv_id::text, status, is_active,
              skills_count
         FROM organigrama.cv_extraction
        WHERE id = $1`,
      [EXPECTED.extractionId],
    );
    const enrichment = await ds.query(
      `SELECT id::text, extraction_id::text, person_id::text, status, is_active
         FROM organigrama.cv_skill_enrichment
        WHERE id = $1`,
      [EXPECTED.enrichmentId],
    );
    const evidence = await ds.query(
      `SELECT id::text, enrichment_id::text, extraction_id::text, person_id::text,
              status, is_active
         FROM organigrama.cv_evidence_evaluation
        WHERE id = $1`,
      [EXPECTED.evidenceEvaluationId],
    );
    const skillCountRows = await ds.query(
      `SELECT COUNT(*)::int AS n
         FROM organigrama.cv_extraction_skill
        WHERE extraction_id = $1`,
      [EXPECTED.extractionId],
    );
    const skillDefs = await ds.query(
      `SELECT COUNT(*)::int AS n,
              COUNT(s.id)::int AS resolved
         FROM organigrama.cv_extraction_skill es
         LEFT JOIN organigrama.cv_skill s ON s.id = es.skill_id
        WHERE es.extraction_id = $1`,
      [EXPECTED.extractionId],
    );

    const personIds = [
      pcv[0]?.person_id,
      extraction[0]?.person_id,
      enrichment[0]?.person_id,
      evidence[0]?.person_id,
    ].filter(Boolean);
    const samePerson =
      personIds.length === 4 && personIds.every((id) => id === personIds[0]);

    const pilot = {
      expected: EXPECTED,
      personCv: pcv[0] ?? null,
      extraction: extraction[0] ?? null,
      enrichment: enrichment[0] ?? null,
      evidenceEvaluation: evidence[0] ?? null,
      skillCount: skillCountRows[0]?.n ?? 0,
      skillDefsResolved: skillDefs[0]?.resolved ?? 0,
      samePerson,
      personId: personIds[0] ?? null,
      ok:
        !!pcv[0] &&
        !!extraction[0] &&
        !!enrichment[0] &&
        !!evidence[0] &&
        samePerson &&
        String(extraction[0].person_cv_id) === EXPECTED.personCvId &&
        String(enrichment[0].extraction_id) === EXPECTED.extractionId &&
        String(evidence[0].extraction_id) === EXPECTED.extractionId &&
        String(evidence[0].enrichment_id) === EXPECTED.enrichmentId &&
        String(extraction[0].status).toUpperCase() === 'SUCCEEDED' &&
        Number(skillCountRows[0]?.n) === EXPECTED.skillCount &&
        Number(skillDefs[0]?.resolved) === EXPECTED.skillCount,
    };

    const impact = {
      tablesToCreate: mcTables.filter((t) => !tableStatus[t]),
      migrationsPending: Object.entries(migrationMatrix)
        .filter(([, v]) => !v.applied)
        .map(([k]) => k),
      expectedSeedRows: {
        catalogVersions: 1,
        domains: 1,
        specialties: 7,
        classifications: 59,
        domainSpecialty: 42,
        mappings: 'pack SOFTWARE (DOMAIN_SPECIALTY only + duals)',
        specialtyResults: 7,
      },
      rollback: 'DDL aditivo; rollback = DROP de tablas mc_* (requiere aprobación). Seeds son idempotentes.',
      lockRisk: 'BAJO — CREATE TABLE IF NOT EXISTS / nuevas tablas vacías; sin ALTER de cv_*',
      durationEstimate: 'Migraciones < 30s; seeds < 1min; evaluate < 1min',
      migrationHistoryMechanism: historyFound.length
        ? historyFound
        : 'NINGUNO — flujo oficial: psql -f migrations/*.sql (manual)',
    };

    const report = {
      phase: 'MC1.3.5',
      step: 'preflight-readonly',
      at: new Date().toISOString(),
      env: envReport,
      tableStatus,
      migrationMatrix,
      migrationHistory: historyFound,
      pilot,
      impact,
      abort: !pilot.ok,
      abortReason: pilot.ok
        ? null
        : 'Dependencias piloto inconsistentes o ausentes — no continuar.',
    };

    const outPath = resolve(
      process.cwd(),
      'tmp/cv-attributes/mc1.3.5-preflight-audit.json',
    );
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(TAG, 'Escrito', outPath);
    console.log(TAG, JSON.stringify(report, null, 2));

    if (!pilot.ok) {
      console.error(TAG, 'STOP: piloto no válido');
      process.exit(3);
    }
    if (isLocal) {
      process.exit(2);
    }
    console.log(TAG, 'Preflight OK — entorno remoto y piloto válidos');
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
