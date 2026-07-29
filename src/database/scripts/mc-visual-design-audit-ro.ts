/**
 * MC1.6.0 / Diseño Visual — auditoría solo lectura (Nidia + hermanos).
 * Sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const DOCUMENT = '1015482688';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            p.edu_email, p.email,
            ro.name AS role_name, a.name AS area_name,
            p.role_id::text, p.area_id::text
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.document = $1`,
    [DOCUMENT],
  );
  if (persons.length !== 1) {
    console.log(JSON.stringify({ error: 'PERSON', count: persons.length }));
    await app.close();
    process.exit(1);
  }
  const person = persons[0];
  const personId = person.id;

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
    [personId],
  );

  const cvs = await ds.query(
    `SELECT id::text, person_id::text, document, drive_file_id, drive_file_name,
            is_active, synced_at, mime_type, drive_modified_time, drive_md5_checksum,
            drive_file_size, created_at
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY is_active DESC, synced_at DESC NULLS LAST`,
    [personId],
  );
  const activeCv = cvs.find((c: any) => c.is_active) ?? null;

  const extractions = await ds.query(
    `SELECT e.id::text, e.person_cv_id::text, e.status, e.is_active, e.pdf_sha256,
            e.drive_file_id, e.drive_file_name, e.model, e.prompt_version,
            e.extractor_version, e.skills_count, e.started_at, e.finished_at
       FROM organigrama.cv_extraction e
      WHERE e.person_id = $1 ORDER BY e.id DESC`,
    [personId],
  );
  const activeExt =
    extractions.find((e: any) => e.status === 'SUCCEEDED' && e.is_active) ??
    null;

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count, created_at
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );
  const activeEnrich =
    enrichments.find((e: any) => e.is_active) ?? null;

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
            created_at
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );
  const activeEv = evidences.find((e: any) => e.is_active) ?? null;

  const pa2 = await ds.query(
    `SELECT id::text, status, is_active, domain_code, engine_rules_version,
            extraction_id::text, enrichment_id::text
       FROM organigrama.mc_profile_evaluation WHERE person_id = $1`,
    [personId],
  );

  // Skills from active extraction + evidence items
  let skills: any[] = [];
  let langs: any[] = [];
  let certs: any[] = [];
  let evidenceItems: any[] = [];

  if (activeExt) {
    skills = await ds.query(
      `SELECT es.id::text AS extraction_skill_id,
              es.original_name, es.category, es.confidence, es.level,
              LEFT(es.evidence, 240) AS evidence,
              es.evidence_items,
              sk.id::text AS skill_id, sk.normalized_name, sk.skill_type,
              sk.normalized_key
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill sk ON sk.id = es.skill_id
        WHERE es.extraction_id = $1
        ORDER BY es.sort_order ASC NULLS LAST, es.id ASC`,
      [activeExt.id],
    );
    langs = await ds.query(
      `SELECT name, level, evidence, is_certified
         FROM organigrama.cv_extraction_language
        WHERE extraction_id = $1 ORDER BY id`,
      [activeExt.id],
    );
    certs = await ds.query(
      `SELECT name, issuer, evidence
         FROM organigrama.cv_extraction_certification
        WHERE extraction_id = $1 ORDER BY id`,
      [activeExt.id],
    );
  }

  if (activeEv) {
    evidenceItems = await ds.query(
      `SELECT normalized_name, evidence_level, evidence_strength,
              evidence_confidence, source_breakdown, quality_flags,
              LEFT(explanation, 200) AS explanation
         FROM organigrama.cv_evidence_evaluation_item
        WHERE evaluation_id = $1
        ORDER BY evidence_strength DESC NULLS LAST, normalized_name`,
      [activeEv.id],
    );
  }

  // Catalog software snapshot (read-only)
  const domains = await ds.query(
    `SELECT d.id::text, d.code, d.name, d.is_active,
            cv.code AS catalog_code, cv.version AS catalog_version,
            cv.id::text AS catalog_version_id, cv.is_active AS catalog_active
       FROM organigrama.mc_domain d
       JOIN organigrama.mc_catalog_version cv ON cv.id = d.catalog_version_id
      ORDER BY d.id`,
  );
  const specialties = await ds.query(
    `SELECT s.id::text, s.code, s.name, s.domain_id::text, s.sort_order, s.is_active,
            d.code AS domain_code
       FROM organigrama.mc_specialty s
       JOIN organigrama.mc_domain d ON d.id = s.domain_id
      ORDER BY d.code, s.sort_order, s.id`,
  );
  const mappingCounts = await ds.query(
    `SELECT d.code AS domain_code, COUNT(*)::int AS mapping_count
       FROM organigrama.mc_skill_specialty_mapping m
       JOIN organigrama.mc_specialty s ON s.id = m.specialty_id
       JOIN organigrama.mc_domain d ON d.id = s.domain_id
      WHERE m.is_active = TRUE
      GROUP BY d.code`,
  );

  // Sibling candidates: same boss and/or same area / related roles
  const bossId = boss[0]?.boss_id ?? null;
  let siblings: any[] = [];
  if (bossId) {
    siblings = await ds.query(
      `SELECT p.id::text AS person_id, p.full_name, p.document, p.is_active,
              ro.name AS role_name, a.name AS area_name,
              parent.id::text AS boss_id, parent.full_name AS boss_name,
              (SELECT COUNT(*)::int FROM organigrama.person_cv cv
                WHERE cv.person_id = p.id AND cv.is_active = TRUE) AS active_cv_count,
              (SELECT cv.id::text FROM organigrama.person_cv cv
                WHERE cv.person_id = p.id AND cv.is_active = TRUE
                ORDER BY cv.synced_at DESC NULLS LAST LIMIT 1) AS active_cv_id,
              (SELECT e.id::text FROM organigrama.cv_extraction e
                WHERE e.person_id = p.id AND e.status = 'SUCCEEDED' AND e.is_active = TRUE
                ORDER BY e.id DESC LIMIT 1) AS active_extraction_id,
              (SELECT e.skills_count FROM organigrama.cv_extraction e
                WHERE e.person_id = p.id AND e.status = 'SUCCEEDED' AND e.is_active = TRUE
                ORDER BY e.id DESC LIMIT 1) AS extraction_skills_count
         FROM organigrama.org_chart_version v
         JOIN organigrama.org_visual_relation r
           ON r.version_id = v.id AND r.is_active = TRUE
         JOIN core.person p ON p.id = r.child_person_id
         JOIN core.person parent ON parent.id = r.parent_person_id
         LEFT JOIN core.role ro ON ro.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
        WHERE v.is_active = TRUE
          AND parent.id = $1
          AND p.id <> $2
          AND p.is_active = TRUE
        ORDER BY ro.name, p.full_name`,
      [bossId, personId],
    );
  }

  // Broader: same area + design/content related role names
  const areaSiblings = await ds.query(
    `SELECT p.id::text AS person_id, p.full_name, p.document, p.is_active,
            ro.name AS role_name, a.name AS area_name,
            (SELECT COUNT(*)::int FROM organigrama.person_cv cv
              WHERE cv.person_id = p.id AND cv.is_active = TRUE) AS active_cv_count,
            (SELECT e.id::text FROM organigrama.cv_extraction e
              WHERE e.person_id = p.id AND e.status = 'SUCCEEDED' AND e.is_active = TRUE
              LIMIT 1) AS active_extraction_id
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.is_active = TRUE
        AND p.id <> $1
        AND (
          a.id = $2
          OR ro.name ILIKE '%DISE%'
          OR ro.name ILIKE '%CONTENID%'
          OR ro.name ILIKE '%AUDIOVIS%'
          OR ro.name ILIKE '%GRAF%'
        )
      ORDER BY
        CASE WHEN a.id = $2 THEN 0 ELSE 1 END,
        CASE WHEN ro.name ILIKE '%DISE%' THEN 0 ELSE 1 END,
        p.full_name
      LIMIT 40`,
    [personId, person.area_id],
  );

  const chainOk =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    Boolean(activeEnrich) &&
    String(activeEnrich?.extraction_id) === String(activeExt?.id) &&
    String(activeEnrich?.pdf_sha256).toLowerCase() ===
      String(activeExt?.pdf_sha256).toLowerCase() &&
    Boolean(activeEv) &&
    String(activeEv?.enrichment_id) === String(activeEnrich?.id);

  const report = {
    meta: {
      phase: 'MC1-DiseñoVisual-audit-RO',
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      document: DOCUMENT,
    },
    person: {
      ...person,
      boss: boss[0] ?? null,
    },
    cvs,
    activeCv,
    extractions,
    activeExt,
    enrichments,
    activeEnrich,
    evidences,
    activeEv,
    pa2,
    chain: {
      ok: chainOk,
      personCvId: activeCv?.id ?? null,
      extractionId: activeExt?.id ?? null,
      enrichmentId: activeEnrich?.id ?? null,
      evidenceId: activeEv?.id ?? null,
      pdfSha256: activeExt?.pdf_sha256 ?? null,
      driveFileId: activeExt?.drive_file_id ?? null,
      driveFileName: activeExt?.drive_file_name ?? null,
      enrichmentHashMatches: activeEnrich
        ? String(activeEnrich.pdf_sha256).toLowerCase() ===
          String(activeExt?.pdf_sha256).toLowerCase()
        : false,
      evidenceOnEnrichment: activeEv
        ? String(activeEv.enrichment_id) === String(activeEnrich?.id)
        : false,
      zeroPa2: pa2.length === 0,
    },
    inventory: { skills, languages: langs, certifications: certs, evidenceItems },
    catalogSnapshot: { domains, specialties, mappingCounts },
    siblingsSameBoss: siblings,
    areaOrRoleCandidates: areaSiblings,
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, 'mc1-visual-design-audit-nidia-ro.json');
  writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        path: out,
        person: {
          id: person.id,
          name: person.full_name,
          role: person.role_name,
          area: person.area_name,
          active: person.is_active,
          boss: boss[0]?.boss_name ?? null,
        },
        chain: report.chain,
        skillsCount: skills.length,
        evidenceCount: evidenceItems.length,
        domains: domains.map((d: any) => d.code),
        siblingsSameBoss: siblings.length,
        areaCandidates: areaSiblings.length,
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
