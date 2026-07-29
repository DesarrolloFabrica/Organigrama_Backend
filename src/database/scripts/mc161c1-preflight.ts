/**
 * MC1.6.1C.1 — preflight RO de candidatos evidencia Diseño Visual.
 * Sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import {
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from '../../cv-skills/cv-skills.constants';
import { DEFAULT_GEMINI_MODEL } from '../../cv-skills/cv-skills.types';
import { prepareCvPdfForExtraction } from './utils/extract-cv-skills-pipeline';

const TARGETS = [
  { label: 'Garzón Toledo', document: '1030646495' },
  { label: 'Correa', document: '1002460888' },
  { label: 'Angulo', document: '1193092980' },
];

async function preflightOne(ds: DataSource, document: string, label: string) {
  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.edu_email, p.email,
            p.role_id::text, ro.name AS role_name,
            p.area_id::text, a.name AS area_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.document = $1`,
    [document],
  );
  if (persons.length !== 1) {
    return {
      label,
      document,
      ok: false,
      error: persons.length === 0 ? 'PERSON_NOT_FOUND' : 'PERSON_AMBIGUOUS',
      count: persons.length,
    };
  }
  const person = persons[0];

  const boss = await ds.query(
    `SELECT parent.id::text AS boss_id, parent.full_name AS boss_name,
            parent.document AS boss_document, ro.name AS boss_role
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation r
         ON r.version_id = v.id AND r.is_active = TRUE
       JOIN core.person parent ON parent.id = r.parent_person_id
       LEFT JOIN core.role ro ON ro.id = parent.role_id
      WHERE v.is_active = TRUE AND r.child_person_id = $1
      LIMIT 3`,
    [person.id],
  );

  const cvs = await ds.query(
    `SELECT id::text, is_active, drive_file_id, drive_file_name,
            drive_md5_checksum, synced_at, drive_modified_time
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [person.id],
  );
  const activeCvs = cvs.filter((c: { is_active: boolean }) => c.is_active);
  const activeCv = activeCvs[0] ?? null;

  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            skills_count, prompt_version, extractor_version, model,
            error_message, started_at, finished_at, created_at
       FROM organigrama.cv_extraction WHERE person_id = $1
      ORDER BY id DESC`,
    [person.id],
  );
  const runningExt = extractions.filter(
    (e: { status: string }) => e.status === 'RUNNING' || e.status === 'PENDING',
  );
  const activeExt =
    extractions.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count, error_message, created_at
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1
      ORDER BY id DESC`,
    [person.id],
  );
  const activeEnr =
    enrichments.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
            error_message, created_at
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1
      ORDER BY id DESC`,
    [person.id],
  );
  const activeEv =
    evidences.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const evals = await ds.query(
    `SELECT id::text, domain_code, is_active, status
       FROM organigrama.mc_profile_evaluation WHERE person_id = $1`,
    [person.id],
  );

  const fileNameMatchesDoc =
    activeCv &&
    String(activeCv.drive_file_name || '')
      .toLowerCase()
      .includes(document);

  let download: Record<string, unknown> | null = null;
  let downloadError: string | null = null;
  if (activeCv) {
    try {
      const prepared = await prepareCvPdfForExtraction({
        document,
        dataSource: ds,
      });
      download = {
        personCvId: prepared.personCvId,
        driveFileName: prepared.driveFileName,
        driveFileId: prepared.driveFileId,
        pdfSha256: prepared.pdfSha256,
        pdfByteSize: prepared.pdfByteSize,
        nonEmpty: prepared.pdfByteSize > 1000,
      };
    } catch (e) {
      downloadError = e instanceof Error ? e.message : String(e);
    }
  }

  const chainComplete =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnr) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnr?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnr?.id);

  const checks = {
    personUnique: true,
    personActive: person.is_active === true,
    hasActiveCv: Boolean(activeCv),
    singleActiveCv: activeCvs.length === 1,
    fileNameMatchesDocument: Boolean(fileNameMatchesDoc),
    noRunningExtraction: runningExt.length === 0,
    noCompleteChainYet: !chainComplete,
    downloadOk: Boolean(download) && !downloadError,
    pdfNonEmpty: Boolean(download?.nonEmpty),
    noPa2Eval: evals.length === 0,
  };

  const blockers = Object.entries(checks)
    .filter(([k, v]) => {
      if (k === 'noCompleteChainYet') return !v; // blocker if chain already complete
      return !v;
    })
    .map(([k]) => k);

  const writePlan = {
    reuseExistingExtraction: Boolean(activeExt),
    extractionId: activeExt?.id ?? null,
    steps: [
      activeExt
        ? `REUSE extraction ${activeExt.id} (SUCCEEDED active) — no re-extract unless hash/version drift`
        : 'EXTRACT + persist new extraction',
      'ENRICH --extractionId=<id> --persist --i-confirm-persist --activate --i-confirm-activate',
      'EVIDENCE --enrichmentId=<id> --persist --i-confirm-persist --activate --i-confirm-activate',
      'NO PA2 persist in this phase',
    ],
    approvedModel: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    approvedPrompt: CV_SKILLS_PROMPT_VERSION,
    approvedExtractor: CV_SKILLS_EXTRACTOR_VERSION,
  };

  return {
    label,
    document,
    ok: blockers.length === 0,
    blockers,
    checks,
    person,
    boss,
    activeCv,
    activeCvCount: activeCvs.length,
    allCvs: cvs,
    activeExt,
    runningExt,
    extractions,
    activeEnr,
    enrichments,
    activeEv,
    evidences,
    evals,
    download,
    downloadError,
    chainComplete,
    writePlan,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const results: Array<Record<string, unknown>> = [];
  for (const t of TARGETS) {
    results.push(await preflightOne(ds, t.document, t.label));
  }
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161c1-preflight.json');
  writeFileSync(
    path,
    JSON.stringify(
      {
        phase: 'MC1.6.1C.1-preflight',
        generatedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(
    JSON.stringify(
      {
        wrote: path,
        summary: results.map((r: any) => ({
          label: r.label,
          document: r.document,
          person_id: r.person?.id,
          name: r.person?.full_name,
          ok: r.ok,
          blockers: r.blockers,
          cv: r.activeCv?.id,
          file: r.activeCv?.drive_file_name,
          ext: r.activeExt?.id,
          enr: r.activeEnr?.id,
          ev: r.activeEv?.id,
          pdfSha256: r.download?.pdfSha256 ?? r.activeExt?.pdf_sha256,
          pdfBytes: r.download?.pdfByteSize,
          writePlan: r.writePlan,
        })),
      },
      null,
      2,
    ),
  );
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
