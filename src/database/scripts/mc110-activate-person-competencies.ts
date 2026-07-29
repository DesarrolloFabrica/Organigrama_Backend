/**
 * MC1.10.0 / MC1.1B — Activación de competencias por documento (multidominio PA2).
 *
 * MC1.1B: persiste evaluación PA2 de todos los dominios evaluados; solo el
 * dominio seleccionado por selectPrimaryDomain queda is_active=true (publicación).
 *
 * npm run mc:activate-competencies -- --documents=1000518830,1000372715,1010247929
 * npm run mc:activate-competencies -- --documents=... --dry-run   # default
 * npm run mc:activate-competencies -- --documents=... --persist
 * npm run mc:activate-competencies -- --documents=... --force-reextract
 * npm run mc:activate-competencies -- --documents=... --skip-api-check
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';
import type { McPa2EngineRunResult } from '../../mc-catalog/mc-pa2.types';
import type { McPa2EvaluateOutcome } from '../../mc-catalog/mc-pa2.service';
import {
  classifyDomainConceptually,
  type McDomainQualification,
  type McEvidenceQualityTier,
} from '../../mc-catalog/mc-domain-qualification';
import { resolveMcPa2EngineConfig } from '../../mc-catalog/mc-pa2.config';
import { MC_OPERATIVE_DOMAIN_RULES } from '../../mc-catalog/mc-operative-domains';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.10]';

const DOMAIN_RULES = MC_OPERATIVE_DOMAIN_RULES;

type ChainAction =
  | 'NONE'
  | 'NEED_CV'
  | 'NEED_EXTRACTION'
  | 'NEED_ENRICHMENT'
  | 'NEED_EVIDENCE'
  | 'NEED_REALIGN'
  | 'CHAIN_COMPLETE';

type QualityTier = McEvidenceQualityTier;

type PrimarySelection =
  | { status: 'SINGLE_PRIMARY'; domainCode: string }
  | { status: 'RESOLVED_TIE'; domainCode: string; demoted: string[] }
  | { status: 'NO_PRIMARY_MATCH' };

interface ScriptArgs {
  documents: string[];
  dryRun: boolean;
  persist: boolean;
  forceReextract: boolean;
  skipApiCheck: boolean;
  out: string;
}

interface EvidenceQualitySummary {
  strong: number;
  moderate: number;
  weak: number;
  none: number;
  professionalStrong: number;
  professionalModerate: number;
  professionalWeak: number;
  professionalNone: number;
  tier: QualityTier;
}

interface ChainAudit {
  document: string;
  personId: string | null;
  fullName: string | null;
  error?: string;
  action: ChainAction;
  chainAligned: boolean;
  activeCvId: string | null;
  activeExtractionId: string | null;
  activeEnrichmentId: string | null;
  activeEvidenceId: string | null;
  actionsNeeded: string[];
}

interface DomainEvaluationReport {
  domainCode: string;
  rulesVersion: string;
  skipped: boolean;
  skipReason?: string;
  dryRunOutcome?: string;
  persistOutcome?: string;
  evaluationId?: string | null;
  activeCount: number;
  emergentCount: number;
  hiddenCount: number;
  defaultSpecialtyCode: string | null;
  defaultSpecialtyStrength: number;
  defaultSpecialtyProfessionalContribution: number;
  conceptualClass: McDomainQualification;
  /** Transitorio MC1.10: dominio que recibiría publicación bajo política CLI actual. */
  approvedForPublication: boolean;
  /** Resultado dry-run completo para persistencia atómica (MC1.1B). */
  dryRun?: McPa2EvaluateOutcome;
  specialtySummary: Array<{
    specialtyCode: string;
    presentationStatus: string;
    strength: number;
    professionalContribution: number;
  }>;
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    documents: [],
    dryRun: true,
    persist: false,
    forceReextract: false,
    skipApiCheck: false,
    out: 'tmp/mc110-activate-competencies.json',
  };

  for (const arg of argv) {
    if (arg.startsWith('--documents=')) {
      const raw = arg.slice('--documents='.length).trim();
      out.documents = raw
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean);
    } else if (arg === '--dry-run') {
      out.dryRun = true;
      out.persist = false;
    } else if (arg === '--persist') {
      out.persist = true;
      out.dryRun = false;
    } else if (arg === '--force-reextract') {
      out.forceReextract = true;
    } else if (arg === '--skip-api-check') {
      out.skipApiCheck = true;
    } else if (arg.startsWith('--out=')) {
      out.out = arg.slice('--out='.length);
    }
  }

  if (!out.documents.length) {
    throw new Error(
      'Requiere --documents=<cedula1,cedula2,...>. ' +
        'Ejemplo: npm run mc:activate-competencies -- --documents=1000518830',
    );
  }

  for (const doc of out.documents) {
    if (!/^\d+$/.test(doc)) {
      throw new Error(`Documento inválido "${doc}": se esperan solo dígitos.`);
    }
  }

  return out;
}

function isProfessionalEvidenceType(skillType: string): boolean {
  return (
    skillType === 'PROFESSIONAL_KNOWLEDGE' || skillType === 'METHOD'
  );
}

function classifyQualityTier(summary: Omit<EvidenceQualitySummary, 'tier'>): QualityTier {
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

async function loadEvidenceQuality(
  ds: DataSource,
  evidenceEvaluationId: string,
): Promise<EvidenceQualitySummary> {
  const rows = (await ds.query(
    `SELECT ei.evidence_level, s.skill_type
       FROM organigrama.cv_evidence_evaluation_item ei
       JOIN organigrama.cv_extraction_skill ces ON ces.id = ei.extraction_skill_id
       JOIN organigrama.cv_skill s ON s.id = ces.skill_id
      WHERE ei.evaluation_id = $1`,
    [evidenceEvaluationId],
  )) as Array<{ evidence_level: string; skill_type: string }>;

  const counts = {
    strong: 0,
    moderate: 0,
    weak: 0,
    none: 0,
    professionalStrong: 0,
    professionalModerate: 0,
    professionalWeak: 0,
    professionalNone: 0,
  };

  for (const row of rows) {
    const level = String(row.evidence_level).toUpperCase();
    const professional = isProfessionalEvidenceType(String(row.skill_type));

    if (level === 'STRONG') counts.strong += 1;
    else if (level === 'MODERATE') counts.moderate += 1;
    else if (level === 'WEAK') counts.weak += 1;
    else counts.none += 1;

    if (professional) {
      if (level === 'STRONG') counts.professionalStrong += 1;
      else if (level === 'MODERATE') counts.professionalModerate += 1;
      else if (level === 'WEAK') counts.professionalWeak += 1;
      else counts.professionalNone += 1;
    }
  }

  return { ...counts, tier: classifyQualityTier(counts) };
}

async function auditChain(
  ds: DataSource,
  document: string,
): Promise<ChainAudit> {
  const persons = (await ds.query(
    `SELECT p.id::text, p.full_name, p.document
       FROM core.person p
      WHERE p.document = $1`,
    [document],
  )) as Array<{ id: string; full_name: string; document: string }>;

  if (persons.length === 0) {
    return {
      document,
      personId: null,
      fullName: null,
      error: 'PERSON_NOT_FOUND',
      action: 'NEED_CV',
      chainAligned: false,
      activeCvId: null,
      activeExtractionId: null,
      activeEnrichmentId: null,
      activeEvidenceId: null,
      actionsNeeded: ['Registrar persona en core.person'],
    };
  }
  if (persons.length > 1) {
    return {
      document,
      personId: null,
      fullName: null,
      error: 'PERSON_AMBIGUOUS',
      action: 'NEED_CV',
      chainAligned: false,
      activeCvId: null,
      activeExtractionId: null,
      activeEnrichmentId: null,
      activeEvidenceId: null,
      actionsNeeded: ['Resolver duplicado de documento en core.person'],
    };
  }

  const person = persons[0];
  const personId = person.id;

  const cvs = (await ds.query(
    `SELECT id::text, is_active, drive_file_id
       FROM organigrama.person_cv WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [personId],
  )) as Array<{ id: string; is_active: boolean; drive_file_id: string | null }>;
  const activeCv = cvs.find((c) => c.is_active) ?? null;

  const extractions = (await ds.query(
    `SELECT id::text, person_cv_id::text, status, is_active
       FROM organigrama.cv_extraction WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  )) as Array<{
    id: string;
    person_cv_id: string;
    status: string;
    is_active: boolean;
  }>;
  const activeExt =
    extractions.find((e) => e.status === 'SUCCEEDED' && e.is_active) ?? null;

  const enrichments = (await ds.query(
    `SELECT id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_skill_enrichment WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  )) as Array<{
    id: string;
    extraction_id: string;
    status: string;
    is_active: boolean;
  }>;
  const activeEnr =
    enrichments.find((e) => e.status === 'SUCCEEDED' && e.is_active) ?? null;

  const evidences = (await ds.query(
    `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
       FROM organigrama.cv_evidence_evaluation WHERE person_id = $1 ORDER BY id DESC`,
    [personId],
  )) as Array<{
    id: string;
    enrichment_id: string;
    extraction_id: string;
    status: string;
    is_active: boolean;
  }>;
  const activeEv =
    evidences.find((e) => e.status === 'SUCCEEDED' && e.is_active) ?? null;

  const chainAligned =
    Boolean(activeCv) &&
    Boolean(activeExt) &&
    Boolean(activeEnr) &&
    Boolean(activeEv) &&
    String(activeExt?.person_cv_id) === String(activeCv?.id) &&
    String(activeEnr?.extraction_id) === String(activeExt?.id) &&
    String(activeEv?.enrichment_id) === String(activeEnr?.id) &&
    String(activeEv?.extraction_id) === String(activeExt?.id);

  let action: ChainAction = 'NONE';
  const actionsNeeded: string[] = [];

  if (!activeCv) {
    action = 'NEED_CV';
    actionsNeeded.push('Sincronizar CV: npm run sync:person-cv -- --document=' + document);
  } else if (!activeExt) {
    action = 'NEED_EXTRACTION';
    actionsNeeded.push(
      'Extraer skills: npm run extract:cv-skills -- --document=' +
        document +
        ' --persist',
    );
  } else if (
    !activeEnr ||
    String(activeEnr.extraction_id) !== String(activeExt.id)
  ) {
    action = 'NEED_ENRICHMENT';
    actionsNeeded.push(
      'Enriquecer skills: npm run enrich:cv-skills -- --extraction-id=' +
        activeExt.id +
        ' --persist',
    );
  } else if (
    !activeEv ||
    String(activeEv.enrichment_id) !== String(activeEnr.id)
  ) {
    action = 'NEED_EVIDENCE';
    actionsNeeded.push(
      'Evaluar evidencia: npm run evaluate:cv-evidence -- --extraction-id=' +
        activeExt.id +
        ' --persist',
    );
  } else if (!chainAligned) {
    action = 'NEED_REALIGN';
    actionsNeeded.push(
      'Re-alinear cadena activa (CV/extracción/enrichment/evidence) antes de PA2',
    );
  } else {
    action = 'CHAIN_COMPLETE';
  }

  return {
    document,
    personId,
    fullName: person.full_name,
    action,
    chainAligned,
    activeCvId: activeCv?.id ?? null,
    activeExtractionId: activeExt?.id ?? null,
    activeEnrichmentId: activeEnr?.id ?? null,
    activeEvidenceId: activeEv?.id ?? null,
    actionsNeeded,
  };
}

function shellReextract(document: string): { ok: boolean; message: string } {
  try {
    console.log(
      `${TAG} force-reextract: ejecutando extract:cv-skills --document=${document} --persist`,
    );
    execSync(
      `npm run extract:cv-skills -- --document=${document} --persist`,
      {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: process.env,
      },
    );
    return { ok: true, message: 'EXTRACT_INVOKED' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message };
  }
}

function getDefaultSpecialtyMetrics(result: McPa2EngineRunResult): {
  defaultSpecialtyCode: string | null;
  defaultSpecialtyStrength: number;
  defaultSpecialtyProfessionalContribution: number;
} {
  const defaultCode = result.defaultSpecialtyCode;
  const defaultRow = defaultCode
    ? result.specialtyResults.find((r) => r.specialtyCode === defaultCode)
    : null;

  return {
    defaultSpecialtyCode: defaultCode,
    defaultSpecialtyStrength: defaultRow?.strength ?? 0,
    defaultSpecialtyProfessionalContribution:
      defaultRow?.professionalContribution ?? 0,
  };
}

function selectPrimaryDomain(
  domains: DomainEvaluationReport[],
): PrimarySelection {
  const primaryCandidates = domains.filter(
    (d) => d.conceptualClass === 'PRIMARY_MATCH',
  );

  if (primaryCandidates.length === 0) {
    return { status: 'NO_PRIMARY_MATCH' };
  }

  if (primaryCandidates.length === 1) {
    return {
      status: 'SINGLE_PRIMARY',
      domainCode: primaryCandidates[0].domainCode,
    };
  }

  const ranked = [...primaryCandidates].sort((a, b) => {
    if (b.activeCount !== a.activeCount) {
      return b.activeCount - a.activeCount;
    }
    if (
      b.defaultSpecialtyProfessionalContribution !==
      a.defaultSpecialtyProfessionalContribution
    ) {
      return (
        b.defaultSpecialtyProfessionalContribution -
        a.defaultSpecialtyProfessionalContribution
      );
    }
    return b.defaultSpecialtyStrength - a.defaultSpecialtyStrength;
  });

  const winner = ranked[0];
  const demoted = ranked.slice(1).map((d) => d.domainCode);

  for (const d of domains) {
    if (demoted.includes(d.domainCode) && d.conceptualClass === 'PRIMARY_MATCH') {
      d.conceptualClass = 'SECONDARY_SIGNAL';
      d.approvedForPublication = false;
    }
  }

  return {
    status: 'RESOLVED_TIE',
    domainCode: winner.domainCode,
    demoted,
  };
}

function buildDomainReport(
  domainCode: string,
  rulesVersion: string,
  result: McPa2EngineRunResult,
  qualityTier: QualityTier,
  dryRunOutcome?: string,
  persistOutcome?: string,
  evaluationId?: string | null,
  approvedForPublication = false,
  dryRun?: McPa2EvaluateOutcome,
): DomainEvaluationReport {
  const metrics = getDefaultSpecialtyMetrics(result);
  const conceptualClass = classifyDomainConceptually(result, qualityTier);

  return {
    domainCode,
    rulesVersion,
    skipped: false,
    dryRunOutcome,
    persistOutcome,
    evaluationId: evaluationId ?? null,
    activeCount: result.activeCount,
    emergentCount: result.emergentCount,
    hiddenCount: result.hiddenCount,
    ...metrics,
    conceptualClass,
    approvedForPublication,
    dryRun,
    specialtySummary: result.specialtyResults.map((r) => ({
      specialtyCode: r.specialtyCode,
      presentationStatus: r.presentationStatus,
      strength: r.strength,
      professionalContribution: r.professionalContribution,
    })),
  };
}

async function verifyApiExposure(
  competencies: OrgChartCompetenciesService,
  personId: string,
  domainCode: string,
): Promise<{ ok: boolean; availabilityStatus?: string; domainFound?: boolean }> {
  const viewer: OrgViewerContext = {
    personId,
    eduEmail: 'mc110@local',
    permissions: ['ORG_READ_ALL'],
  };

  const summary = await competencies.getExplorerSummary(viewer, personId, '0', {
    includeHidden: true,
    includeAudit: true,
  });

  const domainFound = summary.domains?.some((d) => d.code === domainCode) ?? false;

  return {
    ok: summary.availabilityStatus === 'AVAILABLE' && domainFound,
    availabilityStatus: summary.availabilityStatus,
    domainFound,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const fatalErrors: string[] = [];

  console.log(
    `${TAG} Inicio MC1.10.0 mode=${args.persist ? 'PERSIST' : 'DRY_RUN'} ` +
      `documentos=${args.documents.join(',')}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const pa2 = app.select(McCatalogModule).get(McPa2Service);
  const competencies = app.get(OrgChartCompetenciesService);

  const personReports: Array<Record<string, unknown>> = [];

  try {
    for (const document of args.documents) {
      console.log(`${TAG} ── documento=${document} ──`);

      let chain = await auditChain(ds, document);

      if (chain.error === 'PERSON_NOT_FOUND') {
        console.error(`${TAG} ERROR persona no encontrada: ${document}`);
        fatalErrors.push(`PERSON_NOT_FOUND:${document}`);
        personReports.push({ document, chain, skipped: true });
        continue;
      }
      if (chain.error === 'PERSON_AMBIGUOUS') {
        console.error(`${TAG} ERROR documento ambiguo: ${document}`);
        fatalErrors.push(`PERSON_AMBIGUOUS:${document}`);
        personReports.push({ document, chain, skipped: true });
        continue;
      }

      console.log(
        `${TAG} persona=${chain.fullName} id=${chain.personId} acción=${chain.action}`,
      );

      if (args.forceReextract && chain.action === 'NEED_EXTRACTION') {
        const reextract = shellReextract(document);
        console.log(`${TAG} force-reextract resultado=${reextract.message}`);
        chain = await auditChain(ds, document);
        console.log(`${TAG} re-auditoría acción=${chain.action}`);
      }

      if (chain.action !== 'CHAIN_COMPLETE') {
        console.warn(
          `${TAG} cadena incompleta (${chain.action}). Acciones sugeridas:`,
        );
        for (const step of chain.actionsNeeded) {
          console.warn(`${TAG}   → ${step}`);
        }

        if (args.persist) {
          console.error(
            `${TAG} ERROR persist bloqueado: cadena incompleta para ${document}`,
          );
          fatalErrors.push(`CHAIN_INCOMPLETE_ON_PERSIST:${document}`);
        }

        personReports.push({
          document,
          personId: chain.personId,
          fullName: chain.fullName,
          chain,
          quality: null,
          domains: [],
          primarySelection: { status: 'NO_PRIMARY_MATCH' },
          persistResult: null,
          skippedPa2: true,
        });
        continue;
      }

      const quality = await loadEvidenceQuality(ds, chain.activeEvidenceId!);
      console.log(
        `${TAG} calidad evidencia tier=${quality.tier} ` +
          `prof STRONG=${quality.professionalStrong} MOD=${quality.professionalModerate} ` +
          `WEAK=${quality.professionalWeak} NONE=${quality.professionalNone}`,
      );

      const domainReports: DomainEvaluationReport[] = [];

      for (const { domainCode, rulesVersion } of DOMAIN_RULES) {
        console.log(
          `${TAG} PA2 dry-run domain=${domainCode} rules=${rulesVersion}`,
        );

        try {
          const outcome = await pa2.evaluateProfileDomain({
            extractionId: chain.activeExtractionId!,
            domainCode,
            rulesVersion,
            persist: false,
          });

          const report = buildDomainReport(
            domainCode,
            rulesVersion,
            outcome.result,
            quality.tier,
            outcome.outcome,
            undefined,
            null,
            false,
            outcome,
          );

          console.log(
            `${TAG}   ${domainCode}: ACTIVE=${report.activeCount} EMERGENT=${report.emergentCount} ` +
              `HIDDEN=${report.hiddenCount} default=${report.defaultSpecialtyCode ?? '—'} ` +
              `clase=${report.conceptualClass}`,
          );

          domainReports.push(report);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`${TAG} ERROR PA2 ${domainCode}: ${message}`);
          domainReports.push({
            domainCode,
            rulesVersion,
            skipped: true,
            skipReason: message,
            activeCount: 0,
            emergentCount: 0,
            hiddenCount: 0,
            defaultSpecialtyCode: null,
            defaultSpecialtyStrength: 0,
            defaultSpecialtyProfessionalContribution: 0,
            conceptualClass: 'OUTSIDE',
            approvedForPublication: false,
            specialtySummary: [],
          });
        }
      }

      const primarySelection = selectPrimaryDomain(domainReports);
      console.log(
        `${TAG} selección primaria: ${JSON.stringify(primarySelection)}`,
      );

      const publicationDomainCode =
        primarySelection.status === 'SINGLE_PRIMARY' ||
        primarySelection.status === 'RESOLVED_TIE'
          ? primarySelection.domainCode
          : null;

      for (const report of domainReports) {
        report.approvedForPublication =
          publicationDomainCode !== null &&
          report.domainCode === publicationDomainCode &&
          !report.skipped;
      }

      let persistResult: Record<string, unknown> | null = null;

      if (args.persist) {
        const persistable = domainReports.filter(
          (d) => !d.skipped && d.dryRun,
        );

        if (!persistable.length) {
          console.warn(`${TAG} persist omitido: ningún dominio evaluable`);
          persistResult = { status: 'SKIPPED', reason: 'NO_DOMAIN_EVALUATED' };
        } else {
          console.log(
            `${TAG} persist atómico domains=${persistable.length} ` +
              `winner=${publicationDomainCode ?? 'NONE'}`,
          );

          try {
            const batchResult = await pa2.persistMultidomainEvaluationRun(
              persistable.map((report) => ({
                meta: report.dryRun!.meta,
                result: report.dryRun!.result,
                config: resolveMcPa2EngineConfig(report.rulesVersion),
                inputSkillsCount: report.dryRun!.inputSkillsCount,
                domainQualification: report.conceptualClass,
                activateOnPersist: report.approvedForPublication,
              })),
            );

            console.log(
              `${TAG} evaluationSet id=${batchResult.evaluationSetId} ` +
                `status=${batchResult.evaluationSetStatus} ` +
                `hash=${batchResult.contextHash.slice(0, 16)}… ` +
                `schema=${batchResult.schemaVersion} ` +
                `qualificationPolicy=${batchResult.qualificationPolicyVersion}`,
            );

            for (const bo of batchResult.domainResults) {
              const report = domainReports.find(
                (d) => d.domainCode === bo.domainCode,
              );
              if (report) {
                report.persistOutcome = 'SEEDED';
                report.evaluationId = bo.profileEvaluationId;
                console.log(
                  `${TAG} SEEDED evaluación id=${bo.profileEvaluationId} ` +
                    `domain=${bo.domainCode} ` +
                    `domainStatus=${bo.domainStatus} ` +
                    `qualification=${bo.domainQualification} ` +
                    `active=${bo.isActive}`,
                );
              }
            }

            const published = batchResult.domainResults.find((p) => p.isActive);
            persistResult = {
              status: 'COMPLETED',
              publicationDomainCode: publicationDomainCode,
              evaluationSetId: batchResult.evaluationSetId,
              evaluationSetStatus: batchResult.evaluationSetStatus,
              contextHash: batchResult.contextHash,
              schemaVersion: batchResult.schemaVersion,
              qualificationPolicyVersion:
                batchResult.qualificationPolicyVersion,
              candidateDomains: batchResult.domainResults.map(
                (d) => d.domainCode,
              ),
              domains: batchResult.domainResults,
              evaluationId: published?.profileEvaluationId ?? null,
              atomic: true,
            };

            if (
              publicationDomainCode &&
              !args.skipApiCheck &&
              published?.profileEvaluationId
            ) {
              const apiCheck = await verifyApiExposure(
                competencies,
                chain.personId!,
                publicationDomainCode,
              );
              console.log(
                `${TAG} API check availability=${apiCheck.availabilityStatus} ` +
                  `domainFound=${apiCheck.domainFound}`,
              );
              persistResult = {
                ...persistResult,
                apiCheck,
              };
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`${TAG} ERROR persist atómico: ${message}`);
            fatalErrors.push(`PERSIST_ATOMIC_FAILED:${document}`);
            persistResult = {
              status: 'ROLLED_BACK',
              reason: message,
              publicationDomainCode,
              atomic: true,
            };
          }
        }
      }

      personReports.push({
        document,
        personId: chain.personId,
        fullName: chain.fullName,
        chain,
        quality,
        domains: domainReports,
        primarySelection,
        persistResult,
        mode: args.persist ? 'PERSIST' : 'DRY_RUN',
      });
    }

    const report = {
      phase: 'MC1.10.0',
      generatedAt: new Date().toISOString(),
      mode: args.persist ? 'PERSIST' : 'DRY_RUN',
      options: {
        forceReextract: args.forceReextract,
        skipApiCheck: args.skipApiCheck,
      },
      documents: args.documents,
      persons: personReports,
      summary: {
        total: args.documents.length,
        chainComplete: personReports.filter(
          (p) =>
            (p.chain as ChainAudit | undefined)?.action === 'CHAIN_COMPLETE',
        ).length,
        primaryMatches: personReports.filter(
          (p) =>
            (p.primarySelection as PrimarySelection)?.status ===
              'SINGLE_PRIMARY' ||
            (p.primarySelection as PrimarySelection)?.status === 'RESOLVED_TIE',
        ).length,
        fatalErrors,
      },
    };

    mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
    const outPath = resolve(process.cwd(), args.out);
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`${TAG} artefacto JSON: ${outPath}`);
    console.log(`${TAG} resumen: ${JSON.stringify(report.summary)}`);

    if (fatalErrors.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
