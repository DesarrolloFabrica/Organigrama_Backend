/**
 * MC1.4 / 1C.3 — Auditoría dry-run de Evaluation Sets históricos.
 *
 * npm run mc:audit-historical-sets -- --fixture
 * npm run mc:audit-historical-sets -- --i-confirm-readonly --env-file=.env.mc1-local
 *
 * Sin --fixture requiere PG local (assertLocalDatabaseHost). Nunca escribe.
 */
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';
import {
  classifyHistoricalEvaluationSetCandidates,
  currentOperativeUniverseSnapshot,
  summarizeHistoricalCandidates,
} from '../../mc-catalog/mc-historical-evaluation-set-classifier';
import type { McHistoricalProfileEvaluationRow } from '../../mc-catalog/mc-historical-evaluation-set.types';
import {
  fixtureAlreadyInSet,
  fixtureDuplicateDomain,
  fixtureIsolated,
  fixtureMissingChain,
  fixtureMixedExtraction,
  fixturePreMultidomain,
  fixtureQualificationNull,
  fixtureStrongUnique,
  fixtureTwoPlausibleGroups,
  fixtureUnknownUniverse,
} from '../../mc-catalog/mc-historical-evaluation-set.fixtures';

const TAG = '[MC1.4 Historical Set Audit]';

function loadFixtureBundle(): McHistoricalProfileEvaluationRow[] {
  return [
    ...fixtureAlreadyInSet(),
    ...fixtureStrongUnique(),
    ...fixtureTwoPlausibleGroups(),
    ...fixtureMixedExtraction(),
    ...fixtureDuplicateDomain(),
    ...fixtureUnknownUniverse(),
    ...fixtureIsolated(),
    ...fixtureQualificationNull(),
    ...fixturePreMultidomain(),
    ...fixtureMissingChain(),
  ];
}

async function loadFromLocalPg(personId?: string): Promise<McHistoricalProfileEvaluationRow[]> {
  const envArg = process.argv.find((a) => a.startsWith('--env-file='));
  const envPath = envArg
    ? resolve(process.cwd(), envArg.slice('--env-file='.length))
    : resolve(process.cwd(), '.env.mc1-local');
  if (!existsSync(envPath)) {
    throw new Error(`Falta ${envPath}`);
  }
  dotenv.config({ path: envPath, override: true, quiet: true });
  assertLocalDatabaseHost(process.env.DB_HOST);

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
  });
  await client.connect();
  try {
    // Solo lectura. No PII: no full_name / document / CV text.
    const params: string[] = [];
    let where = `e.status = 'SUCCEEDED'`;
    if (personId) {
      params.push(personId);
      where += ` AND e.person_id = $${params.length}`;
    }
    const limitArg = process.argv.find((a) => a.startsWith('--limit='));
    const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 5000;

    const sql = `
      SELECT
        e.id::text,
        e.person_id::text,
        e.person_cv_id::text,
        e.extraction_id::text,
        e.enrichment_id::text,
        e.evidence_evaluation_id::text,
        e.catalog_version_id::text,
        e.domain_code,
        e.engine_rules_version,
        e.mapping_pack_code,
        e.mapping_pack_version,
        e.mapping_hash,
        e.source_hash,
        e.algorithm_version,
        e.evaluation_context_hash,
        e.domain_qualification,
        e.is_active,
        e.status,
        e.created_at,
        d.evaluation_set_id::text AS evaluation_set_id
      FROM organigrama.mc_profile_evaluation e
      LEFT JOIN organigrama.mc_evaluation_set_domain d
        ON d.profile_evaluation_id = e.id
      WHERE ${where}
      ORDER BY e.person_id, e.id
      LIMIT ${Number.isFinite(limit) ? limit : 5000}
    `;
    const res = await client.query(sql, params);
    return res.rows.map((r) => ({
      id: r.id,
      personId: r.person_id,
      personCvId: r.person_cv_id,
      extractionId: r.extraction_id,
      enrichmentId: r.enrichment_id,
      evidenceEvaluationId: r.evidence_evaluation_id,
      catalogVersionId: r.catalog_version_id,
      domainCode: r.domain_code,
      engineRulesVersion: r.engine_rules_version,
      mappingPackCode: r.mapping_pack_code,
      mappingPackVersion: r.mapping_pack_version,
      mappingHash: r.mapping_hash,
      sourceHash: r.source_hash,
      algorithmVersion: r.algorithm_version,
      evaluationContextHash: r.evaluation_context_hash,
      domainQualification: r.domain_qualification,
      isActive: r.is_active,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString(),
      evaluationSetId: r.evaluation_set_id,
    }));
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const useFixture = process.argv.includes('--fixture');
  const personArg = process.argv.find((a) => a.startsWith('--person='));
  const personId = personArg ? personArg.slice('--person='.length) : undefined;

  let rows: McHistoricalProfileEvaluationRow[];
  if (useFixture) {
    rows = loadFixtureBundle();
    console.log(`${TAG} mode=fixture rows=${rows.length}`);
  } else {
    if (!process.argv.includes('--i-confirm-readonly')) {
      throw new Error(
        'Requiere --fixture o --i-confirm-readonly --env-file=.env.mc1-local',
      );
    }
    rows = await loadFromLocalPg(personId);
    console.log(`${TAG} mode=local-readonly rows=${rows.length}`);
  }

  const candidates = classifyHistoricalEvaluationSetCandidates(rows, {
    eraCandidateUniverse: currentOperativeUniverseSnapshot(),
  });
  const summary = summarizeHistoricalCandidates(candidates, rows);

  const out = {
    phase: 'MC1.4-historical-set-audit',
    mode: useFixture ? 'fixture' : 'local-readonly',
    writes: 0,
    summary,
    candidates: candidates.map((c) => ({
      personId: c.personId,
      eligibility: c.eligibility,
      recommendedAction: c.recommendedAction,
      domainCodes: c.domainCodes,
      profileEvaluationIds: c.profileEvaluationIds,
      conflictCodes: c.conflicts.map((x) => x.code),
      missingFields: c.missingFields,
      historicalContextFingerprint: c.historicalContextFingerprint,
      // Sin PII / sin texto de evidencia
    })),
    at: new Date().toISOString(),
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc14-historical-set-audit.json');
  writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(summary, null, 2));
  console.log(`${TAG} wrote ${path} (no DB writes)`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
