/**
 * MC1.5.3 — Auditoría inicial (solo lectura) documento 1022445625.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareCvPdfForExtraction } from './utils/extract-cv-skills-pipeline';

const DOCUMENT = '1022445625';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.edu_email, p.email,
            ro.name AS role_name, a.name AS area_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.document = $1`,
    [DOCUMENT],
  );

  if (persons.length === 0) {
    console.log(JSON.stringify({ error: 'PERSON_NOT_FOUND', document: DOCUMENT }, null, 2));
    await app.close();
    process.exit(1);
  }

  const person = persons[0];
  const personId = person.id;

  const bossRows = await ds.query(
    `SELECT parent.full_name AS boss_name, parent.id::text AS boss_id,
            parent.document AS boss_document, ro.name AS boss_role
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation r
         ON r.version_id = v.id AND r.is_active = TRUE
       JOIN core.person child ON child.id = r.child_person_id
       JOIN core.person parent ON parent.id = r.parent_person_id
       LEFT JOIN core.role ro ON ro.id = parent.role_id
      WHERE v.is_active = TRUE
        AND child.id = $1
      LIMIT 5`,
    [personId],
  );

  const inOrg = await ds.query(
    `SELECT r.id::text, r.parent_person_id::text, r.child_person_id::text
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation r
         ON r.version_id = v.id AND r.is_active = TRUE
      WHERE v.is_active = TRUE
        AND (r.child_person_id = $1 OR r.parent_person_id = $1)
      LIMIT 20`,
    [personId],
  );

  const cvs = await ds.query(
    `SELECT id::text, person_id::text, document, drive_file_id, drive_file_name,
            is_active, synced_at, mime_type, drive_modified_time, drive_md5_checksum,
            drive_file_size, created_at
       FROM organigrama.person_cv
      WHERE person_id = $1 OR document = $2
      ORDER BY is_active DESC, synced_at DESC NULLS LAST`,
    [personId, DOCUMENT],
  );

  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            drive_file_id, drive_file_name, started_at, finished_at,
            model, prompt_version, extractor_version, skills_count
       FROM organigrama.cv_extraction
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count, created_at
       FROM organigrama.cv_skill_enrichment
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
            created_at
       FROM organigrama.cv_evidence_evaluation
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const pa2 = await ds.query(
    `SELECT id::text, status, is_active, domain_code, extraction_id::text
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;
  const activeExt =
    extractions.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;
  const activeEnrich =
    enrichments.find((e: { is_active: boolean }) => e.is_active) ?? null;
  const activeEvidence =
    evidences.find((e: { is_active: boolean }) => e.is_active) ?? null;
  const activePa2 =
    pa2.find((e: { is_active: boolean }) => e.is_active) ?? null;

  let liveHash: string | null = null;
  let liveHash2: string | null = null;
  let liveBytes: number | null = null;
  let pdfError: string | null = null;

  if (activeCv?.drive_file_id) {
    try {
      const prepared = await prepareCvPdfForExtraction({
        document: DOCUMENT,
        dataSource: ds,
      });
      liveHash = prepared.pdfSha256.toLowerCase();
      liveBytes = prepared.pdfBuffer.length;
      const prepared2 = await prepareCvPdfForExtraction({
        document: DOCUMENT,
        dataSource: ds,
      });
      liveHash2 = prepared2.pdfSha256.toLowerCase();
    } catch (e) {
      pdfError = e instanceof Error ? e.message : String(e);
    }
  }

  const extHash = activeExt
    ? String(activeExt.pdf_sha256).toLowerCase()
    : null;
  const drifted =
    Boolean(extHash && liveHash && extHash !== liveHash);
  const stable =
    liveHash !== null && liveHash2 !== null && liveHash === liveHash2;

  const stageTable = [
    {
      stage: 'CV',
      exists: Boolean(activeCv),
      status: activeCv ? 'AVAILABLE' : null,
      active: Boolean(activeCv?.is_active),
      id: activeCv?.id ?? null,
    },
    {
      stage: 'Extraction',
      exists: extractions.length > 0,
      status: activeExt?.status ?? extractions[0]?.status ?? null,
      active: Boolean(activeExt),
      id: activeExt?.id ?? extractions[0]?.id ?? null,
    },
    {
      stage: 'Enrichment',
      exists: enrichments.length > 0,
      status: activeEnrich?.status ?? enrichments[0]?.status ?? null,
      active: Boolean(activeEnrich),
      id: activeEnrich?.id ?? enrichments[0]?.id ?? null,
    },
    {
      stage: 'Evidence',
      exists: evidences.length > 0,
      status: activeEvidence?.status ?? evidences[0]?.status ?? null,
      active: Boolean(activeEvidence),
      id: activeEvidence?.id ?? evidences[0]?.id ?? null,
    },
    {
      stage: 'PA2',
      exists: pa2.length > 0,
      status: activePa2?.status ?? pa2[0]?.status ?? null,
      active: Boolean(activePa2),
      id: activePa2?.id ?? pa2[0]?.id ?? null,
    },
  ];

  const report = {
    meta: {
      phase: 'MC1.5.3-audit',
      document: DOCUMENT,
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
    },
    person: {
      personId,
      fullName: person.full_name,
      document: person.document,
      role: person.role_name,
      area: person.area_name,
      institutionalEmail: person.edu_email,
      email: person.email,
      isActive: person.is_active,
      immediateBoss: bossRows[0]
        ? {
            id: bossRows[0].boss_id,
            name: bossRows[0].boss_name,
            document: bossRows[0].boss_document,
            role: bossRows[0].boss_role,
          }
        : null,
      inActiveOrgChart: inOrg.length > 0,
      orgRelationCount: inOrg.length,
    },
    stageTable,
    pipeline: {
      cvs,
      extractions,
      enrichments,
      evidences,
      pa2,
    },
    drift: {
      activeExtractionHash: extHash,
      livePdfHash: liveHash,
      livePdfHash2: liveHash2,
      liveBytes,
      hashesDiffer: drifted,
      pdfStableDuringAudit: stable,
      pdfError,
      enrichmentHashMatchesExtraction:
        activeEnrich && activeExt
          ? String(activeEnrich.pdf_sha256).toLowerCase() === extHash
          : null,
      evidenceLinkedToActiveEnrichment:
        activeEvidence && activeEnrich
          ? String(activeEvidence.enrichment_id) === String(activeEnrich.id)
          : null,
      recommendation: !activeExt
        ? 'RUN_FULL_PIPELINE'
        : drifted
          ? 'REEXTRACT_THEN_ENRICH_EVIDENCE'
          : !activeEnrich
            ? 'REUSE_EXTRACTION_RUN_ENRICH_EVIDENCE'
            : activeEnrich &&
                activeExt &&
                String(activeEnrich.pdf_sha256).toLowerCase() !== extHash
              ? 'REENRICH_ON_ACTIVE_EXTRACTION'
              : !activeEvidence
                ? 'REUSE_ENRICH_RUN_EVIDENCE'
                : activeEvidence &&
                    activeEnrich &&
                    String(activeEvidence.enrichment_id) !==
                      String(activeEnrich.id)
                  ? 'REEVALUATE_EVIDENCE_ON_ACTIVE_ENRICHMENT'
                  : 'PIPELINE_ALIGNED_REUSE',
    },
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const outPath = resolve(dir, 'mc1.5.3-1022445625-audit.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ path: outPath, person: report.person, stageTable, drift: report.drift }, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
