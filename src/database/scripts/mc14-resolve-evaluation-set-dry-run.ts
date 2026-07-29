/**
 * MC1.5 / 1C.4 — Cross-Domain Resolver v0 dry-run.
 *
 * npm run mc:resolve-set:dry -- --fixture=F01
 * npm run mc:resolve-set:dry -- --fixture=all
 * npm run mc:resolve-set:dry -- --evaluation-set-id=<uuid> --i-confirm-readonly --env-file=.env.mc1-local
 *
 * Nunca escribe. Fixture mode no requiere PostgreSQL.
 */
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';
import {
  CDR_V0_FIXTURES,
} from '../../mc-catalog/mc-cross-domain-resolver.fixtures';
import {
  resolveCrossDomainEvaluationSetDryRunWithDefaults,
} from '../../mc-catalog/mc-cross-domain-resolver';
import type {
  McCdrDomainEvaluationSnapshot,
  McCdrSpecialtySnapshot,
  McCrossDomainResolution,
  McEvaluationSetSnapshot,
} from '../../mc-catalog/mc-cross-domain-resolver.types';
import type { McDomainQualification } from '../../mc-catalog/mc-domain-qualification';
import type { McEvaluationSetDomainStatus } from '../../mc-catalog/mc-evaluation-set.types';

const TAG = '[MC1.5 CDR dry-run]';

function printResolution(r: McCrossDomainResolution): void {
  console.log(`evaluationSetId: ${r.evaluationSetId}`);
  console.log(`resolverVersion: ${r.resolverVersion}`);
  console.log(`policyVersion: ${r.policyVersion}`);
  console.log(
    `eligibility: ${r.diagnostics.eligibility.eligible} (${r.diagnostics.eligibility.code})`,
  );
  console.log(`status: ${r.status}`);
  console.log(`classificationType: ${r.classificationType}`);
  console.log(`confidenceBand: ${r.confidenceBand}`);
  console.log(`decisiveRule: ${r.decisiveRule}`);
  console.log('domainPositions:');
  for (const p of r.domainPositions) {
    console.log(
      `  - ${p.domainCode}: ${p.position} qual=${p.qualification ?? 'null'} rank=${p.rank}`,
    );
  }
  console.log(`warnings: ${JSON.stringify(r.warnings)}`);
  console.log(`explanation.summaryCode: ${r.explanation.summaryCode}`);
  console.log(`explanation.summary: ${r.explanation.summary}`);
  console.log('writes: 0');
}

async function loadSetFromPg(evaluationSetId: string): Promise<McEvaluationSetSnapshot> {
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
    const setRes = await client.query(
      `SELECT id, person_id, status, schema_version, qualification_policy_version,
              context_hash, candidate_domains, warnings
       FROM mc_evaluation_set WHERE id = $1`,
      [evaluationSetId],
    );
    if (setRes.rowCount === 0) {
      throw new Error(`Evaluation Set no encontrado: ${evaluationSetId}`);
    }
    const row = setRes.rows[0];
    const domRes = await client.query(
      `SELECT d.domain_code, d.domain_status, d.domain_qualification, d.profile_evaluation_id,
              e.active_count, e.emergent_count, e.hidden_count, e.specialty_count, e.input_skills_count
       FROM mc_evaluation_set_domain d
       LEFT JOIN mc_profile_evaluation e ON e.id = d.profile_evaluation_id
       WHERE d.evaluation_set_id = $1
       ORDER BY d.domain_code ASC`,
      [evaluationSetId],
    );

    const domains: McCdrDomainEvaluationSnapshot[] = [];
    for (const d of domRes.rows) {
      let specialties: McCdrSpecialtySnapshot[] = [];
      if (d.profile_evaluation_id) {
        const sr = await client.query(
          `SELECT specialty_code, presentation_status, mapped_skill_count, evidenced_skill_count,
                  coverage, confidence, strength, rank
           FROM mc_profile_specialty_result
           WHERE profile_evaluation_id = $1
           ORDER BY rank ASC NULLS LAST, specialty_code ASC`,
          [d.profile_evaluation_id],
        );
        specialties = sr.rows.map((s) => ({
          specialtyCode: s.specialty_code,
          presentationStatus: s.presentation_status,
          mappedSkillCount: Number(s.mapped_skill_count ?? 0),
          evidencedSkillCount: Number(s.evidenced_skill_count ?? 0),
          coverage: Number(s.coverage ?? 0),
          confidence: Number(s.confidence ?? 0),
          strength: Number(s.strength ?? 0),
          rank: Number(s.rank ?? 0),
        }));
      }
      domains.push({
        domainCode: d.domain_code,
        domainStatus: d.domain_status as McEvaluationSetDomainStatus,
        domainQualification: (d.domain_qualification ??
          null) as McDomainQualification | null,
        profileEvaluationId: d.profile_evaluation_id,
        activeCount: d.active_count == null ? null : Number(d.active_count),
        emergentCount:
          d.emergent_count == null ? null : Number(d.emergent_count),
        hiddenCount: d.hidden_count == null ? null : Number(d.hidden_count),
        specialtyCount:
          d.specialty_count == null ? null : Number(d.specialty_count),
        inputSkillsCount:
          d.input_skills_count == null ? null : Number(d.input_skills_count),
        specialties,
      });
    }

    const candidates: string[] = Array.isArray(row.candidate_domains)
      ? row.candidate_domains
      : JSON.parse(row.candidate_domains ?? '[]');

    return {
      evaluationSetId: String(row.id),
      personId: String(row.person_id),
      setStatus: row.status,
      schemaVersion: row.schema_version,
      qualificationPolicyVersion: row.qualification_policy_version,
      contextHash: row.context_hash ?? '',
      candidateDomains: candidates,
      domains,
      warnings: Array.isArray(row.warnings) ? row.warnings : [],
    };
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const fixtureArg = process.argv.find((a) => a.startsWith('--fixture='));
  const idArg = process.argv.find((a) =>
    a.startsWith('--evaluation-set-id='),
  );

  if (fixtureArg) {
    const name = fixtureArg.slice('--fixture='.length).toUpperCase();
    if (name === 'ALL') {
      for (const key of Object.keys(CDR_V0_FIXTURES).sort()) {
        console.log(`\n${TAG} fixture=${key}`);
        printResolution(
          resolveCrossDomainEvaluationSetDryRunWithDefaults(
            CDR_V0_FIXTURES[key](),
          ),
        );
      }
      return;
    }
    const factory = CDR_V0_FIXTURES[name];
    if (!factory) {
      throw new Error(
        `Fixture desconocido: ${name}. Disponibles: ${Object.keys(CDR_V0_FIXTURES).join(', ')}, ALL`,
      );
    }
    console.log(`${TAG} fixture=${name}`);
    printResolution(resolveCrossDomainEvaluationSetDryRunWithDefaults(factory()));
    return;
  }

  if (idArg) {
    if (!process.argv.includes('--i-confirm-readonly')) {
      throw new Error(
        'Modo --evaluation-set-id requiere --i-confirm-readonly (solo lectura local).',
      );
    }
    const id = idArg.slice('--evaluation-set-id='.length);
    console.log(`${TAG} evaluation-set-id=${id} (read-only)`);
    const snapshot = await loadSetFromPg(id);
    printResolution(resolveCrossDomainEvaluationSetDryRunWithDefaults(snapshot));
    return;
  }

  console.log(`${TAG} Uso:`);
  console.log('  --fixture=F01 | --fixture=all');
  console.log(
    '  --evaluation-set-id=<id> --i-confirm-readonly [--env-file=.env.mc1-local]',
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
