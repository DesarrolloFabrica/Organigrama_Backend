import {
  actionForFabricaPipelineState,
  classifyFabricaCohortByRole,
  classifyFabricaContentClass,
  classifyFabricaPipelineState,
  isFabricaCohortIncluded,
  matchFabricaParentCandidates,
  normalizeFabricaText,
} from './mc-fabrica-contenidos-cohort';

describe('mc-fabrica-contenidos-cohort', () => {
  it('resuelve padre por nombre normalizado único', () => {
    const people = [
      {
        fullName:
          'VACANTE — COORDINADOR FABRICA DE CONTENIDOS - DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS',
      },
      {
        fullName: 'VACANTE - COORDINADOR FABRICA DE CONTENIDOS - GIF',
      },
      {
        fullName: 'DEYVIS JAIR MIRANDA ACERO',
      },
    ];
    const hits = matchFabricaParentCandidates(people);
    expect(hits).toHaveLength(1);
    expect(normalizeFabricaText(hits[0].fullName)).toContain('presentadoras');
  });

  it('detecta ambigüedad si hay dos vacantes iguales', () => {
    const people = [
      {
        fullName:
          'VACANTE — COORDINADOR FABRICA DE CONTENIDOS - DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS',
      },
      {
        fullName:
          'VACANTE COORDINADOR FABRICA DE CONTENIDOS DISENADORES DE CONTENIDO (ANALISTAS) Y PRESENTADORAS',
      },
    ];
    expect(matchFabricaParentCandidates(people).length).toBeGreaterThan(1);
  });

  it('incluye analistas de diseño y UX/UI', () => {
    expect(
      classifyFabricaCohortByRole('ANALISTA DE DISEÑO DE CONTENIDOS')
        .classification,
    ).toBe('INCLUDE_DESIGN');
    expect(classifyFabricaCohortByRole('DISEÑADOR UX/UI').classification).toBe(
      'INCLUDE_DESIGN',
    );
    expect(
      classifyFabricaCohortByRole('DISEÑADORA GRÁFICA').classification,
    ).toBe('INCLUDE_DESIGN');
  });

  it('incluye audiovisuales', () => {
    expect(
      classifyFabricaCohortByRole('REALIZADOR AUDIOVISUAL').classification,
    ).toBe('INCLUDE_AUDIOVISUAL');
    expect(
      classifyFabricaCohortByRole('EDITOR DE VIDEO').classification,
    ).toBe('INCLUDE_AUDIOVISUAL');
  });

  it('excluye presentadoras y administrativos', () => {
    expect(
      classifyFabricaCohortByRole('PRESENTADOR DE CONTENIDO').classification,
    ).toBe('EXCLUDE_PRESENTER');
    expect(
      classifyFabricaCohortByRole('PRESENTADORA DE CONTENIDO').classification,
    ).toBe('EXCLUDE_PRESENTER');
    expect(
      classifyFabricaCohortByRole(
        'AUXILIAR ADMINISTRATIVO DE OPERACIONES',
      ).classification,
    ).toBe('EXCLUDE_ADMINISTRATIVE');
  });

  it('no clasifica resultado profesional por cargo (solo cohorte)', () => {
    const c = classifyFabricaCohortByRole('ANALISTA DE DISEÑO DE CONTENIDOS');
    expect(isFabricaCohortIncluded(c.classification)).toBe(true);
    expect(c.classification).not.toMatch(/PRIMARY|SECONDARY|OUTSIDE/);
  });

  it('pipeline HEALTHY vs STALE vs NO_CV', () => {
    expect(
      classifyFabricaPipelineState({
        hasActivePersonCv: true,
        activeCvDriveFileId: 'file-a',
        activeExtraction: {
          id: '1',
          status: 'SUCCEEDED',
          isActive: true,
          driveFileId: 'file-a',
        },
        hasRunningOrPending: false,
      }),
    ).toBe('HEALTHY_CURRENT');

    expect(
      classifyFabricaPipelineState({
        hasActivePersonCv: true,
        activeCvDriveFileId: 'file-new',
        activeExtraction: {
          id: '1',
          status: 'SUCCEEDED',
          isActive: true,
          driveFileId: 'file-old',
        },
        hasRunningOrPending: false,
      }),
    ).toBe('STALE_SELECTED_EXTRACTION');

    expect(
      classifyFabricaPipelineState({
        hasActivePersonCv: false,
        activeCvDriveFileId: null,
        activeExtraction: null,
        hasRunningOrPending: false,
      }),
    ).toBe('NO_PERSON_CV');
  });

  it('content class y acciones', () => {
    expect(
      classifyFabricaContentClass({
        cvDriveFileId: 'a',
        extractionDriveFileId: 'b',
        cvSha256: 'aa'.repeat(32),
        extractionSha256: 'bb'.repeat(32),
      }),
    ).toBe('DIFFERENT_CONTENT');

    expect(
      actionForFabricaPipelineState(
        'STALE_SELECTED_EXTRACTION',
        'SAME_CONTENT_DIFFERENT_FILE_ID',
      ),
    ).toBe('REPOINT_OR_METADATA_REPAIR');

    expect(actionForFabricaPipelineState('HEALTHY_CURRENT')).toBe(
      'EVALUATE_MISSING_DOMAINS',
    );
  });
});
