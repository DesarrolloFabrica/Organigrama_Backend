/**
 * MC1 — tests ciclo de vida cv_extraction (puros, writes: 0).
 */

import {
  assertMutuallyExclusiveCoverage,
  classifyNoExtractionBucket,
  classifyOrphanExtraction,
  classifyPersonActivationState,
  classifyPersonFinalState,
  classifySelectedExtractionState,
  countActiveByStatus,
  lifecycleAuditPerformsWrites,
  selectApiCompetenciesExtraction,
  selectMc1UsableExtraction,
  type McCvExtractionRow,
  type McPa2EvalLink,
  type McPersonCvRow,
  type McPersonFinalState,
} from './mc-cv-extraction-lifecycle-audit';

function ext(
  partial: Partial<McCvExtractionRow> &
    Pick<McCvExtractionRow, 'extractionId' | 'personId' | 'status' | 'isActive'>,
): McCvExtractionRow {
  return {
    document: '1',
    personCvId: '10',
    driveFileId: 'file-a',
    createdAt: null,
    startedAt: null,
    finishedAt: null,
    model: 'm',
    promptVersion: 'p',
    extractorVersion: 'e',
    pdfSha256: 'a'.repeat(64),
    ...partial,
  };
}

function cv(
  partial: Partial<McPersonCvRow> & Pick<McPersonCvRow, 'personCvId' | 'personId'>,
): McPersonCvRow {
  return {
    document: '1',
    driveFileId: 'file-a',
    isActive: true,
    ...partial,
  };
}

describe('mc-cv-extraction-lifecycle-audit', () => {
  it('una persona con una activa SUCCEEDED', () => {
    const extractions = [
      ext({
        extractionId: '5',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-a',
      }),
    ];
    const cvs = [cv({ personCvId: '10', personId: '1' })];
    expect(classifyPersonActivationState({ activePersonCvs: cvs, extractions })).toBe(
      'ONE_ACTIVE_SUCCEEDED',
    );
    expect(
      classifySelectedExtractionState({
        activePersonCv: cvs[0],
        extractions,
      }),
    ).toBe('CURRENT_SELECTED_EXTRACTION');
    expect(
      classifyPersonFinalState({ activePersonCvs: cvs, extractions }),
    ).toBe('HEALTHY_CURRENT');
  });

  it('reextracción: histórica SUCCEEDED inactiva + nueva activa CURRENT', () => {
    const cvs = [
      cv({
        personCvId: '27',
        personId: '1169',
        driveFileId: 'file-current',
      }),
    ];
    const before = [
      ext({
        extractionId: '96',
        personId: '1169',
        personCvId: '27',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-stale',
        pdfSha256: 'b'.repeat(64),
      }),
    ];
    expect(
      classifyPersonFinalState({ activePersonCvs: cvs, extractions: before }),
    ).toBe('STALE_SELECTED_EXTRACTION');

    const after = [
      ext({
        extractionId: '96',
        personId: '1169',
        personCvId: '27',
        status: 'SUCCEEDED',
        isActive: false,
        driveFileId: 'file-stale',
        pdfSha256: 'b'.repeat(64),
      }),
      ext({
        extractionId: '219',
        personId: '1169',
        personCvId: '27',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-current',
        pdfSha256: 'c'.repeat(64),
      }),
    ];
    expect(countActiveByStatus(after)).toEqual({
      totalActive: 1,
      succeeded: 1,
      failed: 0,
      running: 0,
      pending: 0,
      other: 0,
    });
    expect(selectMc1UsableExtraction(after)?.extractionId).toBe('219');
    expect(
      classifyPersonFinalState({ activePersonCvs: cvs, extractions: after }),
    ).toBe('HEALTHY_CURRENT');

    // Rollback documentado: reactivar histórica, desactivar nueva.
    const rolled = after.map((e) =>
      e.extractionId === '219'
        ? { ...e, isActive: false }
        : e.extractionId === '96'
          ? { ...e, isActive: true }
          : e,
    );
    expect(selectMc1UsableExtraction(rolled)?.extractionId).toBe('96');
    expect(
      classifyPersonFinalState({ activePersonCvs: cvs, extractions: rolled }),
    ).toBe('STALE_SELECTED_EXTRACTION');
  });

  it('múltiples activas', () => {
    const extractions = [
      ext({
        extractionId: '1',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-a',
      }),
      ext({
        extractionId: '2',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-b',
      }),
    ];
    expect(
      classifyPersonActivationState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1' })],
        extractions,
      }),
    ).toBe('MULTIPLE_ACTIVE');
    expect(
      classifyPersonFinalState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'file-b' })],
        extractions,
      }),
    ).toBe('MULTIPLE_ACTIVE_CURRENT_RESOLVED');
    expect(
      classifyPersonFinalState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'file-z' })],
        extractions,
      }),
    ).toBe('MULTIPLE_ACTIVE_AMBIGUOUS');
  });

  it('activa FAILED / RUNNING (conteo; CHECK real prohíbe FAILED activa)', () => {
    const failed = [
      ext({
        extractionId: '1',
        personId: '1',
        status: 'FAILED',
        isActive: true,
      }),
    ];
    expect(countActiveByStatus(failed).failed).toBe(1);
    expect(
      classifyPersonActivationState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1' })],
        extractions: failed,
      }),
    ).toBe('ACTIVE_FAILED_ONLY');

    const running = [
      ext({
        extractionId: '1',
        personId: '1',
        status: 'RUNNING',
        isActive: false,
      }),
    ];
    expect(
      classifyPersonActivationState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1' })],
        extractions: running,
      }),
    ).toBe('NO_ACTIVE');
  });

  it('solo histórica SUCCEEDED', () => {
    const extractions = [
      ext({
        extractionId: '1',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: false,
        driveFileId: 'old',
      }),
    ];
    const cvs = [cv({ personCvId: '10', personId: '1', driveFileId: 'new' })];
    expect(
      classifyNoExtractionBucket({ activePersonCv: cvs[0], extractions }),
    ).toBe('HAS_HISTORICAL_SUCCEEDED_INACTIVE');
    expect(
      classifyPersonFinalState({ activePersonCvs: cvs, extractions }),
    ).toBe('NO_USABLE_EXTRACTION');
  });

  it('extracción sin person_cv / person_cv sin extracción', () => {
    const extractions = [
      ext({
        extractionId: '1',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
      }),
    ];
    expect(
      classifyPersonFinalState({ activePersonCvs: [], extractions }),
    ).toBe('EXTRACTION_ONLY_NO_CV');
    expect(
      classifyPersonFinalState({
        activePersonCvs: [cv({ personCvId: '10', personId: '1' })],
        extractions: [],
      }),
    ).toBe('NO_USABLE_EXTRACTION');
  });

  it('extracción activa con file ID anterior (STALE)', () => {
    const extractions = [
      ext({
        extractionId: '9',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'old-file',
      }),
    ];
    const cvs = [cv({ personCvId: '10', personId: '1', driveFileId: 'new-file' })];
    expect(
      classifySelectedExtractionState({
        activePersonCv: cvs[0],
        extractions,
      }),
    ).toBe('STALE_SELECTED_EXTRACTION');
  });

  it('extracción histórica con file ID anterior no es huérfana', () => {
    const extraction = ext({
      extractionId: '1',
      personId: '1',
      status: 'SUCCEEDED',
      isActive: false,
      driveFileId: 'old',
    });
    expect(
      classifyOrphanExtraction({
        extraction,
        personExists: true,
        activePersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'new' })],
        allPersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'new' })],
      }),
    ).toBe('NOT_ORPHAN_HISTORICAL');
    expect(
      classifyOrphanExtraction({
        extraction: { ...extraction, isActive: true },
        personExists: true,
        activePersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'new' })],
        allPersonCvs: [cv({ personCvId: '10', personId: '1', driveFileId: 'new' })],
      }),
    ).toBe('ORPHAN_OLD_DRIVE_FILE');
  });

  it('selección determinística API vs MC1', () => {
    const extractions = [
      ext({
        extractionId: '10',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: true,
        driveFileId: 'file-a',
      }),
      ext({
        extractionId: '8',
        personId: '1',
        status: 'SUCCEEDED',
        isActive: false,
        driveFileId: 'file-old',
      }),
    ];
    const pa2: McPa2EvalLink[] = [
      {
        personId: '1',
        extractionId: '8',
        evaluationId: '100',
        domainCode: 'VISUAL_DESIGN',
        isActive: true,
      },
    ];
    expect(selectMc1UsableExtraction(extractions)?.extractionId).toBe('10');
    expect(selectApiCompetenciesExtraction(extractions, pa2)?.extractionId).toBe(
      '8',
    );
  });

  it('categorías mutuamente excluyentes y suma exacta', () => {
    const states: McPersonFinalState[] = [
      'HEALTHY_CURRENT',
      'STALE_SELECTED_EXTRACTION',
      'NO_USABLE_EXTRACTION',
      'EXTRACTION_ONLY_NO_CV',
      'PERSON_CV_ORPHAN',
    ];
    const r = assertMutuallyExclusiveCoverage(states);
    expect(r.ok).toBe(true);
    expect(r.sum).toBe(5);
  });

  it('ausencia de writes', () => {
    expect(lifecycleAuditPerformsWrites()).toBe(false);
  });
});
