/**
 * MC1.5.3 — Integridad pipeline activo documento 1022445625.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const PERSON_ID = '1176';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const extractions = await ds.query(
    `SELECT id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id`,
    [PERSON_ID],
  );
  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id`,
    [PERSON_ID],
  );
  const evidence = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id`,
    [PERSON_ID],
  );
  const pa2 = await ds.query(
    `SELECT id::text FROM organigrama.mc_profile_evaluation WHERE person_id = $1`,
    [PERSON_ID],
  );

  const activeExt = extractions.filter((e: any) => e.is_active);
  const activeEnr = enrichments.filter((e: any) => e.is_active);
  const activeEv = evidence.filter((e: any) => e.is_active);

  const report = {
    extractions,
    enrichments,
    evidence,
    pa2Count: pa2.length,
    integrity: {
      oneActiveExtraction: activeExt.length === 1,
      activeExtractionId: activeExt[0]?.id ?? null,
      activeExtractionHash: activeExt[0]?.pdf_sha256 ?? null,
      oneActiveEnrichment: activeEnr.length === 1,
      enrichmentId: activeEnr[0]?.id ?? null,
      enrichmentHash: activeEnr[0]?.pdf_sha256 ?? null,
      enrichmentOnActiveExtraction:
        activeEnr[0] &&
        activeExt[0] &&
        String(activeEnr[0].extraction_id) === String(activeExt[0].id),
      hashMatch:
        activeEnr[0] &&
        activeExt[0] &&
        String(activeEnr[0].pdf_sha256).toLowerCase() ===
          String(activeExt[0].pdf_sha256).toLowerCase(),
      oneActiveEvidence: activeEv.length === 1,
      evidenceId: activeEv[0]?.id ?? null,
      evidenceOnActiveEnrichment:
        activeEv[0] &&
        activeEnr[0] &&
        String(activeEv[0].enrichment_id) === String(activeEnr[0].id),
      historical104:
        extractions.some(
          (e: any) => String(e.id) === '104' && e.is_active === false,
        ),
      zeroPa2: pa2.length === 0,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
