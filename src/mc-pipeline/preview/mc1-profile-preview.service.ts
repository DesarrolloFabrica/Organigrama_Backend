/**
 * FASE 9B.1 — Preview local de perfiles MC1 (ARTIFACT_ONLY).
 * Lee packs en tmp/mc1-profile-pilot. No persiste. No modifica pipeline.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SPECIALTY_BY_CODE } from '../catalog/specialties-visual-education';
import type { ProfilePilotEnvelope } from '../profile/profile.types';
import { resolveBackendRoot } from './mc1-preview-backend-root';

const FIELD_LABELS: Record<string, string> = {
  VISUAL_DESIGN: 'Diseño Visual',
  EDUCATION: 'Educación',
  SOFTWARE_ENGINEERING: 'Ingeniería de Software',
  PROJECT_PROGRAM_MGMT: 'Gestión de Proyectos / Programas',
  FINANCE_ADMIN: 'Administración y Finanzas Operativas',
  CUSTOMER_SUCCESS: 'Relación con Usuario/Cliente',
  AUDIOVISUAL_PRODUCTION: 'Producción Audiovisual',
};

export type PreviewAvailability =
  | 'PROFILE_AVAILABLE'
  | 'PARTIAL_PROFILE'
  | 'PIPELINE_NOT_READY'
  | 'PROCESSING_ERROR';

export type PreviewCaseKind = 'ARTIFACT_SNAPSHOT' | 'REAL_PERSON';
export type PreviewCohortGroup = 'A' | 'B' | 'C' | 'D' | 'E';

export type PreviewCaseSummary = {
  caseId: string;
  kind: PreviewCaseKind;
  label: string;
  snapshotId: string | null;
  availability: PreviewAvailability;
  r1Status: string | null;
  fieldCodes: string[];
  hasRadar: boolean;
  cohortGroup: PreviewCohortGroup;
  /** Solo server-side; nunca incluir documento en respuestas. */
};

/** Casos Grupo A — packs obligatorios. */
const ARTIFACT_CASES: Array<{ caseId: string; snapshotId: string; label: string }> =
  [
    { caseId: 'snap-1', snapshotId: '1', label: 'Snapshot 1' },
    { caseId: 'snap-2', snapshotId: '2', label: 'Snapshot 2' },
    { caseId: 'snap-5', snapshotId: '5', label: 'Snapshot 5' },
    { caseId: 'snap-6', snapshotId: '6', label: 'Snapshot 6' },
    { caseId: 'snap-7', snapshotId: '7', label: 'Snapshot 7' },
  ];

/**
 * Casos Grupo B — documentos solo en memoria servidor para lookup MDE.
 * Nunca se serializan a la respuesta.
 */
const REAL_PERSON_CASES: Array<{
  caseId: string;
  label: string;
  document: string;
  cohortGroup: PreviewCohortGroup;
}> = [
  {
    caseId: 'person-nidia',
    label: 'Nidia Marcela Prada Ramírez',
    document: '1015482688',
    cohortGroup: 'B',
  },
  {
    caseId: 'person-santiago',
    label: 'Santiago Vanegas García',
    document: '1000944247',
    cohortGroup: 'B',
  },
  {
    caseId: 'person-ginna',
    label: 'Ginna Marcela Garzón Toledo',
    document: '1030646495',
    cohortGroup: 'B',
  },
  {
    caseId: 'person-camilo',
    label: 'Camilo Andrés Quintero Vargas',
    document: '1000518830',
    cohortGroup: 'C',
  },
  {
    caseId: 'person-zuany',
    label: 'Zuany Alejandro Acuña Vélez',
    document: '1000372715',
    cohortGroup: 'C',
  },
  {
    caseId: 'person-jose',
    label: 'José Alejandro Camacho Cobos',
    document: '1010247929',
    cohortGroup: 'C',
  },
  {
    caseId: 'person-alejandro',
    label: 'Alejandro Castro Sánchez',
    document: '1193510625',
    cohortGroup: 'C',
  },
  {
    caseId: 'person-johan',
    label: 'Johan Sebastian Daza Sarmiento',
    document: '1020841798',
    cohortGroup: 'C',
  },
  {
    caseId: 'person-santiago-vanegas',
    label: 'Santiago Vanegas García (AV)',
    document: '1000944247',
    cohortGroup: 'D',
  },
  {
    caseId: 'person-juan-pablo-sanabria',
    label: 'Juan Pablo Sanabria Díaz',
    document: '1022445625',
    cohortGroup: 'D',
  },
  {
    caseId: 'person-camilo-ramirez',
    label: 'Camilo Andrés Ramírez Vargas',
    document: '93135969',
    cohortGroup: 'D',
  },
  {
    caseId: 'person-katherin-araque',
    label: 'Katherin Juliana Araque Pinzón',
    document: '1000020890',
    cohortGroup: 'E',
  },
  {
    caseId: 'person-danna-fierro',
    label: 'Danna Camila Fierro Herrera',
    document: '1013102120',
    cohortGroup: 'E',
  },
  {
    caseId: 'person-linda-aguilera',
    label: 'Linda Gisell Aguilera Domínguez',
    document: '1072896519',
    cohortGroup: 'E',
  },
  {
    caseId: 'person-alejandra-sanabria',
    label: 'Alejandra Lucía Sanabria Ramírez',
    document: '1013100614',
    cohortGroup: 'E',
  },
];

function loadRealPersonBindings(
  backendRoot: string,
): Record<string, { snapshotId: string; boundAt?: string }> {
  const path = join(
    backendRoot,
    'tmp',
    'mc1-profile-preview',
    'real-person-bindings.json',
  );
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      { snapshotId: string; boundAt?: string }
    >;
  } catch {
    return {};
  }
}

function backendRootFromHere(): string {
  return resolveBackendRoot(__dirname);
}

export type ValidProfilePack = {
  packDir: string;
  envelope: ProfilePilotEnvelope;
  producedAtMs: number;
};

/**
 * Selecciona el Profile Assembly válido más reciente para un snapshot.
 * Criterio:
 * 1) directorio bajo tmp/mc1-profile-pilot
 * 2) profile-contract.json con contractCode MC1.PROFILE.PILOT
 * 3) payload.snapshotId coincide (metadata, no solo nombre de carpeta)
 * 4) al menos un field
 * 5) entre válidos: mayor producedAt (ISO); empate → nombre de dir lexicográfico
 */
export function findValidProfilePacks(
  backendRoot: string,
  snapshotId: string,
): ValidProfilePack[] {
  const root = resolve(backendRoot, 'tmp', 'mc1-profile-pilot');
  if (!existsSync(root)) return [];

  const wanted = String(snapshotId);
  const out: ValidProfilePack[] = [];

  for (const name of readdirSync(root)) {
    const packDir = join(root, name);
    if (!statSync(packDir).isDirectory()) continue;
    const contractPath = join(packDir, 'profile-contract.json');
    if (!existsSync(contractPath)) continue;

    let envelope: ProfilePilotEnvelope;
    try {
      envelope = JSON.parse(
        readFileSync(contractPath, 'utf8'),
      ) as ProfilePilotEnvelope;
    } catch {
      continue;
    }

    if (envelope.contractCode !== 'MC1.PROFILE.PILOT') continue;
    if (String(envelope.payload?.snapshotId ?? '') !== wanted) continue;
    if (!Array.isArray(envelope.payload?.fields) || !envelope.payload.fields.length) {
      continue;
    }

    const producedAtMs = Date.parse(envelope.producedAt ?? '');
    out.push({
      packDir,
      envelope,
      producedAtMs: Number.isFinite(producedAtMs) ? producedAtMs : 0,
    });
  }

  out.sort((a, b) => {
    if (b.producedAtMs !== a.producedAtMs) return b.producedAtMs - a.producedAtMs;
    return a.packDir < b.packDir ? 1 : a.packDir > b.packDir ? -1 : 0;
  });
  return out;
}

/** @deprecated alias — usa findBestValidProfilePack */
export function findLatestProfilePack(
  backendRoot: string,
  snapshotId: string,
): string | null {
  return findBestValidProfilePack(backendRoot, snapshotId)?.packDir ?? null;
}

export function findBestValidProfilePack(
  backendRoot: string,
  snapshotId: string,
): ValidProfilePack | null {
  const packs = findValidProfilePacks(backendRoot, snapshotId);
  return packs[0] ?? null;
}

export function loadProfileContract(packDir: string): ProfilePilotEnvelope {
  const path = join(packDir, 'profile-contract.json');
  if (!existsSync(path)) {
    throw new Error(`missing profile-contract.json in ${packDir}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ProfilePilotEnvelope;
}

function specialtyName(code: string): string {
  return SPECIALTY_BY_CODE.get(code)?.name ?? code;
}

function fieldLabel(code: string): string {
  return FIELD_LABELS[code] ?? code;
}

function classifyAvailability(
  envelope: ProfilePilotEnvelope | null,
): PreviewAvailability {
  if (!envelope) return 'PIPELINE_NOT_READY';
  const fields = envelope.payload.fields ?? [];
  if (!fields.length) return 'PIPELINE_NOT_READY';
  const withSpec = fields.filter((f) => (f.specialties?.length ?? 0) > 0);
  const withSkills = fields.filter((f) => (f.skills?.length ?? 0) > 0);
  const withRadar = fields.filter((f) =>
    (f.radar?.axes ?? []).some((a) => a.relativeCoverage > 0),
  );
  if (withSpec.length && withSkills.length && withRadar.length) {
    return 'PROFILE_AVAILABLE';
  }
  if (withSpec.length || withSkills.length) return 'PARTIAL_PROFILE';
  return 'PARTIAL_PROFILE';
}

export type PreviewPresentation = {
  caseId: string;
  kind: PreviewCaseKind;
  label: string;
  availability: PreviewAvailability;
  snapshotId: string | null;
  personId: number | null;
  photoUrl: string | null;
  r1FieldResolutionStatus: string | null;
  mc1StatusLabel: string;
  fields: Array<{
    fieldCode: string;
    fieldLabel: string;
    role: 'PRIMARY' | 'SECONDARY';
    r1Confidence?: number;
    specialties: Array<{
      specialtyCode: string;
      name: string;
      confidence: number;
    }>;
    skillsBySpecialty: Array<{
      specialtyCode: string;
      specialtyName: string;
      skills: Array<{
        skillCode: string;
        name: string;
        confidence: number;
        supportingEvidenceUnitIds: string[];
      }>;
    }>;
    toolsTechnologies: string[];
    evidenceVolume: 'LOW' | 'MEDIUM' | 'HIGH';
    evidenceUnitCount: number;
    derivedPresentationLabel?: string | null;
    radar: {
      axes: Array<{
        dimensionCode: string;
        label: string;
        relativeCoverage: number;
        rawScore: number;
        contributingSkillCodes: string[];
        supportingEvidenceUnitIds: string[];
      }>;
    };
    skillDimensionMappings: Array<{
      skillCode: string;
      dimensionCodes: string[];
      mappingJustification: string;
      supportingEvidenceUnitIds: string[];
    }>;
  }>;
  presentationNotes: ProfilePilotEnvelope['payload']['presentationNotes'] | null;
  debug: null | {
    snapshotId: string;
    packDir: string;
    producedAt: string;
    provenance: ProfilePilotEnvelope['payload']['provenance'];
    warnings: ProfilePilotEnvelope['warnings'];
    formulaVersion: string;
    radarSemantics: string;
  };
};

function buildPresentation(args: {
  caseId: string;
  kind: PreviewCaseKind;
  label: string;
  envelope: ProfilePilotEnvelope | null;
  packDir: string | null;
  personId: number | null;
  debug: boolean;
}): PreviewPresentation {
  const availability = classifyAvailability(args.envelope);
  const payload = args.envelope?.payload;

  const fields =
    payload?.fields.map((f) => {
      const specialties = (f.specialties ?? []).map((s) => ({
        specialtyCode: s.specialtyCode,
        name: specialtyName(s.specialtyCode),
        confidence: s.confidence,
      }));
      const bySpec = new Map<
        string,
        PreviewPresentation['fields'][0]['skillsBySpecialty'][0]
      >();
      for (const sp of specialties) {
        bySpec.set(sp.specialtyCode, {
          specialtyCode: sp.specialtyCode,
          specialtyName: sp.name,
          skills: [],
        });
      }
      for (const sk of f.skills ?? []) {
        const key = sk.parentSpecialtyCode;
        if (!bySpec.has(key)) {
          bySpec.set(key, {
            specialtyCode: key,
            specialtyName: specialtyName(key),
            skills: [],
          });
        }
        bySpec.get(key)!.skills.push({
          skillCode: sk.skillCode,
          name: sk.name,
          confidence: sk.confidence,
          supportingEvidenceUnitIds: sk.supportingEvidenceUnitIds ?? [],
        });
      }
      return {
        fieldCode: f.fieldCode,
        fieldLabel: fieldLabel(f.fieldCode),
        role: f.role,
        r1Confidence: f.r1Confidence,
        specialties,
        skillsBySpecialty: [...bySpec.values()],
        toolsTechnologies: [...(f.toolsTechnologies ?? [])],
        evidenceVolume: f.evidenceVolume,
        evidenceUnitCount: f.evidenceUnitCount,
        derivedPresentationLabel: f.derivedPresentationLabel ?? null,
        radar: {
          axes: (f.radar?.axes ?? []).map((a) => ({
            dimensionCode: a.dimensionCode,
            label: a.label,
            relativeCoverage: a.relativeCoverage,
            rawScore: a.rawScore,
            contributingSkillCodes: a.contributingSkillCodes ?? [],
            supportingEvidenceUnitIds: a.supportingEvidenceUnitIds ?? [],
          })),
        },
        skillDimensionMappings: (f.skillDimensionMappings ?? []).map((m) => ({
          skillCode: m.skillCode,
          dimensionCodes: m.dimensionCodes,
          mappingJustification: m.mappingJustification,
          supportingEvidenceUnitIds: m.supportingEvidenceUnitIds ?? [],
        })),
      };
    }) ?? [];

  let mc1StatusLabel = 'Sin perfil MC1';
  if (availability === 'PROFILE_AVAILABLE') mc1StatusLabel = 'Perfil MC1 disponible';
  else if (availability === 'PARTIAL_PROFILE') mc1StatusLabel = 'Perfil MC1 parcial';
  else mc1StatusLabel = 'Pipeline no listo';

  return {
    caseId: args.caseId,
    kind: args.kind,
    label: args.label,
    availability,
    snapshotId: payload?.snapshotId ?? null,
    personId: args.personId,
    photoUrl: args.personId
      ? `/api/org-chart/photos/${args.personId}`
      : null,
    r1FieldResolutionStatus: payload?.r1FieldResolutionStatus ?? null,
    mc1StatusLabel,
    fields,
    presentationNotes: payload?.presentationNotes ?? null,
    debug:
      args.debug && args.envelope && args.packDir
        ? {
            snapshotId: args.envelope.payload.snapshotId,
            packDir: args.packDir,
            producedAt: args.envelope.producedAt,
            provenance: args.envelope.payload.provenance,
            warnings: args.envelope.warnings,
            formulaVersion:
              args.envelope.payload.presentationNotes.formulaVersion,
            radarSemantics:
              args.envelope.payload.presentationNotes.radarSemantics,
          }
        : null,
  };
}

export type PersonLookupRow = {
  personId: number;
  fullName: string;
  personCvId: string | null;
  latestSnapshotId: string | null;
};

export class Mc1ProfilePreviewService {
  constructor(private readonly backendRoot = backendRootFromHere()) {}

  listCases(personLookups?: Map<string, PersonLookupRow>): PreviewCaseSummary[] {
    const out: PreviewCaseSummary[] = [];

    for (const c of ARTIFACT_CASES) {
      const best = findBestValidProfilePack(this.backendRoot, c.snapshotId);
      let availability: PreviewAvailability = 'PIPELINE_NOT_READY';
      let r1Status: string | null = null;
      let fieldCodes: string[] = [];
      let hasRadar = false;
      if (best) {
        availability = classifyAvailability(best.envelope);
        r1Status = best.envelope.payload.r1FieldResolutionStatus;
        fieldCodes = best.envelope.payload.fields.map((f) => f.fieldCode);
        hasRadar = best.envelope.payload.fields.some((f) =>
          (f.radar?.axes ?? []).some((a) => a.relativeCoverage > 0),
        );
      }
      out.push({
        caseId: c.caseId,
        kind: 'ARTIFACT_SNAPSHOT',
        label: c.label,
        snapshotId: c.snapshotId,
        availability,
        r1Status,
        fieldCodes,
        hasRadar,
        cohortGroup: 'A',
      });
    }

    const bindings = loadRealPersonBindings(this.backendRoot);
    for (const c of REAL_PERSON_CASES) {
      const lookup = personLookups?.get(c.caseId);
      const boundSnapshotId = bindings[c.caseId]?.snapshotId ?? null;
      let availability: PreviewAvailability = 'PIPELINE_NOT_READY';
      let r1Status: string | null = null;
      let fieldCodes: string[] = [];
      let hasRadar = false;
      let snapshotId: string | null = boundSnapshotId;

      if (boundSnapshotId) {
        const best = findBestValidProfilePack(this.backendRoot, boundSnapshotId);
        if (best) {
          availability = classifyAvailability(best.envelope);
          r1Status = best.envelope.payload.r1FieldResolutionStatus;
          fieldCodes = best.envelope.payload.fields.map((f) => f.fieldCode);
          hasRadar = best.envelope.payload.fields.some((f) =>
            (f.radar?.axes ?? []).some((a) => a.relativeCoverage > 0),
          );
          snapshotId = best.envelope.payload.snapshotId;
        }
      }

      out.push({
        caseId: c.caseId,
        kind: 'REAL_PERSON',
        label: lookup?.fullName?.trim() || c.label,
        snapshotId,
        availability,
        r1Status,
        fieldCodes,
        hasRadar,
        cohortGroup: c.cohortGroup,
      });
    }

    return out;
  }

  getCase(args: {
    caseId: string;
    debug?: boolean;
    personLookups?: Map<string, PersonLookupRow>;
  }): PreviewPresentation | null {
    const artifact = ARTIFACT_CASES.find((c) => c.caseId === args.caseId);
    if (artifact) {
      const best = findBestValidProfilePack(
        this.backendRoot,
        artifact.snapshotId,
      );
      if (!best) {
        return buildPresentation({
          caseId: artifact.caseId,
          kind: 'ARTIFACT_SNAPSHOT',
          label: artifact.label,
          envelope: null,
          packDir: null,
          personId: null,
          debug: !!args.debug,
        });
      }
      return buildPresentation({
        caseId: artifact.caseId,
        kind: 'ARTIFACT_SNAPSHOT',
        label: artifact.label,
        envelope: best.envelope,
        packDir: best.packDir,
        personId: null,
        debug: !!args.debug,
      });
    }

    const person = REAL_PERSON_CASES.find((c) => c.caseId === args.caseId);
    if (!person) return null;
    const lookup = args.personLookups?.get(person.caseId);
    const bindings = loadRealPersonBindings(this.backendRoot);
    const boundSnapshotId = bindings[person.caseId]?.snapshotId ?? null;
    const best = boundSnapshotId
      ? findBestValidProfilePack(this.backendRoot, boundSnapshotId)
      : null;
    return buildPresentation({
      caseId: person.caseId,
      kind: 'REAL_PERSON',
      label: lookup?.fullName?.trim() || person.label,
      envelope: best?.envelope ?? null,
      packDir: best?.packDir ?? null,
      personId: lookup?.personId ?? null,
      debug: !!args.debug,
    });
  }

  /** Documentos internos para lookup MDE (nunca exponer). */
  realPersonDocuments(): Array<{ caseId: string; document: string }> {
    return REAL_PERSON_CASES.map((c) => ({
      caseId: c.caseId,
      document: c.document,
    }));
  }
}
