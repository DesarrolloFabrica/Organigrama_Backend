/**
 * FASE 9F — Local ARTIFACT_ONLY reader for MC1 Profile Assembly → PersonDetail.
 * Resolves by personId (never by display name). Does not persist or call Gemini.
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

function toPresentation(
  envelope: ProfilePilotEnvelope,
): Mc1PersonCompetenciesPresentationDto {
  return {
    status: 'AVAILABLE',
    source: 'ARTIFACT_ONLY_LOCAL',
    fields: (envelope.payload.fields ?? []).map((f) => {
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

/**
 * Resolve MC1 Profile Assembly for a person (local ARTIFACT_ONLY).
 */
export async function readMc1PersonProfile(args: {
  personId: string;
  dataSource: DataSource;
  backendRoot?: string;
}): Promise<Mc1PersonProfileReadResult> {
  let backendRoot: string;
  try {
    backendRoot = args.backendRoot ?? resolveBackendRoot(__dirname);
  } catch {
    return { status: 'NOT_AVAILABLE' };
  }

  let snapshotId: string | null;
  try {
    snapshotId = await resolveSnapshotIdForPerson({
      backendRoot,
      personId: String(args.personId),
      dataSource: args.dataSource,
    });
  } catch {
    return { status: 'NOT_AVAILABLE' };
  }

  if (!snapshotId) return { status: 'NOT_AVAILABLE' };

  const pack = findBestValidProfilePack(backendRoot, snapshotId);
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
