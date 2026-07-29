/**
 * MC1.9.2 — Auditoría RO de cadenas HR (6 documentos priorizados).
 *
 * npm run mc:validate-hr-round1 -- --audit-only
 * npm run mc:validate-hr-round1 -- --reactivate-inactive-cv
 *
 * No ejecuta PA2, catálogo ni mappings. Completar enrichment/evidence
 * con los CLI oficiales enrich:cv-skills / evaluate:cv-evidence.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const DOCUMENTS = [
  { document: '1000120580', expected: 'MATCH', label: 'Laura García' },
  { document: '1082955522', expected: 'MATCH', label: 'Alberto Valencia' },
  { document: '1233497340', expected: 'BORDERLINE', label: 'Lina Tristancho' },
  { document: '1013588273', expected: 'BORDERLINE', label: 'Yuri Maecha' },
  { document: '1020749844', expected: 'OUTSIDE_HSEQ', label: 'Daniel Rodríguez' },
  { document: '1068658455', expected: 'COMPLEMENTARY', label: 'María José Algarín' },
];

const REFS = [
  { document: '1070007550', expected: 'SEED', label: 'Leidy Bernal' },
  { document: '1000518830', expected: 'OUTSIDE_SOFTWARE', label: 'Camilo Quintero' },
];

async function auditOne(ds: DataSource, document: string, expected: string, label: string) {
  const persons = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active,
            ro.name AS role_name, a.name AS area_name, p.edu_email
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.document = $1`,
    [document],
  );
  if (persons.length !== 1) {
    return { document, label, expected, error: persons.length === 0 ? 'NOT_FOUND' : 'AMBIGUOUS' };
  }
  const p = persons[0];
  const cvs = await ds.query(
    `SELECT id::text, is_active, drive_file_name, drive_file_id, drive_md5_checksum, synced_at
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [p.id],
  );
  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;

  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            skills_count, prompt_version, extractor_version, finished_at, error_message
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [p.id],
  );
  const activeExt =
    extractions.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id DESC`,
    [p.id],
  );
  const activeEnr =
    enrichments.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const evidences = await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
            strong_skills_count, moderate_skills_count, weak_skills_count,
            no_evidence_skills_count, input_skills_count, output_skills_count
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id DESC`,
    [p.id],
  );
  const activeEv =
    evidences.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const chainAligned =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnr) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnr?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
    String(activeEv?.extraction_id) === String(activeExt?.id);

  let action = 'NONE';
  if (!activeCv) action = 'NEED_CV';
  else if (!activeExt) action = 'NEED_EXTRACTION';
  else if (!activeEnr || String(activeEnr.extraction_id) !== String(activeExt.id))
    action = 'NEED_ENRICHMENT';
  else if (!activeEv || String(activeEv.enrichment_id) !== String(activeEnr.id))
    action = 'NEED_EVIDENCE';
  else if (!chainAligned) action = 'NEED_REALIGN';
  else action = 'CHAIN_COMPLETE';

  let evidenceItems: unknown[] = [];
  let skills: unknown[] = [];
  if (activeExt) {
    skills = await ds.query(
      `SELECT s.normalized_key, s.normalized_name, s.skill_type, ces.category
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
        WHERE ces.extraction_id = $1
        ORDER BY s.skill_type, s.normalized_key`,
      [activeExt.id],
    );
  }
  if (activeEv) {
    evidenceItems = await ds.query(
      `SELECT ei.normalized_name, ei.evidence_level,
              ei.evidence_strength::float AS evidence_strength,
              ei.evidence_confidence::float AS evidence_confidence,
              ei.has_work_experience, ei.has_responsibility,
              ei.substantive_evidence_count, ei.explanation
         FROM organigrama.cv_evidence_evaluation_item ei
        WHERE ei.evaluation_id = $1
        ORDER BY ei.evidence_strength DESC NULLS LAST`,
      [activeEv.id],
    );
  }

  return {
    document,
    label,
    expected,
    person: p,
    activeCv,
    allCvsCount: cvs.length,
    activeExt,
    allExtractionsCount: extractions.length,
    activeEnr,
    allEnrichmentsCount: enrichments.length,
    activeEv,
    allEvidencesCount: evidences.length,
    chainAligned,
    action,
    skillsCount: skills.length,
    skills,
    evidenceItemsCount: evidenceItems.length,
    evidenceItems,
  };
}

/**
 * Reactiva person_cv inactivo solo si:
 * - documento autorizado MC1.9.2
 * - sin CV activo
 * - un único CV inactivo con drive_file_id
 * - extracción SUCCEEDED activa apunta a ese CV
 */
async function reactivateInactiveCvIfJustified(
  ds: DataSource,
  document: string,
): Promise<{ reactivated: boolean; cvId?: string; reason: string }> {
  const allowed = new Set(DOCUMENTS.map((d) => d.document));
  if (!allowed.has(document)) {
    return { reactivated: false, reason: 'DOCUMENT_NOT_AUTHORIZED' };
  }

  const personRows = await ds.query(
    `SELECT id::text FROM core.person WHERE document = $1`,
    [document],
  );
  if (personRows.length !== 1) {
    return { reactivated: false, reason: 'PERSON_NOT_UNIQUE' };
  }
  const personId = personRows[0].id as string;

  const cvs = await ds.query(
    `SELECT id::text, is_active, drive_file_id
       FROM organigrama.person_cv WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  );
  const active = cvs.filter((c: { is_active: boolean }) => c.is_active);
  const inactive = cvs.filter((c: { is_active: boolean }) => !c.is_active);
  if (active.length > 0) {
    return { reactivated: false, reason: 'ALREADY_HAS_ACTIVE_CV' };
  }
  if (inactive.length !== 1) {
    return {
      reactivated: false,
      reason: `INACTIVE_CV_COUNT_${inactive.length}`,
    };
  }
  const cv = inactive[0] as { id: string; drive_file_id: string | null };
  if (!cv.drive_file_id) {
    return { reactivated: false, reason: 'INACTIVE_CV_WITHOUT_DRIVE_FILE_ID' };
  }

  const ext = await ds.query(
    `SELECT id::text, person_cv_id::text
       FROM organigrama.cv_extraction
      WHERE person_id = $1 AND status = 'SUCCEEDED' AND is_active = TRUE
      LIMIT 1`,
    [personId],
  );
  if (ext.length !== 1 || String(ext[0].person_cv_id) !== String(cv.id)) {
    return {
      reactivated: false,
      reason: 'ACTIVE_EXTRACTION_NOT_LINKED_TO_INACTIVE_CV',
    };
  }

  const updated = await ds.query(
    `UPDATE organigrama.person_cv
        SET is_active = TRUE, synced_at = NOW()
      WHERE id = $1 AND is_active = FALSE AND drive_file_id IS NOT NULL
      RETURNING id::text`,
    [cv.id],
  );
  if (updated.length !== 1) {
    return { reactivated: false, reason: 'UPDATE_FAILED' };
  }

  return {
    reactivated: true,
    cvId: updated[0].id as string,
    reason:
      'MC1.9.2: extracción SUCCEEDED activa enlazada a person_cv inactivo con drive_file_id; reactivación para completar enrichment/evidence sin re-extraer',
  };
}

async function main() {
  const auditOnly = process.argv.includes('--audit-only');
  const reactivate = process.argv.includes('--reactivate-inactive-cv');
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const out = outArg?.slice('--out='.length) ?? 'tmp/mc192-hr-validation-audit.json';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  try {
    const reactivationLog: Array<{
      document: string;
      reactivated: boolean;
      cvId?: string;
      reason: string;
    }> = [];

    if (reactivate) {
      for (const d of DOCUMENTS) {
        const result = await reactivateInactiveCvIfJustified(ds, d.document);
        reactivationLog.push({ document: d.document, ...result });
        console.log(
          JSON.stringify({
            step: 'reactivate-inactive-cv',
            document: d.document,
            ...result,
          }),
        );
      }
    }

    const targets: Awaited<ReturnType<typeof auditOne>>[] = [];
    for (const d of DOCUMENTS) {
      targets.push(await auditOne(ds, d.document, d.expected, d.label));
    }
    const refs: Awaited<ReturnType<typeof auditOne>>[] = [];
    for (const d of REFS) {
      refs.push(await auditOne(ds, d.document, d.expected, d.label));
    }

    const report = {
      phase: 'MC1.9.2',
      mode: reactivate
        ? 'AUDIT_AFTER_REACTIVATE'
        : auditOnly
          ? 'AUDIT_ONLY'
          : 'AUDIT',
      generatedAt: new Date().toISOString(),
      reactivationLog,
      targets,
      refs,
      summary: {
        actions: Object.fromEntries(
          [...targets, ...refs].map((t) => [
            t.document,
            'action' in t && t.action ? t.action : 'ERROR',
          ]),
        ),
      },
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const path = resolve(process.cwd(), out);
    writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
    console.log(
      JSON.stringify(
        {
          out: path,
          table: targets.map((t) => ({
            document: t.document,
            label: t.label,
            person_id: 'person' in t && t.person ? t.person.id : null,
            cv: Boolean('activeCv' in t && t.activeCv),
            extraction: 'activeExt' in t && t.activeExt ? t.activeExt.id : null,
            enrichment: 'activeEnr' in t && t.activeEnr ? t.activeEnr.id : null,
            evidence: 'activeEv' in t && t.activeEv ? t.activeEv.id : null,
            action: 'action' in t ? t.action : 'ERROR',
          })),
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
