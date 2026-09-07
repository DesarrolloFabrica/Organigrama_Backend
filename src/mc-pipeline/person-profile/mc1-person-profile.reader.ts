/**
 * FASE 9F / deploy B — Reader MC1 Profile → PersonDetail.
 * Orden: Cloud presentation store → (lab) ARTIFACT_ONLY local tmp/.
 * No persiste ni llama Gemini. No modifica Publication Gate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from 'typeorm';
import { SPECIALTY_BY_CODE } from '../catalog/specialties-visual-education';
import {
  findBestValidProfilePack,
  type ValidProfilePack,
} from '../preview/mc1-profile-preview.service';
import { resolveBackendRoot } from '../preview/mc1-preview-backend-root';
import type { ProfilePilotEnvelope } from '../profile/profile.types';
import { selectPublishableFields } from '../profile/profile-publication-gate';
import {
  calibrateDimensionCoverage,
  RADAR_CALIBRATION_METADATA,
} from '../profile/profile-radar-calibration';
import {
  readActiveMc1PresentationFromStore,
  validateMc1PresentationPayload,
} from './mc1-person-profile-store';
import type {
  Mc1PersonCompetenciesPresentationDto,
  Mc1PersonProfileReadResult,
} from './mc1-person-profile.types';

const FIELD_LABELS: Record<string, string> = {
  VISUAL_DESIGN: 'Diseño Visual',
  EDUCATION: 'Educación',
  SOFTWARE_ENGINEERING: 'Ingeniería de Software',
  PROJECT_PROGRAM_MGMT: 'Gestión de Proyectos / Programas',
  FINANCE_ADMIN: 'Administración y Finanzas Operativas',
  CUSTOMER_SUCCESS: 'Relación con Usuario/Cliente',
  AUDIOVISUAL_PRODUCTION: 'Producción Audiovisual',
  DATA_ANALYTICS: 'Datos y Analítica',
  IT_SYSTEMS: 'Sistemas y Operaciones de TI',
  DIGITAL_MARKETING: 'Marketing Digital',
  COMMUNICATIONS: 'Comunicación',
  ACADEMIC_RESEARCH: 'Investigación Académica',
  PEOPLE_HR: 'Personas y Talento',
};

/**
 * Document → caseId registry (server-side only; never serialize documents to clients).
 * Used to resolve personId → snapshot via real-person-bindings.
 */
const DOCUMENT_CASE_REGISTRY: Array<{ caseId: string; document: string }> = [
  { caseId: 'person-camilo', document: '1000518830' },
  { caseId: 'person-zuany', document: '1000372715' },
  { caseId: 'person-jose', document: '1010247929' },
  { caseId: 'person-alejandro', document: '1193510625' },
  { caseId: 'person-johan', document: '1020841798' },
  { caseId: 'person-nidia', document: '1015482688' },
  { caseId: 'person-santiago', document: '1000944247' },
  { caseId: 'person-ginna', document: '1030646495' },
];

type PersonSnapshotIndex = Record<
  string,
  { snapshotId: string; caseId?: string; boundAt?: string }
>;

type CaseBindings = Record<string, { snapshotId: string; boundAt?: string }>;

function loadJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

function specialtyLabel(code: string): string {
  return SPECIALTY_BY_CODE.get(code)?.name ?? code;
}

function fieldLabel(code: string): string {
  return FIELD_LABELS[code] ?? code;
}

function allowArtifactLocalFallback(explicit?: boolean): boolean {
  if (explicit != null) return explicit;
  if (process.env.MC1_ALLOW_ARTIFACT_LOCAL === 'true') return true;
  if (process.env.MC1_ALLOW_ARTIFACT_LOCAL === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}

function toPresentation(
  envelope: ProfilePilotEnvelope,
): Mc1PersonCompetenciesPresentationDto {
  // FASE 12A — tabs = PUBLISHABLE only (legacy packs inferred via gate).
  const fields = selectPublishableFields(envelope.payload.fields ?? []);
  return {
    status: 'AVAILABLE',
    source: 'ARTIFACT_ONLY_LOCAL',
    calibration: RADAR_CALIBRATION_METADATA,
    fields: fields.map((f) => {
      const skillsBySpec = new Map<string, Array<{ code: string; name: string }>>();
      for (const sp of f.specialties ?? []) {
        skillsBySpec.set(sp.specialtyCode, []);
      }
      for (const sk of f.skills ?? []) {
        const key = sk.parentSpecialtyCode;
        if (!skillsBySpec.has(key)) skillsBySpec.set(key, []);
        skillsBySpec.get(key)!.push({
          code: sk.skillCode,
          name: sk.name,
        });
      }
      return {
        code: f.fieldCode,
        label: fieldLabel(f.fieldCode),
        role: f.role,
        confidence: f.r1Confidence,
        derivedPresentationLabel: f.derivedPresentationLabel ?? null,
        specialties: (f.specialties ?? []).map((s) => ({
          code: s.specialtyCode,
          label: specialtyLabel(s.specialtyCode),
          confidence: s.confidence,
          skills: skillsBySpec.get(s.specialtyCode) ?? [],
        })),
        tools: [...(f.toolsTechnologies ?? [])],
        competencyMap: {
          dimensions: (f.radar?.axes ?? []).map((a) => ({
            code: a.dimensionCode,
            label: a.label,
            relativeCoverage: a.relativeCoverage,
            displayCoverage: calibrateDimensionCoverage(a),
            ...(a.evidenceState ? { evidenceState: a.evidenceState } : {}),
          })),
        },
        evidenceVolume: f.evidenceVolume,
      };
    }),
  };
}

async function resolveSnapshotIdForPerson(args: {
  backendRoot: string;
  personId: string;
  dataSource: DataSource;
}): Promise<string | null> {
  const indexPath = join(
    args.backendRoot,
    'tmp',
    'mc1-profile-preview',
    'person-snapshot-index.json',
  );
  const index = loadJsonFile<PersonSnapshotIndex>(indexPath);
  const byPerson = index?.[String(args.personId)];
  if (byPerson?.snapshotId) return String(byPerson.snapshotId);

  const rows = await args.dataSource.query(
    `SELECT document FROM core.person WHERE id = $1 LIMIT 1`,
    [args.personId],
  );
  const document = rows?.[0]?.document ? String(rows[0].document) : null;
  if (!document) return null;

  const caseId = DOCUMENT_CASE_REGISTRY.find((c) => c.document === document)
    ?.caseId;
  if (!caseId) return null;

  const bindingsPath = join(
    args.backendRoot,
    'tmp',
    'mc1-profile-preview',
    'real-person-bindings.json',
  );
  const bindings = loadJsonFile<CaseBindings>(bindingsPath);
  const snap = bindings?.[caseId]?.snapshotId;
  return snap ? String(snap) : null;
}

export function mapProfilePackToPresentation(
  pack: ValidProfilePack,
): Mc1PersonCompetenciesPresentationDto {
  return toPresentation(pack.envelope);
}

async function readFromCloudStore(
  dataSource: DataSource,
  personId: string,
): Promise<Mc1PersonProfileReadResult | null> {
  const row = await readActiveMc1PresentationFromStore({
    dataSource,
    personId,
  });
  if (!row) return null;
  if (!row.configFingerprint.trim()) {
    return { status: 'INVALID', reason: 'STORE_FINGERPRINT_MISSING' };
  }
  const validated = validateMc1PresentationPayload(row.payloadJson);
  if (!validated.ok) {
    return { status: 'INVALID', reason: `STORE_${validated.reason}` };
  }
  return { status: 'AVAILABLE', presentation: validated.presentation };
}

async function readFromArtifactLocal(args: {
  personId: string;
  dataSource: DataSource;
  backendRoot: string;
}): Promise<Mc1PersonProfileReadResult> {
  let snapshotId: string | null;
  try {
    snapshotId = await resolveSnapshotIdForPerson({
      backendRoot: args.backendRoot,
      personId: String(args.personId),
      dataSource: args.dataSource,
    });
  } catch {
    return { status: 'NOT_AVAILABLE' };
  }

  if (!snapshotId) return { status: 'NOT_AVAILABLE' };

  const pack = findBestValidProfilePack(args.backendRoot, snapshotId);
  if (!pack) return { status: 'NOT_AVAILABLE' };

  try {
    const presentation = toPresentation(pack.envelope);
    if (!presentation.fields.length) {
      return { status: 'INVALID', reason: 'EMPTY_FIELDS' };
    }
    return { status: 'AVAILABLE', presentation };
  } catch (e) {
    return {
      status: 'INVALID',
      reason: String(e instanceof Error ? e.message : e).slice(0, 200),
    };
  }
}

/**
 * Resolve MC1 Profile Assembly for a person.
 * 1) Cloud store (organigrama.mc1_person_profile_presentation)
 * 2) Lab ARTIFACT_ONLY local (tmp/), unless production / disabled
 */
export async function readMc1PersonProfile(args: {
  personId: string;
  dataSource: DataSource;
  backendRoot?: string;
  /** Override: allow tmp/ fallback (default: non-production). */
  allowArtifactLocal?: boolean;
}): Promise<Mc1PersonProfileReadResult> {
  try {
    const fromStore = await readFromCloudStore(
      args.dataSource,
      String(args.personId),
    );
    if (fromStore) return fromStore;
  } catch (e) {
    // Store read errors should not break PersonDetail; fall through to local/lab.
    if (process.env.NODE_ENV === 'production') {
      return {
        status: 'INVALID',
        reason: String(e instanceof Error ? e.message : e).slice(0, 200),
      };
    }
  }

  if (!allowArtifactLocalFallback(args.allowArtifactLocal)) {
    return { status: 'NOT_AVAILABLE' };
  }

  let backendRoot: string;
  try {
    backendRoot = args.backendRoot ?? resolveBackendRoot(__dirname);
  } catch {
    return { status: 'NOT_AVAILABLE' };
  }

  return readFromArtifactLocal({
    personId: String(args.personId),
    dataSource: args.dataSource,
    backendRoot,
  });
}

/** Write helper for cohort scripts (optional). */
export function buildPersonSnapshotIndexEntries(
  rows: Array<{ personId: string | number; snapshotId: string; caseId?: string }>,
): PersonSnapshotIndex {
  const out: PersonSnapshotIndex = {};
  const now = new Date().toISOString();
  for (const r of rows) {
    out[String(r.personId)] = {
      snapshotId: String(r.snapshotId),
      caseId: r.caseId,
      boundAt: now,
    };
  }
  return out;
}
