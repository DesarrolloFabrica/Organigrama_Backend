/**
 * MC1 — Clasificación pura del ciclo de vida de cv_extraction.
 * Sin I/O. Determinístico. Categorías mutuamente excluyentes.
 */

export type CvExtractionStatusValue =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | string;

export interface McCvExtractionRow {
  extractionId: string;
  personId: string;
  document: string;
  personCvId: string;
  driveFileId: string;
  status: CvExtractionStatusValue;
  isActive: boolean;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  model: string | null;
  promptVersion: string | null;
  extractorVersion: string | null;
  pdfSha256: string | null;
}

export interface McPersonCvRow {
  personCvId: string;
  personId: string;
  document: string;
  driveFileId: string | null;
  isActive: boolean;
}

export interface McPa2EvalLink {
  personId: string;
  extractionId: string | null;
  evaluationId: string;
  domainCode: string;
  isActive: boolean;
}

export type McPersonActivationState =
  | 'ONE_ACTIVE_SUCCEEDED'
  | 'MULTIPLE_ACTIVE'
  | 'ACTIVE_FAILED_ONLY'
  | 'NO_ACTIVE'
  | 'NO_PERSON_CV'
  | 'MULTIPLE_PERSON_CV';

export type McSelectedExtractionState =
  | 'CURRENT_SELECTED_EXTRACTION'
  | 'STALE_SELECTED_EXTRACTION'
  | 'NO_USABLE_SELECTED_EXTRACTION'
  | 'MULTIPLE_ACTIVE_BUT_CURRENT_SELECTED'
  | 'MULTIPLE_ACTIVE_AND_AMBIGUOUS';

export type McPersonFinalState =
  | 'HEALTHY_CURRENT'
  | 'STALE_SELECTED_EXTRACTION'
  | 'NO_USABLE_EXTRACTION'
  | 'MULTIPLE_ACTIVE_CURRENT_RESOLVED'
  | 'MULTIPLE_ACTIVE_AMBIGUOUS'
  | 'PERSON_CV_ORPHAN'
  | 'EXTRACTION_ONLY_NO_CV';

export type McOrphanKind =
  | 'ORPHAN_NO_PERSON'
  | 'ORPHAN_NO_PERSON_CV'
  | 'ORPHAN_NO_ACTIVE_PERSON_CV'
  | 'ORPHAN_OLD_DRIVE_FILE'
  | 'NOT_ORPHAN_HISTORICAL';

/** Criterio MC1/CLI: única activa SUCCEEDED (ORDER BY id DESC como desempate). */
export function selectMc1UsableExtraction(
  extractions: McCvExtractionRow[],
): McCvExtractionRow | null {
  const activeSucceeded = extractions
    .filter((e) => e.isActive && e.status === 'SUCCEEDED')
    .sort((a, b) => Number(b.extractionId) - Number(a.extractionId));
  return activeSucceeded[0] ?? null;
}

/**
 * Criterio API competencias: extraction_id congelado en mc_profile_evaluation activa.
 * Si no hay PA2, no hay “extracción de ficha de competencias”.
 */
export function selectApiCompetenciesExtraction(
  extractions: McCvExtractionRow[],
  pa2Links: McPa2EvalLink[],
): McCvExtractionRow | null {
  const activeEvals = pa2Links
    .filter((p) => p.isActive && p.extractionId)
    .sort((a, b) => Number(b.evaluationId) - Number(a.evaluationId));
  const extId = activeEvals[0]?.extractionId;
  if (!extId) return null;
  return extractions.find((e) => e.extractionId === extId) ?? null;
}

export function countActiveByStatus(extractions: McCvExtractionRow[]): {
  totalActive: number;
  succeeded: number;
  failed: number;
  running: number;
  pending: number;
  other: number;
} {
  const active = extractions.filter((e) => e.isActive);
  let succeeded = 0;
  let failed = 0;
  let running = 0;
  let pending = 0;
  let other = 0;
  for (const e of active) {
    if (e.status === 'SUCCEEDED') succeeded += 1;
    else if (e.status === 'FAILED') failed += 1;
    else if (e.status === 'RUNNING') running += 1;
    else if (e.status === 'PENDING') pending += 1;
    else other += 1;
  }
  return {
    totalActive: active.length,
    succeeded,
    failed,
    running,
    pending,
    other,
  };
}

export function classifyPersonActivationState(params: {
  activePersonCvs: McPersonCvRow[];
  extractions: McCvExtractionRow[];
}): McPersonActivationState {
  const { activePersonCvs, extractions } = params;
  if (activePersonCvs.length > 1) return 'MULTIPLE_PERSON_CV';
  if (activePersonCvs.length === 0) return 'NO_PERSON_CV';
  const counts = countActiveByStatus(extractions);
  if (counts.totalActive > 1) return 'MULTIPLE_ACTIVE';
  if (counts.succeeded === 1) return 'ONE_ACTIVE_SUCCEEDED';
  if (counts.failed > 0 && counts.succeeded === 0) return 'ACTIVE_FAILED_ONLY';
  return 'NO_ACTIVE';
}

export function classifySelectedExtractionState(params: {
  activePersonCv: McPersonCvRow | null;
  extractions: McCvExtractionRow[];
}): McSelectedExtractionState {
  const { activePersonCv, extractions } = params;
  const activeSucceeded = extractions.filter(
    (e) => e.isActive && e.status === 'SUCCEEDED',
  );
  if (activeSucceeded.length > 1) {
    const selected = selectMc1UsableExtraction(extractions);
    if (
      selected &&
      activePersonCv &&
      (activePersonCv.driveFileId ?? '').trim() === selected.driveFileId.trim()
    ) {
      return 'MULTIPLE_ACTIVE_BUT_CURRENT_SELECTED';
    }
    return 'MULTIPLE_ACTIVE_AND_AMBIGUOUS';
  }
  const selected = selectMc1UsableExtraction(extractions);
  if (!selected || !activePersonCv) return 'NO_USABLE_SELECTED_EXTRACTION';
  const cvFid = (activePersonCv.driveFileId ?? '').trim();
  const extFid = selected.driveFileId.trim();
  if (!cvFid || !extFid) return 'NO_USABLE_SELECTED_EXTRACTION';
  if (cvFid === extFid) return 'CURRENT_SELECTED_EXTRACTION';
  return 'STALE_SELECTED_EXTRACTION';
}

/**
 * Categoría final mutuamente excluyente por persona.
 * Prioridad: múltiples activas → múltiples CV → sin CV → stale/current/no usable.
 */
export function classifyPersonFinalState(params: {
  activePersonCvs: McPersonCvRow[];
  extractions: McCvExtractionRow[];
}): McPersonFinalState {
  const { activePersonCvs, extractions } = params;
  const activeSucceeded = extractions.filter(
    (e) => e.isActive && e.status === 'SUCCEEDED',
  );

  if (activeSucceeded.length > 1) {
    const selected = selectMc1UsableExtraction(extractions);
    const cv = activePersonCvs[0] ?? null;
    if (
      selected &&
      cv &&
      (cv.driveFileId ?? '').trim() === selected.driveFileId.trim()
    ) {
      return 'MULTIPLE_ACTIVE_CURRENT_RESOLVED';
    }
    return 'MULTIPLE_ACTIVE_AMBIGUOUS';
  }

  if (activePersonCvs.length > 1) return 'PERSON_CV_ORPHAN';
  if (activePersonCvs.length === 0) return 'EXTRACTION_ONLY_NO_CV';

  const selectedState = classifySelectedExtractionState({
    activePersonCv: activePersonCvs[0],
    extractions,
  });
  if (selectedState === 'CURRENT_SELECTED_EXTRACTION') return 'HEALTHY_CURRENT';
  if (selectedState === 'STALE_SELECTED_EXTRACTION') {
    return 'STALE_SELECTED_EXTRACTION';
  }
  return 'NO_USABLE_EXTRACTION';
}

export function classifyOrphanExtraction(params: {
  extraction: McCvExtractionRow;
  personExists: boolean;
  activePersonCvs: McPersonCvRow[];
  allPersonCvs: McPersonCvRow[];
}): McOrphanKind {
  const { extraction, personExists, activePersonCvs, allPersonCvs } = params;
  if (!personExists) return 'ORPHAN_NO_PERSON';
  if (allPersonCvs.length === 0) return 'ORPHAN_NO_PERSON_CV';
  if (activePersonCvs.length === 0) return 'ORPHAN_NO_ACTIVE_PERSON_CV';

  const activeCv = activePersonCvs[0];
  const cvFid = (activeCv.driveFileId ?? '').trim();
  if (
    extraction.isActive &&
    extraction.status === 'SUCCEEDED' &&
    cvFid &&
    extraction.driveFileId.trim() !== cvFid
  ) {
    return 'ORPHAN_OLD_DRIVE_FILE';
  }
  if (!extraction.isActive) return 'NOT_ORPHAN_HISTORICAL';
  // Activa SUCCEEDED con mismo file_id (o sin cv file) → no huérfana
  return 'NOT_ORPHAN_HISTORICAL';
}

export function classifyNoExtractionBucket(params: {
  activePersonCv: McPersonCvRow | null;
  extractions: McCvExtractionRow[];
}):
  | 'HAS_ACTIVE_SUCCEEDED'
  | 'NO_EXTRACTION_AT_ALL'
  | 'ONLY_FAILED'
  | 'ONLY_RUNNING_PENDING'
  | 'HAS_HISTORICAL_SUCCEEDED_INACTIVE'
  | 'NOT_APPLICABLE_NO_CV' {
  if (!params.activePersonCv) return 'NOT_APPLICABLE_NO_CV';
  const ex = params.extractions;
  if (ex.some((e) => e.isActive && e.status === 'SUCCEEDED')) {
    return 'HAS_ACTIVE_SUCCEEDED';
  }
  if (ex.length === 0) return 'NO_EXTRACTION_AT_ALL';
  const hasHistSucceeded = ex.some(
    (e) => !e.isActive && e.status === 'SUCCEEDED',
  );
  if (hasHistSucceeded) return 'HAS_HISTORICAL_SUCCEEDED_INACTIVE';
  const onlyFailed =
    ex.every((e) => e.status === 'FAILED') &&
    ex.some((e) => e.status === 'FAILED');
  if (onlyFailed) return 'ONLY_FAILED';
  const onlyRunPend = ex.every(
    (e) => e.status === 'RUNNING' || e.status === 'PENDING',
  );
  if (onlyRunPend) return 'ONLY_RUNNING_PENDING';
  return 'NO_EXTRACTION_AT_ALL';
}

/** Verifica que las categorías finales no se solapen y cubren el universo. */
export function assertMutuallyExclusiveCoverage(
  states: McPersonFinalState[],
): { ok: boolean; sum: number; counts: Record<McPersonFinalState, number> } {
  const keys: McPersonFinalState[] = [
    'HEALTHY_CURRENT',
    'STALE_SELECTED_EXTRACTION',
    'NO_USABLE_EXTRACTION',
    'MULTIPLE_ACTIVE_CURRENT_RESOLVED',
    'MULTIPLE_ACTIVE_AMBIGUOUS',
    'PERSON_CV_ORPHAN',
    'EXTRACTION_ONLY_NO_CV',
  ];
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<
    McPersonFinalState,
    number
  >;
  for (const s of states) counts[s] += 1;
  const sum = Object.values(counts).reduce((a, b) => a + b, 0);
  return { ok: sum === states.length, sum, counts };
}

export function lifecycleAuditPerformsWrites(): boolean {
  return false;
}
