import {
  CV_SKILLS_EXTRACTOR_VERSION,
  CV_SKILLS_PROMPT_VERSION,
} from '../../../cv-skills/cv-skills.constants';
import {
  assertDryRunListIntegrity,
  classifyActiveCvBucket,
  classifyProcessStatus,
  isVacancyCandidate,
  maskDocument,
  parseVersionScriptArgs,
  selectPersistTargets,
  unifyVersionPersonIds,
  type DryRunPersonRef,
} from './cv-skills-version-dry-run';

describe('cv-skills-version-dry-run utils', () => {
  describe('unifyVersionPersonIds', () => {
    it('une padres e hijos y deduplica', () => {
      expect(
        unifyVersionPersonIds([1, 2, 2, null, '3'], [2, 4, undefined, '']),
      ).toEqual([1, 2, 3, 4]);
      expect(unifyVersionPersonIds([10], [10, 11])).toEqual([10, 11]);
    });
  });

  describe('classifyActiveCvBucket', () => {
    it('NO_ACTIVE_CV sin registros', () => {
      expect(classifyActiveCvBucket([]).bucket).toBe('NO_ACTIVE_CV');
    });

    it('INVALID_ACTIVE_CV con duplicados activos', () => {
      const r = classifyActiveCvBucket([
        {
          personCvId: 1,
          driveFileName: 'a.pdf',
          hasDriveFileId: true,
          mimeType: 'application/pdf',
        },
        {
          personCvId: 2,
          driveFileName: 'b.pdf',
          hasDriveFileId: true,
          mimeType: 'application/pdf',
        },
      ]);
      expect(r.bucket).toBe('INVALID_ACTIVE_CV');
      expect(r.reason).toMatch(/duplicate/);
    });

    it('INVALID_ACTIVE_CV sin drive_file_id o MIME incorrecto', () => {
      expect(
        classifyActiveCvBucket([
          {
            personCvId: 1,
            driveFileName: 'a.pdf',
            hasDriveFileId: false,
            mimeType: 'application/pdf',
          },
        ]).bucket,
      ).toBe('INVALID_ACTIVE_CV');
      expect(
        classifyActiveCvBucket([
          {
            personCvId: 1,
            driveFileName: 'a.pdf',
            hasDriveFileId: true,
            mimeType: 'image/png',
          },
        ]).bucket,
      ).toBe('INVALID_ACTIVE_CV');
    });

    it('HAS_ACTIVE_CV procesable', () => {
      const r = classifyActiveCvBucket([
        {
          personCvId: 57,
          driveFileName: '1000019945.pdf',
          hasDriveFileId: true,
          mimeType: 'application/pdf',
        },
      ]);
      expect(r.bucket).toBe('HAS_ACTIVE_CV');
      expect(r.processableCv?.personCvId).toBe(57);
    });
  });

  describe('classifyProcessStatus', () => {
    const baseExtraction = {
      personCvId: 57,
      model: 'gemini-3.6-flash',
      promptVersion: CV_SKILLS_PROMPT_VERSION,
      extractorVersion: CV_SKILLS_EXTRACTOR_VERSION,
    };

    it('ALREADY_PROCESSED con SUCCEEDED activa', () => {
      expect(
        classifyProcessStatus({
          bucket: 'HAS_ACTIVE_CV',
          personCvId: 57,
          extractions: [
            { ...baseExtraction, status: 'SUCCEEDED', isActive: true },
          ],
        }),
      ).toBe('ALREADY_PROCESSED');
    });

    it('PENDING_PROCESSING sin extracción compatible', () => {
      expect(
        classifyProcessStatus({
          bucket: 'HAS_ACTIVE_CV',
          personCvId: 57,
          extractions: [],
        }),
      ).toBe('PENDING_PROCESSING');
    });

    it('FAILED_PREVIOUSLY sin SUCCEEDED activa', () => {
      expect(
        classifyProcessStatus({
          bucket: 'HAS_ACTIVE_CV',
          personCvId: 57,
          extractions: [
            { ...baseExtraction, status: 'FAILED', isActive: false },
          ],
        }),
      ).toBe('FAILED_PREVIOUSLY');
    });

    it('NO_CV e INVALID_CV', () => {
      expect(
        classifyProcessStatus({ bucket: 'NO_ACTIVE_CV', extractions: [] }),
      ).toBe('NO_CV');
      expect(
        classifyProcessStatus({ bucket: 'INVALID_ACTIVE_CV', extractions: [] }),
      ).toBe('INVALID_CV');
    });
  });

  describe('isVacancyCandidate', () => {
    it('detecta vacantes por rol, documento y nombre', () => {
      expect(
        isVacancyCandidate({
          document: 'VAC-1',
          fullName: 'X',
          roleName: 'Analista',
        }),
      ).toBe(true);
      expect(
        isVacancyCandidate({
          document: '1000019945',
          fullName: 'INGRID',
          roleName: 'Analista',
        }),
      ).toBe(false);
    });
  });

  describe('parseVersionScriptArgs', () => {
    it('exige dry-run o persist', () => {
      expect(() => parseVersionScriptArgs(['--versionId=4'])).toThrow(
        /Debes indicar --dry-run o --persist/,
      );
    });

    it('rechaza ambos modos', () => {
      expect(() =>
        parseVersionScriptArgs(['--versionId=4', '--dry-run', '--persist']),
      ).toThrow(/No combines/);
    });

    it('acepta dry-run', () => {
      expect(parseVersionScriptArgs(['--versionId=4', '--dry-run'])).toMatchObject({
        versionId: 4,
        dryRun: true,
        persist: false,
        delayMs: 1000,
        retryFailed: true,
      });
    });

    it('acepta persist solo para versionId=4', () => {
      expect(
        parseVersionScriptArgs(['--versionId=4', '--persist', '--limit=3']),
      ).toMatchObject({
        versionId: 4,
        persist: true,
        dryRun: false,
        limit: 3,
      });
      expect(() =>
        parseVersionScriptArgs(['--versionId=3', '--persist']),
      ).toThrow(/only for versionId=4/);
    });
  });

  describe('selectPersistTargets / maskDocument', () => {
    it('ordena por personId y aplica limit; excluye no pendientes', () => {
      const pending: DryRunPersonRef[] = [
        {
          personId: 20,
          document: '20',
          fullName: 'B',
          classification: 'PENDING_PROCESSING',
        },
        {
          personId: 10,
          document: '10',
          fullName: 'A',
          classification: 'PENDING_PROCESSING',
        },
      ];
      const failed: DryRunPersonRef[] = [
        {
          personId: 15,
          document: '15',
          fullName: 'F',
          classification: 'FAILED_PREVIOUSLY',
        },
      ];
      expect(
        selectPersistTargets({
          pending,
          failedPreviously: failed,
          retryFailed: true,
          limit: 2,
        }).map((p) => p.personId),
      ).toEqual([10, 15]);
      expect(
        selectPersistTargets({
          pending,
          failedPreviously: failed,
          retryFailed: false,
          limit: null,
        }).map((p) => p.personId),
      ).toEqual([10, 20]);
    });

    it('enmascara documento', () => {
      expect(maskDocument('1000019945')).toBe('******9945');
    });
  });

  describe('assertDryRunListIntegrity', () => {
    it('valida totales y unicidad', () => {
      expect(() =>
        assertDryRunListIntegrity({
          alreadyProcessed: [
            {
              personId: 1145,
              document: '1000019945',
              fullName: 'INGRID',
              classification: 'ALREADY_PROCESSED',
            },
          ],
          failedPreviously: [],
          pending: [
            {
              personId: 2,
              document: '2',
              fullName: 'B',
              classification: 'PENDING_PROCESSING',
            },
          ],
          withoutCv: [
            {
              personId: 3,
              document: '3',
              fullName: 'C',
              classification: 'NO_CV',
            },
          ],
          invalidCv: [],
          processableCvCount: 2,
          realActivePeopleCount: 3,
        }),
      ).not.toThrow();
    });
  });
});
