/**
 * MC1.5.2B — Preflight + inspección extracción 87 (solo lectura).
 * npx ts-node -r tsconfig-paths/register src/database/scripts/mc152b-preflight.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const EXPECTED = {
  personId: '1163',
  document: '1015482688',
  personCvId: '7',
  extractionId: '87',
};

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const persons = await ds.query(
    `SELECT id::text, full_name, document, is_active, edu_email
       FROM core.person WHERE document = $1`,
    [EXPECTED.document],
  );

  const cv = await ds.query(
    `SELECT id::text, person_id::text, document, drive_file_id, drive_file_name,
            is_active, synced_at, mime_type
       FROM organigrama.person_cv
      WHERE person_id = $1
      ORDER BY is_active DESC`,
    [EXPECTED.personId],
  );

  const extraction = await ds.query(
    `SELECT id::text, person_id::text, person_cv_id::text, status, is_active,
            drive_file_name, pdf_sha256, started_at, finished_at, error_message
       FROM organigrama.cv_extraction WHERE id = $1`,
    [EXPECTED.extractionId],
  );

  const skills = await ds.query(
    `SELECT ces.id::text AS extraction_skill_id,
            ces.skill_id::text,
            cs.normalized_name,
            cs.normalized_key,
            cs.skill_type,
            ces.category,
            ces.confidence::float8 AS confidence,
            ces.level,
            ces.evidence,
            ces.evidence_items,
            ces.is_explicit,
            ces.sort_order
       FROM organigrama.cv_extraction_skill ces
       JOIN organigrama.cv_skill cs ON cs.id = ces.skill_id
      WHERE ces.extraction_id = $1
      ORDER BY ces.sort_order, ces.id`,
    [EXPECTED.extractionId],
  );

  const enrichments = await ds.query(
    `SELECT id::text, status, is_active, extraction_id::text, created_at
       FROM organigrama.cv_skill_enrichment
      WHERE extraction_id = $1
      ORDER BY id`,
    [EXPECTED.extractionId],
  );

  const evidences = await ds.query(
    `SELECT ev.id::text, ev.status, ev.is_active, ev.enrichment_id::text
       FROM organigrama.cv_evidence_evaluation ev
       JOIN organigrama.cv_skill_enrichment en ON en.id = ev.enrichment_id
      WHERE en.extraction_id = $1
      ORDER BY ev.id`,
    [EXPECTED.extractionId],
  );

  const pa2 = await ds.query(
    `SELECT id::text, status, is_active, domain_code, engine_rules_version
       FROM organigrama.mc_profile_evaluation
      WHERE extraction_id = $1 OR person_id = $2
      ORDER BY id`,
    [EXPECTED.extractionId, EXPECTED.personId],
  );

  const activeCv = cv.find((c: { is_active: boolean }) => c.is_active);
  const ext = extraction[0];

  const checks = {
    personUniqueActive:
      persons.length === 1 &&
      persons[0].id === EXPECTED.personId &&
      persons[0].is_active === true,
    personCvId7Active:
      activeCv?.id === EXPECTED.personCvId && activeCv?.is_active === true,
    pdfAvailable: Boolean(activeCv?.drive_file_id),
    extraction87ActiveSucceeded:
      ext?.id === EXPECTED.extractionId &&
      ext?.status === 'SUCCEEDED' &&
      ext?.is_active === true,
    extractionLinkedToCv7: ext?.person_cv_id === EXPECTED.personCvId,
    noActiveEnrichment: !enrichments.some(
      (e: { is_active: boolean }) => e.is_active,
    ),
    noActiveEvidence: !evidences.some(
      (e: { is_active: boolean }) => e.is_active,
    ),
    noPa2ForExtraction: !pa2.some(
      (e: { extraction_id?: string }) =>
        String((e as { extraction_id?: string }).extraction_id ?? '') ===
          EXPECTED.extractionId || true,
    ),
  };

  // Fix PA2 check properly
  const pa2ForExt = await ds.query(
    `SELECT id::text FROM organigrama.mc_profile_evaluation WHERE extraction_id = $1`,
    [EXPECTED.extractionId],
  );
  checks.noPa2ForExtraction = pa2ForExt.length === 0;

  const abort =
    !checks.personUniqueActive ||
    !checks.personCvId7Active ||
    !checks.pdfAvailable ||
    !checks.extraction87ActiveSucceeded ||
    !checks.extractionLinkedToCv7;

  const skillKind = (type: string, category: string, name: string) => {
    const t = (type || '').toUpperCase();
    const c = (category || '').toLowerCase();
    const n = (name || '').toLowerCase();
    if (t === 'SOFT_SKILL' || c.includes('liderazgo')) return 'transversal';
    if (t === 'TECHNOLOGY' || n.includes('inteligencia') || n.includes('prompt'))
      return 'técnica';
    if (t === 'METHODOLOGY') return 'metodológica';
    if (c.includes('diseño') || c.includes('audiovisual') || c.includes('visual'))
      return 'creativa';
    if (c.includes('estrategia') || c.includes('planificación')) return 'metodológica';
    return 'profesional';
  };

  const report = {
    meta: {
      phase: 'MC1.5.2B-preflight',
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      expected: EXPECTED,
    },
    checks,
    abort,
    identity: persons[0]
      ? {
          personId: persons[0].id,
          fullName: persons[0].full_name,
          document: persons[0].document,
          isActive: persons[0].is_active,
          eduEmail: persons[0].edu_email,
        }
      : null,
    personCv: cv.map((c: Record<string, unknown>) => ({
      id: c.id,
      document: c.document,
      fileName: c.drive_file_name,
      driveFileId: c.drive_file_id ? '(present)' : null,
      isActive: c.is_active,
      syncedAt: c.synced_at,
    })),
    extraction: ext ?? null,
    skillCount: skills.length,
    skills: skills.map((s: Record<string, unknown>) => ({
      extractionSkillId: s.extraction_skill_id,
      skillId: s.skill_id,
      canonicalName: s.normalized_name,
      normalizedKey: s.normalized_key,
      type: s.skill_type,
      category: s.category,
      extractionConfidence: s.confidence,
      level: s.level,
      evidenceOriginal: s.evidence,
      evidenceItems: s.evidence_items,
      kindHint: skillKind(
        String(s.skill_type),
        String(s.category),
        String(s.normalized_name),
      ),
      sortOrder: s.sort_order,
    })),
    pipeline: {
      enrichments,
      evidences,
      pa2ForPerson: pa2,
      pa2ForExtraction: pa2ForExt,
    },
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'mc1.5.2b-preflight-1015482688.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  console.log(JSON.stringify({ checks, abort, skillCount: skills.length, path }, null, 2));
  for (const s of report.skills) {
    console.log(
      `- ${s.canonicalName} [${s.type}/${s.category}] conf=${s.extractionConfidence} kind=${s.kindHint}`,
    );
  }
  await app.close();
  if (abort) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
