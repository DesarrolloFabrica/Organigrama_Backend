/**
 * MC1.11.0 — Auditoría operativa del dominio VISUAL_DESIGN.
 *
 * npm run mc:audit-visual-domain -- --team-scope=vacancy --dry-run
 * npm run mc:audit-visual-domain -- --documents=1015482688,1032488010 --dry-run
 * npm run mc:audit-visual-domain -- --simulate-pack
 * npm run mc:audit-visual-domain -- --apply-pack --i-confirm-apply-pack
 * npm run mc:audit-visual-domain -- --reevaluate --persist
 *
 * Default: read-only / dry-run. Escritura requiere flags explícitos.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import {
  MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
  resolveMcMappingPack,
  resolveMcMappingPackByRelease,
} from '../../mc-catalog/mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';
import { MC_VISUAL_DESIGN_MAPPING_PACK_V110 } from '../../mc-catalog/mc-catalog.mapping-visual-design-v110';
import { MC_VISUAL_DESIGN_MAPPING_PACK_V120 } from '../../mc-catalog/mc-catalog.mapping-visual-design-v120';
import { simulateVisualPa2WithPack } from '../../mc-catalog/mc-catalog.visual-pack-simulate';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.11.0]';
const VACANCY_PARENT_ID = '1206';
const PROPOSED_PACK_VERSION = '1.2.0';
const CURRENT_PACK_VERSION = '1.1.0';

/** Corpus visual mínimo (8–12) — documentos con cadena válida en MC1.10.2. */
const DEFAULT_VISUAL_CORPUS = [
  '1015482688', // Nidia
  '1032488010', // Daniel
  '1030646495', // Ginna
  '1000254881', // Danna
  '1022356343', // Darío
  '1001294362', // Diego
  '1000035262', // Molano
  '1000622424', // Alison
  '1001202072', // Hari
  '1000366409', // Laura Melisa
  '1031164534', // Daissy
  '1023899594', // Laura Patiño
];

const CONTROL_DOCUMENTS = [
  '1022445625', // Juan Pablo AV
  '1000944247', // Santiago AV
  '1013100614', // Presentadora
];

const PRESENTER_ROLE = /presentador/i;

interface ScriptArgs {
  documents: string[];
  teamScope: 'vacancy' | 'documents' | 'controls';
  dryRun: boolean;
  simulatePack: boolean;
  applyPack: boolean;
  confirmApplyPack: boolean;
  reevaluate: boolean;
  persist: boolean;
  apiCheck: boolean;
  browserCheck: boolean;
  exportJson: string;
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    documents: [...DEFAULT_VISUAL_CORPUS],
    teamScope: 'vacancy',
    dryRun: true,
    simulatePack: false,
    applyPack: false,
    confirmApplyPack: false,
    reevaluate: false,
    persist: false,
    apiCheck: false,
    browserCheck: false,
    exportJson: 'tmp/mc1110-audit-visual-domain.json',
  };
  for (const arg of argv) {
    if (arg.startsWith('--documents=')) {
      out.documents = arg
        .slice('--documents='.length)
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
      out.teamScope = 'documents';
    } else if (arg.startsWith('--team-scope=')) {
      const v = arg.slice('--team-scope='.length);
      if (v === 'vacancy' || v === 'documents' || v === 'controls') {
        out.teamScope = v;
      }
    } else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--simulate-pack') out.simulatePack = true;
    else if (arg === '--apply-pack') out.applyPack = true;
    else if (arg === '--i-confirm-apply-pack') out.confirmApplyPack = true;
    else if (arg === '--reevaluate') out.reevaluate = true;
    else if (arg === '--persist') {
      out.persist = true;
      out.dryRun = false;
    } else if (arg === '--api-check') out.apiCheck = true;
    else if (arg === '--browser-check') out.browserCheck = true;
    else if (arg.startsWith('--export-json=')) {
      out.exportJson = arg.slice('--export-json='.length);
    }
  }
  if (out.teamScope === 'controls') {
    out.documents = [...CONTROL_DOCUMENTS];
  }
  return out;
}

type GapKind =
  | 'ALIAS_GAP'
  | 'MAPPING_GAP'
  | 'PA2_GAP'
  | 'NO_PROFESSIONAL_EVIDENCE'
  | 'INSUFFICIENT_CV'
  | 'OUTSIDE'
  | 'NONE';

type ActionKind =
  | 'NO_CHANGE'
  | 'ADD_ALIAS'
  | 'ADD_MAPPING'
  | 'REVIEW_PA2'
  | 'REVIEW_DOMAIN_GATE'
  | 'INSUFFICIENT_CV'
  | 'OUTSIDE';

async function loadVacancyDocuments(ds: DataSource): Promise<string[]> {
  const rows = (await ds.query(
    `SELECT c.document
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation ovr
         ON ovr.version_id = v.id AND ovr.is_active = TRUE
       JOIN core.person c ON c.id = ovr.child_person_id
      WHERE v.is_active = TRUE AND ovr.parent_person_id = $1
        AND c.document IS NOT NULL
      ORDER BY c.full_name`,
    [VACANCY_PARENT_ID],
  )) as Array<{ document: string }>;
  const docs = new Set(rows.map((r) => r.document));
  return DEFAULT_VISUAL_CORPUS.filter((d) => docs.has(d));
}

async function loadPersonSkills(
  ds: DataSource,
  personId: string,
): Promise<{
  extractionId: string | null;
  enrichmentId: string | null;
  evidenceId: string | null;
  skills: Array<{
    skillId: string;
    skillKey: string;
    skillName: string;
    skillType: string;
    evidenceLevel: string;
    evidenceStrength: number;
    evidenceConfidence: number;
  }>;
}> {
  const chain = (await ds.query(
    `SELECT e.id::text AS extraction_id,
            en.id::text AS enrichment_id,
            ev.id::text AS evidence_id
       FROM organigrama.person_cv pc
       JOIN organigrama.cv_extraction e
         ON e.person_cv_id = pc.id AND e.is_active = TRUE
       LEFT JOIN organigrama.cv_skill_enrichment en
         ON en.extraction_id = e.id AND en.is_active = TRUE
       LEFT JOIN organigrama.cv_evidence_evaluation ev
         ON ev.extraction_id = e.id AND ev.is_active = TRUE
      WHERE pc.person_id = $1 AND pc.is_active = TRUE
      ORDER BY e.id DESC
      LIMIT 1`,
    [personId],
  )) as Array<{
    extraction_id: string;
    enrichment_id: string | null;
    evidence_id: string | null;
  }>;

  if (!chain.length || !chain[0].evidence_id) {
    return {
      extractionId: chain[0]?.extraction_id ?? null,
      enrichmentId: chain[0]?.enrichment_id ?? null,
      evidenceId: null,
      skills: [],
    };
  }

  const skills = (await ds.query(
    `SELECT s.id::text AS skill_id,
            s.normalized_key AS skill_key,
            s.normalized_name AS skill_name,
            s.skill_type,
            ei.evidence_level,
            ei.evidence_strength::float AS evidence_strength,
            ei.evidence_confidence::float AS evidence_confidence
       FROM organigrama.cv_extraction_skill es
       JOIN organigrama.cv_skill s ON s.id = es.skill_id
       JOIN organigrama.cv_evidence_evaluation_item ei
         ON ei.extraction_skill_id = es.id AND ei.evaluation_id = $2
      WHERE es.extraction_id = $1
      ORDER BY s.normalized_key`,
    [chain[0].extraction_id, chain[0].evidence_id],
  )) as Array<{
    skill_id: string;
    skill_key: string;
    skill_name: string;
    skill_type: string;
    evidence_level: string;
    evidence_strength: number;
    evidence_confidence: number;
  }>;

  return {
    extractionId: chain[0].extraction_id,
    enrichmentId: chain[0].enrichment_id,
    evidenceId: chain[0].evidence_id,
    skills: skills.map((s) => ({
      skillId: s.skill_id,
      skillKey: s.skill_key,
      skillName: s.skill_name,
      skillType: s.skill_type,
      evidenceLevel: s.evidence_level,
      evidenceStrength: Number(s.evidence_strength),
      evidenceConfidence: Number(s.evidence_confidence),
    })),
  };
}

function diagnoseGap(params: {
  conceptualClass: string;
  mappedKeys: string[];
  visualishUnmapped: string[];
  professionalModerateOrStrong: number;
}): { gap: GapKind; action: ActionKind } {
  const {
    conceptualClass,
    mappedKeys,
    visualishUnmapped,
    professionalModerateOrStrong,
  } = params;

  if (conceptualClass === 'PRIMARY_MATCH') {
    return { gap: 'NONE', action: 'NO_CHANGE' };
  }
  if (professionalModerateOrStrong === 0 && visualishUnmapped.length === 0) {
    return { gap: 'NO_PROFESSIONAL_EVIDENCE', action: 'INSUFFICIENT_CV' };
  }
  if (visualishUnmapped.length > 0 && mappedKeys.length === 0) {
    return { gap: 'ALIAS_GAP', action: 'ADD_ALIAS' };
  }
  if (visualishUnmapped.length > 0) {
    return { gap: 'MAPPING_GAP', action: 'ADD_MAPPING' };
  }
  if (conceptualClass === 'SECONDARY_SIGNAL') {
    return { gap: 'PA2_GAP', action: 'REVIEW_DOMAIN_GATE' };
  }
  return { gap: 'OUTSIDE', action: 'OUTSIDE' };
}

const VISUALISH_RE =
  /diseno|identidad|branding|editorial|diagram|maquet|ilustr|graf|visual|retoque|pieza|marca|catalogo|publicitar/i;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  console.log(`${TAG} mode dryRun=${args.dryRun} simulate=${args.simulatePack} apply=${args.applyPack} reevaluate=${args.reevaluate} persist=${args.persist}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = app.get(DataSource);
  const pa2 = app.select(McCatalogModule).get(McPa2Service);
  const competencies = app.get(OrgChartCompetenciesService);

  try {
    let documents = args.documents;
    if (args.teamScope === 'vacancy' && args.documents === DEFAULT_VISUAL_CORPUS) {
      const fromVacancy = await loadVacancyDocuments(ds);
      if (fromVacancy.length >= 8) {
        documents = fromVacancy;
      }
      console.log(
        `${TAG} vacancy parent=${VACANCY_PARENT_ID} corpus=${documents.length}`,
      );
    }

    const currentPack = resolveMcMappingPackByRelease(
      MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
      CURRENT_PACK_VERSION,
    );
    const proposedPack = resolveMcMappingPackByRelease(
      MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
      PROPOSED_PACK_VERSION,
    );
    const defaultReg = resolveMcMappingPack('VISUAL_DESIGN');

    const specialtyRows = (await ds.query(
      `SELECT s.code, s.name, s.lifecycle_status,
              (SELECT count(*)::int FROM organigrama.mc_skill_specialty_mapping m
                WHERE m.specialty_id = s.id AND m.is_active) AS mapping_count
         FROM organigrama.mc_specialty s
         JOIN organigrama.mc_domain d ON d.id = s.domain_id
         JOIN organigrama.mc_catalog_version cv ON cv.id = s.catalog_version_id
        WHERE d.code = 'VISUAL_DESIGN' AND cv.is_active
        ORDER BY s.sort_order`,
    )) as Array<{
      code: string;
      name: string;
      lifecycle_status: string;
      mapping_count: number;
    }>;

    const catalogAudit = {
      catalogVersion: 'mc1.8-2026-07-28',
      defaultPackVersion: defaultReg.mappingRulesVersion,
      defaultPackHash: computeMcMappingPackHash(defaultReg.pack),
      proposedPackVersion: PROPOSED_PACK_VERSION,
      proposedPackHash: computeMcMappingPackHash(proposedPack.pack),
      currentPackHash: computeMcMappingPackHash(currentPack.pack),
      specialties: specialtyRows,
      maturityDocumented: {
        VISUAL_GRAPHIC: 'CONSOLIDATED',
        VISUAL_IDENTITY: 'STABLE',
        VISUAL_EDITORIAL: 'STABLE',
        VISUAL_UI: 'RESERVED',
        VISUAL_DIGITAL_ASSETS: 'DEPRECATED',
      },
      maturityInCatalogLifecycle: Object.fromEntries(
        specialtyRows.map((s) => [s.code, s.lifecycle_status]),
      ),
      note: 'Madurez metodológica ≠ lifecycle_status de catálogo (todas ACTIVE en seed).',
    };

    const profiles: unknown[] = [];
    const simulationRows: unknown[] = [];

    for (const document of documents) {
      const persons = (await ds.query(
        `SELECT p.id::text, p.full_name, p.document, r.name AS role_name
           FROM core.person p
           LEFT JOIN core.role r ON r.id = p.role_id
          WHERE p.document = $1`,
        [document],
      )) as Array<{
        id: string;
        full_name: string;
        document: string;
        role_name: string | null;
      }>;
      if (!persons.length) {
        profiles.push({ document, error: 'PERSON_NOT_FOUND' });
        continue;
      }
      const person = persons[0];
      if (person.role_name && PRESENTER_ROLE.test(person.role_name)) {
        profiles.push({
          document,
          fullName: person.full_name,
          skipped: 'PRESENTER',
        });
        continue;
      }

      const chain = await loadPersonSkills(ds, person.id);
      const currentSim = simulateVisualPa2WithPack({
        pack: MC_VISUAL_DESIGN_MAPPING_PACK_V110,
        packVersion: CURRENT_PACK_VERSION,
        skills: chain.skills,
      });

      const visualishUnmapped = chain.skills
        .filter(
          (s) =>
            VISUALISH_RE.test(s.skillKey) &&
            !currentSim.mappedSkillKeys.includes(s.skillKey) &&
            s.skillType !== 'SOFT_SKILL',
        )
        .map((s) => s.skillKey);

      const professionalModerateOrStrong = chain.skills.filter(
        (s) =>
          (s.skillType === 'PROFESSIONAL_KNOWLEDGE' ||
            s.skillType === 'METHODOLOGY') &&
          (s.evidenceLevel === 'MODERATE' || s.evidenceLevel === 'STRONG') &&
          VISUALISH_RE.test(s.skillKey),
      ).length;

      const { gap, action } = diagnoseGap({
        conceptualClass: currentSim.conceptualClass,
        mappedKeys: currentSim.mappedSkillKeys,
        visualishUnmapped,
        professionalModerateOrStrong,
      });

      const evalRows = (await ds.query(
        `SELECT pe.id::text, pe.is_active, pe.default_specialty_code,
                pe.active_count, pe.emergent_count, pe.mapping_pack_version,
                cv.version AS catalog_version, cv.is_active AS catalog_active
           FROM organigrama.mc_profile_evaluation pe
           JOIN organigrama.mc_catalog_version cv ON cv.id = pe.catalog_version_id
          WHERE pe.person_id = $1 AND pe.domain_code = 'VISUAL_DESIGN'
          ORDER BY pe.id DESC`,
        [person.id],
      )) as unknown[];

      let api: unknown = null;
      if (args.apiCheck) {
        const viewer: OrgViewerContext = {
          personId: '1229',
          eduEmail: 'desarrollofabrica@cun.edu.co',
          permissions: ['ORG_READ_ALL', 'ORG_ADMIN'],
        };
        try {
          api = await competencies.getExplorerSummary(viewer, person.id, '0', {
            includeHidden: true,
            includeAudit: true,
          });
        } catch (err) {
          api = { error: err instanceof Error ? err.message : String(err) };
        }
      }

      const profileRow = {
        document,
        personId: person.id,
        fullName: person.full_name,
        roleName: person.role_name,
        extractionId: chain.extractionId,
        enrichmentId: chain.enrichmentId,
        evidenceId: chain.evidenceId,
        skillsCount: chain.skills.length,
        current: {
          pack: CURRENT_PACK_VERSION,
          conceptualClass: currentSim.conceptualClass,
          activeCount: currentSim.result.activeCount,
          emergentCount: currentSim.result.emergentCount,
          defaultSpecialty: currentSim.result.defaultSpecialtyCode,
          specialties: currentSim.result.specialtyResults
            .filter((r) => r.presentationStatus !== 'HIDDEN')
            .map((r) => ({
              code: r.specialtyCode,
              status: r.presentationStatus,
              strength: r.strength,
              professionalContribution: r.professionalContribution,
            })),
          mappedSkillKeys: currentSim.mappedSkillKeys,
        },
        visualishUnmapped,
        gap,
        action,
        evaluations: evalRows,
        api,
      };
      profiles.push(profileRow);

      console.log(
        `${TAG} ${person.full_name}: ${currentSim.conceptualClass} ` +
          `A${currentSim.result.activeCount}/E${currentSim.result.emergentCount} ` +
          `gap=${gap} action=${action}`,
      );

      if (args.simulatePack) {
        const proposedSim = simulateVisualPa2WithPack({
          pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
          packVersion: PROPOSED_PACK_VERSION,
          skills: chain.skills,
        });
        const improved =
          (currentSim.conceptualClass !== 'PRIMARY_MATCH' &&
            proposedSim.conceptualClass === 'PRIMARY_MATCH') ||
          proposedSim.result.activeCount > currentSim.result.activeCount ||
          proposedSim.result.emergentCount > currentSim.result.emergentCount;
        const row = {
          document,
          fullName: person.full_name,
          before: currentSim.conceptualClass,
          after: proposedSim.conceptualClass,
          beforeSpecialties: profileRow.current.specialties,
          afterSpecialties: proposedSim.result.specialtyResults
            .filter((r) => r.presentationStatus !== 'HIDDEN')
            .map((r) => ({
              code: r.specialtyCode,
              status: r.presentationStatus,
              strength: r.strength,
            })),
          improved,
          mappedAfter: proposedSim.mappedSkillKeys,
        };
        simulationRows.push(row);
        console.log(
          `${TAG}   simulate ${CURRENT_PACK_VERSION}→${PROPOSED_PACK_VERSION}: ` +
            `${currentSim.conceptualClass} → ${proposedSim.conceptualClass}` +
            (improved ? ' IMPROVED' : ''),
        );
      }
    }

    // Controles negativos en simulación
    if (args.simulatePack) {
      for (const document of CONTROL_DOCUMENTS) {
        const persons = (await ds.query(
          `SELECT id::text, full_name FROM core.person WHERE document = $1`,
          [document],
        )) as Array<{ id: string; full_name: string }>;
        if (!persons.length) continue;
        const chain = await loadPersonSkills(ds, persons[0].id);
        if (!chain.skills.length) {
          simulationRows.push({
            document,
            fullName: persons[0].full_name,
            control: true,
            note: 'NO_SKILLS_OR_CHAIN',
          });
          continue;
        }
        const before = simulateVisualPa2WithPack({
          pack: MC_VISUAL_DESIGN_MAPPING_PACK_V110,
          packVersion: CURRENT_PACK_VERSION,
          skills: chain.skills,
        });
        const after = simulateVisualPa2WithPack({
          pack: MC_VISUAL_DESIGN_MAPPING_PACK_V120,
          packVersion: PROPOSED_PACK_VERSION,
          skills: chain.skills,
        });
        const falsePositive =
          before.conceptualClass !== 'PRIMARY_MATCH' &&
          after.conceptualClass === 'PRIMARY_MATCH' &&
          /presentador|sanabria|vanegas/i.test(persons[0].full_name);
        simulationRows.push({
          document,
          fullName: persons[0].full_name,
          control: true,
          before: before.conceptualClass,
          after: after.conceptualClass,
          falsePositiveRisk: falsePositive,
        });
        console.log(
          `${TAG} control ${persons[0].full_name}: ${before.conceptualClass} → ${after.conceptualClass}`,
        );
      }
    }

    let applyOutcome: unknown = null;
    if (args.applyPack) {
      if (!args.confirmApplyPack) {
        throw new Error('--apply-pack requiere --i-confirm-apply-pack');
      }
      console.log(
        `${TAG} APPLY PACK: registre V120 como default en código y reseed DB`,
      );
      console.log(
        `${TAG} Nota: este script NO reescribe el registry TypeScript; ` +
          `asuma que el default ya apunta a 1.2.0 antes de reseed, o use mc:mappings tras cambiar registry.`,
      );
      applyOutcome = {
        status: 'MANUAL_REGISTRY_THEN_RESEED',
        instruction:
          'Cambiar REGISTRY VISUAL_DESIGN a V120, luego: npm run mc:mappings -- --seed --i-confirm-seed --force-reseed --i-confirm-reseed --domain=VISUAL_DESIGN',
      };
    }

    const persistResults: unknown[] = [];
    if (args.reevaluate) {
      const candidates = (profiles as Array<Record<string, unknown>>).filter(
        (p) =>
          p.gap === 'ALIAS_GAP' ||
          p.gap === 'MAPPING_GAP' ||
          p.gap === 'PA2_GAP',
      );
      for (const p of candidates) {
        const extractionId = p.extractionId as string | null;
        if (!extractionId) {
          persistResults.push({
            document: p.document,
            status: 'SKIPPED',
            reason: 'NO_EXTRACTION',
          });
          continue;
        }
        const dry = await pa2.evaluateProfileDomain({
          extractionId,
          domainCode: 'VISUAL_DESIGN',
          rulesVersion: 'pa2-visual-design-1.1.0',
          persist: false,
        });
        const isPrimary = dry.result.activeCount >= 1;
        if (!args.persist || !isPrimary) {
          persistResults.push({
            document: p.document,
            fullName: p.fullName,
            status: isPrimary
              ? 'DRY_RUN_PRIMARY_READY'
              : 'SKIPPED_NO_PRIMARY',
            activeCount: dry.result.activeCount,
            emergentCount: dry.result.emergentCount,
            defaultSpecialty: dry.result.defaultSpecialtyCode,
            specialties: dry.result.specialtyResults
              .filter((r) => r.presentationStatus !== 'HIDDEN')
              .map((r) => ({
                code: r.specialtyCode,
                status: r.presentationStatus,
              })),
            wouldPersist: Boolean(args.persist && isPrimary),
          });
          continue;
        }
        const saved = await pa2.evaluateProfileDomain({
          extractionId,
          domainCode: 'VISUAL_DESIGN',
          rulesVersion: 'pa2-visual-design-1.1.0',
          persist: true,
        });
        persistResults.push({
          document: p.document,
          fullName: p.fullName,
          status: saved.outcome,
          evaluationId: saved.evaluationId,
          activeCount: saved.result.activeCount,
          defaultSpecialty: saved.result.defaultSpecialtyCode,
          specialties: saved.result.specialtyResults
            .filter((r) => r.presentationStatus !== 'HIDDEN')
            .map((r) => ({
              code: r.specialtyCode,
              status: r.presentationStatus,
            })),
        });
      }
    }

    if (args.browserCheck) {
      console.log(
        `${TAG} browser-check: ejecutar E2E Frontend creative-competencies-visibility / visual specialties`,
      );
    }

    const summary = {
      profilesAudited: profiles.length,
      primary: (profiles as Array<{ current?: { conceptualClass?: string } }>).filter(
        (p) => p.current?.conceptualClass === 'PRIMARY_MATCH',
      ).length,
      secondary: (profiles as Array<{ current?: { conceptualClass?: string } }>).filter(
        (p) => p.current?.conceptualClass === 'SECONDARY_SIGNAL',
      ).length,
      outside: (profiles as Array<{ current?: { conceptualClass?: string } }>).filter(
        (p) => p.current?.conceptualClass === 'OUTSIDE',
      ).length,
      aliasGaps: (profiles as Array<{ gap?: string }>).filter(
        (p) => p.gap === 'ALIAS_GAP',
      ).length,
      mappingGaps: (profiles as Array<{ gap?: string }>).filter(
        (p) => p.gap === 'MAPPING_GAP',
      ).length,
      pa2Gaps: (profiles as Array<{ gap?: string }>).filter(
        (p) => p.gap === 'PA2_GAP',
      ).length,
      simulationImprovements: (simulationRows as Array<{ improved?: boolean }>).filter(
        (r) => r.improved,
      ).length,
      simulationFalsePositives: (
        simulationRows as Array<{ falsePositiveRisk?: boolean }>
      ).filter((r) => r.falsePositiveRisk).length,
    };

    const report = {
      phase: 'MC1.11.0',
      generatedAt: new Date().toISOString(),
      args,
      catalogAudit,
      summary,
      profiles,
      simulation: args.simulatePack ? simulationRows : null,
      applyOutcome,
      persistResults,
      proposedPackDiff: {
        from: CURRENT_PACK_VERSION,
        to: PROPOSED_PACK_VERSION,
        addedDomainSpecialtyKeys:
          MC_VISUAL_DESIGN_MAPPING_PACK_V120.classifications
            .filter((c) => c.classification === 'DOMAIN_SPECIALTY')
            .map((c) => c.skillKey)
            .filter(
              (k) =>
                !MC_VISUAL_DESIGN_MAPPING_PACK_V110.classifications.some(
                  (c) => c.skillKey === k,
                ),
            ),
      },
    };

    const outPath = resolve(process.cwd(), args.exportJson);
    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${TAG} wrote ${outPath}`);
    console.log(`${TAG} summary ${JSON.stringify(summary)}`);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(TAG, err);
  process.exit(1);
});
