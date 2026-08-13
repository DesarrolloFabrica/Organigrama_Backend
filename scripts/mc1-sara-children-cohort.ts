/**
 * Cohorte Sara Juliana + hijos directos — LIVE full pipeline (config congelada 12E/12I).
 *
 *   node scripts/mc1-sara-children-bootstrap.js
 *   npx ts-node --transpile-only scripts/mc1-sara-children-cohort.ts --confirm
 *
 * P0→P1→P2→R1→P3→P4→Profile. No modifica prompts/catálogo/mapper/routing/gate.
 * Evidence-first: cargo/jerarquía solo para selección de cohorte.
 * No deploy. No masivo global.
 */
import {
  createHash,
  randomUUID,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  createMdeDataSource,
  createP0Service,
} from '../src/mc-observatory/p0-bootstrap';
import { runP1ForMember } from '../src/mc-observatory/p1-member-runner';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import {
  P1_CONTRACT_VERSION,
  P1_PROMPT_VERSION,
  P1_SEGMENTER_VERSION,
} from '../src/mc-pipeline/p1/p1.types';
import { P2_CONTRACT_VERSION, P2_PROMPT_VERSION } from '../src/mc-pipeline/p2/p2.types';
import { R1_CONTRACT_VERSION } from '../src/mc-pipeline/r1/r1.types';
import { P3_CONTRACT_VERSION, P3_PROMPT_VERSION } from '../src/mc-pipeline/p3/p3.types';
import {
  P4_CONTRACT_VERSION,
  P4_PROMPT_VERSION,
  P4_ROUTING_POLICY_VERSION,
} from '../src/mc-pipeline/p4/p4.types';
import {
  PROFILE_CONTRACT_VERSION,
  type ProfilePilotEnvelope,
} from '../src/mc-pipeline/profile/profile.types';
import { PROFILE_RADAR_FORMULA_VERSION } from '../src/mc-pipeline/profile/profile-radar';
import { readMc1PersonProfile } from '../src/mc-pipeline/person-profile';
import { mapSkillToDimensions } from '../src/mc-pipeline/profile/profile-skill-dimension-mapper';

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-sara-children-live');
const BINDINGS_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'real-person-bindings.json',
);
const INDEX_PATH = resolve(
  ROOT,
  'tmp',
  'mc1-profile-preview',
  'person-snapshot-index.json',
);

/** Radar mapper freeze label from FASE 12E. */
const RADAR_MAPPER_VERSION = 'VD_MAPPER_12E_SEMANTIC_BLOB_V1';
const P0_VERSION = 'MC1.P0.SNAPSHOT.4D.2';

/** Fixed cohort — Sara + direct reports (selection only; domain from CV). */
const SARA_TEAM: Array<{
  personId: string;
  personCvId: number;
  label: string;
  selectionRole: string;
  caseId: string;
  cohortRole?: 'LEADER' | 'MEMBER';
}> = [
  {
    personId: '52',
    personCvId: 225,
    label: 'Sara Juliana',
    selectionRole: 'Líder de Contenidos Académicos',
    caseId: 'person-sara-juliana-martinez',
    cohortRole: 'LEADER',
  },
  {
    personId: '1207',
    personCvId: 20,
    label: 'Diana Marcela',
    selectionRole: 'GIF Publicidad',
    caseId: 'person-diana-marcela-vargas',
  },
  {
    personId: '1210',
    personCvId: 32,
    label: 'Maria Angelica',
    selectionRole: 'GIF Matemáticas',
    caseId: 'person-maria-angelica-cruz',
  },
  {
    personId: '1211',
    personCvId: 33,
    label: 'Sandra Carolina',
    selectionRole: 'GIF Humanidades y Transversales',
    caseId: 'person-sandra-carolina-molano',
  },
  {
    personId: '1217',
    personCvId: 30,
    label: 'Jhonatan David',
    selectionRole: 'GIF Administración de Empresas',
    caseId: 'person-jhonatan-david-marquez',
  },
];

const VD_AXES = [
  'VD_VISUAL_COMMUNICATION',
  'VD_BRAND_SYSTEMS',
  'VD_EDITORIAL',
  'VD_PRODUCT_INTERFACE',
  'VD_ILLUSTRATION',
  'VD_MOTION',
  'VD_PRODUCTION_CRAFT',
] as const;

const VD_SPECIALTIES = new Set([
  'GRAPHIC_DESIGN',
  'UX_PRODUCT_DESIGN',
  'BRAND_IDENTITY_DESIGN',
  'EDITORIAL_DESIGN',
  'ILLUSTRATION',
  'MOTION_DESIGN',
]);

const AV_SPECIALTIES = new Set([
  'VIDEO_PRODUCTION',
  'VIDEO_POST_PRODUCTION',
  'PHOTOGRAPHY',
  'AUDIO_PRODUCTION',
]);

const EDU_SPECIALTIES = new Set([
  'TEACHING_FACILITATION',
  'INSTRUCTIONAL_DESIGN',
  'CURRICULUM_DESIGN',
  'ACADEMIC_MANAGEMENT',
  'LEARNING_ASSESSMENT',
]);

const COMM_SPECIALTIES = new Set([
  'CORPORATE_COMMUNICATIONS',
  'DIGITAL_COMMUNICATIONS',
  'PUBLIC_RELATIONS',
  'JOURNALISM',
  'CONTENT_COMMUNICATION',
]);

/** Fields with radar/dimension mapper in current pilot. */
const MAPPED_FIELDS = new Set([
  'VISUAL_DESIGN',
  'EDUCATION',
  'PROJECT_PROGRAM_MGMT',
  'FINANCE_ADMIN',
  'SOFTWARE_ENGINEERING',
  'AUDIOVISUAL_PRODUCTION',
  'COMMUNICATIONS',
]);

function loadEnvFile(path: string, allow: Set<string> | null = null) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (allow && !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function slugName(fullName: string): string {
  return fullName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .split('-')
    .slice(0, 3)
    .join('-');
}

function buildFrozenConfig(model: string) {
  const config = {
    phase: 'SARA_CHILDREN_LIVE',
    p0Version: P0_VERSION,
    p1SegmenterVersion: P1_SEGMENTER_VERSION,
    p1PromptVersion: P1_PROMPT_VERSION,
    p1ContractVersion: P1_CONTRACT_VERSION,
    geminiModel: model,
    p2Version: `${P2_CONTRACT_VERSION}/${P2_PROMPT_VERSION}`,
    r1Version: R1_CONTRACT_VERSION,
    p3Version: `${P3_CONTRACT_VERSION}/${P3_PROMPT_VERSION}`,
    p4Version: `${P4_CONTRACT_VERSION}/${P4_PROMPT_VERSION}`,
    p4RoutingPolicyVersion: P4_ROUTING_POLICY_VERSION,
    profileAssemblyVersion: PROFILE_CONTRACT_VERSION,
    radarFormulaVersion: PROFILE_RADAR_FORMULA_VERSION,
    radarMapperVersion: RADAR_MAPPER_VERSION,
    publicSkillFilter: 'OBSERVED_P3_PARENT_ONLY_12I',
    specialtyCatalogScope: [...SPECIALTY_CATALOG_SCOPE].sort(),
  };
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(config))
    .digest('hex')
    .slice(0, 16);
  return { ...config, configFingerprint: fingerprint };
}

function writeBinding(caseId: string, snapshotId: string) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<string, { snapshotId: string; boundAt: string }> = {};
  if (existsSync(BINDINGS_PATH)) {
    try {
      current = JSON.parse(readFileSync(BINDINGS_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[caseId] = {
    snapshotId: String(snapshotId),
    boundAt: new Date().toISOString(),
  };
  writeFileSync(BINDINGS_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function writePersonSnapshotIndex(
  personId: string,
  snapshotId: string,
  caseId: string,
) {
  mkdirSync(resolve(ROOT, 'tmp', 'mc1-profile-preview'), { recursive: true });
  let current: Record<
    string,
    { snapshotId: string; caseId?: string; boundAt?: string }
  > = {};
  if (existsSync(INDEX_PATH)) {
    try {
      current = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
    } catch {
      current = {};
    }
  }
  current[String(personId)] = {
    snapshotId: String(snapshotId),
    caseId,
    boundAt: new Date().toISOString(),
  };
  writeFileSync(INDEX_PATH, JSON.stringify(current, null, 2), 'utf8');
}

function summarizeProfile(envelope: ProfilePilotEnvelope) {
  const resolved = envelope.payload.resolvedFieldsProvenance ?? [];
  const fields = (envelope.payload.fields ?? []).map((f) => {
    const radar: Record<string, number> = {};
    const axisTrace: Record<
      string,
      Array<{ skillCode: string; signals: string[]; tools: string[] }>
    > = {};
    for (const a of f.radar?.axes ?? []) {
      radar[a.dimensionCode] = a.relativeCoverage;
      if (a.relativeCoverage > 0) {
        axisTrace[a.dimensionCode] = (a.contributingSkillCodes ?? []).map(
          (code) => {
            const sk = f.skills.find((s) => s.skillCode === code);
            const map = f.skillDimensionMappings.find(
              (m) => m.skillCode === code,
            );
            return {
              skillCode: code,
              name: sk?.name,
              parentSpecialtyCode: sk?.parentSpecialtyCode,
              mappingJustification: map?.mappingJustification,
              signals: [] as string[],
              tools: [] as string[],
            };
          },
        );
      }
    }
    return {
      fieldCode: f.fieldCode,
      role: f.role,
      specialties: f.specialties.map((s) => s.specialtyCode),
      skills: f.skills.map((sk) => ({
        skillCode: sk.skillCode,
        name: sk.name,
        parentSpecialtyCode: sk.parentSpecialtyCode,
      })),
      tools: f.toolsTechnologies,
      evidenceVolume: f.evidenceVolume,
      radar,
      vdRadar: Object.fromEntries(
        VD_AXES.map((code) => [code, radar[code] ?? null]),
      ),
      axisTrace,
      emptyTabRisk:
        f.specialties.length === 0 &&
        f.skills.length === 0 &&
        (f.toolsTechnologies?.length ?? 0) === 0,
    };
  });
  return {
    r1Status: envelope.payload.r1FieldResolutionStatus,
    resolvedFields: resolved,
    publishableFields: fields.map((f) => f.fieldCode),
    hiddenFields: resolved
      .filter((r) => r.publicationStatus === 'PROVENANCE_ONLY')
      .map((r) => ({
        fieldCode: r.fieldCode,
        role: r.role,
        reasonCode: r.reasonCode,
      })),
    fields,
    warnings: (envelope.warnings ?? []).map((w) => w.code),
  };
}

type CohortMember = {
  caseId: string;
  label: string;
  personId: string;
  document: string;
  selectionRole: string;
  personCvId: number | null;
  existingSnapshotId: string | null;
  action: 'REUSE_SNAPSHOT' | 'CREATE_SNAPSHOT' | 'NO_ACTIVE_CV' | 'BLOCKED';
  parseStatus?: string | null;
  nlen?: number | null;
};

async function loadSaraTeamMembers(mde: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<CohortMember[]> {
  const ds = await createMdeDataSource(mde);
  try {
    const out: CohortMember[] = [];
    for (const s of SARA_TEAM) {
      const rows = await ds.query(
        `
        SELECT p.id::text AS person_id, p.full_name, p.document,
               pc.id AS person_cv_id, pc.drive_file_id, pc.mime_type,
               (SELECT s.id::text FROM organigrama.mc_cv_snapshot s
                 WHERE s.person_cv_id = pc.id
                 ORDER BY s.created_at DESC NULLS LAST, s.id DESC
                 LIMIT 1) AS latest_snapshot_id,
               (SELECT s.parse_status FROM organigrama.mc_cv_snapshot s
                 WHERE s.person_cv_id = pc.id
                 ORDER BY s.created_at DESC NULLS LAST, s.id DESC
                 LIMIT 1) AS parse_status,
               (SELECT length(s.normalized_text) FROM organigrama.mc_cv_snapshot s
                 WHERE s.person_cv_id = pc.id
                 ORDER BY s.created_at DESC NULLS LAST, s.id DESC
                 LIMIT 1) AS nlen
        FROM core.person p
        LEFT JOIN organigrama.person_cv pc
          ON pc.person_id = p.id AND pc.is_active = true
        WHERE p.id = $1
        LIMIT 1
        `,
        [Number(s.personId)],
      );
      const row = rows?.[0];
      if (!row?.person_cv_id) {
        out.push({
          caseId: s.caseId,
          label: s.label,
          personId: s.personId,
          document: row?.document ? String(row.document) : '',
          selectionRole: s.selectionRole,
          personCvId: null,
          existingSnapshotId: null,
          action: 'NO_ACTIVE_CV',
        });
        continue;
      }
      const mime = String(row.mime_type || '').toLowerCase();
      if (!row.drive_file_id || !mime.includes('pdf')) {
        out.push({
          caseId: s.caseId,
          label: s.label,
          personId: s.personId,
          document: String(row.document || ''),
          selectionRole: s.selectionRole,
          personCvId: Number(row.person_cv_id),
          existingSnapshotId: row.latest_snapshot_id
            ? String(row.latest_snapshot_id)
            : null,
          action: 'BLOCKED',
        });
        continue;
      }
      out.push({
        caseId: s.caseId,
        label: s.label,
        personId: s.personId,
        document: String(row.document || ''),
        selectionRole: s.selectionRole,
        personCvId: Number(row.person_cv_id),
        existingSnapshotId: row.latest_snapshot_id
          ? String(row.latest_snapshot_id)
          : null,
        action: row.latest_snapshot_id ? 'REUSE_SNAPSHOT' : 'CREATE_SNAPSHOT',
        parseStatus: row.parse_status ?? null,
        nlen: row.nlen != null ? Number(row.nlen) : null,
      });
    }
    return out;
  } finally {
    await ds.destroy();
  }
}

function auditP4SkillWording(p4Rows: Array<{
  specialtyCode: string;
  skillNames: string[];
  skillsObserved: string[];
}>): string[] {
  const flags: string[] = [];
  for (const row of p4Rows) {
    if (row.specialtyCode !== 'GRAPHIC_DESIGN') continue;
    const blob = [...row.skillNames, ...row.skillsObserved].join(' ').toLowerCase();
    if (/brand|identidad|branding|key visual|lineamiento/.test(blob)) {
      flags.push('BRAND_WORDING_UNDER_GRAPHIC');
    }
    if (/editorial|diagramaci[oó]n|maquetaci[oó]n editorial/.test(blob)) {
      flags.push('EDITORIAL_WORDING_UNDER_GRAPHIC');
    }
    if (
      /motion graphics|animaci[oó]n gr[aá]fica|animaci[oó]n digital/.test(blob)
    ) {
      flags.push('MOTION_WORDING_UNDER_GRAPHIC');
    }
    if (/ilustraci[oó]n|illustration/.test(blob)) {
      flags.push('ILLUSTRATION_WORDING_UNDER_GRAPHIC');
    }
    if (
      /animaci[oó]n|animation|audiovisual|edici[oó]n de video|video editing|realizaci[oó]n|postproducci[oó]n|post-producci[oó]n|motion/.test(
        blob,
      )
    ) {
      flags.push('AV_OR_MOTION_WORDING_UNDER_GRAPHIC');
    }
  }
  return [...new Set(flags)];
}

/** 12I-specific invariants — classification only, no fixes. */
function audit12IInvariants(args: {
  p3ByField: Record<
    string,
    { observed: string[]; weak: string[]; notEmitted: string[] }
  >;
  specialtiesEvaluated: Array<{
    specialtyCode: string;
    evaluationRole?: string;
    p3Status?: string;
  }>;
  p4Rows: Array<{
    specialtyCode: string;
    skillNames: string[];
    skillsObserved: string[];
    skillsDetail?: Array<{
      skillCode: string;
      name: string;
      supportingSignals: string[];
      tools: string[];
    }>;
  }>;
  profileSummary: ReturnType<typeof summarizeProfile>;
  p4Hints?: Array<{ specialtyCode: string }>;
}): Array<{ code: string; detail: string }> {
  const anomalies: Array<{ code: string; detail: string }> = [];
  const vdP3 = args.p3ByField.VISUAL_DESIGN ?? {
    observed: [],
    weak: [],
    notEmitted: [],
  };
  const weakSet = new Set(vdP3.weak);
  const observedSet = new Set(vdP3.observed);
  const notEmittedSet = new Set(vdP3.notEmitted);
  const evalCodes = new Set(
    args.specialtiesEvaluated.map((s) => s.specialtyCode),
  );

  // NOT_EMITTED must not appear as P4 evaluation destination
  for (const code of evalCodes) {
    if (notEmittedSet.has(code) && !observedSet.has(code) && !weakSet.has(code)) {
      anomalies.push({
        code: 'P4_ROUTING_DRIFT',
        detail: `P4 evaluated NOT_EMITTED specialty ${code}`,
      });
    }
  }
  for (const row of args.p4Rows) {
    if (
      row.specialtyCode &&
      VD_SPECIALTIES.has(row.specialtyCode) &&
      notEmittedSet.has(row.specialtyCode) &&
      (row.skillsObserved?.length ?? 0) > 0
    ) {
      anomalies.push({
        code: 'P4_ROUTING_DRIFT',
        detail: `P4 invented skills under NOT_EMITTED ${row.specialtyCode}`,
      });
    }
  }

  // WEAK siblings should be ROUTING_CANDIDATE in specialtiesEvaluated
  for (const w of vdP3.weak) {
    const ev = args.specialtiesEvaluated.find((s) => s.specialtyCode === w);
    if (!ev) {
      anomalies.push({
        code: 'P4_ROUTING_DRIFT',
        detail: `WEAK ${w} missing from specialtiesEvaluated`,
      });
    } else if (
      ev.evaluationRole &&
      ev.evaluationRole !== 'ROUTING_CANDIDATE'
    ) {
      anomalies.push({
        code: 'P4_ROUTING_DRIFT',
        detail: `WEAK ${w} role=${ev.evaluationRole} expected ROUTING_CANDIDATE`,
      });
    }
  }

  // GRAPHIC catch-all when WEAK sibling clearly supported by wording and empty
  const graphic = args.p4Rows.find((r) => r.specialtyCode === 'GRAPHIC_DESIGN');
  const graphicBlob = [
    ...(graphic?.skillNames ?? []),
    ...(graphic?.skillsObserved ?? []),
  ]
    .join(' ')
    .toLowerCase();
  const checks: Array<{
    weakCode: string;
    re: RegExp;
    label: string;
  }> = [
    {
      weakCode: 'EDITORIAL_DESIGN',
      re: /editorial|diagramaci[oó]n|maquetaci[oó]n/,
      label: 'editorial',
    },
    {
      weakCode: 'BRAND_IDENTITY_DESIGN',
      re: /brand|identidad|branding/,
      label: 'brand',
    },
    {
      weakCode: 'ILLUSTRATION',
      re: /ilustraci[oó]n|illustration/,
      label: 'illustration',
    },
    {
      weakCode: 'MOTION_DESIGN',
      re: /motion graphics|animaci[oó]n gr[aá]fica|animaci[oó]n digital/,
      label: 'motion',
    },
  ];
  for (const c of checks) {
    if (!weakSet.has(c.weakCode)) continue;
    if (!c.re.test(graphicBlob)) continue;
    const sibling = args.p4Rows.find((r) => r.specialtyCode === c.weakCode);
    const siblingSkills = sibling?.skillsObserved?.length ?? 0;
    if (siblingSkills === 0) {
      anomalies.push({
        code: 'P4_ROUTING_DRIFT',
        detail: `${c.label} wording under GRAPHIC while ${c.weakCode} WEAK has zero skills`,
      });
    }
  }

  // Public profile must not expose skills parented only under WEAK
  const vdProfile = args.profileSummary.fields.find(
    (f) => f.fieldCode === 'VISUAL_DESIGN',
  );
  if (vdProfile) {
    for (const sk of vdProfile.skills) {
      if (
        weakSet.has(sk.parentSpecialtyCode) &&
        !observedSet.has(sk.parentSpecialtyCode)
      ) {
        anomalies.push({
          code: 'PUBLICATION_DRIFT',
          detail: `public skill ${sk.skillCode} parented under WEAK-only ${sk.parentSpecialtyCode}`,
        });
      }
    }
    for (const [axis, contribs] of Object.entries(vdProfile.axisTrace)) {
      for (const c of contribs) {
        const parent = String(
          (c as { parentSpecialtyCode?: string }).parentSpecialtyCode ?? '',
        );
        if (parent && weakSet.has(parent) && !observedSet.has(parent)) {
          anomalies.push({
            code: 'RADAR_DRIFT',
            detail: `radar ${axis} includes WEAK-only parent skill ${c.skillCode}`,
          });
        }
      }
    }
  }

  // Mapper 12E probes: tools alone must not activate Editorial/Motion/Product UI
  const toolProbes: Array<{
    tools: string[];
    forbiddenAxes: string[];
    label: string;
  }> = [
    {
      tools: ['Adobe InDesign'],
      forbiddenAxes: ['VD_EDITORIAL'],
      label: 'InDesign-only→Editorial',
    },
    {
      tools: ['Adobe Premiere', 'Premiere Pro', 'CapCut'],
      forbiddenAxes: ['VD_MOTION'],
      label: 'video-tool-only→Motion',
    },
    {
      tools: ['Figma', 'Adobe XD'],
      forbiddenAxes: ['VD_PRODUCT_INTERFACE'],
      label: 'Figma-only→ProductUI',
    },
  ];
  for (const probe of toolProbes) {
    const m = mapSkillToDimensions({
      skillCode: 'tool_probe',
      name: 'Generic capacity without specialty practice',
      parentFieldCode: 'VISUAL_DESIGN',
      parentSpecialtyCode: 'GRAPHIC_DESIGN',
      supportingSignals: [],
      toolOrTechnologySignals: probe.tools,
      supportingEvidenceUnitIds: [],
    });
    for (const axis of probe.forbiddenAxes) {
      if (m.dimensionCodes.includes(axis as never)) {
        anomalies.push({
          code: 'RADAR_DRIFT',
          detail: `mapper probe failed: ${probe.label}`,
        });
      }
    }
  }

  // Product UI axis: require practice wording / UX specialty (reuse soft check)
  if (vdProfile) {
    const uiScore = vdProfile.radar.VD_PRODUCT_INTERFACE ?? 0;
    if (uiScore > 0) {
      const hasUi = vdProfile.skills.some(
        (s) =>
          s.parentSpecialtyCode === 'UX_PRODUCT_DESIGN' ||
          /ui|ux|interfaz|interface|producto|experiencia/.test(
            `${s.skillCode} ${s.name}`.toLowerCase(),
          ),
      );
      if (!hasUi) {
        anomalies.push({
          code: 'RADAR_DRIFT',
          detail: 'VD_PRODUCT_INTERFACE without UI practice skill',
        });
      }
    }
  }

  void args.p4Hints;
  return anomalies;
}

function auditRadar(
  profileSummary: ReturnType<typeof summarizeProfile>,
  p4Rows: Array<{
    specialtyCode: string;
    skillsObserved: string[];
    skillNames: string[];
    tools: string[];
    supportingSignalsBySkill?: Record<string, string[]>;
  }>,
): Array<{ code: string; detail: string }> {
  const anomalies: Array<{ code: string; detail: string }> = [];
  const vd = profileSummary.fields.find((f) => f.fieldCode === 'VISUAL_DESIGN');
  if (!vd) return anomalies;
  for (const axis of VD_AXES) {
    const score = vd.radar[axis] ?? 0;
    if (score <= 0) continue;
    const contrib = vd.axisTrace[axis] ?? [];
    if (contrib.length === 0) {
      anomalies.push({
        code: 'RADAR_DRIFT',
        detail: `${axis}>0 without contributing skills`,
      });
    }
  }
  // Product UI false heuristic moved to audit12IInvariants (RADAR_DRIFT)
  void p4Rows;
  return anomalies;
}

async function processCase(args: {
  member: CohortMember;
  gem: Record<string, string>;
  mde: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  };
  frozen: ReturnType<typeof buildFrozenConfig>;
}): Promise<Record<string, unknown>> {
  const { member, gem, mde, frozen } = args;
  if (member.action === 'NO_ACTIVE_CV' || member.action === 'BLOCKED') {
    return {
      ...member,
      status: member.action,
      configFingerprint: frozen.configFingerprint,
    };
  }

  const dsP0 = await createMdeDataSource(mde);
  const p0 = createP0Service(dsP0, mde);
  const p0Result = await p0.createOrReuseFromPersonCv(member.personCvId!);
  const snapshotId = String(p0Result.snapshotId);
  const p0Origin = p0Result.outcome === 'CREATED' ? 'CREATED' : 'REUSED_VALID';
  await dsP0.destroy();

  const ds = new DataSource({
    type: 'postgres',
    host: mde.host,
    port: mde.port,
    username: mde.username,
    password: mde.password,
    database: mde.database,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  try {
    const snap = (
      await ds.query(
        `SELECT id::text AS id, normalized_text, pages, sectioned_content,
                parse_status, page_count, length(normalized_text) AS nlen
           FROM organigrama.mc_cv_snapshot WHERE id = $1`,
        [snapshotId],
      )
    )[0];
    if (!snap?.normalized_text || snap.parse_status !== 'PARSED') {
      throw new Error(`SNAPSHOT_NOT_READY:${snapshotId}`);
    }

    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const prototypeId = `P1P-SARA-S${snapshotId}-${stamp}-${randomUUID().slice(0, 8)}`;
    const outDir = resolve(ROOT, 'tmp', 'mc1-p1-prototype', prototypeId);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(
      join(outDir, 'prototype-manifest.json'),
      JSON.stringify(
        {
          classification: 'CONFIDENTIAL',
          operationType: 'P1_SARA_CHILDREN_LIVE',
          prototypeId,
          snapshotId: String(snapshotId),
          contractVersion: P1_CONTRACT_VERSION,
          segmenterVersion: P1_SEGMENTER_VERSION,
          promptVersion: P1_PROMPT_VERSION,
          modelProvider: 'google-genai',
          modelVersion: gem.GEMINI_MODEL || frozen.geminiModel,
          configFingerprint: frozen.configFingerprint,
          startedAt: new Date().toISOString(),
          persistence: 'NONE',
          resultOrigin: 'LIVE',
        },
        null,
        2,
      ),
      'utf8',
    );

    const pages =
      typeof snap.pages === 'string' ? JSON.parse(snap.pages) : snap.pages;
    const sectioned =
      typeof snap.sectioned_content === 'string'
        ? JSON.parse(snap.sectioned_content)
        : snap.sectioned_content;

    const p1Result = await runP1ForMember({
      prototypeId,
      snapshotId: String(snapshotId),
      normalizedText: snap.normalized_text,
      pages,
      sectionedContent: sectioned,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || frozen.geminiModel,
      outDir,
    });
    if (!p1Result.ok) {
      throw new Error(`P1_FAILED:${p1Result.errorCode ?? p1Result.status}`);
    }

    const batchesFile = JSON.parse(
      readFileSync(join(outDir, 'batches.json'), 'utf8'),
    ) as { batches: Array<{ batchId: string; candidateIds: string[] }> };
    const candToBatch = new Map<string, string>();
    for (const b of batchesFile.batches) {
      for (const id of b.candidateIds) candToBatch.set(id, b.batchId);
    }
    const decisions = [...p1Result.decisions.entries()].map(
      ([candidateId, decision]) => ({
        candidateId,
        decision,
        reasonCode:
          decision === 'REVIEW_REQUIRED'
            ? 'NEEDS_REVIEW'
            : String(decision).startsWith('REJECTED')
              ? 'REJECTED'
              : 'OK',
        batchId: candToBatch.get(candidateId) ?? 'unknown',
      }),
    );
    writeFileSync(
      join(outDir, 'decisions.json'),
      JSON.stringify({ decisions }, null, 2),
      'utf8',
    );

    const units = p1Result.units ?? [];
    const inferred = units.filter((u) => u.explicitness === 'INFERRED').length;
    // Units carry startOffset/endOffset/sourceText (ValidatedEvidenceUnit).
    // Do NOT use legacy sourceSpan shape — that caused AUDITOR_FALSE_POSITIVE.
    const missingSpan = units.filter((u) => {
      const start = Number((u as { startOffset?: number }).startOffset);
      const end = Number((u as { endOffset?: number }).endOffset);
      const text = String((u as { sourceText?: string }).sourceText ?? '');
      return (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end <= start ||
        text.trim().length === 0
      );
    }).length;
    const p1Alerts: string[] = [];
    const p1AnomalyClass: Array<{ code: string; detail: string }> = [];
    if (inferred > 0) p1Alerts.push('INFERRED_PRESENT');
    if (units.length < 5) p1Alerts.push('LOW_EVIDENCE_COVERAGE');
    if (missingSpan > 0) {
      p1Alerts.push('EVIDENCE_WITHOUT_SPANS');
      p1AnomalyClass.push({
        code: 'P1_EXTRACTION_DRIFT',
        detail: `REAL_P1_DRIFT:missing_span_fields:${missingSpan}`,
      });
    } else if (units.length > 0) {
      p1AnomalyClass.push({
        code: 'AUDITOR_FALSE_POSITIVE',
        detail:
          'legacy_sourceSpan_check_skipped_units_have_startOffset_endOffset_sourceText',
      });
    }
    const reviewRequired = decisions.filter(
      (d) => d.decision === 'REVIEW_REQUIRED',
    ).length;
    if (reviewRequired > Math.max(2, Math.floor(decisions.length * 0.25))) {
      p1Alerts.push('ELEVATED_REVIEW_REQUIRED');
    }

    const p1Stats = {
      candidates: p1Result.candidateCount,
      evidenceUnits: units.length,
      explicit: units.filter((u) => u.explicitness === 'EXPLICIT').length,
      stronglySupported: units.filter(
        (u) => u.explicitness === 'STRONGLY_SUPPORTED',
      ).length,
      inferred,
      reviewRequired,
      missingSpan,
      spanHealth:
        missingSpan === 0 ? 'SPANS_OK' : 'REAL_P1_DRIFT_MISSING_SPANS',
      batches: p1Result.batchCount,
      executionId: prototypeId,
      geminiInvoked: true,
      resultOrigin: 'LIVE' as const,
      alerts: p1Alerts,
    };

    const p2 = await runP2ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || frozen.geminiModel,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
    });

    const r1 = runR1ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      p2PackDir: p2.outDir,
    });
    const r1p = r1.envelope.payload;
    const primary = r1p.primaryField?.fieldCode ?? null;
    const secondaries = (r1p.secondaryFields ?? []).map((f) => ({
      code: f.fieldCode,
      confidence: f.confidence,
    }));

    const inScope =
      (primary && SPECIALTY_CATALOG_SCOPE.has(primary)) ||
      secondaries.some((f) => !!f.code && SPECIALTY_CATALOG_SCOPE.has(f.code));

    const p3 = await runP3ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || frozen.geminiModel,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
      r1PackDir: r1.outDir,
    });

    const catalogFor = (fieldCode: string): string[] => {
      if (fieldCode === 'VISUAL_DESIGN') return [...VD_SPECIALTIES];
      if (fieldCode === 'AUDIOVISUAL_PRODUCTION') return [...AV_SPECIALTIES];
      if (fieldCode === 'EDUCATION') return [...EDU_SPECIALTIES];
      if (fieldCode === 'COMMUNICATIONS') return [...COMM_SPECIALTIES];
      return [];
    };

    const p3ByField: Record<
      string,
      { observed: string[]; weak: string[]; notEmitted: string[] }
    > = {};
    for (const fr of p3.envelope.payload.fieldResults ?? []) {
      const observed: string[] = [];
      const weak: string[] = [];
      for (const s of fr.observedSpecialties ?? []) {
        if (s.status === 'OBSERVED') observed.push(s.specialtyCode);
        if (s.status === 'WEAK') weak.push(s.specialtyCode);
      }
      const emitted = new Set([...observed, ...weak]);
      const notEmitted = catalogFor(fr.fieldCode).filter((c) => !emitted.has(c));
      p3ByField[fr.fieldCode] = { observed, weak, notEmitted };
    }

    const p4 = await runP4ArtifactOnly({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      dataSource: ds,
      apiKey: gem.GEMINI_API_KEY,
      model: gem.GEMINI_MODEL || frozen.geminiModel,
      outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
    });

    const p4Rows = (p4.envelope.payload.specialtyResults ?? []).map((sr) => ({
      fieldCode: sr.fieldCode,
      specialtyCode: sr.specialtyCode,
      evaluationRole: (
        p4.envelope.payload.specialtiesEvaluated ?? []
      ).find((s) => s.specialtyCode === sr.specialtyCode)?.evaluationRole,
      p3Status: (
        p4.envelope.payload.specialtiesEvaluated ?? []
      ).find((s) => s.specialtyCode === sr.specialtyCode)?.p3Status,
      skillsObserved: (sr.observedSkills ?? [])
        .filter((sk) => sk.status === 'OBSERVED')
        .map((sk) => sk.skillCode || sk.name),
      skillNames: (sr.observedSkills ?? [])
        .filter((sk) => sk.status === 'OBSERVED')
        .map((sk) => sk.name),
      tools: [
        ...new Set(
          (sr.observedSkills ?? []).flatMap(
            (sk) => sk.toolOrTechnologySignals ?? [],
          ),
        ),
      ],
      skillsDetail: (sr.observedSkills ?? [])
        .filter((sk) => sk.status === 'OBSERVED')
        .map((sk) => ({
          skillCode: sk.skillCode,
          name: sk.name,
          supportingSignals: sk.supportingSignals ?? [],
          tools: sk.toolOrTechnologySignals ?? [],
        })),
      allSkillCount: (sr.observedSkills ?? []).length,
    }));

    const p4Flags = auditP4SkillWording(p4Rows);
    const specialtiesEvaluated = p4.envelope.payload.specialtiesEvaluated ?? [];
    const routingCandidates = specialtiesEvaluated.filter(
      (s) => s.evaluationRole === 'ROUTING_CANDIDATE',
    );
    const corroborationHints =
      p4.envelope.payload.specialtyCorroborationHints ?? [];

    const profile = await runProfilePilot({
      backendRoot: ROOT,
      snapshotId: String(snapshotId),
      outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
      dataSource: ds,
      r1PackDir: r1.outDir,
      p3PackDir: p3.outDir,
      p4PackDir: p4.outDir,
    });

    // Enrich axisTrace with P4 signals for VD
    const profileSummary = summarizeProfile(profile.envelope);
    const signalBySkill = new Map<string, { signals: string[]; tools: string[] }>();
    for (const row of p4Rows) {
      for (const sk of row.skillsDetail ?? []) {
        signalBySkill.set(sk.skillCode || sk.name, {
          signals: sk.supportingSignals,
          tools: sk.tools,
        });
      }
    }
    for (const f of profileSummary.fields) {
      for (const [axis, contribs] of Object.entries(f.axisTrace)) {
        for (const c of contribs) {
          const info = signalBySkill.get(c.skillCode);
          if (info) {
            c.signals = info.signals;
            c.tools = info.tools;
          }
          void axis;
        }
      }
    }

    writeBinding(member.caseId, snapshotId);
    writePersonSnapshotIndex(member.personId, snapshotId, member.caseId);

    const reader = await readMc1PersonProfile({
      personId: member.personId,
      dataSource: ds,
      backendRoot: ROOT,
    });

    const anomalies: Array<{ code: string; detail: string }> = [];
    anomalies.push(...p1AnomalyClass);
    for (const a of p1Alerts) {
      if (a === 'EVIDENCE_WITHOUT_SPANS') continue;
      if (
        a === 'INFERRED_PRESENT' ||
        a === 'LOW_EVIDENCE_COVERAGE' ||
        a === 'ELEVATED_REVIEW_REQUIRED'
      ) {
        anomalies.push({ code: 'P1_EXTRACTION_DRIFT', detail: a });
      } else {
        anomalies.push({ code: 'EXPECTED_VARIATION', detail: `p1_alert:${a}` });
      }
    }
    // GRAPHIC specialized wording → P4_ROUTING_DRIFT only when sibling WEAK empty
    const vdWeak = new Set(p3ByField.VISUAL_DESIGN?.weak ?? []);
    const flagToWeak: Record<string, string> = {
      BRAND_WORDING_UNDER_GRAPHIC: 'BRAND_IDENTITY_DESIGN',
      EDITORIAL_WORDING_UNDER_GRAPHIC: 'EDITORIAL_DESIGN',
      MOTION_WORDING_UNDER_GRAPHIC: 'MOTION_DESIGN',
      ILLUSTRATION_WORDING_UNDER_GRAPHIC: 'ILLUSTRATION',
      // AV_OR_MOTION_WORDING_UNDER_GRAPHIC: report-only via avAbsorptionNotes
      // (do not hard-map to MOTION_DESIGN — AV evidence may live under AV specialties)
    };
    for (const flag of p4Flags) {
      const weakCode = flagToWeak[flag];
      const siblingSkills =
        p4Rows.find((r) => r.specialtyCode === weakCode)?.skillsObserved
          ?.length ?? 0;
      if (weakCode && vdWeak.has(weakCode) && siblingSkills === 0) {
        anomalies.push({
          code: 'P4_ROUTING_DRIFT',
          detail: flag,
        });
      } else {
        anomalies.push({
          code: 'EXPECTED_VARIATION',
          detail: `graphic_wording_flag:${flag}`,
        });
      }
    }
    for (const f of profileSummary.fields) {
      if (f.emptyTabRisk) {
        anomalies.push({
          code: 'PUBLICATION_DRIFT',
          detail: `empty publishable field ${f.fieldCode}`,
        });
      }
    }
    anomalies.push(...auditRadar(profileSummary, p4Rows));
    anomalies.push(
      ...audit12IInvariants({
        p3ByField,
        specialtiesEvaluated,
        p4Rows,
        profileSummary,
        p4Hints: corroborationHints,
      }),
    );

    // Unexpected specialty vs known catalogs (report-only)
    const knownByField: Record<string, Set<string>> = {
      VISUAL_DESIGN: VD_SPECIALTIES,
      AUDIOVISUAL_PRODUCTION: AV_SPECIALTIES,
      EDUCATION: EDU_SPECIALTIES,
      COMMUNICATIONS: COMM_SPECIALTIES,
    };
    for (const [field, data] of Object.entries(p3ByField)) {
      const known = knownByField[field];
      if (!known) continue;
      for (const sp of data.observed) {
        if (!known.has(sp)) {
          anomalies.push({
            code: 'P3_SPECIALTY_DRIFT',
            detail: `unexpected OBSERVED specialty ${sp} under ${field}`,
          });
        }
      }
    }

    // Deduplicate anomaly codes+detail
    const seenA = new Set<string>();
    const deduped = anomalies.filter((a) => {
      const k = `${a.code}::${a.detail}`;
      if (seenA.has(k)) return false;
      seenA.add(k);
      return true;
    });

    if (
      deduped.length === 0 ||
      deduped.every(
        (a) =>
          a.code === 'EXPECTED_VARIATION' ||
          a.code === 'AUDITOR_FALSE_POSITIVE',
      )
    ) {
      if (
        !deduped.some(
          (a) =>
            a.code === 'EXPECTED_VARIATION' ||
            a.code === 'AUDITOR_FALSE_POSITIVE',
        )
      ) {
        deduped.push({
          code: 'EXPECTED_VARIATION',
          detail: 'no hard anomaly flags',
        });
      }
    }

    // Mapper availability note (does not invalidate P1–P4)
    const mapperStatus: Array<{
      fieldCode: string;
      status: string;
    }> = [];
    for (const f of profileSummary.fields) {
      if (!MAPPED_FIELDS.has(f.fieldCode)) {
        mapperStatus.push({
          fieldCode: f.fieldCode,
          status: 'MAPPER_NOT_AVAILABLE',
        });
        deduped.push({
          code: 'RADAR_MAPPER_DRIFT',
          detail: `MAPPER_NOT_AVAILABLE:${f.fieldCode}`,
        });
      }
    }

    const hardReviewCodes = new Set([
      'RADAR_DRIFT',
      'PUBLICATION_DRIFT',
      'P1_EXTRACTION_DRIFT',
      'P4_ROUTING_DRIFT',
      'P2_DOMAIN_DRIFT',
      'P3_SPECIALTY_DRIFT',
      'P4_SKILL_DRIFT',
    ]);

    return {
      caseId: member.caseId,
      label: member.label,
      selectionRole: member.selectionRole,
      status: 'DONE',
      personId: member.personId,
      personCvId: member.personCvId,
      snapshotId,
      p0ActionPlanned: member.action,
      p0: p0Origin,
      configFingerprint: frozen.configFingerprint,
      mapperStatus,
      p0Meta: {
        parseStatus: snap.parse_status,
        pageCount: snap.page_count,
        normalizedLen: snap.nlen,
        fidelity:
          snap.parse_status === 'PARSED' && Number(snap.nlen) > 500
            ? 'HIGH_FIDELITY'
            : 'CHECK',
      },
      p1: { origin: 'LIVE', packDir: outDir, ...p1Stats },
      p2: {
        origin: 'LIVE',
        packDir: p2.outDir,
        geminiInvoked: !!p2.geminiInvoked,
        resultOrigin: p2.geminiInvoked ? 'LIVE' : 'NONE',
        candidates: p2.envelope.payload.domainCandidates.map((c) => ({
          domainCode: c.domainCode,
          status: c.candidateStatus,
          confidence: c.confidence,
        })),
      },
      r1: {
        origin: 'CREATED',
        packDir: r1.outDir,
        status: r1p.fieldResolutionStatus,
        primary,
        secondaries,
        decisionCodes: r1p.decisionCodes,
      },
      p3: {
        origin: inScope ? 'LIVE' : 'LIVE_OR_ABSTAIN',
        packDir: p3.outDir,
        geminiInvoked: !!p3.geminiInvoked,
        resultOrigin: p3.geminiInvoked ? 'LIVE' : 'NONE',
        byField: p3ByField,
      },
      p4: {
        origin: 'LIVE',
        packDir: p4.outDir,
        geminiInvoked: !!p4.geminiInvoked,
        resultOrigin: p4.geminiInvoked ? 'LIVE' : 'NONE',
        contractVersion: p4.envelope.contractVersion,
        promptVersion: p4.envelope.payload.artifactProvenance?.promptVersion,
        routingPolicyVersion: p4.envelope.payload.routingPolicyVersion,
        p3Unchanged: p4.envelope.payload.p3Unchanged,
        specialtiesEvaluated,
        routingCandidates: routingCandidates.map((s) => s.specialtyCode),
        specialtyCorroborationHints: corroborationHints,
        specialtyResults: p4Rows,
        flags: p4Flags,
      },
      profile: {
        origin: 'CREATED',
        packDir: profile.outDir,
        summary: profileSummary,
      },
      personDetail: {
        status: reader.status,
        tabs:
          reader.status === 'AVAILABLE'
            ? reader.presentation.fields.map((f) => ({
                code: f.code,
                role: f.role,
                specialtyCount: f.specialties?.length ?? 0,
                toolCount: f.tools?.length ?? 0,
                radarAxes: f.competencyMap?.dimensions?.length ?? 0,
              }))
            : [],
        fallbackLegacy: false,
      },
      anomalies: deduped,
      needsHumanReview:
        p1Alerts.includes('ELEVATED_REVIEW_REQUIRED') ||
        p1Alerts.includes('LOW_EVIDENCE_COVERAGE') ||
        deduped.some((a) => hardReviewCodes.has(a.code)),
    };
  } finally {
    await ds.destroy();
  }
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'node scripts/mc1-felipe-team-bootstrap.js && npx ts-node --transpile-only scripts/mc1-felipe-team-cohort.ts --confirm',
      }),
    );
    process.exit(2);
  }

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const driveAllow = new Set([
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]);
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'), driveAllow);
  for (const [k, v] of Object.entries(driveEnv)) {
    if (!process.env[k]?.trim()) process.env[k] = v;
  }

  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnvFile(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);

  const model = gem.GEMINI_MODEL || 'gemini-3.6-flash';
  const frozen = buildFrozenConfig(model);
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, 'frozen-config.json'),
    JSON.stringify(frozen, null, 2),
    'utf8',
  );

  const members = await loadSaraTeamMembers(mde);
  writeFileSync(
    join(OUT_DIR, 'cohort-members.json'),
    JSON.stringify(
      {
        parent: 'Sara Juliana Martinez Lopez',
        members: members.map((m) => ({
          person: m.label,
          fullRole: m.selectionRole,
          personId: m.personId,
          personCvId: m.personCvId,
          document: m.document,
          existingSnapshotId: m.existingSnapshotId,
          action: m.action,
          caseId: m.caseId,
          parseStatus: m.parseStatus,
          nlen: m.nlen,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }

  const only = process.argv
    .find((a) => a.startsWith('--only='))
    ?.split('=')[1]
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const mergeExisting = process.argv.includes('--merge-existing');

  const eligible = members.filter(
    (m) =>
      (m.action === 'REUSE_SNAPSHOT' || m.action === 'CREATE_SNAPSHOT') &&
      (!only || only.includes(m.caseId) || only.includes(m.personId)),
  );

  const results: unknown[] = [];
  const fingerprintMismatches: unknown[] = [];

  if (mergeExisting) {
    const priorPath = join(OUT_DIR, 'cohort-report.json');
    if (existsSync(priorPath)) {
      try {
        const prior = JSON.parse(readFileSync(priorPath, 'utf8')) as {
          results?: Array<{ personId?: string; status?: string }>;
        };
        const skipIds = new Set(eligible.map((m) => m.personId));
        for (const r of prior.results ?? []) {
          if (r?.personId && !skipIds.has(String(r.personId))) {
            results.push(r);
          }
        }
      } catch {
        /* start fresh if prior unreadable */
      }
    }
  }
  for (const m of eligible) {
    try {
      // eslint-disable-next-line no-console
      console.error(JSON.stringify({ progress: 'START', caseId: m.caseId }));
      const r = await processCase({ member: m, gem, mde, frozen });
      if (
        (r as { configFingerprint?: string }).configFingerprint &&
        (r as { configFingerprint: string }).configFingerprint !==
          frozen.configFingerprint
      ) {
        fingerprintMismatches.push(r);
        writeFileSync(
          join(OUT_DIR, 'cohort-report.partial.json'),
          JSON.stringify({ results, fingerprintMismatches }, null, 2),
        );
        console.log(
          JSON.stringify({
            status: 'BLOCKED',
            reason: 'CONFIG_FINGERPRINT_MISMATCH',
            caseId: m.caseId,
          }),
        );
        process.exit(3);
      }
      results.push(r);
      writeFileSync(
        join(OUT_DIR, 'cohort-report.partial.json'),
        JSON.stringify({ frozen, results }, null, 2),
      );
      // eslint-disable-next-line no-console
      console.error(
        JSON.stringify({
          progress: m.caseId,
          status: (r as { status?: string }).status,
          snapshotId: (r as { snapshotId?: string }).snapshotId,
        }),
      );
    } catch (e) {
      results.push({
        ...m,
        status: 'PROCESSING_ERROR',
        error: String(e instanceof Error ? e.message : e).slice(0, 500),
        configFingerprint: frozen.configFingerprint,
      });
      writeFileSync(
        join(OUT_DIR, 'cohort-report.partial.json'),
        JSON.stringify({ frozen, results }, null, 2),
      );
    }
  }

  // Include skipped members in report
  for (const m of members.filter(
    (x) => x.action === 'NO_ACTIVE_CV' || x.action === 'BLOCKED',
  )) {
    results.push({
      ...m,
      status: m.action,
      configFingerprint: frozen.configFingerprint,
    });
  }

  const done = (results as Array<Record<string, unknown>>).filter(
    (r) => r.status === 'DONE',
  );
  const domainDist: Record<string, number> = {};
  const specialtyDist: Record<string, number> = {};
  const anomalyDist: Record<string, number> = {};
  const humanReview: string[] = [];

  for (const r of done) {
    const primary = (r.r1 as { primary?: string })?.primary ?? 'NONE';
    domainDist[primary] = (domainDist[primary] ?? 0) + 1;
    const byField = (
      r.p3 as { byField?: Record<string, { observed?: string[]; weak?: string[] }> }
    )?.byField;
    for (const field of Object.values(byField ?? {})) {
      for (const sp of [...(field.observed ?? []), ...(field.weak ?? [])]) {
        specialtyDist[sp] = (specialtyDist[sp] ?? 0) + 1;
      }
    }
    for (const a of (r.anomalies as Array<{ code: string }>) ?? []) {
      anomalyDist[a.code] = (anomalyDist[a.code] ?? 0) + 1;
    }
    if (r.needsHumanReview) humanReview.push(String(r.label));
  }

  const hardDrift = done.some((r) =>
    ((r.anomalies as Array<{ code: string }>) ?? []).some((a) =>
      [
        'RADAR_DRIFT',
        'PUBLICATION_DRIFT',
        'P2_DOMAIN_DRIFT',
        'P4_ROUTING_DRIFT',
      ].includes(a.code),
    ),
  );
  const softDrift = done.some((r) =>
    ((r.anomalies as Array<{ code: string }>) ?? []).some((a) =>
      ['P3_SPECIALTY_DRIFT', 'P1_EXTRACTION_DRIFT', 'P4_SKILL_DRIFT'].includes(
        a.code,
      ),
    ),
  );
  const errors = (results as Array<{ status?: string }>).filter(
    (r) => r.status === 'PROCESSING_ERROR',
  );

  const mapperNotes: unknown[] = [];
  for (const r of done) {
    const fields =
      (r.profile as { summary?: { fields?: Array<{ fieldCode: string; radar?: Record<string, number>; skillCount?: number; skills?: unknown[] }> } })
        ?.summary?.fields ?? [];
    for (const f of fields) {
      const mapped = MAPPED_FIELDS.has(f.fieldCode);
      const radarVals = Object.values(f.radar ?? {});
      const hasRadar = radarVals.some((v) => Number(v) > 0);
      const skillN = f.skills?.length ?? f.skillCount ?? 0;
      if (!mapped) {
        mapperNotes.push({
          person: r.label,
          personId: r.personId,
          fieldCode: f.fieldCode,
          status: 'MAPPER_NOT_AVAILABLE',
          skillCount: skillN,
        });
      } else if (skillN > 0 && !hasRadar) {
        mapperNotes.push({
          person: r.label,
          personId: r.personId,
          fieldCode: f.fieldCode,
          status: 'MAPPER_PRESENT_BUT_ZERO_RADAR',
          skillCount: skillN,
        });
      }
    }
  }

  let decision:
    | 'SARA_CHILDREN_VALIDATED'
    | 'SARA_CHILDREN_VALIDATED_WITH_DRIFT'
    | 'SARA_CHILDREN_BLOCKED' = 'SARA_CHILDREN_VALIDATED';
  if (errors.length > 0 || fingerprintMismatches.length > 0) {
    decision = 'SARA_CHILDREN_BLOCKED';
  } else if (hardDrift || softDrift) {
    decision = 'SARA_CHILDREN_VALIDATED_WITH_DRIFT';
  }

  // Soft: AUDITOR_FALSE_POSITIVE alone should not force WITH_DRIFT
  if (decision === 'SARA_CHILDREN_VALIDATED_WITH_DRIFT') {
    const onlySoftAuditor = done.every((r) => {
      const ans = (r.anomalies as Array<{ code: string }>) ?? [];
      const hard = ans.some((a) =>
        [
          'RADAR_DRIFT',
          'PUBLICATION_DRIFT',
          'P2_DOMAIN_DRIFT',
          'P4_ROUTING_DRIFT',
          'P3_SPECIALTY_DRIFT',
          'P1_EXTRACTION_DRIFT',
        ].includes(a.code),
      );
      return !hard;
    });
    const anyHard = done.some((r) =>
      ((r.anomalies as Array<{ code: string }>) ?? []).some((a) =>
        [
          'RADAR_DRIFT',
          'PUBLICATION_DRIFT',
          'P2_DOMAIN_DRIFT',
          'P4_ROUTING_DRIFT',
          'P3_SPECIALTY_DRIFT',
          'P1_EXTRACTION_DRIFT',
        ].includes(a.code),
      ),
    );
    if (!anyHard && onlySoftAuditor) {
      decision = 'SARA_CHILDREN_VALIDATED';
    }
  }

  const report = {
    phase: 'SARA_CHILDREN_LIVE',
    mode: 'LIVE_GEMINI_FULL_PIPELINE',
    status: errors.length ? 'DONE_WITH_ERRORS' : 'DONE',
    decision,
    cloudWrites: 0,
    frozenConfig: frozen,
    cohortComposition: {
      leaderPersonId: '52',
      memberPersonIds: ['1207', '1210', '1211', '1217'],
      totalPersons: done.length,
    },
    skipped: members.filter(
      (m) => m.action === 'NO_ACTIVE_CV' || m.action === 'BLOCKED',
    ),
    distribution: { domains: domainDist, specialties: specialtyDist },
    mapperNotes,
    anomalyDistribution: anomalyDist,
    humanReview,
    results,
  };

  const personResults = done.map((r) => ({
    name: r.label,
    personId: r.personId,
    personCvId: r.personCvId,
    selectionRole: r.selectionRole,
    snapshotId: r.snapshotId,
    p0Action: r.p0ActionPlanned,
    p0Origin: r.p0,
    p1: r.p1,
    p2: r.p2,
    r1: r.r1,
    p3: r.p3,
    p4: {
      routingCandidates: (r.p4 as { routingCandidates?: string[] })?.routingCandidates,
      flags: (r.p4 as { flags?: string[] })?.flags,
      specialtyResults: (r.p4 as { specialtyResults?: unknown })?.specialtyResults,
    },
    publicationGate: (r.profile as { summary?: { resolvedFields?: unknown } })?.summary
      ?.resolvedFields,
    radar: ((r.profile as { summary?: { fields?: unknown[] } })?.summary?.fields ?? []).map(
      (f: any) => ({
        fieldCode: f.fieldCode,
        role: f.role,
        specialties: f.specialties,
        skillCount: f.skills?.length ?? 0,
        tools: f.tools,
        radar: f.radar,
        mapperAvailable: MAPPED_FIELDS.has(f.fieldCode),
      }),
    ),
    anomalies: r.anomalies,
    needsHumanReview: r.needsHumanReview,
  }));

  const driftSummary = {
    decision,
    configFingerprint: frozen.configFingerprint,
    cloudWrites: 0,
    anomalyDistribution: anomalyDist,
    byPerson: done.map((r) => ({
      personId: r.personId,
      label: r.label,
      anomalies: r.anomalies,
    })),
    mapperNotes,
  };

  const analysisNotes = {
    intent:
      'Evidence-first LIVE validation of Sara Juliana + 4 direct reports. Org roles used only for cohort selection.',
    nonAssumptions: [
      'Do not assume EDUCATION from Contenidos Académicos',
      'Do not assume VISUAL_DESIGN from prior cohorts',
      'Do not homogenize Sara with children',
    ],
    identityResolved: SARA_TEAM.map((m) => ({
      label: m.label,
      personId: m.personId,
      personCvId: m.personCvId,
      selectionRole: m.selectionRole,
    })),
    p1SpanAudit:
      'Units validated via startOffset/endOffset/sourceText; legacy sourceSpan check treated as AUDITOR_FALSE_POSITIVE when spans present',
    frozenStack: frozen,
  };

  writeFileSync(join(OUT_DIR, 'cohort-report.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'person-results.json'), JSON.stringify(personResults, null, 2));
  writeFileSync(join(OUT_DIR, 'drift-summary.json'), JSON.stringify(driftSummary, null, 2));
  writeFileSync(join(OUT_DIR, 'analysis-notes.json'), JSON.stringify(analysisNotes, null, 2));
  writeFileSync(
    join(OUT_DIR, 'phase-verdict.json'),
    JSON.stringify(
      {
        phase: 'SARA_CHILDREN_LIVE',
        decision,
        configFingerprint: frozen.configFingerprint,
        cloudWrites: 0,
        p4ContractVersion: P4_CONTRACT_VERSION,
        p4PromptVersion: P4_PROMPT_VERSION,
        routingPolicyVersion: P4_ROUTING_POLICY_VERSION,
        radarMapperVersion: RADAR_MAPPER_VERSION,
        processed: done.length,
        leaderIncluded: done.some((r) => String(r.personId) === '52'),
        errors: errors.length,
        humanReview,
        anomalyDistribution: anomalyDist,
        mapperNotes,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      status: report.status,
      decision,
      processed: done.length,
      leaderIncluded: done.some((r) => String(r.personId) === '52'),
      errors: errors.length,
      cloudWrites: 0,
      configFingerprint: frozen.configFingerprint,
      out: join(OUT_DIR, 'cohort-report.json'),
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
