/**
 * MC1 — Auditoría de capas C2 (extracción → evidence → MVP → API shape).
 * Solo lectura. Guarda artefactos en browser-verification/.
 *
 * npm run build && node dist/database/scripts/mc-school-coordinators-browser-audit.js
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import { buildMvpProfessionalCapabilities } from '../../org-chart/mc-mvp-capability-projection';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';

const TAG = '[MC1 School C2 browser audit]';
const ROOT = resolve('tmp/mc1-school-coordinators-mvp/browser-verification');

const COHORT = [
  {
    key: 'viviana',
    document: '1117526801',
    personId: '601',
    extractionId: '231',
    fullName: 'VIVIANA ANDREA CABRERA CABRERA',
  },
  {
    key: 'maira',
    document: '1023935373',
    personId: '1078',
    extractionId: '232',
    fullName: 'MAIRA ALEJANDRA DONCEL LARGO',
  },
  {
    key: 'andres',
    document: '1020720408',
    personId: '1079',
    extractionId: '234',
    fullName: 'ANDRES FELIPE PRIETO LIZARAZO',
  },
  {
    key: 'carlos',
    document: '1010174410',
    personId: '1080',
    extractionId: '233',
    fullName: 'CARLOS ANDRES RODRIGUEZ',
  },
  {
    key: 'aura',
    document: '1042448655',
    personId: '1297',
    extractionId: '235',
    fullName: 'AURA MARCELA ROYERO VERGARA',
  },
] as const;

function writeJson(path: string, data: unknown): void {
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function main(): Promise<void> {
  mkdirSync(resolve(ROOT, 'api-responses'), { recursive: true });
  mkdirSync(resolve(ROOT, 'screenshots'), { recursive: true });
  mkdirSync(resolve(ROOT, 'responsive'), { recursive: true });

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const competencies = app.get(OrgChartCompetenciesService);

  const version = (
    await ds.query(
      `SELECT id::text FROM organigrama.org_chart_version WHERE is_active = TRUE LIMIT 1`,
    )
  )[0]?.id;
  if (!version) throw new Error('Sin versión activa');

  // Viewer con lectura amplia (mismo email del e2e creativo).
  const viewerPerson = await ds.query(
    `SELECT id::text AS id FROM core.person
      WHERE lower(edu_email) = lower($1)
      LIMIT 1`,
    ['desarrollofabrica@cun.edu.co'],
  );
  const viewer: OrgViewerContext = {
    personId: String(viewerPerson[0]?.id || '1229'),
    eduEmail: 'desarrollofabrica@cun.edu.co',
    permissions: ['ORG_READ_ALL'],
  };

  const lossRows: Array<Record<string, unknown>> = [];
  const renderComparison: Array<Record<string, unknown>> = [];
  const layerSummary: Array<Record<string, unknown>> = [];

  for (const person of COHORT) {
    const skills = await ds.query(
      `SELECT ces.id::text AS extraction_skill_id,
              s.normalized_name, s.normalized_key, s.skill_type,
              ces.original_name, ces.evidence AS evidence_text,
              ces.evidence_items,
              ei.evidence_level, ei.has_work_experience,
              ei.substantive_evidence_count
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
         LEFT JOIN organigrama.cv_evidence_evaluation ev
           ON ev.extraction_id = ces.extraction_id
          AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
         LEFT JOIN organigrama.cv_evidence_evaluation_item ei
           ON ei.evaluation_id = ev.id AND ei.extraction_skill_id = ces.id
        WHERE ces.extraction_id = $1
        ORDER BY ces.sort_order ASC`,
      [person.extractionId],
    );

    const evidenced = skills.filter(
      (s: { evidence_level: string | null }) =>
        s.evidence_level === 'STRONG' || s.evidence_level === 'MODERATE',
    );
    const toolsExtracted = skills.filter((s: { skill_type: string }) =>
      /tool|herramienta/i.test(String(s.skill_type || '')),
    );
    const methodologiesExtracted = skills.filter((s: { skill_type: string }) =>
      /methodolog|metodolog/i.test(String(s.skill_type || '')),
    );

    const mvp = buildMvpProfessionalCapabilities(
      skills.map((r: Record<string, unknown>) => ({
        normalizedName: String(r.normalized_name ?? ''),
        originalName: r.original_name ? String(r.original_name) : null,
        skillType: r.skill_type ? String(r.skill_type) : null,
        evidenceLevel: r.evidence_level ? String(r.evidence_level) : null,
        hasWorkExperience:
          r.has_work_experience == null
            ? null
            : Boolean(r.has_work_experience),
        substantiveCount:
          r.substantive_evidence_count == null
            ? null
            : Number(r.substantive_evidence_count),
        evidenceText: r.evidence_text ? String(r.evidence_text) : null,
        evidenceItems:
          (r.evidence_items as Array<{
            sourceType?: string;
            evidenceText?: string;
          }> | null) ?? null,
      })),
    );

    let apiProfile: Awaited<
      ReturnType<OrgChartCompetenciesService['getProfessionalProfile']>
    > | null = null;
    let apiError: string | null = null;
    try {
      apiProfile = await competencies.getProfessionalProfile(
        viewer,
        person.personId,
        version,
        { includeAudit: true },
      );
    } catch (err) {
      apiError = err instanceof Error ? err.message : String(err);
    }

    const apiMvp = apiProfile?.mvpCapabilities ?? null;
    const apiPayload = {
      personId: person.personId,
      document: person.document,
      extractionId: apiProfile?.extractionId ?? person.extractionId,
      availabilityStatus: apiProfile?.availabilityStatus ?? null,
      defaultDomainCode: apiProfile?.defaultDomainCode ?? null,
      evaluatedDomains: (apiProfile?.evaluatedDomains ?? []).map((d) => ({
        code: d.code,
        name: d.name,
        qualification: d.qualification,
        specialties: d.specialties.map((s) => ({
          code: s.code,
          name: s.name,
          presentationStatus: s.presentationStatus,
        })),
      })),
      mvpCapabilities: apiMvp
        ? {
            classificationPending: apiMvp.classificationPending,
            consolidated: apiMvp.consolidatedCapabilities.map((c) => ({
              label: c.label,
              evidenceLevel: c.evidenceLevel,
              code: c.code,
            })),
            complementary: apiMvp.complementaryCapabilities.map((c) => ({
              label: c.label,
              evidenceLevel: c.evidenceLevel,
              code: c.code,
            })),
            emerging: apiMvp.emergingCapabilities.map((c) => ({
              label: c.label,
              evidenceLevel: c.evidenceLevel,
            })),
            tools: apiMvp.tools.map((t) => t.label),
            methodologies: apiMvp.methodologies.map((t) => t.label),
            qualityAlerts: apiMvp.qualityAlerts,
          }
        : null,
      warnings: apiProfile?.warnings ?? [],
      apiError,
    };
    writeJson(
      resolve(ROOT, 'api-responses', `${person.document}.json`),
      apiPayload,
    );

    // Clasificar pérdidas skill → visible pipeline
    const publishedLabels = new Set(
      [
        ...(apiMvp?.consolidatedCapabilities ?? []).map((c) => c.label),
        ...(apiMvp?.complementaryCapabilities ?? []).map((c) => c.label),
        ...(apiMvp?.emergingCapabilities ?? []).map((c) => c.label),
        ...(apiMvp?.tools ?? []).map((t) => t.label),
        ...(apiMvp?.methodologies ?? []).map((t) => t.label),
      ].map((x) => x.toLowerCase()),
    );

    for (const s of skills as Array<Record<string, unknown>>) {
      const original = String(s.original_name || s.normalized_name || '');
      const skillType = String(s.skill_type || '');
      const level = String(s.evidence_level || '');
      const isTool = /tool|herramienta/i.test(skillType);
      const isMethod = /methodolog|metodolog/i.test(skillType);
      const inPublished =
        publishedLabels.has(original.toLowerCase()) ||
        [...publishedLabels].some(
          (p) =>
            original.toLowerCase().includes(p) ||
            p.includes(String(s.normalized_name || '').toLowerCase()),
        );

      let classification = 'EXPECTED_NON_PROFESSIONAL_SIGNAL';
      let lastLayer = 'EXTRACTION';
      let justification = 'Señal extraída sin clasificación automática fina';

      if (isTool || isMethod) {
        classification = 'EXPECTED_TOOL_SEPARATION';
        lastLayer = inPublished ? 'API' : 'MVP_PROJECTION';
        justification = 'Herramienta/metodología separada de competencias';
      } else if (level === 'STRONG' || level === 'MODERATE') {
        lastLayer = 'EVIDENCE';
        if (inPublished) {
          lastLayer = 'API';
          classification = 'EXPECTED_DUPLICATE_COLLAPSE';
          justification =
            'Evidencia aceptada; puede estar consolidada en capacidad canónica';
        } else {
          classification = 'MVP_PROJECTION_GAP';
          justification =
            'Tiene evidence STRONG/MODERATE pero no aparece como capacidad MVP independiente';
        }
      } else if (level === 'WEAK' || level === 'NONE' || !level) {
        classification = 'EXPECTED_INSUFFICIENT_EVIDENCE';
        lastLayer = level ? 'EVIDENCE' : 'EVIDENCE';
        justification = 'Evidence insuficiente o ausente para publicar';
      }

      lossRows.push({
        signal: original,
        personKey: person.key,
        document: person.document,
        skillType,
        evidenceLevel: level || null,
        lastLayerReached: lastLayer,
        classification,
        justification,
      });
    }

    const apiCounts = {
      consolidated: apiMvp?.consolidatedCapabilities.length ?? 0,
      complementary: apiMvp?.complementaryCapabilities.length ?? 0,
      emerging: apiMvp?.emergingCapabilities.length ?? 0,
      tools: apiMvp?.tools.length ?? 0,
      methodologies: apiMvp?.methodologies.length ?? 0,
    };

    layerSummary.push({
      document: person.document,
      personKey: person.key,
      extractionId: person.extractionId,
      extractedSkills: skills.length,
      evidencedStrongOrModerate: evidenced.length,
      toolsExtracted: toolsExtracted.length,
      methodologiesExtracted: methodologiesExtracted.length,
      mvp: {
        consolidated: mvp.consolidatedCapabilities.length,
        complementary: mvp.complementaryCapabilities.length,
        emerging: mvp.emergingCapabilities.length,
        tools: mvp.tools.length,
        methodologies: mvp.methodologies.length,
      },
      api: apiCounts,
      mvpMatchesApi:
        mvp.consolidatedCapabilities.length === apiCounts.consolidated &&
        mvp.complementaryCapabilities.length === apiCounts.complementary &&
        mvp.tools.length === apiCounts.tools,
      domains: (apiProfile?.evaluatedDomains ?? []).map((d) => ({
        code: d.code,
        qualification: d.qualification,
      })),
      classificationPending: apiMvp?.classificationPending ?? null,
      technicalCodesInLabels: [
        ...(apiMvp?.consolidatedCapabilities ?? []),
        ...(apiMvp?.complementaryCapabilities ?? []),
      ]
        .filter((c) => /^[A-Z0-9_]+$/.test(c.label) || c.label === c.code)
        .map((c) => c.label),
    });

    renderComparison.push({
      document: person.document,
      personKey: person.key,
      api: apiCounts,
      visible: null, // rellenado por Playwright
      deltaNote:
        'visible se completa tras e2e browser; si null, auditoría API/capa lista',
    });
  }

  // Diagnósticos especiales Maira / Aura
  const maira = layerSummary.find((r) => r.personKey === 'maira');
  const aura = layerSummary.find((r) => r.personKey === 'aura');
  const mairaLoss = lossRows.filter((r) => r.personKey === 'maira');
  const auraLoss = lossRows.filter((r) => r.personKey === 'aura');

  writeJson(resolve(ROOT, 'capability-loss-analysis.json'), {
    generatedAt: new Date().toISOString(),
    writes: 0,
    layerSummary,
    lossRows,
    special: {
      maira: {
        extracted: maira?.extractedSkills,
        evidenced: maira?.evidencedStrongOrModerate,
        publishedCaps:
          ((maira?.api as { consolidated: number; complementary: number })
            ?.consolidated ?? 0) +
          ((maira?.api as { complementary: number })?.complementary ?? 0),
        diagnosis:
          'Revisar si descarte es EXPECTED_INSUFFICIENT_EVIDENCE vs NORMALIZATION_GAP',
        topLossClasses: countBy(mairaLoss, 'classification'),
      },
      aura: {
        extracted: aura?.extractedSkills,
        evidenced: aura?.evidencedStrongOrModerate,
        toolsApi: (aura?.api as { tools: number })?.tools,
        capsApi:
          ((aura?.api as { consolidated: number })?.consolidated ?? 0) +
          ((aura?.api as { complementary: number })?.complementary ?? 0),
        diagnosis:
          'Muchas herramientas vs pocas capacidades: probablemente EXPECTED_TOOL_SEPARATION + evidence débil en soft skills',
        topLossClasses: countBy(auraLoss, 'classification'),
      },
    },
  });

  writeJson(resolve(ROOT, 'render-comparison.json'), {
    generatedAt: new Date().toISOString(),
    note: 'API vs visible (visible vía Playwright)',
    rows: renderComparison,
  });

  writeJson(resolve(ROOT, 'console-report.json'), {
    generatedAt: new Date().toISOString(),
    env: {
      backend: 'http://localhost:3000',
      frontend: 'http://localhost:5173',
      dbHostFromHealth: 'see /api/health/live',
      mocks: false,
    },
    people: COHORT.map((p) => ({
      document: p.document,
      consoleErrors: null,
      networkErrors: null,
      renderWarnings: null,
      result: 'PENDING_BROWSER',
    })),
  });

  console.log(`${TAG} layer summary`);
  for (const row of layerSummary) {
    console.log(
      `  ${row.document} extracted=${row.extractedSkills} evidenced=${row.evidencedStrongOrModerate} api=${JSON.stringify(row.api)} domains=${JSON.stringify(row.domains)}`,
    );
  }
  console.log(`${TAG} artifacts → ${ROOT}`);
  await app.close();
}

function countBy(
  rows: Array<Record<string, unknown>>,
  key: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const k = String(r[key] || 'UNKNOWN');
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

main().catch((err) => {
  console.error(TAG, err);
  process.exitCode = 1;
});
