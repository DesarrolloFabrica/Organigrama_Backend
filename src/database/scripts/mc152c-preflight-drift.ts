/**
 * MC1.5.2C — Auditoría de drift PDF (solo lectura).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareCvPdfForExtraction } from './utils/extract-cv-skills-pipeline';

const EXPECTED = {
  personId: '1163',
  personCvId: '7',
  document: '1015482688',
  extractionId: '87',
  enrichmentId: '4',
  evidenceId: '4',
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const person = await ds.query(
    `SELECT id::text, full_name, document, is_active FROM core.person WHERE id = $1`,
    [EXPECTED.personId],
  );
  const cvs = await ds.query(
    `SELECT id::text, person_id::text, document, drive_file_id, drive_file_name,
            is_active, synced_at, mime_type, drive_modified_time, drive_md5_checksum,
            drive_file_size, created_at
       FROM organigrama.person_cv WHERE person_id = $1 ORDER BY is_active DESC`,
    [EXPECTED.personId],
  );
  const ext87 = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            drive_file_id, drive_file_name, started_at, finished_at,
            model, prompt_version, extractor_version
       FROM organigrama.cv_extraction WHERE id = 87`,
  );
  const enrich = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_skill_enrichment WHERE id IN (3,4) OR extraction_id = 87`,
  );
  const evidence = await ds.query(
    `SELECT id::text, enrichment_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation WHERE id = 4 OR enrichment_id IN (3,4)`,
  );
  const pa2 = await ds.query(
    `SELECT id::text FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 OR extraction_id = 87`,
    [EXPECTED.personId],
  );

  const prepared = await prepareCvPdfForExtraction({
    document: EXPECTED.document,
    dataSource: ds,
  });
  const liveHash = prepared.pdfSha256.toLowerCase();
  const liveSize = prepared.pdfBuffer.length;
  // second download to ensure PDF didn't change mid-audit
  const prepared2 = await prepareCvPdfForExtraction({
    document: EXPECTED.document,
    dataSource: ds,
  });
  const liveHash2 = prepared2.pdfSha256.toLowerCase();

  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active);
  const extHash = String(ext87[0]?.pdf_sha256 ?? '').toLowerCase();

  const report = {
    meta: {
      phase: 'MC1.5.2C-preflight',
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
    },
    checks: {
      personActive: person[0]?.is_active === true && person[0]?.id === EXPECTED.personId,
      documentMatch: person[0]?.document === EXPECTED.document,
      oneActiveCv:
        cvs.filter((c: { is_active: boolean }) => c.is_active).length === 1 &&
        activeCv?.id === EXPECTED.personCvId,
      pdfAvailable: Boolean(activeCv?.drive_file_id),
      extraction87Active:
        ext87[0]?.status === 'SUCCEEDED' && ext87[0]?.is_active === true,
      enrichment4Active: enrich.some(
        (e: { id: string; is_active: boolean }) =>
          e.id === '4' && e.is_active === true,
      ),
      evidence4Active: evidence.some(
        (e: { id: string; is_active: boolean }) =>
          e.id === '4' && e.is_active === true,
      ),
      zeroPa2: pa2.length === 0,
      pdfStableDuringAudit: liveHash === liveHash2,
    },
    drift: {
      extraction87Hash: extHash,
      livePdfHash: liveHash,
      hashesDiffer: extHash !== liveHash,
      sameDriveFileId:
        String(ext87[0]?.drive_file_id ?? '') ===
        String(activeCv?.drive_file_id ?? ''),
      driveModifiedTime: activeCv?.drive_modified_time ?? null,
      driveMd5Checksum: activeCv?.drive_md5_checksum ?? null,
      driveFileSize: activeCv?.drive_file_size ?? null,
      livePdfBytes: liveSize,
      personCvSyncedAt: activeCv?.synced_at ?? null,
      extractionFinishedAt: ext87[0]?.finished_at ?? null,
      whyExtractionStillActive:
        'El flujo de extracción marca SUCCEEDED+is_active por idempotencia de (person, pdf_sha256, model, prompt, extractor). Un PDF nuevo (hash distinto) no desactiva automáticamente la extracción anterior hasta completar una nueva extracción SUCCEEDED del hash vigente.',
      likelyCause:
        extHash !== liveHash &&
        String(ext87[0]?.drive_file_id ?? '') ===
          String(activeCv?.drive_file_id ?? '')
          ? 'PDF_REPLACED_SAME_DRIVE_FILE_ID'
          : extHash !== liveHash
            ? 'PDF_SOURCE_CHANGED'
            : 'NO_DRIFT',
    },
    rows: { person: person[0], cvs, ext87: ext87[0], enrich, evidence, pa2 },
  };

  const abort =
    !report.checks.personActive ||
    !report.checks.oneActiveCv ||
    !report.checks.pdfAvailable ||
    !report.checks.pdfStableDuringAudit ||
    !report.drift.hashesDiffer;

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'mc1.5.2c-preflight-drift.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        checks: report.checks,
        drift: report.drift,
        abortIfNoDriftOrUnstable: abort && !report.drift.hashesDiffer
          ? 'NO_DRIFT'
          : !report.checks.pdfStableDuringAudit
            ? 'PDF_CHANGED_MID_AUDIT'
            : report.drift.hashesDiffer
              ? 'READY_FOR_REEXTRACT'
              : 'BLOCKED',
        path,
      },
      null,
      2,
    ),
  );
  await app.close();
  if (!report.checks.pdfStableDuringAudit) process.exit(2);
  if (!report.drift.hashesDiffer) {
    console.error('No hay drift; no se requiere reextracción por hash.');
    process.exit(3);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
