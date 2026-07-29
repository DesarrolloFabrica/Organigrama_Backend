/**
 * MC1.9.0 — Auditoría RO documento 1070007550 (exploración transversal).
 * Solo lectura. No ejecuta PA2 ni muta catálogo.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const DOCUMENT = '1070007550';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.edu_email, p.email,
            ro.name AS role_name, a.name AS area_name,
            p.created_at, p.updated_at
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
       JOIN core.person parent ON parent.id = r.parent_person_id
       LEFT JOIN core.role ro ON ro.id = parent.role_id
      WHERE v.is_active = TRUE AND r.child_person_id = $1
      LIMIT 5`,
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
            model, prompt_version, extractor_version, skills_count, error_message
       FROM organigrama.cv_extraction
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count, created_at,
            model, prompt_version, enricher_version
       FROM organigrama.cv_skill_enrichment
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
            created_at, completed_at, evidence_rules_version, algorithm_version,
            input_skills_count, output_skills_count,
            strong_skills_count, moderate_skills_count, weak_skills_count,
            no_evidence_skills_count
       FROM organigrama.cv_evidence_evaluation
      WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );

  const pa2 = await ds.query(
    `SELECT id::text, status, is_active, domain_code, extraction_id::text,
            default_specialty_code, active_count, emergent_count, hidden_count
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
    enrichments.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;
  const activeEv =
    evidences.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  let skills: unknown[] = [];
  let evidenceItems: unknown[] = [];
  let enrichmentItems: unknown[] = [];

  if (activeExt) {
    skills = await ds.query(
      `SELECT ces.id::text AS extraction_skill_id,
              s.id::text AS skill_id,
              s.normalized_key, s.normalized_name, s.skill_type,
              ces.category, ces.confidence AS extraction_confidence,
              ces.original_name, ces.evidence, ces.evidence_items
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
        WHERE ces.extraction_id = $1
        ORDER BY s.skill_type, s.normalized_key`,
      [activeExt.id],
    );
  }

  if (activeEv) {
    evidenceItems = await ds.query(
      `SELECT ei.id::text, ei.normalized_name, ei.evidence_level,
              ei.evidence_strength::float AS evidence_strength,
              ei.evidence_confidence::float AS evidence_confidence,
              ei.explanation, ei.quality_flags, ei.source_breakdown,
              ei.has_work_experience, ei.has_project, ei.has_achievement,
              ei.has_responsibility, ei.has_certification, ei.has_education,
              ei.has_profile_summary, ei.has_skills_section,
              ei.applied_evidence_count, ei.listing_evidence_count,
              ei.substantive_evidence_count
         FROM organigrama.cv_evidence_evaluation_item ei
        WHERE ei.evaluation_id = $1
        ORDER BY ei.evidence_strength DESC NULLS LAST, ei.normalized_name`,
      [activeEv.id],
    );
  }

  if (activeEnrich) {
    enrichmentItems = await ds.query(
      `SELECT id::text, normalized_name, evidence_count, source_types,
              status, evidence_items
         FROM organigrama.cv_skill_enrichment_item
        WHERE enrichment_id = $1
        ORDER BY evidence_count DESC, normalized_name`,
      [activeEnrich.id],
    );
  }

  const chainComplete =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnrich) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnrich?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnrich?.id) &&
    String(activeEv?.extraction_id) === String(activeExt?.id);

  const report = {
    phase: 'MC1.9.0',
    document: DOCUMENT,
    generatedAt: new Date().toISOString(),
    mode: 'READ_ONLY',
    person,
    boss: bossRows,
    chain: {
      complete: chainComplete,
      person_cv: activeCv,
      extraction: activeExt,
      enrichment: activeEnrich,
      evidence: activeEv,
    },
    allCvs: cvs,
    allExtractions: extractions,
    allEnrichments: enrichments,
    allEvidences: evidences,
    pa2Evaluations: pa2,
    skillsCount: skills.length,
    skills,
    evidenceItemsCount: evidenceItems.length,
    evidenceItems,
    enrichmentItemsCount: enrichmentItems.length,
    enrichmentItems,
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const out = resolve(process.cwd(), 'tmp/mc190-audit-1070007550.json');
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        person_id: person.id,
        full_name: person.full_name,
        role: person.role_name,
        area: person.area_name,
        chainComplete,
        extractionId: activeExt?.id ?? null,
        enrichmentId: activeEnrich?.id ?? null,
        evidenceId: activeEv?.id ?? null,
        skillsCount: skills.length,
        evidenceItemsCount: evidenceItems.length,
        enrichmentItemsCount: enrichmentItems.length,
        out,
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
