/**
 * MC1.6.1C — auditoría RO de candidatos hermanos Diseño Visual.
 * Sin writes.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const CANDIDATES = [
  { label: 'Nidia (semilla)', document: '1015482688' },
  { label: 'Juan Pablo', document: '1022445625' },
  { label: 'Angulo', document: '1193092980' },
  { label: 'Garzón', document: '1030646495' },
  { label: 'Correa', document: '1002460888' },
  { label: 'Poveda', document: '1000254881' },
  { label: 'Herrera', document: '1031167800' },
  { label: 'Castro', document: '1000622424' },
  // Fronteras reportadas (evidencia, no jerarquía)
  { label: 'Camacho Cobos (UX/UI)', document: '1010247929' },
  { label: 'Acuña Vélez (UX/UI)', document: '1000372715' },
  { label: 'Garzón Ortiz (Integral IA)', document: '80802023' },
];

const BORDER_NAMES = ['%CAMACHO%', '%ACUNA%', '%ACUÑA%', '%GARZON%ORTIZ%', '%GARZÓN%ORTIZ%'];

async function auditPerson(ds: DataSource, document: string, label: string): Promise<Record<string, unknown>> {
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
      error: persons.length === 0 ? 'PERSON_NOT_FOUND' : 'PERSON_AMBIGUOUS',
      count: persons.length,
    };
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
    `SELECT id::text, is_active, drive_file_name, drive_md5_checksum, synced_at
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [personId],
  );
  const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;

  const extractions = await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
            skills_count, finished_at
       FROM organigrama.cv_extraction WHERE person_id = $1
      ORDER BY id DESC`,
    [personId],
  );
  const activeExt =
    extractions.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const enrichments = await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
            input_skills_count, output_skills_count
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1
      ORDER BY id DESC`,
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
      ORDER BY id DESC`,
    [personId],
  );
  const activeEv =
    evidences.find(
      (e: { status: string; is_active: boolean }) =>
        e.status === 'SUCCEEDED' && e.is_active,
    ) ?? null;

  const evals = await ds.query(
    `SELECT id::text, domain_code, is_active, status, engine_rules_version,
            default_specialty_code, mapping_pack_version, source_hash
       FROM organigrama.mc_profile_evaluation WHERE person_id = $1
      ORDER BY id`,
    [personId],
  );

  const chainOk =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnr) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnr?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
    String(activeEv?.extraction_id) === String(activeExt?.id) &&
    String(activeEnr?.pdf_sha256).toLowerCase() ===
      String(activeExt?.pdf_sha256).toLowerCase();

  let skills: unknown[] = [];
  let extractionOnlySkills: unknown[] = [];
  if (activeExt && activeEv) {
    skills = await ds.query(
      `SELECT ces.id::text AS extraction_skill_id,
              s.id::text AS skill_id,
              s.normalized_key, s.normalized_name, s.skill_type,
              ces.category,
              ces.confidence AS extraction_confidence,
              ei.evidence_level,
              ei.evidence_strength::float AS strength,
              ei.evidence_confidence::float AS evidence_confidence
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
         LEFT JOIN organigrama.cv_evidence_evaluation_item ei
           ON ei.evaluation_id = $2
          AND ei.extraction_skill_id = ces.id
        WHERE ces.extraction_id = $1
        ORDER BY s.skill_type, s.normalized_name`,
      [activeExt.id, activeEv.id],
    );
  } else if (activeExt) {
    // Solo extracción: útil para priorizar enrichment/evidence, NO para PA2.
    extractionOnlySkills = await ds.query(
      `SELECT ces.id::text AS extraction_skill_id,
              s.id::text AS skill_id,
              s.normalized_key, s.normalized_name, s.skill_type,
              ces.category,
              ces.confidence AS extraction_confidence
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
        WHERE ces.extraction_id = $1
        ORDER BY s.skill_type, s.normalized_name`,
      [activeExt.id],
    );
  }

  return {
    label,
    document,
    person,
    boss,
    activeCv,
    activeExt: activeExt
      ? {
          id: activeExt.id,
          person_cv_id: activeExt.person_cv_id,
          status: activeExt.status,
          is_active: activeExt.is_active,
          pdf_sha256: activeExt.pdf_sha256,
          skills_count: activeExt.skills_count,
        }
      : null,
    activeEnr,
    activeEv,
    evals,
    chainOk,
    viableCandidate: person.is_active === true && chainOk,
    skills,
    skillCount: skills.length,
    extractionOnlySkills,
    extractionOnlySkillCount: extractionOnlySkills.length,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const audited: Array<Record<string, unknown>> = [];
  for (const c of CANDIDATES) {
    audited.push(await auditPerson(ds, c.document, c.label));
  }

  const borderPeople = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, p.is_active, ro.name AS role_name, a.name AS area_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
      WHERE p.full_name ILIKE ANY($1::text[])
      ORDER BY p.full_name
      LIMIT 40`,
    [BORDER_NAMES],
  );

  // Nidia siblings under same boss in v4 (sample context, not membership proof)
  const nidiaBossChildren = await ds.query(
    `SELECT child.id::text, child.full_name, child.document, ro.name AS role_name
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation rn
         ON rn.version_id = v.id AND rn.is_active AND rn.child_person_id = 1163
       JOIN organigrama.org_visual_relation r
         ON r.version_id = v.id AND r.is_active
        AND r.parent_person_id = rn.parent_person_id
       JOIN core.person child ON child.id = r.child_person_id
       LEFT JOIN core.role ro ON ro.id = child.role_id
      WHERE v.is_active = TRUE
      ORDER BY child.full_name`,
  );

  // Quién más tiene cadena completa con rol de diseño / contenido / AV / UX
  const completeChains = await ds.query(
    `SELECT p.id::text, p.full_name, p.document, ro.name AS role_name,
            cv.id::text AS cv_id, e.id::text AS ext_id,
            en.id::text AS enr_id, ev.id::text AS ev_id
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       JOIN organigrama.person_cv cv
         ON cv.person_id = p.id AND cv.is_active = TRUE
       JOIN organigrama.cv_extraction e
         ON e.person_id = p.id AND e.is_active = TRUE AND e.status = 'SUCCEEDED'
        AND e.person_cv_id = cv.id
       JOIN organigrama.cv_skill_enrichment en
         ON en.person_id = p.id AND en.is_active = TRUE AND en.status = 'SUCCEEDED'
        AND en.extraction_id = e.id
       JOIN organigrama.cv_evidence_evaluation ev
         ON ev.person_id = p.id AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
        AND ev.enrichment_id = en.id AND ev.extraction_id = e.id
      WHERE p.is_active = TRUE
        AND (
          ro.name ILIKE '%DISE%'
          OR ro.name ILIKE '%UX%'
          OR ro.name ILIKE '%AUDIO%'
          OR ro.name ILIKE '%CONTENIDO%'
          OR ro.name ILIKE '%PRESENTADOR%'
          OR ro.name ILIKE '%REALIZADOR%'
        )
      ORDER BY p.full_name`,
  );

  const summary = audited.map((a: any) => ({
    label: a.label,
    document: a.document,
    person_id: a.person?.id ?? null,
    name: a.person?.full_name ?? null,
    role: a.person?.role_name ?? null,
    area: a.person?.area_name ?? null,
    active: a.person?.is_active ?? null,
    cv: a.activeCv?.id ?? null,
    extraction: a.activeExt?.id ?? null,
    enrichment: a.activeEnr?.id ?? null,
    evidence: a.activeEv?.id ?? null,
    chainOk: a.chainOk ?? false,
    viable: a.viableCandidate ?? false,
    priorEval: (a.evals ?? [])
      .filter((e: any) => e.is_active)
      .map((e: any) => `${e.domain_code}#${e.id}`)
      .join(',') || null,
    skillCount: a.skillCount ?? 0,
    extractionOnlySkillCount: a.extractionOnlySkillCount ?? 0,
    error: a.error ?? null,
  }));

  const out = {
    phase: 'MC1.6.1C-candidate-audit',
    generatedAt: new Date().toISOString(),
    summary,
    borderPeople,
    nidiaBossChildren,
    completeChainsDesignish: completeChains,
    profiles: audited,
  };

  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161c-candidate-audit.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        wrote: path,
        summary,
        completeChainsDesignish: completeChains,
        borderPeopleCount: borderPeople.length,
        nidiaBossChildrenCount: nidiaBossChildren.length,
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
