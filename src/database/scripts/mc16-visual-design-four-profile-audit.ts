/**
 * MC1.6 — Auditoría Diseño Visual cuatro perfiles (dry-run / read-only).
 *
 * npm run mc:audit-visual-design -- --fixture
 * npm run mc:audit-visual-design -- --documents=1015482688,1000035262,1000590473,103154553 --fixture
 * npm run mc:audit-visual-design -- --documents=... --i-confirm-readonly --env-file=.env.mc1-local
 *
 * Nunca escribe. Fixture mode no requiere PostgreSQL.
 */
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';
import { loadFourProfileFixtures } from '../../mc-catalog/mc-visual-design-four-profile-audit.fixtures';
import {
  auditVisualDesignFourProfiles,
  defaultTargetDocuments,
} from '../../mc-catalog/mc-visual-design-four-profile-audit';
import type {
  McVdFourProfileAuditReport,
  McVdProfileSkill,
  McVdProfileSnapshot,
} from '../../mc-catalog/mc-visual-design-four-profile-audit.types';
import type { McEvidenceLevel } from '../../mc-catalog/mc-pa2.types';

const TAG = '[MC1.6 VD four-profile audit]';

function parseDocuments(argv: string[]): string[] {
  const arg = argv.find((a) => a.startsWith('--documents='));
  if (!arg) return defaultTargetDocuments();
  return arg
    .slice('--documents='.length)
    .split(',')
    .map((d) => d.trim())
    .filter(Boolean);
}

function printReport(report: McVdFourProfileAuditReport): void {
  console.log(`${TAG} mode=${report.mode} pack=${report.packVersion} writes=${report.writes}`);
  console.log('\n| Documento | found | Qualification | Activas | Emergentes | Ocultas |');
  console.log('| --------- | ----- | ------------- | ------: | ---------: | ------: |');
  for (const p of report.persons) {
    const d = p.dryRun;
    console.log(
      `| ${p.document} | ${p.found} | ${d?.qualification ?? 'N/A'} | ${d?.activeCount ?? 'N/A'} | ${d?.emergentCount ?? 'N/A'} | ${d?.hiddenCount ?? 'N/A'} |`,
    );
  }
  console.log('\nVeredictos:');
  for (const p of report.persons) {
    console.log(
      `  ${p.document}: ${p.verdicts.join(', ')} → capa ${p.recommendedLayer}`,
    );
  }
  console.log('\nEspecialidades catálogo:');
  for (const s of report.specialtyCatalog) {
    console.log(
      `  ${s.specialtyCode}: maturity=${s.maturity} mappings=${s.mappingCount} coverage=${s.coverageInProfiles}`,
    );
  }
  console.log(`\nwrites: ${report.writes}`);
}

async function loadLiveProfiles(documents: string[]): Promise<{
  profiles: McVdProfileSnapshot[];
  blockedReason?: string;
}> {
  const envArg = process.argv.find((a) => a.startsWith('--env-file='));
  const envPath = envArg
    ? resolve(process.cwd(), envArg.slice('--env-file='.length))
    : resolve(process.cwd(), '.env.mc1-local');
  if (!existsSync(envPath)) {
    return {
      profiles: [],
      blockedReason: `Falta ${envPath} (PG local). Usar --fixture.`,
    };
  }
  dotenv.config({ path: envPath, override: true, quiet: true });
  try {
    assertLocalDatabaseHost(process.env.DB_HOST);
  } catch (err) {
    return {
      profiles: [],
      blockedReason: err instanceof Error ? err.message : String(err),
    };
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5433),
    database: process.env.DB_NAME,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD?.replace(/^'|'$/g, ''),
  });

  try {
    await client.connect();
  } catch (err) {
    return {
      profiles: [],
      blockedReason: `PG connect falló: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const profiles: McVdProfileSnapshot[] = [];
    for (const document of documents) {
      const persons = await client.query(
        `SELECT p.id::text AS id, p.full_name, p.document
           FROM core.person p WHERE p.document = $1`,
        [document],
      );
      if (persons.rowCount === 0) {
        profiles.push({
          document,
          personId: null,
          fullNameConfirm: null,
          found: false,
          dataSource: 'LIVE_PG',
          chain: {
            cv: 'MISSING',
            extraction: 'NOT_EXECUTED',
            enrichment: 'NOT_EXECUTED',
            evidence: 'NOT_EXECUTED',
            visualEvaluation: 'NOT_EXECUTED',
            evaluationSet: 'NOT_EXECUTED',
            extractionId: null,
            enrichmentId: null,
            evidenceId: null,
            notes: ['PERSON_NOT_FOUND'],
          },
          skills: [],
        });
        continue;
      }
      const person = persons.rows[0];
      const personId = person.id as string;

      const cv = await client.query(
        `SELECT id::text FROM organigrama.person_cv
          WHERE person_id = $1 AND is_active = TRUE
          ORDER BY synced_at DESC NULLS LAST LIMIT 1`,
        [personId],
      );
      const ext = await client.query(
        `SELECT id::text, status FROM organigrama.cv_extraction
          WHERE person_id = $1 AND is_active = TRUE AND status = 'SUCCEEDED'
          ORDER BY id DESC LIMIT 1`,
        [personId],
      );
      const enr = await client.query(
        `SELECT id::text, status FROM organigrama.cv_skill_enrichment
          WHERE person_id = $1 AND is_active = TRUE
          ORDER BY id DESC LIMIT 1`,
        [personId],
      );
      const ev = await client.query(
        `SELECT id::text, status FROM organigrama.cv_evidence_evaluation
          WHERE person_id = $1 AND is_active = TRUE
          ORDER BY id DESC LIMIT 1`,
        [personId],
      );
      const pe = await client.query(
        `SELECT id::text FROM organigrama.mc_profile_evaluation
          WHERE person_id = $1 AND domain_code = 'VISUAL_DESIGN'
          ORDER BY id DESC LIMIT 1`,
        [personId],
      );
      const es = await client.query(
        `SELECT id::text FROM organigrama.mc_evaluation_set
          WHERE person_id = $1 ORDER BY id DESC LIMIT 1`,
        [personId],
      );

      const extractionId = ext.rows[0]?.id ?? null;
      const evidenceId = ev.rows[0]?.id ?? null;
      const skills: McVdProfileSkill[] = [];

      if (extractionId) {
        const skillRows = await client.query(
          `SELECT sk.normalized_key AS skill_key, sk.normalized_name AS skill_name,
                  sk.skill_type,
                  es.original_name,
                  LEFT(COALESCE(es.evidence, ''), 120) AS evidence_snippet,
                  COALESCE(ei.evidence_level, 'NONE') AS evidence_level,
                  COALESCE(ei.evidence_strength, 0)::float AS evidence_strength,
                  COALESCE(ei.evidence_confidence, 0)::float AS evidence_confidence
             FROM organigrama.cv_extraction_skill es
             JOIN organigrama.cv_skill sk ON sk.id = es.skill_id
             LEFT JOIN organigrama.cv_evidence_evaluation_item ei
               ON ei.extraction_skill_id = es.id AND ei.evaluation_id = $2
            WHERE es.extraction_id = $1
            ORDER BY es.sort_order ASC NULLS LAST, es.id ASC`,
          [extractionId, evidenceId],
        );
        for (const row of skillRows.rows) {
          skills.push({
            skillKey: row.skill_key,
            skillName: row.skill_name,
            skillType: row.skill_type,
            evidenceLevel: (row.evidence_level ?? 'NONE') as McEvidenceLevel,
            evidenceStrength: Number(row.evidence_strength ?? 0),
            evidenceConfidence: Number(row.evidence_confidence ?? 0),
            evidenceSnippet: row.evidence_snippet || null,
            source: 'NORMALIZED',
            originalName: row.original_name ?? null,
          });
        }
      }

      profiles.push({
        document,
        personId,
        fullNameConfirm: person.full_name,
        found: true,
        dataSource: 'LIVE_PG',
        chain: {
          cv: cv.rowCount ? 'AVAILABLE' : 'MISSING',
          extraction: ext.rowCount ? 'AVAILABLE' : 'MISSING',
          enrichment: enr.rowCount ? 'AVAILABLE' : 'MISSING',
          evidence: ev.rowCount ? 'AVAILABLE' : 'MISSING',
          visualEvaluation: pe.rowCount ? 'AVAILABLE' : 'NOT_EXECUTED',
          evaluationSet: es.rowCount ? 'AVAILABLE' : 'NOT_EXECUTED',
          extractionId,
          enrichmentId: enr.rows[0]?.id ?? null,
          evidenceId,
          notes: [],
        },
        skills,
      });
    }
    return { profiles };
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const documents = parseDocuments(argv);
  const useFixture =
    argv.includes('--fixture') ||
    argv.some((a) => a.startsWith('--fixture=')) ||
    !argv.includes('--i-confirm-readonly');

  let report: McVdFourProfileAuditReport;

  if (useFixture && !argv.includes('--i-confirm-readonly')) {
    const profiles = loadFourProfileFixtures(documents);
    report = auditVisualDesignFourProfiles({ profiles, mode: 'FIXTURE' });
    console.log(
      `${TAG} SCRIPT IMPLEMENTADO / AUDITORÍA CON DATAS REALES NO EJECUTADA (modo fixture)`,
    );
  } else {
    if (!argv.includes('--i-confirm-readonly')) {
      throw new Error('Modo live requiere --i-confirm-readonly');
    }
    const live = await loadLiveProfiles(documents);
    if (live.blockedReason) {
      console.error(`${TAG} AUDITORÍA CON DATOS REALES BLOQUEADA: ${live.blockedReason}`);
      const profiles = loadFourProfileFixtures(documents);
      report = auditVisualDesignFourProfiles({ profiles, mode: 'BLOCKED' });
    } else {
      report = auditVisualDesignFourProfiles({
        profiles: live.profiles,
        mode: 'LIVE_READONLY',
      });
    }
  }

  printReport(report);

  const outArg = argv.find((a) => a.startsWith('--export-json='));
  const outPath = resolve(
    process.cwd(),
    outArg?.slice('--export-json='.length) ??
      'tmp/mc16-visual-design-four-profile-audit.json',
  );
  mkdirSync(resolve(outPath, '..'), { recursive: true });
  // Sanitizar: no volcar snippets largos ni campos sensibles extra
  const sanitized = {
    ...report,
    persons: report.persons.map((p) => ({
      ...p,
      // fullName solo en chain notes si venía; no incluir nombre en export por defecto
      skillGaps: p.skillGaps.map(({ skillKey, gap, specialtyTargets, reason }) => ({
        skillKey,
        gap,
        specialtyTargets,
        reason,
      })),
    })),
  };
  writeFileSync(outPath, JSON.stringify(sanitized, null, 2), 'utf8');
  console.log(`${TAG} export=${outPath}`);
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
