/**
 * MC1.10.1 — Diagnóstico RO del resumen profesional visible (Zuany / genérico).
 *
 * npm run mc:audit-zuany-summary
 * npm run mc:audit-zuany-summary -- --document=1000372715
 * npm run mc:audit-zuany-summary -- --document=1000372715 --repair  (no-op: repair es FE)
 *
 * Read-only por defecto. --repair documenta que la corrección es frontend
 * (trajectoryNarrative) y no muta BD.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.10.1]';
const UX_RE =
  /ux\/?ui|diseñador|diseñadora|diseño de interfaces|prototipado|prototip/i;

function parseArgs(argv: string[]): {
  document: string;
  repair: boolean;
  out: string;
} {
  let document = '1000372715';
  let repair = false;
  let out = 'tmp/mc1101-zuany-summary-audit.json';
  for (const a of argv) {
    if (a.startsWith('--document=')) document = a.slice('--document='.length);
    else if (a === '--repair') repair = true;
    else if (a.startsWith('--out=')) out = a.slice('--out='.length);
  }
  return { document, repair, out };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const ds = app.get(DataSource);
  const competencies = app.get(OrgChartCompetenciesService);

  try {
    const persons = await ds.query(
      `SELECT p.id::text, p.full_name, p.document, p.is_active, p.role_id::text,
              r.name AS role_name, a.name AS area_name
         FROM core.person p
         LEFT JOIN core.role r ON r.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
        WHERE p.document = $1`,
      [args.document],
    );
    if (persons.length !== 1) {
      throw new Error(
        persons.length === 0
          ? `Persona no encontrada: ${args.document}`
          : `Documento ambiguo: ${args.document}`,
      );
    }
    const person = persons[0] as {
      id: string;
      full_name: string;
      document: string;
      is_active: boolean;
      role_id: string | null;
      role_name: string | null;
      area_name: string | null;
    };
    const personId = person.id;

    const cvs = await ds.query(
      `SELECT id::text, is_active, drive_file_name, drive_file_id,
              drive_md5_checksum, synced_at, created_at
         FROM organigrama.person_cv WHERE person_id = $1 ORDER BY id DESC`,
      [personId],
    );
    const exts = await ds.query(
      `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256,
              skills_count, finished_at, prompt_version, extractor_version
         FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
      [personId],
    );
    const enrs = await ds.query(
      `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
              input_skills_count, output_skills_count, created_at
         FROM organigrama.cv_skill_enrichment
        WHERE person_id = $1 ORDER BY id DESC`,
      [personId],
    );
    const evs = await ds.query(
      `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active,
              strong_skills_count, moderate_skills_count, weak_skills_count,
              no_evidence_skills_count, created_at
         FROM organigrama.cv_evidence_evaluation
        WHERE person_id = $1 ORDER BY id DESC`,
      [personId],
    );
    const evals = await ds.query(
      `SELECT e.id::text, e.is_active, e.status, e.domain_code,
              e.default_specialty_code, e.active_count, e.emergent_count,
              e.hidden_count, e.extraction_id::text, e.enrichment_id::text,
              e.evidence_evaluation_id::text, e.engine_rules_version,
              e.mapping_pack_code, e.mapping_pack_version, e.source_hash,
              cv.version AS catalog_version, cv.is_active AS catalog_active,
              e.created_at, e.completed_at
         FROM organigrama.mc_profile_evaluation e
         JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
        WHERE e.person_id = $1
        ORDER BY e.id DESC`,
      [personId],
    );

    const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active);
    const activeExt = exts.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const activeEnr = enrs.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const activeEv = evs.find(
      (e: { is_active: boolean; status: string }) =>
        e.is_active && e.status === 'SUCCEEDED',
    );
    const activeEval = evals.find((e: { is_active: boolean }) => e.is_active);

    const chainAligned =
      Boolean(activeCv) &&
      Boolean(activeExt) &&
      Boolean(activeEnr) &&
      Boolean(activeEv) &&
      String(activeExt?.person_cv_id) === String(activeCv?.id) &&
      String(activeEnr?.extraction_id) === String(activeExt?.id) &&
      String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
      String(activeEv?.extraction_id) === String(activeExt?.id) &&
      (!activeEval ||
        (String(activeEval.extraction_id) === String(activeExt?.id) &&
          String(activeEval.enrichment_id) === String(activeEnr?.id) &&
          String(activeEval.evidence_evaluation_id) === String(activeEv?.id)));

    let uxSkills: unknown[] = [];
    if (activeExt) {
      uxSkills = await ds.query(
        `SELECT s.normalized_key, s.normalized_name, s.skill_type
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.cv_skill s ON s.id = ces.skill_id
          WHERE ces.extraction_id = $1
            AND (
              s.normalized_name ~* '(^|[^a-z])(ux|ui|ux/ui)([^a-z]|$)'
              OR s.normalized_name ~* 'diseñ|figma|prototip|interfaz'
              OR s.normalized_key ~* '(^|_)(ux|ui|diseno|figma|prototip|interfaz)(_|$)'
            )
          ORDER BY s.normalized_key`,
        [activeExt.id],
      );
    }

    const viewer: OrgViewerContext = {
      personId,
      eduEmail: 'mc1101@local',
      permissions: ['ORG_READ_ALL'],
    };
    const summary = await competencies.getExplorerSummary(viewer, personId, '0', {
      includeHidden: false,
      includeAudit: true,
    });

    const uxHits: Array<Record<string, unknown>> = [];
    if (person.role_name && UX_RE.test(person.role_name)) {
      uxHits.push({
        text: person.role_name,
        tableOrFile: 'core.role (via core.person.role_id)',
        recordId: person.role_id,
        field: 'role.name',
        version: 'organizacional vigente',
        consumedBy:
          'GET /api/org-chart/person/:id/competencies → person.role → FE buildTrajectoryNarrative',
      });
    }
    for (const s of uxSkills as Array<{
      normalized_key: string;
      normalized_name: string;
    }>) {
      uxHits.push({
        text: s.normalized_name,
        tableOrFile: 'organigrama.cv_skill + cv_extraction_skill',
        recordId: activeExt?.id,
        field: 'normalized_name',
        skillKey: s.normalized_key,
        consumedBy: 'enrichment / evidence / PA2 (complementario si aplica)',
      });
    }

    const domain = summary.domains?.[0];
    const report = {
      phase: 'MC1.10.1',
      mode: args.repair ? 'AUDIT_WITH_REPAIR_NOTE' : 'AUDIT_READONLY',
      generatedAt: new Date().toISOString(),
      document: args.document,
      person,
      layers: {
        cv: {
          activeId: activeCv?.id ?? null,
          dependsOn: 'Drive sync',
          sourceHash: activeCv?.drive_md5_checksum ?? null,
          professionalSummary: null,
          consistent: Boolean(activeCv),
        },
        extraction: {
          activeId: activeExt?.id ?? null,
          dependsOn: activeCv?.id ?? null,
          sourceHash: activeExt?.pdf_sha256 ?? null,
          professionalSummary: null,
          consistent:
            Boolean(activeExt) &&
            String(activeExt?.person_cv_id) === String(activeCv?.id),
        },
        enrichment: {
          activeId: activeEnr?.id ?? null,
          dependsOn: activeExt?.id ?? null,
          sourceHash: activeEnr?.pdf_sha256 ?? null,
          professionalSummary: null,
          consistent:
            Boolean(activeEnr) &&
            String(activeEnr?.extraction_id) === String(activeExt?.id),
        },
        evidence: {
          activeId: activeEv?.id ?? null,
          dependsOn: activeEnr?.id ?? null,
          sourceHash: null,
          professionalSummary: null,
          consistent:
            Boolean(activeEv) &&
            String(activeEv?.enrichment_id) === String(activeEnr?.id),
        },
        evaluation: {
          activeId: activeEval?.id ?? null,
          dependsOn: `${activeExt?.id}/${activeEnr?.id}/${activeEv?.id}`,
          sourceHash: activeEval?.source_hash ?? null,
          professionalSummary: `${activeEval?.domain_code}/${activeEval?.default_specialty_code}`,
          consistent: chainAligned,
        },
      },
      chainAligned,
      uxTextHits: uxHits,
      api: {
        availabilityStatus: summary.availabilityStatus,
        personRoleFromCore: summary.person?.role,
        evaluationId: summary.evaluation?.id ?? null,
        domainCode: domain?.code ?? null,
        defaultSpecialty: domain?.defaultSpecialtyCode ?? null,
        specialties: (domain?.specialties ?? []).map((s) => ({
          code: s.code,
          status: s.presentationStatus,
          isDefault: s.isDefault,
        })),
        audit: summary.evaluation?.audit ?? null,
      },
      rootCause: {
        case: 'D+E',
        summary:
          'El texto UX/UI visible en Competencias provenía del cargo Core (person.role) ' +
          'consumido por FE buildTrajectoryNarrative, que inventaba “trayectoria hacia Diseño de Interfaces” ' +
          'cuando el dominio MC1 era Software. La cadena MC1 (ext/enr/ev/eval) estaba alineada a Software.',
        frontendFile:
          'Organigrama_Frontend/src/features/competencies/utils/trajectoryNarrative.ts',
        repair:
          'Restringir narrativa cargo↔especialidad a dominio VISUAL_DESIGN; no usar cargo Core como identidad MC1 en Software/AV.',
      },
      repairAppliedNote: args.repair
        ? 'Corrección aplicada en frontend (trajectoryNarrative). No muta BD ni evaluation_id.'
        : 'Modo RO. Use --repair solo como nota; la reparación es de código FE.',
      joseCheckHint: '1010247929 debe permanecer NOT_EVALUATED (fuera de alcance de mutación).',
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const outPath = resolve(process.cwd(), args.out);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${TAG} artefacto=${outPath}`);
    console.log(
      JSON.stringify(
        {
          personId,
          roleCore: person.role_name,
          chainAligned,
          activeChain: {
            cv: activeCv?.id,
            ext: activeExt?.id,
            enr: activeEnr?.id,
            ev: activeEv?.id,
            eval: activeEval?.id,
          },
          uxHits: uxHits.map((h) => ({
            text: h.text,
            source: h.tableOrFile,
          })),
          apiDomain: domain?.code,
          apiDefault: domain?.defaultSpecialtyCode,
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
  console.error(TAG, e instanceof Error ? e.message : e);
  process.exit(1);
});
