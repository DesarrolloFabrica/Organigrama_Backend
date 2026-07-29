/**
 * MC1.10.2 — Activación Visual/Audiovisual para equipo creativo de un líder.
 *
 * npm run mc:activate-creative-team -- --leader-document=<DOC> --dry-run
 * npm run mc:activate-creative-team -- --leader-document=<DOC> --persist
 * npm run mc:activate-creative-team -- --leader-document=<DOC> --team-scope=auto
 * npm run mc:activate-creative-team -- --leader-document=<DOC> --team-scope=siblings
 * npm run mc:activate-creative-team -- --leader-document=<DOC> --documents=... --persist
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
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';
import { DataSource } from 'typeorm';

const TAG = '[MC1.10.2]';

const CREATIVE_DOMAINS = ['VISUAL_DESIGN', 'AUDIOVISUAL_PRODUCTION'] as const;

const DOMAIN_RULES: ReadonlyArray<{ domainCode: string; rulesVersion: string }> =
  [
    { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
    {
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      rulesVersion: 'pa2-audiovisual-production-1.0.0',
    },
    { domainCode: 'SOFTWARE', rulesVersion: 'pa2-software-1.1.0' },
  ];

const PRESENTER_TERMS = [
  'presentador',
  'presentadora',
  'conduccion',
  'locucion',
  'frente a camara',
  'host',
  'reportera',
  'reportero',
  'maestra de ceremonias',
  'maestro de ceremonias',
  'talento en camara',
  'conductor',
  'conductora',
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
];

const AV_PRACTICE_TERMS = [
  'after effects como',
  'premiere como',
  'practica de edicion',
  'produccion audiovisual',
  'produccion de video',
  'realizacion audiovisual',
];

const TOOL_ONLY_TERMS = [
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

const ADMIN_TERMS = [
  'asistente administrativo',
  'apoyo administrativo',
  'secretaria',
  'secretario',
  'auxiliar administrativo',
  'gestion documental',
  'archivo y correspondencia',
  'atencion al cliente',
  'recepcion',
];

type ChainAction =
  | 'NONE'
  | 'NEED_CV'
  | 'NEED_EXTRACTION'
  | 'NEED_ENRICHMENT'
  | 'NEED_EVIDENCE'
  | 'NEED_REALIGN'
  | 'CHAIN_COMPLETE';

type QualityTier = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

type DomainConceptualClass =
  | 'PRIMARY_MATCH'
  | 'SECONDARY_SIGNAL'
  | 'OUTSIDE'
  | 'INSUFFICIENT_EVIDENCE';

type PreliminaryClass =
  | 'PRESENTER_DEFERRED'
  | 'CANDIDATE_VISUAL'
  | 'CANDIDATE_AUDIOVISUAL'
  | 'CANDIDATE_VISUAL_AUDIOVISUAL'
  | 'POSSIBLE_ADMINISTRATIVE'
  | 'OTHER_DOMAIN'
  | 'INSUFFICIENT_INFORMATION';

type PrimarySelection =
  | { status: 'SINGLE_PRIMARY'; domainCode: string }
  | { status: 'RESOLVED_TIE'; domainCode: string; demoted: string[] }
  | { status: 'NO_PRIMARY_MATCH' }
  | { status: 'SOFTWARE_ONLY'; domainCode: 'SOFTWARE'; note: string };

type TeamScopeArg = 'direct' | 'siblings' | 'auto';
type ResolvedTeamScope = 'direct' | 'siblings';

interface ScriptArgs {
  leaderDocument: string;
  documents: string[];
  teamScope: TeamScopeArg;
  dryRun: boolean;
  persist: boolean;
  includeVisual: boolean;
  includeAudiovisual: boolean;
  excludePresenters: boolean;
  forceReextract: boolean;
  skipApiCheck: boolean;
  out: string;
}

interface TeamMember {
  id: string;
  document: string;
  full_name: string;
  role_name: string | null;
  area_name: string | null;
}

interface StructuralParent {
  id: string;
  name: string;
  document: string | null;
}

interface ParentRelationCandidate {
  parentPersonId: string;
  parentName: string;
  parentDocument: string | null;
  siblingCount: number;
}

interface LoadTeamResult {
  members: TeamMember[];
  teamScope: ResolvedTeamScope;
  structuralParent: StructuralParent | null;
  directChildrenCount: number;
  parentAmbiguity: ParentRelationCandidate[] | null;
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
  activeMcEvaluationId: string | null;
  activeMcEvaluationDomain: string | null;
  actionsNeeded: string[];
}

interface PreliminaryReport {
  classification: PreliminaryClass;
  visualSignals: string[];
  avSignals: string[];
  presenterSignals: string[];
  adminSignals: string[];
  toolOnlyHits: string[];
  matchedTexts: string[];
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
  conceptualClass: DomainConceptualClass;
  approvedForPersistence: boolean;
  specialtySummary: Array<{
    specialtyCode: string;
    presentationStatus: string;
    strength: number;
    professionalContribution: number;
  }>;
}

function parseArgs(argv: string[]): ScriptArgs {
  const out: ScriptArgs = {
    leaderDocument: '',
    documents: [],
    teamScope: 'auto',
    dryRun: true,
    persist: false,
    includeVisual: true,
    includeAudiovisual: true,
    excludePresenters: true,
    forceReextract: false,
    skipApiCheck: false,
    out: 'tmp/mc1102-activate-creative-team.json',
  };

  for (const arg of argv) {
    if (arg.startsWith('--leader-document=')) {
      out.leaderDocument = arg.slice('--leader-document='.length).trim();
    } else if (arg.startsWith('--team-scope=')) {
      const scope = arg.slice('--team-scope='.length).trim() as TeamScopeArg;
      if (scope !== 'direct' && scope !== 'siblings' && scope !== 'auto') {
        throw new Error(
          `team-scope inválido "${scope}": use direct, siblings o auto.`,
        );
      }
      out.teamScope = scope;
    } else if (arg.startsWith('--documents=')) {
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
    } else if (arg === '--include-visual') {
      out.includeVisual = true;
    } else if (arg === '--no-include-visual') {
      out.includeVisual = false;
    } else if (arg === '--include-audiovisual') {
      out.includeAudiovisual = true;
    } else if (arg === '--no-include-audiovisual') {
      out.includeAudiovisual = false;
    } else if (arg === '--exclude-presenters') {
      out.excludePresenters = true;
    } else if (arg === '--no-exclude-presenters') {
      out.excludePresenters = false;
    } else if (arg === '--force-reextract') {
      out.forceReextract = true;
    } else if (arg === '--skip-api-check') {
      out.skipApiCheck = true;
    } else if (arg.startsWith('--out=')) {
      out.out = arg.slice('--out='.length);
    }
  }

  if (!out.leaderDocument) {
    throw new Error(
      'Requiere --leader-document=<cedula>. ' +
        'Ejemplo: npm run mc:activate-creative-team -- --leader-document=1015482688',
    );
  }

  if (!/^\d+$/.test(out.leaderDocument)) {
    throw new Error(
      `Documento de líder inválido "${out.leaderDocument}": se esperan solo dígitos.`,
    );
  }

  for (const doc of out.documents) {
    if (!/^\d+$/.test(doc)) {
      throw new Error(`Documento inválido "${doc}": se esperan solo dígitos.`);
    }
  }

  return out;
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

function termMatches(text: string, term: string): boolean {
  const n = normalize(text);
  const nt = normalize(term);
  const needsBoundary =
    nt.length <= 10 ||
    nt.includes(' ') ||
    ['talento', 'host', 'motion', 'branding'].includes(nt);
  if (needsBoundary) {
    const escaped = nt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(n);
  }
  return n.includes(nt);
}

function matchTerms(text: string, terms: readonly string[]): string[] {
  return terms.filter((t) => termMatches(text, t));
}

function isProfessionalEvidenceType(skillType: string): boolean {
  return skillType === 'PROFESSIONAL_KNOWLEDGE' || skillType === 'METHOD';
}

function isToolOnlyText(text: string): boolean {
  const n = normalize(text);
  const toolHits = TOOL_ONLY_TERMS.filter((t) => termMatches(n, t));
  if (toolHits.length === 0) return false;
  const professionalHits = [
    ...VISUAL_TERMS,
    ...AV_TERMS,
    ...AV_PRACTICE_TERMS,
  ].filter((t) => termMatches(n, t));
  return professionalHits.length === 0;
}

function classifyQualityTier(
  summary: Omit<EvidenceQualitySummary, 'tier'>,
): QualityTier {
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

async function resolveLeader(
  ds: DataSource,
  document: string,
): Promise<{ id: string; full_name: string; document: string }> {
  const rows = (await ds.query(
    `SELECT p.id::text, p.full_name, p.document
       FROM core.person p
      WHERE p.document = $1`,
    [document],
  )) as Array<{ id: string; full_name: string; document: string }>;

  if (rows.length === 0) {
    throw new Error(`Líder no encontrado: documento=${document}`);
  }
  if (rows.length > 1) {
    throw new Error(`Documento de líder ambiguo: ${document}`);
  }
  return rows[0];
}

function applyDocumentFilter(
  members: TeamMember[],
  documentFilter: string[],
): TeamMember[] {
  if (documentFilter.length === 0) {
    return members;
  }
  const allowed = new Set(documentFilter);
  return members.filter((m) => allowed.has(m.document));
}

async function loadDirectTeamMembers(
  ds: DataSource,
  leaderPersonId: string,
): Promise<TeamMember[]> {
  return (await ds.query(
    `SELECT c.id::text, c.document, c.full_name, r.name AS role_name, a.name AS area_name
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation ovr ON ovr.version_id = v.id AND ovr.is_active = TRUE
       JOIN core.person c ON c.id = ovr.child_person_id
       LEFT JOIN core.role r ON r.id = c.role_id
       LEFT JOIN core.area a ON a.id = c.area_id
      WHERE v.is_active = TRUE AND ovr.parent_person_id = $1
      ORDER BY c.full_name`,
    [leaderPersonId],
  )) as TeamMember[];
}

async function loadLeaderParentCandidates(
  ds: DataSource,
  leaderPersonId: string,
): Promise<ParentRelationCandidate[]> {
  const rows = (await ds.query(
    `SELECT rn.parent_person_id::text AS parent_person_id,
            p.full_name AS parent_name,
            p.document AS parent_document,
            (
              SELECT COUNT(*)::int
                FROM organigrama.org_visual_relation sib
               WHERE sib.version_id = rn.version_id
                 AND sib.is_active = TRUE
                 AND sib.parent_person_id = rn.parent_person_id
                 AND sib.child_person_id <> $1
            ) AS sibling_count
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation rn
         ON rn.version_id = v.id AND rn.is_active = TRUE AND rn.child_person_id = $1
       JOIN core.person p ON p.id = rn.parent_person_id
      WHERE v.is_active = TRUE
      ORDER BY sibling_count DESC, p.full_name`,
    [leaderPersonId],
  )) as Array<{
    parent_person_id: string;
    parent_name: string;
    parent_document: string | null;
    sibling_count: number;
  }>;

  return rows.map((row) => ({
    parentPersonId: row.parent_person_id,
    parentName: row.parent_name,
    parentDocument: row.parent_document,
    siblingCount: Number(row.sibling_count),
  }));
}

async function loadSiblingTeamMembers(
  ds: DataSource,
  leaderPersonId: string,
  parentPersonId: string,
): Promise<TeamMember[]> {
  return (await ds.query(
    `SELECT c.id::text, c.document, c.full_name, r.name AS role_name, a.name AS area_name
       FROM organigrama.org_chart_version v
       JOIN organigrama.org_visual_relation rn
         ON rn.version_id = v.id AND rn.is_active = TRUE AND rn.child_person_id = $1
       JOIN organigrama.org_visual_relation ovr
         ON ovr.version_id = v.id AND ovr.is_active = TRUE
        AND ovr.parent_person_id = rn.parent_person_id
       JOIN core.person c ON c.id = ovr.child_person_id
       LEFT JOIN core.role r ON r.id = c.role_id
       LEFT JOIN core.area a ON a.id = c.area_id
      WHERE v.is_active = TRUE AND c.id <> $1
        AND rn.parent_person_id = $2
      ORDER BY c.full_name`,
    [leaderPersonId, parentPersonId],
  )) as TeamMember[];
}

async function loadTeamMembers(
  ds: DataSource,
  leaderPersonId: string,
  teamScopeArg: TeamScopeArg,
  documentFilter: string[],
): Promise<LoadTeamResult> {
  const directMembers = await loadDirectTeamMembers(ds, leaderPersonId);
  const directChildrenCount = directMembers.length;

  const pickStructuralParent = async (): Promise<{
    structuralParent: StructuralParent;
    parentAmbiguity: ParentRelationCandidate[] | null;
  }> => {
    const candidates = await loadLeaderParentCandidates(ds, leaderPersonId);
    if (candidates.length === 0) {
      throw new Error(
        'No hay relación activa de padre para el líder en la versión de organigrama activa.',
      );
    }

    const bestCount = candidates[0].siblingCount;
    const tied = candidates.filter((c) => c.siblingCount === bestCount);
    const chosen = tied[0];

    if (tied.length > 1) {
      console.warn(
        `${TAG} AMBIGÜEDAD: el líder tiene ${candidates.length} padres activos; ` +
          `${tied.length} empatan con ${bestCount} hermanos. ` +
          `Usando parent_person_id=${chosen.parentPersonId} (${chosen.parentName}).`,
      );
    }

    return {
      structuralParent: {
        id: chosen.parentPersonId,
        name: chosen.parentName,
        document: chosen.parentDocument,
      },
      parentAmbiguity: tied.length > 1 ? tied : null,
    };
  };

  if (teamScopeArg === 'direct') {
    return {
      members: applyDocumentFilter(directMembers, documentFilter),
      teamScope: 'direct',
      structuralParent: null,
      directChildrenCount,
      parentAmbiguity: null,
    };
  }

  if (teamScopeArg === 'siblings') {
    const { structuralParent, parentAmbiguity } = await pickStructuralParent();
    console.log(
      `${TAG} TEAM_SCOPE=SIBLINGS_UNDER_SHARED_PARENT parent_person_id=${structuralParent.id} ` +
        `parent_name=${structuralParent.name}`,
    );
    const siblings = await loadSiblingTeamMembers(
      ds,
      leaderPersonId,
      structuralParent.id,
    );
    return {
      members: applyDocumentFilter(siblings, documentFilter),
      teamScope: 'siblings',
      structuralParent,
      directChildrenCount,
      parentAmbiguity,
    };
  }

  // auto: direct first, fallback to siblings when empty
  if (directChildrenCount > 0) {
    return {
      members: applyDocumentFilter(directMembers, documentFilter),
      teamScope: 'direct',
      structuralParent: null,
      directChildrenCount,
      parentAmbiguity: null,
    };
  }

  console.log(
    `${TAG} TEAM_SCOPE: 0 hijos directos; fallback automático a hermanos bajo padre compartido`,
  );
  const { structuralParent, parentAmbiguity } = await pickStructuralParent();
  console.log(
    `${TAG} TEAM_SCOPE=SIBLINGS_UNDER_SHARED_PARENT parent_person_id=${structuralParent.id} ` +
      `parent_name=${structuralParent.name}`,
  );
  const siblings = await loadSiblingTeamMembers(
    ds,
    leaderPersonId,
    structuralParent.id,
  );
  return {
    members: applyDocumentFilter(siblings, documentFilter),
    teamScope: 'siblings',
    structuralParent,
    directChildrenCount,
    parentAmbiguity,
  };
}

interface SkillRow {
  normalized_name: string;
  normalized_key: string;
  skill_type: string;
  category: string | null;
}

interface EvidenceRow {
  normalized_name: string;
  evidence_level: string;
  explanation: string | null;
}

async function loadClassificationCorpus(
  ds: DataSource,
  personId: string,
): Promise<{ skills: SkillRow[]; evidence: EvidenceRow[] }> {
  const extractions = (await ds.query(
    `SELECT id::text FROM organigrama.cv_extraction
      WHERE person_id = $1 AND status = 'SUCCEEDED' AND is_active = TRUE
      ORDER BY id DESC LIMIT 1`,
    [personId],
  )) as Array<{ id: string }>;

  if (extractions.length === 0) {
    return { skills: [], evidence: [] };
  }

  const extractionId = extractions[0].id;

  const skills = (await ds.query(
    `SELECT s.normalized_name, s.normalized_key, s.skill_type, ces.category
       FROM organigrama.cv_extraction_skill ces
       JOIN organigrama.cv_skill s ON s.id = ces.skill_id
      WHERE ces.extraction_id = $1`,
    [extractionId],
  )) as SkillRow[];

  const evidences = (await ds.query(
    `SELECT id::text FROM organigrama.cv_evidence_evaluation
      WHERE person_id = $1 AND status = 'SUCCEEDED' AND is_active = TRUE
      ORDER BY id DESC LIMIT 1`,
    [personId],
  )) as Array<{ id: string }>;

  let evidence: EvidenceRow[] = [];
  if (evidences.length > 0) {
    evidence = (await ds.query(
      `SELECT ei.normalized_name, ei.evidence_level, ei.explanation
         FROM organigrama.cv_evidence_evaluation_item ei
        WHERE ei.evaluation_id = $1`,
      [evidences[0].id],
    )) as EvidenceRow[];
  }

  return { skills, evidence };
}

function classifyPreliminary(
  child: TeamMember,
  corpus: { skills: SkillRow[]; evidence: EvidenceRow[] },
): PreliminaryReport {
  const texts: Array<{ text: string; professional: boolean; source: string }> =
    [];

  for (const s of corpus.skills) {
    texts.push({
      text: s.normalized_name,
      professional: isProfessionalEvidenceType(s.skill_type),
      source: 'SKILL',
    });
  }

  for (const e of corpus.evidence) {
    const parts = [e.normalized_name, e.explanation].filter(Boolean) as string[];
    for (const part of parts) {
      texts.push({ text: part, professional: true, source: 'EVIDENCE' });
    }
  }

  const contextTexts = [
    child.role_name ?? '',
    child.area_name ?? '',
    child.full_name,
  ].filter(Boolean);

  const presenterSignals: string[] = [];
  const visualSignals: string[] = [];
  const avSignals: string[] = [];
  const adminSignals: string[] = [];
  const toolOnlyHits: string[] = [];
  const matchedTexts: string[] = [];

  const scan = (text: string, professional: boolean, source: string) => {
    if (!text.trim()) return;

    const presenter = matchTerms(text, PRESENTER_TERMS);
    const visual = matchTerms(text, [...VISUAL_TERMS]);
    const avDirect = matchTerms(text, [...AV_TERMS]);
    const avPractice = matchTerms(text, [...AV_PRACTICE_TERMS]);
    const admin = matchTerms(text, ADMIN_TERMS);

    if (presenter.length) {
      presenterSignals.push(...presenter.map((t) => `${source}:${t}`));
      matchedTexts.push(`${source}(presenter): ${text.slice(0, 120)}`);
    }

    const avHits = [...avDirect, ...avPractice];
    const toolOnly = isToolOnlyText(text);

    if (toolOnly && !professional) {
      toolOnlyHits.push(`${source}:${text.slice(0, 80)}`);
      return;
    }

    if (visual.length && (professional || source === 'EVIDENCE')) {
      visualSignals.push(...visual.map((t) => `${source}:${t}`));
      matchedTexts.push(`${source}(visual): ${text.slice(0, 120)}`);
    } else if (visual.length && !toolOnly) {
      visualSignals.push(...visual.map((t) => `${source}:${t}`));
      matchedTexts.push(`${source}(visual): ${text.slice(0, 120)}`);
    }

    if (avHits.length && (professional || source === 'EVIDENCE')) {
      avSignals.push(...avHits.map((t) => `${source}:${t}`));
      matchedTexts.push(`${source}(av): ${text.slice(0, 120)}`);
    } else if (avHits.length && !toolOnly) {
      avSignals.push(...avHits.map((t) => `${source}:${t}`));
      matchedTexts.push(`${source}(av): ${text.slice(0, 120)}`);
    }

    if (admin.length) {
      adminSignals.push(...admin.map((t) => `${source}:${t}`));
    }
  };

  for (const t of texts) {
    scan(t.text, t.professional, t.source);
  }
  for (const ctx of contextTexts) {
    scan(ctx, false, 'CONTEXT');
  }

  const roleIsPresenter =
    matchTerms(child.role_name ?? '', PRESENTER_TERMS).length > 0;
  const roleIsAdmin =
    matchTerms(child.role_name ?? '', ADMIN_TERMS).length > 0 ||
    normalize(child.role_name ?? '').includes('auxiliar administrativo');

  const hasPresenter = presenterSignals.length > 0 || roleIsPresenter;
  const hasVisual = visualSignals.length > 0;
  const hasAv = avSignals.length > 0;
  const hasAdmin = adminSignals.length > 0 || roleIsAdmin;

  let classification: PreliminaryClass;

  // Cargo PRESENTADOR / presentación sin núcleo visual → diferir (no AV por
  // aparición en video). cargo organizacional ≠ dominio profesional.
  if (roleIsPresenter || (hasPresenter && !hasVisual)) {
    classification = 'PRESENTER_DEFERRED';
  } else if (hasVisual && hasAv) {
    classification = 'CANDIDATE_VISUAL_AUDIOVISUAL';
  } else if (hasVisual) {
    classification = 'CANDIDATE_VISUAL';
  } else if (hasAv) {
    classification = 'CANDIDATE_AUDIOVISUAL';
  } else if (hasAdmin) {
    classification = 'POSSIBLE_ADMINISTRATIVE';
  } else if (corpus.skills.length === 0 && corpus.evidence.length === 0) {
    classification = 'INSUFFICIENT_INFORMATION';
  } else {
    classification = 'OTHER_DOMAIN';
  }

  return {
    classification,
    visualSignals: [...new Set(visualSignals)],
    avSignals: [...new Set(avSignals)],
    presenterSignals: [...new Set(presenterSignals)],
    adminSignals: [...new Set(adminSignals)],
    toolOnlyHits: [...new Set(toolOnlyHits)],
    matchedTexts: matchedTexts.slice(0, 20),
  };
}

function isSelectedCandidate(
  preliminary: PreliminaryReport,
  args: ScriptArgs,
): boolean {
  const { classification } = preliminary;

  if (classification === 'CANDIDATE_VISUAL') {
    return args.includeVisual;
  }
  if (classification === 'CANDIDATE_AUDIOVISUAL') {
    return args.includeAudiovisual;
  }
  if (classification === 'CANDIDATE_VISUAL_AUDIOVISUAL') {
    return args.includeVisual || args.includeAudiovisual;
  }
  return false;
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
  personId: string,
  fullName: string,
): Promise<ChainAudit> {
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

  const mcEvals = (await ds.query(
    `SELECT id::text, domain_code, is_active
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = $1 AND is_active = TRUE
      ORDER BY id DESC LIMIT 1`,
    [personId],
  )) as Array<{ id: string; domain_code: string; is_active: boolean }>;
  const activeMcEval = mcEvals[0] ?? null;

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
    actionsNeeded.push(
      'Sincronizar CV: npm run sync:person-cv -- --document=' + document,
    );
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
      'Enriquecer skills: npm run enrich:cv-skills -- --extractionId=' +
        activeExt.id +
        ' --document=' +
        document +
        ' --persist --i-confirm-persist --activate --i-confirm-activate',
    );
  } else if (
    !activeEv ||
    String(activeEv.enrichment_id) !== String(activeEnr.id)
  ) {
    action = 'NEED_EVIDENCE';
    actionsNeeded.push(
      'Evaluar evidencia: npm run evaluate:cv-evidence -- --enrichmentId=' +
        activeEnr.id +
        ' --persist --i-confirm-persist --activate --i-confirm-activate',
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
    fullName,
    action,
    chainAligned,
    activeCvId: activeCv?.id ?? null,
    activeExtractionId: activeExt?.id ?? null,
    activeEnrichmentId: activeEnr?.id ?? null,
    activeEvidenceId: activeEv?.id ?? null,
    activeMcEvaluationId: activeMcEval?.id ?? null,
    activeMcEvaluationDomain: activeMcEval?.domain_code ?? null,
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
    (r) =>
      r.presentationStatus === 'EMERGENT' && r.professionalContribution > 0,
  );

  if (result.emergentCount >= 1 && emergentWithProfessional.length > 0) {
    return 'SECONDARY_SIGNAL';
  }

  if (result.emergentCount >= 1 && result.activeCount === 0) {
    return 'SECONDARY_SIGNAL';
  }

  if (
    result.activeCount === 0 &&
    result.emergentCount === 0 &&
    result.hiddenCount > 0
  ) {
    return 'OUTSIDE';
  }

  if (result.activeCount === 0 && result.emergentCount === 0) {
    return 'OUTSIDE';
  }

  return 'OUTSIDE';
}

function selectCreativePrimaryDomain(
  domains: DomainEvaluationReport[],
): PrimarySelection {
  const creativePrimary = domains.filter(
    (d) =>
      CREATIVE_DOMAINS.includes(
        d.domainCode as (typeof CREATIVE_DOMAINS)[number],
      ) && d.conceptualClass === 'PRIMARY_MATCH',
  );

  if (creativePrimary.length === 0) {
    const softwareOnly = domains.find(
      (d) =>
        d.domainCode === 'SOFTWARE' && d.conceptualClass === 'PRIMARY_MATCH',
    );
    if (softwareOnly) {
      return {
        status: 'SOFTWARE_ONLY',
        domainCode: 'SOFTWARE',
        note:
          'SOFTWARE fue el único PRIMARY_MATCH; no es dominio objetivo MC1.10.2. ' +
          'Documentar como OTHER.',
      };
    }
    return { status: 'NO_PRIMARY_MATCH' };
  }

  if (creativePrimary.length === 1) {
    return {
      status: 'SINGLE_PRIMARY',
      domainCode: creativePrimary[0].domainCode,
    };
  }

  const ranked = [...creativePrimary].sort((a, b) => {
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
      d.approvedForPersistence = false;
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
): DomainEvaluationReport {
  const metrics = getDefaultSpecialtyMetrics(result);
  const conceptualClass = classifyDomainConceptually(result, qualityTier);
  const isCreative = CREATIVE_DOMAINS.includes(
    domainCode as (typeof CREATIVE_DOMAINS)[number],
  );
  const approvedForPersistence =
    isCreative &&
    conceptualClass === 'PRIMARY_MATCH' &&
    qualityTier !== 'INSUFFICIENT';

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
    approvedForPersistence,
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
    eduEmail: 'mc1102@local',
    permissions: ['ORG_READ_ALL'],
  };

  const summary = await competencies.getExplorerSummary(viewer, personId, '0', {
    includeHidden: true,
    includeAudit: true,
  });

  const domainFound =
    summary.domains?.some((d) => d.code === domainCode) ?? false;

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
    `${TAG} Inicio MC1.10.2 mode=${args.persist ? 'PERSIST' : 'DRY_RUN'} ` +
      `lider=${args.leaderDocument} teamScope=${args.teamScope} ` +
      `visual=${args.includeVisual} av=${args.includeAudiovisual} ` +
      `excluirPresentadores=${args.excludePresenters}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const pa2 = app.select(McCatalogModule).get(McPa2Service);
  const competencies = app.get(OrgChartCompetenciesService);

  const selectedReports: Array<Record<string, unknown>> = [];
  const excludedReports: Array<Record<string, unknown>> = [];
  const universeReports: Array<Record<string, unknown>> = [];

  try {
    const leader = await resolveLeader(ds, args.leaderDocument);
    console.log(
      `${TAG} líder=${leader.full_name} id=${leader.id} documento=${leader.document}`,
    );

    const team = await loadTeamMembers(
      ds,
      leader.id,
      args.teamScope,
      args.documents,
    );
    console.log(
      `${TAG} alcance=${team.teamScope} miembros=${team.members.length} ` +
        `hijosDirectos=${team.directChildrenCount}` +
        (team.structuralParent
          ? ` padre=${team.structuralParent.name} (${team.structuralParent.id})`
          : '') +
        (args.documents.length
          ? ` filtro documentos=${args.documents.join(',')}`
          : ''),
    );

    for (const child of team.members) {
      console.log(
        `${TAG} ── ${child.full_name} documento=${child.document} cargo=${child.role_name ?? '—'} ──`,
      );

      const corpus = await loadClassificationCorpus(ds, child.id);
      const preliminary = classifyPreliminary(child, corpus);

      console.log(
        `${TAG} clasificación preliminar=${preliminary.classification} ` +
          `visual=${preliminary.visualSignals.length} av=${preliminary.avSignals.length} ` +
          `presentador=${preliminary.presenterSignals.length}`,
      );

      const universeEntry = {
        personId: child.id,
        document: child.document,
        fullName: child.full_name,
        roleName: child.role_name,
        areaName: child.area_name,
        preliminary,
        skillsCount: corpus.skills.length,
        evidenceCount: corpus.evidence.length,
      };
      universeReports.push(universeEntry);

      if (
        args.excludePresenters &&
        preliminary.classification === 'PRESENTER_DEFERRED'
      ) {
        console.log(`${TAG} omitido: presentador diferido (exclude-presenters)`);
        excludedReports.push({
          ...universeEntry,
          excludeReason: 'PRESENTER_DEFERRED',
        });
        continue;
      }

      if (!isSelectedCandidate(preliminary, args)) {
        console.log(
          `${TAG} omitido: no es candidato visual/AV seleccionado (${preliminary.classification})`,
        );
        excludedReports.push({
          ...universeEntry,
          excludeReason: preliminary.classification,
        });
        continue;
      }

      let chain = await auditChain(
        ds,
        child.document,
        child.id,
        child.full_name,
      );

      console.log(
        `${TAG} cadena acción=${chain.action} mc_eval=${chain.activeMcEvaluationId ?? '—'} ` +
          `(${chain.activeMcEvaluationDomain ?? 'sin eval activa'})`,
      );

      if (args.forceReextract && chain.action === 'NEED_EXTRACTION') {
        const reextract = shellReextract(child.document);
        console.log(`${TAG} force-reextract resultado=${reextract.message}`);
        chain = await auditChain(
          ds,
          child.document,
          child.id,
          child.full_name,
        );
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
          console.warn(
            `${TAG} persist omitido por cadena incompleta (${chain.action}) ` +
              `documento=${child.document} — no es error fatal si no hay CV sincronizado`,
          );
        }

        selectedReports.push({
          ...universeEntry,
          chain,
          quality: null,
          domains: [],
          primarySelection: { status: 'NO_PRIMARY_MATCH' },
          persistResult: args.persist
            ? { status: 'SKIPPED', reason: chain.action }
            : null,
          skippedPa2: true,
        });
        continue;
      }

      const quality = await loadEvidenceQuality(ds, chain.activeEvidenceId!);
      console.log(
        `${TAG} calidad evidencia tier=${quality.tier} ` +
          `prof STRONG=${quality.professionalStrong} MOD=${quality.professionalModerate}`,
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
          );

          console.log(
            `${TAG}   ${domainCode}: ACTIVE=${report.activeCount} EMERGENT=${report.emergentCount} ` +
              `HIDDEN=${report.hiddenCount} default=${report.defaultSpecialtyCode ?? '—'} ` +
              `clase=${report.conceptualClass} approved=${report.approvedForPersistence}`,
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
            approvedForPersistence: false,
            specialtySummary: [],
          });
        }
      }

      const primarySelection = selectCreativePrimaryDomain(domainReports);
      console.log(
        `${TAG} selección primaria: ${JSON.stringify(primarySelection)}`,
      );

      let persistResult: Record<string, unknown> | null = null;

      if (args.persist) {
        const approved = domainReports.find((d) => d.approvedForPersistence);

        if (!approved) {
          console.warn(
            `${TAG} persist omitido: ningún dominio Visual/AV APPROVED`,
          );
          persistResult = { status: 'SKIPPED', reason: 'NO_APPROVED_DOMAIN' };
        } else if (primarySelection.status === 'SOFTWARE_ONLY') {
          console.warn(
            `${TAG} persist omitido: solo SOFTWARE (control negativo) — ${primarySelection.note}`,
          );
          persistResult = {
            status: 'SKIPPED',
            reason: 'SOFTWARE_ONLY_NEGATIVE_CONTROL',
            note: primarySelection.note,
          };
        } else if (
          primarySelection.status !== 'SINGLE_PRIMARY' &&
          primarySelection.status !== 'RESOLVED_TIE'
        ) {
          console.warn(`${TAG} persist omitido: NO_PRIMARY_MATCH creativo`);
          persistResult = { status: 'SKIPPED', reason: 'NO_PRIMARY_MATCH' };
        } else if (approved.domainCode !== primarySelection.domainCode) {
          console.warn(
            `${TAG} persist omitido: primario=${primarySelection.domainCode} ` +
              `≠ aprobado=${approved.domainCode}`,
          );
          persistResult = {
            status: 'SKIPPED',
            reason: 'PRIMARY_DOMAIN_NOT_APPROVED',
          };
        } else {
          console.log(
            `${TAG} persist PA2 domain=${approved.domainCode} rules=${approved.rulesVersion}`,
          );

          const persistOutcome = await pa2.evaluateProfileDomain({
            extractionId: chain.activeExtractionId!,
            domainCode: approved.domainCode,
            rulesVersion: approved.rulesVersion,
            persist: true,
          });

          approved.persistOutcome = persistOutcome.outcome;
          approved.evaluationId = persistOutcome.evaluationId;

          if (persistOutcome.outcome === 'ALREADY_EXISTS') {
            console.log(
              `${TAG} REUSE evaluación existente id=${persistOutcome.evaluationId}`,
            );
          } else {
            console.log(
              `${TAG} SEEDED evaluación id=${persistOutcome.evaluationId}`,
            );
          }

          persistResult = {
            status: persistOutcome.outcome,
            domainCode: approved.domainCode,
            evaluationId: persistOutcome.evaluationId,
          };

          if (!args.skipApiCheck) {
            const apiCheck = await verifyApiExposure(
              competencies,
              child.id,
              approved.domainCode,
            );
            console.log(
              `${TAG} API check availability=${apiCheck.availabilityStatus} ` +
                `domainFound=${apiCheck.domainFound}`,
            );
            persistResult = { ...persistResult, apiCheck };
          }
        }
      }

      selectedReports.push({
        ...universeEntry,
        chain,
        quality,
        domains: domainReports,
        primarySelection,
        persistResult,
        mode: args.persist ? 'PERSIST' : 'DRY_RUN',
        skippedPa2: false,
      });
    }

    const report = {
      phase: 'MC1.10.2',
      generatedAt: new Date().toISOString(),
      mode: args.persist ? 'PERSIST' : 'DRY_RUN',
      leader: {
        id: leader.id,
        document: leader.document,
        fullName: leader.full_name,
      },
      teamScope: team.teamScope,
      teamScopeArg: args.teamScope,
      directChildrenCount: team.directChildrenCount,
      structuralParent: team.structuralParent,
      parentAmbiguity: team.parentAmbiguity,
      options: {
        teamScope: args.teamScope,
        includeVisual: args.includeVisual,
        includeAudiovisual: args.includeAudiovisual,
        excludePresenters: args.excludePresenters,
        forceReextract: args.forceReextract,
        skipApiCheck: args.skipApiCheck,
        documentFilter: args.documents,
      },
      universe: universeReports,
      selected: selectedReports,
      excluded: excludedReports,
      summary: {
        teamMembersTotal: team.members.length,
        directChildrenCount: team.directChildrenCount,
        universeSize: universeReports.length,
        selectedCount: selectedReports.length,
        excludedCount: excludedReports.length,
        chainComplete: selectedReports.filter(
          (p) =>
            (p.chain as ChainAudit | undefined)?.action === 'CHAIN_COMPLETE',
        ).length,
        primaryMatches: selectedReports.filter(
          (p) => {
            const ps = p.primarySelection as PrimarySelection;
            return (
              ps?.status === 'SINGLE_PRIMARY' || ps?.status === 'RESOLVED_TIE'
            );
          },
        ).length,
        persisted: selectedReports.filter(
          (p) =>
            (p.persistResult as { status?: string } | null)?.status ===
              'SEEDED' ||
            (p.persistResult as { status?: string } | null)?.status ===
              'ALREADY_EXISTS',
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
