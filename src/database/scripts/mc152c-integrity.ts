/**
 * MC1.5.2C — Verificación de integridad del pipeline activo de Nidia.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const PERSON_ID = '1163';
const DOC = '1015482688';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const extractions = await ds.query(
    `SELECT id, status, is_active, pdf_sha256, drive_file_id, person_cv_id,
            model, prompt_version, extractor_version, finished_at
     FROM organigrama.cv_extraction
     WHERE person_id = $1
     ORDER BY id`,
    [PERSON_ID],
  );

  const enrichments = await ds.query(
    `SELECT e.id, e.extraction_id, e.status, e.is_active, e.pdf_sha256, e.created_at
     FROM organigrama.cv_skill_enrichment e
     WHERE e.person_id = $1
     ORDER BY e.id`,
    [PERSON_ID],
  );

  const evidence = await ds.query(
    `SELECT ev.id, ev.enrichment_id, ev.extraction_id, ev.status, ev.is_active, ev.created_at
     FROM organigrama.cv_evidence_evaluation ev
     WHERE ev.person_id = $1
     ORDER BY ev.id`,
    [PERSON_ID],
  );

  const pa2 = await ds.query(
    `SELECT id::text FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 OR extraction_id IN (87, 207)`,
    [PERSON_ID],
  );

  const skills207 = await ds.query(
    `SELECT es.id, es.original_name, es.category, sk.normalized_name, sk.skill_type
     FROM organigrama.cv_extraction_skill es
     JOIN organigrama.cv_skill sk ON sk.id = es.skill_id
     WHERE es.extraction_id = 207
     ORDER BY es.id`,
  );

  const skills87 = await ds.query(
    `SELECT es.id, es.original_name, es.category, sk.normalized_name, sk.skill_type
     FROM organigrama.cv_extraction_skill es
     JOIN organigrama.cv_skill sk ON sk.id = es.skill_id
     WHERE es.extraction_id = 87
     ORDER BY es.id`,
  );

  const evidenceItems = await ds.query(
    `SELECT i.normalized_name, i.evidence_level, i.evidence_strength, i.evidence_confidence,
            i.quality_flags, i.explanation
     FROM organigrama.cv_evidence_evaluation_item i
     WHERE i.evaluation_id = (
       SELECT id FROM organigrama.cv_evidence_evaluation
       WHERE person_id = $1 AND is_active = true
       ORDER BY id DESC LIMIT 1
     )
     ORDER BY i.evidence_strength DESC NULLS LAST, i.normalized_name`,
    [PERSON_ID],
  );

  const activeExt = extractions.filter((r: any) => r.is_active);
  const activeEnr = enrichments.filter((r: any) => r.is_active);
  const activeEv = evidence.filter((r: any) => r.is_active);

  const report = {
    document: DOC,
    personId: PERSON_ID,
    extractions,
    enrichments,
    evidence,
    pa2Count: pa2.length,
    skills87Count: skills87.length,
    skills207Count: skills207.length,
    skills87: skills87.map((s: any) => s.normalized_name || s.original_name),
    skills207: skills207.map((s: any) => ({
      name: s.normalized_name || s.original_name,
      type: s.skill_type,
      category: s.category,
    })),
    activeEvidenceSkills: evidenceItems,
    integrity: {
      oneActiveExtraction: activeExt.length === 1,
      activeExtractionId: activeExt[0]?.id ?? null,
      activeExtractionHash: activeExt[0]?.pdf_sha256 ?? null,
      activeEnrichments: activeEnr.map((e: any) => ({
        id: e.id,
        extractionId: e.extraction_id,
        hash: e.pdf_sha256,
      })),
      activeEvidence: activeEv.map((e: any) => ({
        id: e.id,
        enrichmentId: e.enrichment_id,
        extractionId: e.extraction_id,
      })),
      hashChainOk:
        activeExt.length === 1 &&
        activeEnr.some(
          (e: any) =>
            String(e.extraction_id) === String(activeExt[0].id) &&
            e.pdf_sha256 === activeExt[0].pdf_sha256 &&
            e.is_active,
        ),
      zeroPa2: pa2.length === 0,
      historical87Present: extractions.some(
        (e: any) => String(e.id) === '87' && e.is_active === false,
      ),
      enrichment4StillActiveFlag: enrichments.some(
        (e: any) => String(e.id) === '4' && e.is_active === true,
      ),
      evidence4StillActiveFlag: evidence.some(
        (e: any) => String(e.id) === '4' && e.is_active === true,
      ),
    },
  };

  const out = resolve(
    process.cwd(),
    'tmp',
    'cv-attributes',
    'mc1.5.2c-integrity.json',
  );
  mkdirSync(resolve(process.cwd(), 'tmp', 'cv-attributes'), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify(report.integrity, null, 2));
  console.log('path:', out);
  console.log('skills87:', report.skills87);
  console.log(
    'evidence levels:',
    evidenceItems.reduce((acc: any, s: any) => {
      acc[s.evidence_level] = (acc[s.evidence_level] || 0) + 1;
      return acc;
    }, {}),
  );
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
