/**
 * MC1.6.1B — preflight solo lectura: cadena vigente Nidia + catálogo.
 * Sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const EXPECTED = {
  personId: '1163',
  document: '1015482688',
  personCvId: '7',
  extractionId: '207',
  enrichmentId: '5',
  evidenceId: '5',
  sourceHashPrefix: '467d7dbe',
  sourceHashSuffix: 'f86f3a6',
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.role_id::text, ro.name AS role_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
      WHERE p.document = $1 OR p.id = $2`,
    [EXPECTED.document, EXPECTED.personId],
  );

  const person = persons[0] ?? null;
  const personId = person?.id ?? EXPECTED.personId;

  const cvs = await ds.query(
    `SELECT id::text, is_active, drive_md5_checksum, drive_file_name, created_at
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY id`,
    [personId],
  );
  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;

  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            LEFT(pdf_sha256, 8) AS h8, RIGHT(pdf_sha256, 7) AS h7
       FROM organigrama.cv_extraction WHERE person_id = $1
      ORDER BY id`,
    [personId],
  );
  const activeExt =
    extractions.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1
      ORDER BY id`,
    [personId],
  );
  const activeEnr =
    enrichments.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1
      ORDER BY id`,
    [personId],
  );
  const activeEv =
    evidences.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const catalogs = await ds.query(
    `SELECT id::text, code, version, status, is_active
       FROM organigrama.mc_catalog_version ORDER BY id`,
  );
  const domains = await ds.query(
    `SELECT d.code, d.name, cv.version AS catalog_version, d.is_active
       FROM organigrama.mc_domain d
       JOIN organigrama.mc_catalog_version cv ON cv.id = d.catalog_version_id
      ORDER BY cv.id, d.sort_order, d.id`,
  );

  const camiloEvals = await ds.query(
    `SELECT e.id::text, e.person_id::text, e.domain_code, e.status, e.is_active,
            e.engine_rules_version, e.default_specialty_code, e.extraction_id::text,
            p.full_name, p.document
       FROM organigrama.mc_profile_evaluation e
       JOIN core.person p ON p.id = e.person_id
      WHERE e.domain_code = 'SOFTWARE' AND e.is_active = TRUE
      ORDER BY e.id DESC LIMIT 5`,
  );

  const nidiaEvals = await ds.query(
    `SELECT id::text, domain_code, status, is_active, engine_rules_version,
            default_specialty_code, extraction_id::text
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 ORDER BY id`,
    [personId],
  );

  const hash = String(activeExt?.pdf_sha256 ?? '');
  const checks = {
    personIdMatch: person?.id === EXPECTED.personId,
    documentMatch: person?.document === EXPECTED.document,
    personActive: person?.is_active === true,
    activeCvId: activeCv?.id === EXPECTED.personCvId,
    activeExtractionId: activeExt?.id === EXPECTED.extractionId,
    activeEnrichmentId: activeEnr?.id === EXPECTED.enrichmentId,
    activeEvidenceId: activeEv?.id === EXPECTED.evidenceId,
    hashPrefix: hash.startsWith(EXPECTED.sourceHashPrefix),
    hashSuffix: hash.endsWith(EXPECTED.sourceHashSuffix),
    chainExtractionCv:
      String(activeExt?.person_cv_id) === String(activeCv?.id),
    chainEnrichmentExtraction:
      String(activeEnr?.extraction_id) === String(activeExt?.id),
    chainEvidenceEnrichment:
      String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
      String(activeEv?.extraction_id) === String(activeExt?.id),
    hashEnrichmentMatch:
      String(activeEnr?.pdf_sha256) === String(activeExt?.pdf_sha256),
  };

  const abort =
    !checks.personIdMatch ||
    !checks.documentMatch ||
    !checks.personActive ||
    !checks.activeCvId ||
    !checks.activeExtractionId ||
    !checks.activeEnrichmentId ||
    !checks.activeEvidenceId ||
    !checks.hashPrefix ||
    !checks.hashSuffix ||
    !checks.chainExtractionCv ||
    !checks.chainEnrichmentExtraction ||
    !checks.chainEvidenceEnrichment ||
    !checks.hashEnrichmentMatch;

  const out = {
    phase: 'MC1.6.1B-preflight',
    abort,
    checks,
    person,
    activeCv,
    activeExt: activeExt
      ? {
          id: activeExt.id,
          person_cv_id: activeExt.person_cv_id,
          status: activeExt.status,
          is_active: activeExt.is_active,
          pdf_sha256: activeExt.pdf_sha256,
        }
      : null,
    activeEnr,
    activeEv,
    catalogs,
    domains,
    camiloActiveSoftwareEvals: camiloEvals,
    nidiaEvals,
  };

  console.log(JSON.stringify(out, null, 2));
  await app.close();
  process.exit(abort ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
