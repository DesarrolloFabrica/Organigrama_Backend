/**
 * Clasificación y parsing para extract-cv-skills-version (dry-run / persist).
 * Sin I/O de Drive/Gemini en este módulo.
 */

import {
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from '../../../cv-skills/cv-skills.constants';
import { DEFAULT_GEMINI_MODEL } from '../../../cv-skills/cv-skills.types';
import { VACANCY_ROLE_NAMES_NORMALIZED } from '../../../org-chart/org-chart-vacancy';

export const CV_SKILLS_VERSION_DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
export const CV_SKILLS_VERSION_PROMPT = CV_SKILLS_PROMPT_VERSION;
export const CV_SKILLS_VERSION_EXTRACTOR = CV_SKILLS_EXTRACTOR_VERSION;

/** Solo versionId=4 admite --persist en Fase 4B. */
export const CV_SKILLS_PERSIST_ALLOWED_VERSION_ID = 4;
export const CV_SKILLS_PERSIST_EXPECTED_CODE = 'periodo-agosto-2026';

/** Baseline dry-run Fase 4A (referencia de consistencia). */
export const CV_SKILLS_V4_DRYRUN_BASELINE = {
  alreadyProcessed: 1,
  pendingProcessing: 136,
  failedPreviously: 0,
  invalidActiveCv: 0,
  withActiveProcessableCv: 137,
} as const;

export type CvBucket =
  | 'HAS_ACTIVE_CV'
  | 'NO_ACTIVE_CV'
  | 'INVALID_ACTIVE_CV';

export type CvProcessClassification =
  | 'ALREADY_PROCESSED'
  | 'FAILED_PREVIOUSLY'
  | 'PENDING_PROCESSING'
  | 'NO_CV'
  | 'INVALID_CV';

export type ActiveCvRow = {
  personCvId: number;
  driveFileName: string;
  hasDriveFileId: boolean;
  mimeType: string | null;
};

export type ExtractionRow = {
  personCvId: number;
  status: string;
  isActive: boolean;
  model: string;
  promptVersion: string;
  extractorVersion: string;
};

export type DryRunPersonRef = {
  personId: number;
  document: string;
  fullName: string;
  personCvId?: number;
  driveFileName?: string;
  classification: CvProcessClassification;
  reason?: string;
};

export function unifyVersionPersonIds(
  parents: Array<number | string | null | undefined>,
  children: Array<number | string | null | undefined>,
): number[] {
  const set = new Set<number>();
  for (const raw of [...parents, ...children]) {
    if (raw == null || raw === '') continue;
    const n = Number(raw);
    if (!Number.isFinite(n)) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

export function classifyActiveCvBucket(activeCvs: ActiveCvRow[]): {
  bucket: CvBucket;
  reason?: string;
  processableCv?: ActiveCvRow;
} {
  if (activeCvs.length === 0) {
    return { bucket: 'NO_ACTIVE_CV' };
  }
  if (activeCvs.length > 1) {
    return {
      bucket: 'INVALID_ACTIVE_CV',
      reason: `duplicate_active_cv_count=${activeCvs.length}`,
    };
  }
  const cv = activeCvs[0];
  if (!cv.hasDriveFileId) {
    return {
      bucket: 'INVALID_ACTIVE_CV',
      reason: 'missing_drive_file_id',
      processableCv: cv,
    };
  }
  const mime = (cv.mimeType ?? '').trim().toLowerCase();
  if (mime !== 'application/pdf') {
    return {
      bucket: 'INVALID_ACTIVE_CV',
      reason: `unexpected_mime=${cv.mimeType ?? '(null)'}`,
      processableCv: cv,
    };
  }
  return { bucket: 'HAS_ACTIVE_CV', processableCv: cv };
}

export function classifyProcessStatus(params: {
  bucket: CvBucket;
  personCvId?: number;
  extractions: ExtractionRow[];
  model?: string;
  promptVersion?: string;
  extractorVersion?: string;
}): CvProcessClassification {
  const model = params.model ?? CV_SKILLS_VERSION_DEFAULT_MODEL;
  const promptVersion = params.promptVersion ?? CV_SKILLS_VERSION_PROMPT;
  const extractorVersion =
    params.extractorVersion ?? CV_SKILLS_VERSION_EXTRACTOR;

  if (params.bucket === 'NO_ACTIVE_CV') return 'NO_CV';
  if (params.bucket === 'INVALID_ACTIVE_CV') return 'INVALID_CV';

  const personCvId = params.personCvId;
  if (personCvId == null) return 'INVALID_CV';

  const matching = params.extractions.filter(
    (e) =>
      e.personCvId === personCvId &&
      e.model === model &&
      e.promptVersion === promptVersion &&
      e.extractorVersion === extractorVersion,
  );

  const succeededActive = matching.find(
    (e) => e.status === 'SUCCEEDED' && e.isActive === true,
  );
  if (succeededActive) return 'ALREADY_PROCESSED';

  const failed = matching.find((e) => e.status === 'FAILED');
  if (failed) return 'FAILED_PREVIOUSLY';

  return 'PENDING_PROCESSING';
}

export function isVacancyCandidate(params: {
  document: string | null | undefined;
  fullName: string | null | undefined;
  roleName: string | null | undefined;
  vacancyRoleNames?: readonly string[];
}): boolean {
  const roles = params.vacancyRoleNames ?? VACANCY_ROLE_NAMES_NORMALIZED;
  const doc = (params.document ?? '').trim().toUpperCase();
  if (doc.startsWith('VAC-')) return true;
  const name = (params.fullName ?? '').trim().toUpperCase();
  if (name.startsWith('VACANTE')) return true;
  const role = (params.roleName ?? '').trim().toUpperCase();
  return roles.includes(role);
}

export type VersionScriptArgs = {
  versionId: number;
  dryRun: boolean;
  persist: boolean;
  delayMs: number;
  limit: number | null;
  retryFailed: boolean;
};

function parseBoolFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * --dry-run y --persist son mutuamente excluyentes; uno es obligatorio.
 */
export function parseVersionScriptArgs(argv: string[]): VersionScriptArgs {
  let versionId: number | undefined;
  let dryRun = false;
  let persist = false;
  let delayMs = 1000;
  let limit: number | null = null;
  let retryFailed = true;

  for (const arg of argv) {
    if (arg.startsWith('--versionId=')) {
      const raw = arg.slice('--versionId='.length).trim();
      const n = Number(raw);
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--versionId inválido: "${raw}"`);
      }
      versionId = n;
    } else if (arg === '--versionId') {
      throw new Error('Usa --versionId=<id> (ej. --versionId=4).');
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--dry-run=')) {
      dryRun = parseBoolFlag(arg.slice('--dry-run='.length));
    } else if (arg === '--persist') {
      persist = true;
    } else if (arg.startsWith('--persist=')) {
      persist = parseBoolFlag(arg.slice('--persist='.length));
    } else if (arg.startsWith('--delayMs=')) {
      const n = Number(arg.slice('--delayMs='.length).trim());
      if (!Number.isInteger(n) || n < 0) {
        throw new Error(`--delayMs inválido: "${arg}"`);
      }
      delayMs = n;
    } else if (arg.startsWith('--limit=')) {
      const n = Number(arg.slice('--limit='.length).trim());
      if (!Number.isInteger(n) || n <= 0) {
        throw new Error(`--limit inválido: "${arg}"`);
      }
      limit = n;
    } else if (arg.startsWith('--retryFailed=')) {
      retryFailed = parseBoolFlag(arg.slice('--retryFailed='.length));
    } else if (arg === '--retryFailed') {
      retryFailed = true;
    }
  }

  if (versionId == null) {
    throw new Error(
      'Falta --versionId=. Ejemplo: npm run extract:cv-skills:version -- --versionId=4 --dry-run',
    );
  }

  if (dryRun && persist) {
    throw new Error(
      'No combines --dry-run y --persist. Usa uno u otro.',
    );
  }
  if (!dryRun && !persist) {
    throw new Error(
      'Debes indicar --dry-run o --persist. Ejemplo: --versionId=4 --persist',
    );
  }

  if (persist && versionId !== CV_SKILLS_PERSIST_ALLOWED_VERSION_ID) {
    throw new Error(
      'Real processing is enabled only for versionId=4.',
    );
  }

  return { versionId, dryRun, persist, delayMs, limit, retryFailed };
}

/** @deprecated alias para tests Fase 4A; usa parseVersionScriptArgs. */
export function parseVersionDryRunArgs(argv: string[]): VersionScriptArgs {
  return parseVersionScriptArgs(argv);
}

export function maskDocument(document: string): string {
  const d = document.trim();
  if (d.length <= 4) return '*'.repeat(d.length);
  return `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
}

export function assertDryRunListIntegrity(params: {
  alreadyProcessed: DryRunPersonRef[];
  failedPreviously: DryRunPersonRef[];
  pending: DryRunPersonRef[];
  withoutCv: DryRunPersonRef[];
  invalidCv: DryRunPersonRef[];
  processableCvCount: number;
  realActivePeopleCount: number;
}): void {
  const processable =
    params.alreadyProcessed.length +
    params.failedPreviously.length +
    params.pending.length;
  if (processable !== params.processableCvCount) {
    throw new Error(
      `Integrity: processable split ${processable} != processableCvCount ${params.processableCvCount}`,
    );
  }

  const total =
    params.processableCvCount +
    params.withoutCv.length +
    params.invalidCv.length;
  if (total !== params.realActivePeopleCount) {
    throw new Error(
      `Integrity: buckets ${total} != realActivePeopleCount ${params.realActivePeopleCount}`,
    );
  }

  const ids = [
    ...params.alreadyProcessed,
    ...params.failedPreviously,
    ...params.pending,
    ...params.withoutCv,
    ...params.invalidCv,
  ].map((p) => p.personId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('Integrity: duplicate personId across dry-run lists');
  }
}

export function assertPersistUniverseConsistency(params: {
  versionCode: string;
  versionActive: boolean;
  alreadyProcessed: DryRunPersonRef[];
  pending: DryRunPersonRef[];
  failedPreviously: DryRunPersonRef[];
  invalidCv: DryRunPersonRef[];
  withProcessableCv: number;
}): void {
  if (params.versionCode !== CV_SKILLS_PERSIST_EXPECTED_CODE) {
    throw new Error(
      `Versión code inesperado "${params.versionCode}"; se esperaba ${CV_SKILLS_PERSIST_EXPECTED_CODE}.`,
    );
  }
  if (!params.versionActive) {
    throw new Error('La versión 4 no está activa; abortando persist.');
  }

  const ingrid = params.alreadyProcessed.find((p) => p.personId === 1145);
  if (!ingrid) {
    throw new Error(
      'Ingrid (person_id=1145) no aparece en ALREADY_PROCESSED; abortando.',
    );
  }

  const baseline = CV_SKILLS_V4_DRYRUN_BASELINE;
  if (params.invalidCv.length > baseline.invalidActiveCv) {
    throw new Error(
      `Aparecieron CV inválidos (${params.invalidCv.length}); abortando antes de Gemini.`,
    );
  }

  const processableNow =
    params.alreadyProcessed.length +
    params.failedPreviously.length +
    params.pending.length;
  const processableDelta = Math.abs(
    processableNow - baseline.withActiveProcessableCv,
  );
  if (processableDelta > 2) {
    throw new Error(
      `Universo inconsistente: processable=${processableNow} ` +
        `(baseline ${baseline.withActiveProcessableCv}, Δ${processableDelta}). Abortando.`,
    );
  }

  // Duplicados activos u otros inválidos ya elevan invalidCv.
  // pending puede bajar tras reanudaciones; no se compara con 136.
}

export function selectPersistTargets(params: {
  pending: DryRunPersonRef[];
  failedPreviously: DryRunPersonRef[];
  retryFailed: boolean;
  limit: number | null;
}): DryRunPersonRef[] {
  const list = [
    ...params.pending,
    ...(params.retryFailed ? params.failedPreviously : []),
  ].sort((a, b) => a.personId - b.personId);

  if (params.limit == null) return list;
  return list.slice(0, params.limit);
}

export function mapPipelineStageToPersistStage(
  stage: string | undefined,
): string {
  switch (stage) {
    case 'PERSON_LOOKUP':
      return 'PERSON_VALIDATION';
    case 'CV_LOOKUP':
      return 'CV_METADATA';
    case 'DOWNLOAD':
      return 'DRIVE_DOWNLOAD';
    case 'PDF_VALIDATION':
      return 'PDF_HASH';
    case 'GEMINI':
      return 'GEMINI_EXTRACTION';
    case 'VALIDATION':
      return 'RESULT_VALIDATION';
    default:
      return stage && stage.length > 0 ? stage : 'PERSISTENCE';
  }
}
