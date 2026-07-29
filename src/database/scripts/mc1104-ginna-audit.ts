/**
 * MC1.10.4 — Auditoría Ginna Marcela Garzón Toledo (1030646495).
 * Solo dry-run PA2; sin persistencia.
 *
 * npm run mc:audit-ginna
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import type { McPa2EngineRunResult } from '../../mc-catalog/mc-pa2.types';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.10.4]';
const GINNA_DOCUMENT = '1030646495';

const DOMAIN_RULES: ReadonlyArray<{ domainCode: string; rulesVersion: string }> =
  [
    { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
    {
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      rulesVersion: 'pa2-audiovisual-production-1.0.0',
    },
    { domainCode: 'SOFTWARE', rulesVersion: 'pa2-software-1.1.0' },
  ];

const VISUAL_TERMS = [
  'diseno grafico',
  'diseno editorial',
  'identidad visual',
  'identidad de marca',
  'branding',
  'diagramacion',
  'piezas graficas',
  'ilustracion',
  'maquetacion',
  'diseno de piezas',
  'manual de marca',
  'pieza grafica',
  'diseno de contenidos',
  'diseno visual',
];

const AV_TERMS = [
  'edicion de video',
  'edicion audiovisual',
  'motion graphics',
  'motion design',
  'postproduccion',
  'post produccion',
  'animacion 2d',
  'animacion 3d',
  'montaje audiovisual',
  'montaje de video',
  'color grading',
  'correccion de color',
  'realizador audiovisual',
  'realizacion audiovisual',
  'produccion audiovisual',
  'produccion de video',
];

const TOOL_TERMS = [
  'photoshop',
  'canva',
  'adobe premiere',
  'premiere pro',
  'after effects',
  'adobe illustrator',
  'illustrator',
  'indesign',
  'figma',
  'final cut',
  'davinci resolve',
  'lightroom',
];

type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

type DomainConceptualClass =
  | 'PRIMARY_MATCH'
  | 'SECONDARY_SIGNAL'
  | 'OUTSIDE'
  | 'INSUFFICIENT_EVIDENCE';

type ProfessionalReadingClass =
  | 'VISUAL_SPECIALIST'
  | 'AUDIOVISUAL_SPECIALIST'
  | 'VISUAL_AUDIOVISUAL_HYBRID'
  | 'GENERALIST_CREATIVE'
  | 'PROFESSIONAL_TRANSITION'
  | 'INSUFFICIENT_EVIDENCE';

type NotPrimaryCause = 'REAL_OUTSIDE_OR_SECONDARY' | 'MAPPING_GAP' | null;

type PolicyCase = 'CASO_A' | 'CASO_B' | 'CASO_C' | 'CASO_D';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function termMatches(text: string, term: string): boolean {
  const n = normalize(text);
  const nt = normalize(term);
  if (nt.includes(' ')) {
    return n.includes(nt);
  }
  const escaped = nt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(n);
}

function matchTerms(text: string, terms: readonly string[]): string[] {
  return terms.filter((t) => termMatches(text, t));
}

function isProfessionalEvidenceType(skillType: string): boolean {
  return skillType === 'PROFESSIONAL_KNOWLEDGE' || skillType === 'METHOD';
}

function classifyQualityTier(summary: {
  professionalStrong: number;
  professionalModerate: number;
}): QualityTier {
  const profModerateStrong =
    summary.professionalStrong + summary.professionalModerate;

  if (summary.professionalStrong === 0 && summary.professionalModerate === 0) {
    return 'INSUFFICIENT';
  }
  if (profModerateStrong < 1) {
    return 'INSUFFICIENT';
  }
  if (summary.professionalStrong >= 1 || summary.professionalModerate >= 6) {
    return 'HIGH';
  }
  if (summary.professionalModerate >= 3 || profModerateStrong >= 4) {
    return 'MEDIUM';
  }
  return 'LOW';
}

function classifyDomainConceptually(
  result: McPa2EngineRunResult,
  qualityTier: QualityTier,
): DomainConceptualClass {
  if (qualityTier === 'INSUFFICIENT') {
    return 'INSUFFICIENT_EVIDENCE';
  }
  if (result.activeCount >= 1) {
    return 'PRIMARY_MATCH';
  }
  const emergentWithProfessional = result.specialtyResults.filter(
    (r) => r.presentationStatus === 'EMERGENT' && r.professionalContribution > 0,
  );
  if (result.emergentCount >= 1 && emergentWithProfessional.length > 0) {
    return 'SECONDARY_SIGNAL';
  }
  if (result.emergentCount >= 1 && result.activeCount === 0) {
    return 'SECONDARY_SIGNAL';
  }
  return 'OUTSIDE';
}

function classifyProfessionalReading(input: {
  qualityTier: QualityTier;
  visualSignals: string[];
  avSignals: string[];
  toolSignals: string[];
  roleName: string | null;
  visualClass: DomainConceptualClass;
  avClass: DomainConceptualClass;
}): ProfessionalReadingClass {
  if (input.qualityTier === 'INSUFFICIENT') {
    return 'INSUFFICIENT_EVIDENCE';
  }

  const hasVisual =
    input.visualSignals.length > 0 ||
    input.visualClass === 'PRIMARY_MATCH' ||
    input.visualClass === 'SECONDARY_SIGNAL';
  const hasAv =
    input.avSignals.length > 0 ||
    input.avClass === 'PRIMARY_MATCH' ||
    input.avClass === 'SECONDARY_SIGNAL';

  const role = normalize(input.roleName ?? '');
  const isTransition =
    role.includes('analista') &&
    (role.includes('diseno') || role.includes('contenido'));

  if (hasVisual && hasAv) {
    return 'VISUAL_AUDIOVISUAL_HYBRID';
  }
  if (hasVisual && input.visualClass === 'PRIMARY_MATCH') {
    return 'VISUAL_SPECIALIST';
  }
  if (hasAv && input.avClass === 'PRIMARY_MATCH') {
    return 'AUDIOVISUAL_SPECIALIST';
  }
  if (hasVisual && !hasAv) {
    return isTransition ? 'PROFESSIONAL_TRANSITION' : 'VISUAL_SPECIALIST';
  }
  if (hasAv && !hasVisual) {
    return 'AUDIOVISUAL_SPECIALIST';
  }
  if (input.toolSignals.length > 0 && !hasVisual && !hasAv) {
    return 'GENERALIST_CREATIVE';
  }
  if (isTransition) {
    return 'PROFESSIONAL_TRANSITION';
  }
  return 'GENERALIST_CREATIVE';
}

function explainNotPrimary(input: {
  domainClass: DomainConceptualClass;
  qualityTier: QualityTier;
  visualSignals: string[];
  avSignals: string[];
  result: McPa2EngineRunResult;
}): { cause: NotPrimaryCause; explanation: string | null } {
  if (input.domainClass === 'PRIMARY_MATCH') {
    return { cause: null, explanation: null };
  }

  const strongProfessionalUnmapped = input.result.specialtyResults.some(
    (r) =>
      r.presentationStatus !== 'ACTIVE' &&
      r.professionalContribution >= 0.15 &&
      r.professionalEvidencedCount >= 2,
  );

  const hasStrongVisualCorpus =
    input.visualSignals.length >= 2 || input.avSignals.length >= 2;

  if (
    (input.domainClass === 'SECONDARY_SIGNAL' ||
      input.domainClass === 'OUTSIDE') &&
    hasStrongVisualCorpus &&
    strongProfessionalUnmapped &&
    input.qualityTier !== 'INSUFFICIENT'
  ) {
    return {
      cause: 'MAPPING_GAP',
      explanation:
        'Evidencia profesional moderada/fuerte en corpus pero PA2 no alcanza ACTIVE; posible vocabulario no mapeado.',
    };
  }

  return {
    cause: 'REAL_OUTSIDE_OR_SECONDARY',
    explanation:
      input.domainClass === 'INSUFFICIENT_EVIDENCE'
        ? 'Evidencia profesional insuficiente para activar especialidad.'
        : input.domainClass === 'SECONDARY_SIGNAL'
          ? 'Señales EMERGENT sin umbral ACTIVE; perfil secundario al dominio.'
          : 'Sin cobertura PA2 suficiente; perfil fuera del dominio evaluado.',
  };
}

function recommendPolicyCase(input: {
  staleCatalog: boolean;
  visualClass: DomainConceptualClass;
  avClass: DomainConceptualClass;
  notPrimaryCause: NotPrimaryCause;
  apiStale: boolean;
}): { case: PolicyCase; rationale: string } {
  if (input.staleCatalog && input.apiStale) {
    return {
      case: 'CASO_B',
      rationale:
        'Evaluación activa en catálogo inactivo → API STALE; requiere dry-run bajo catálogo vigente antes de persistir.',
    };
  }
  if (input.notPrimaryCause === 'MAPPING_GAP') {
    return {
      case: 'CASO_C',
      rationale:
        'Evidencia profesional fuerte no reconocida por mappings PA2; revisar pack antes de forzar persistencia.',
    };
  }
  if (
    input.visualClass === 'SECONDARY_SIGNAL' ||
    input.visualClass === 'OUTSIDE'
  ) {
    return {
      case: 'CASO_B',
      rationale:
        'Sin PRIMARY bajo catálogo activo; mantener STALE/documentar SECONDARY sin persistir hasta evidencia PRIMARY.',
    };
  }
  return {
    case: 'CASO_D',
    rationale:
      'Contrato API/FE o narrativa; verificar visibilidad tras eventual persistencia PRIMARY.',
  };
}

async function main(): Promise<void> {
  console.log(`${TAG} Auditoría Ginna documento=${GINNA_DOCUMENT} (dry-run only)`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const pa2 = app.select(McCatalogModule).get(McPa2Service);
  const competencies = app.get(OrgChartCompetenciesService);

  try {
    const persons = (await ds.query(
      `SELECT p.id::text, p.full_name, p.document, p.is_active,
              r.name AS role_name, a.name AS area_name
         FROM core.person p
         LEFT JOIN core.role r ON r.id = p.role_id
         LEFT JOIN core.area a ON a.id = p.area_id
        WHERE p.document = $1`,
      [GINNA_DOCUMENT],
    )) as Array<{
      id: string;
      full_name: string;
      document: string;
      is_active: boolean;
      role_name: string | null;
      area_name: string | null;
    }>;

    if (persons.length !== 1) {
      throw new Error(
        `Persona no encontrada o ambigua: ${GINNA_DOCUMENT} (count=${persons.length})`,
      );
    }
    const person = persons[0];

    const cvs = await ds.query(
      `SELECT id::text, is_active, drive_file_name, drive_md5_checksum, synced_at
         FROM organigrama.person_cv WHERE person_id = $1 ORDER BY id DESC`,
      [person.id],
    );
    const extractions = await ds.query(
      `SELECT id::text, person_cv_id::text, status, is_active, pdf_sha256, skills_count
         FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
      [person.id],
    );
    const enrichments = await ds.query(
      `SELECT id::text, extraction_id::text, status, is_active, pdf_sha256,
              input_skills_count, output_skills_count
         FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id DESC`,
      [person.id],
    );
    const evidences = await ds.query(
      `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
         FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id DESC`,
      [person.id],
    );

    const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active) ?? null;
    const activeExt =
      extractions.find(
        (e: { is_active: boolean; status: string }) =>
          e.is_active && e.status === 'SUCCEEDED',
      ) ?? null;
    const activeEnr =
      enrichments.find(
        (e: { is_active: boolean; status: string }) =>
          e.is_active && e.status === 'SUCCEEDED',
      ) ?? null;
    const activeEv =
      evidences.find(
        (e: { is_active: boolean; status: string }) =>
          e.is_active && e.status === 'SUCCEEDED',
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

    const activeCatalog = (await ds.query(
      `SELECT id::text, version, is_active FROM organigrama.mc_catalog_version
        WHERE is_active = TRUE ORDER BY id DESC LIMIT 1`,
    )) as Array<{ id: string; version: string; is_active: boolean }>;

    const evaluations = await ds.query(
      `SELECT e.id::text, e.is_active, e.status, e.domain_code,
              e.default_specialty_code, e.active_count, e.emergent_count, e.hidden_count,
              e.extraction_id::text, e.enrichment_id::text, e.evidence_evaluation_id::text,
              e.engine_rules_version,
              cv.version AS catalog_version, cv.is_active AS catalog_active,
              cv.id::text AS catalog_version_id,
              e.created_at, e.completed_at
         FROM organigrama.mc_profile_evaluation e
         JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
        WHERE e.person_id = $1
        ORDER BY e.id DESC`,
      [person.id],
    );

    const activeEvaluation =
      evaluations.find(
        (e: { is_active: boolean; status: string }) =>
          e.is_active && e.status === 'SUCCEEDED',
      ) ?? null;

    const staleCatalog =
      Boolean(activeEvaluation) && activeEvaluation?.catalog_active === false;

    let evidenceItems: Array<Record<string, unknown>> = [];
    let extractionSkills: Array<Record<string, unknown>> = [];
    const qualityCounts = {
      all: { STRONG: 0, MODERATE: 0, WEAK: 0, NONE: 0 },
      professional: { STRONG: 0, MODERATE: 0, WEAK: 0, NONE: 0 },
      tools: { STRONG: 0, MODERATE: 0, WEAK: 0, NONE: 0 },
    };

    if (activeEv) {
      evidenceItems = await ds.query(
        `SELECT ei.evidence_level, s.skill_type, ei.normalized_name,
                LEFT(COALESCE(ei.explanation, ''), 120) AS explanation_snippet
           FROM organigrama.cv_evidence_evaluation_item ei
           JOIN organigrama.cv_extraction_skill ces ON ces.id = ei.extraction_skill_id
           JOIN organigrama.cv_skill s ON s.id = ces.skill_id
          WHERE ei.evaluation_id = $1
          ORDER BY s.skill_type, ei.normalized_name`,
        [activeEv.id],
      );

      for (const row of evidenceItems) {
        const level = String(row.evidence_level).toUpperCase() as
          | 'STRONG'
          | 'MODERATE'
          | 'WEAK'
          | 'NONE';
        const bucket =
          level === 'STRONG' ||
          level === 'MODERATE' ||
          level === 'WEAK' ||
          level === 'NONE'
            ? level
            : 'NONE';
        qualityCounts.all[bucket] += 1;

        const skillType = String(row.skill_type);
        const target =
          skillType === 'TOOL'
            ? qualityCounts.tools
            : isProfessionalEvidenceType(skillType)
              ? qualityCounts.professional
              : null;
        if (target) {
          target[bucket] += 1;
        }
      }
    }

    if (activeExt) {
      extractionSkills = await ds.query(
        `SELECT s.normalized_name, s.normalized_key, s.skill_type, ces.category,
                ces.confidence
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.cv_skill s ON s.id = ces.skill_id
          WHERE ces.extraction_id = $1
          ORDER BY s.skill_type, s.normalized_name`,
        [activeExt.id],
      );
    }

    const qualityTierInput = {
      professionalStrong: qualityCounts.professional.STRONG,
      professionalModerate: qualityCounts.professional.MODERATE,
    };
    const qualityTier = classifyQualityTier(qualityTierInput);

    if (!chainAligned || !activeExt) {
      throw new Error('Cadena CV incompleta o desalineada; no se puede ejecutar PA2');
    }

    const pa2DryRuns: Array<Record<string, unknown>> = [];
    for (const { domainCode, rulesVersion } of DOMAIN_RULES) {
      const outcome = await pa2.evaluateProfileDomain({
        extractionId: String(activeExt.id),
        domainCode,
        rulesVersion,
        persist: false,
      });
      const result = outcome.result as McPa2EngineRunResult;
      const conceptualClass = classifyDomainConceptually(result, qualityTier);

      pa2DryRuns.push({
        domainCode,
        rulesVersion,
        outcome: outcome.outcome,
        defaultSpecialty: result.defaultSpecialtyCode,
        activeCount: result.activeCount,
        emergentCount: result.emergentCount,
        hiddenCount: result.hiddenCount,
        conceptualClass,
        specialtyBreakdown: result.specialtyResults.map((r) => ({
          specialtyCode: r.specialtyCode,
          presentationStatus: r.presentationStatus,
          professionalContribution: r.professionalContribution,
          strength: r.strength,
          isDefault: r.isDefault,
        })),
        warnings: result.warnings,
      });

      console.log(
        `${TAG} PA2 ${domainCode}: ACTIVE=${result.activeCount} EMERGENT=${result.emergentCount} ` +
          `class=${conceptualClass} default=${result.defaultSpecialtyCode ?? 'null'}`,
      );
    }

    const visualDry = pa2DryRuns.find((d) => d.domainCode === 'VISUAL_DESIGN')!;
    const avDry = pa2DryRuns.find(
      (d) => d.domainCode === 'AUDIOVISUAL_PRODUCTION',
    )!;

    const corpusTexts: string[] = [
      person.role_name ?? '',
      person.area_name ?? '',
      ...extractionSkills.map((s) => String(s.normalized_name)),
      ...evidenceItems.flatMap((e) => [
        String(e.normalized_name),
        String(e.explanation_snippet ?? ''),
      ]),
    ];

    const visualSignals = [
      ...new Set(corpusTexts.flatMap((t) => matchTerms(t, VISUAL_TERMS))),
    ];
    const avSignals = [
      ...new Set(corpusTexts.flatMap((t) => matchTerms(t, AV_TERMS))),
    ];
    const toolSignals = [
      ...new Set(corpusTexts.flatMap((t) => matchTerms(t, TOOL_TERMS))),
    ];

    const deliverables = evidenceItems
      .filter((e) => isProfessionalEvidenceType(String(e.skill_type)))
      .filter((e) => ['STRONG', 'MODERATE'].includes(String(e.evidence_level)))
      .map((e) => String(e.normalized_name))
      .slice(0, 12);

    const professionalReading = classifyProfessionalReading({
      qualityTier,
      visualSignals,
      avSignals,
      toolSignals,
      roleName: person.role_name,
      visualClass: visualDry.conceptualClass as DomainConceptualClass,
      avClass: avDry.conceptualClass as DomainConceptualClass,
    });

    const visualResult = (
      await pa2.evaluateProfileDomain({
        extractionId: String(activeExt.id),
        domainCode: 'VISUAL_DESIGN',
        rulesVersion: 'pa2-visual-design-1.1.0',
        persist: false,
      })
    ).result;

    const notPrimaryVisual = explainNotPrimary({
      domainClass: visualDry.conceptualClass as DomainConceptualClass,
      qualityTier,
      visualSignals,
      avSignals,
      result: visualResult,
    });

    const viewer: OrgViewerContext = {
      personId: person.id,
      eduEmail: 'mc1104@local',
      permissions: ['ORG_READ_ALL'],
    };
    const apiSummary = await competencies.getExplorerSummary(
      viewer,
      person.id,
      '0',
      { includeHidden: false, includeAudit: true },
    );

    const policyRecommendation = recommendPolicyCase({
      staleCatalog,
      visualClass: visualDry.conceptualClass as DomainConceptualClass,
      avClass: avDry.conceptualClass as DomainConceptualClass,
      notPrimaryCause: notPrimaryVisual.cause,
      apiStale: apiSummary.availabilityStatus === 'STALE',
    });

    const report = {
      phase: 'MC1.10.4',
      generatedAt: new Date().toISOString(),
      mode: 'AUDIT_DRY_RUN_ONLY',
      document: GINNA_DOCUMENT,
      person: {
        person_id: person.id,
        full_name: person.full_name,
        document: person.document,
        is_active: person.is_active,
        role: person.role_name,
        area: person.area_name,
      },
      activeCatalog: activeCatalog[0] ?? null,
      chain: {
        chainAligned,
        activeCvId: activeCv?.id ?? null,
        activeExtractionId: activeExt?.id ?? null,
        activeEnrichmentId: activeEnr?.id ?? null,
        activeEvidenceId: activeEv?.id ?? null,
        cvs,
        extractions,
        enrichments,
        evidences,
        alignmentChecks: {
          extraction_person_cv_id_matches: String(activeExt?.person_cv_id) === String(activeCv?.id),
          enrichment_extraction_id_matches: String(activeEnr?.extraction_id) === String(activeExt?.id),
          evidence_enrichment_id_matches: String(activeEv?.enrichment_id) === String(activeEnr?.id),
          evidence_extraction_id_matches: String(activeEv?.extraction_id) === String(activeExt?.id),
        },
      },
      evaluations,
      activeEvaluation,
      staleDiagnosis: {
        staleCatalog,
        activeEvalId: activeEvaluation?.id ?? null,
        activeEvalCatalog: activeEvaluation?.catalog_version ?? null,
        activeEvalCatalogActive: activeEvaluation?.catalog_active ?? null,
      },
      evidenceItems,
      qualityCounts,
      qualityTier,
      extractionSkills,
      pa2DryRuns,
      professionalReading: {
        classification: professionalReading,
        mainPractice: visualSignals.length >= avSignals.length ? 'visual' : 'audiovisual',
        deliverables,
        tools: toolSignals,
        visualSignals,
        avSignals,
      },
      notPrimaryAnalysis: {
        visual: notPrimaryVisual,
        primaryDomainWouldBe:
          visualDry.conceptualClass === 'PRIMARY_MATCH'
            ? 'VISUAL_DESIGN'
            : avDry.conceptualClass === 'PRIMARY_MATCH'
              ? 'AUDIOVISUAL_PRODUCTION'
              : null,
      },
      api: {
        availabilityStatus: apiSummary.availabilityStatus,
        warnings: apiSummary.warnings ?? [],
        evaluationId: apiSummary.evaluation?.id ?? null,
        evaluationCatalogVersion:
          apiSummary.evaluation?.audit?.catalogVersion ?? null,
      },
      policyRecommendation,
      persistAllowed: false,
      persistNote:
        'MC1.10.4: dry-run only; persist solo si VISUAL o AV activeCount>=1 con instrucción explícita.',
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const outPath = resolve(process.cwd(), 'tmp/mc1104-ginna-audit.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${TAG} artefacto=${outPath}`);
    console.log(JSON.stringify(report.policyRecommendation, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(TAG, e instanceof Error ? e.message : e);
  process.exit(1);
});
