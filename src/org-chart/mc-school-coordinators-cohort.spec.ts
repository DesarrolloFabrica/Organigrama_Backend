import {
  actionForSchoolC1,
  classifyCapabilityEvidenceLevel,
  classifyClusterSignal,
  classifySchoolContentClass,
  classifySchoolPipelineState,
  diagnoseNewDomainOverall,
  isPublishableCapability,
  matchCapabilityFamilies,
  matrixStrengthFromLevels,
  normalizeSchoolText,
  personNameMatchesExpected,
  resolveSchoolCoordinatorIdentity,
  roleMatchesExpected,
  schoolDoesNotImplyDomain,
  SCHOOL_COORDINATORS_EXPECTED,
} from './mc-school-coordinators-cohort';

describe('mc-school-coordinators-cohort', () => {
  it('resuelve las cinco identidades esperadas por nombre+rol', () => {
    const people = [
      {
        personId: '601',
        document: '1117526801',
        fullName: 'VIVIANA ANDREA CABRERA CABRERA',
        roleName: 'COORDINADOR ESCUELA DE INGENIERIA',
        email: 'a@x',
        isActive: true,
      },
      {
        personId: '1078',
        document: '1023935373',
        fullName: 'MAIRA ALEJANDRA DONCEL LARGO',
        roleName: 'COORDINADOR ESCUELA DE TRANSVERSALES',
        email: 'b@x',
        isActive: true,
      },
      {
        personId: '1079',
        document: '1020720408',
        fullName: 'ANDRES FELIPE PRIETO LIZARAZO',
        roleName: 'COORDINADOR ESCUELA DE NEGOCIOS',
        email: 'c@x',
        isActive: true,
      },
      {
        personId: '1080',
        document: '1010174410',
        fullName: 'CARLOS ANDRES RODRIGUEZ',
        roleName: 'COORDINADOR ESCUELA DE BELLAS ARTES',
        email: 'd@x',
        isActive: true,
      },
      {
        personId: '1297',
        document: '1042448655',
        fullName: 'AURA MARCELA ROYERO VERGARA',
        roleName: 'COORDINADOR ESCUELA DE TRANSFORMACION EMPRESARIAL',
        email: 'e@x',
        isActive: true,
      },
    ];

    for (const expected of SCHOOL_COORDINATORS_EXPECTED) {
      const r = resolveSchoolCoordinatorIdentity(expected, people);
      expect(r.status).toBe('RESOLVED');
      expect(r.selected?.document).toBeTruthy();
    }
  });

  it('marca ambigüedad si hay dos homónimos', () => {
    const expected = SCHOOL_COORDINATORS_EXPECTED.find((e) => e.key === 'carlos')!;
    const people = [
      {
        personId: '1',
        document: '1',
        fullName: 'CARLOS ANDRES RODRIGUEZ',
        roleName: 'COORDINADOR ESCUELA DE BELLAS ARTES',
        email: null,
        isActive: true,
      },
      {
        personId: '2',
        document: '2',
        fullName: 'CARLOS ANDRES RODRIGUEZ GOMEZ',
        roleName: 'COORDINADOR ESCUELA DE BELLAS ARTES',
        email: null,
        isActive: true,
      },
    ];
    expect(resolveSchoolCoordinatorIdentity(expected, people).status).toBe(
      'IDENTITY_MANUAL_REVIEW',
    );
  });

  it('no clasifica competencias por cargo (solo identidad)', () => {
    expect(
      roleMatchesExpected(
        'COORDINADOR ESCUELA DE INGENIERIA',
        'coordinador escuela de ingenieria',
      ),
    ).toBe(true);
    // El rol no implica dominio SOFTWARE
    expect(
      schoolDoesNotImplyDomain('Escuela de Ingeniería', 'ENGINEERING_MANAGEMENT'),
    ).toBe(true);
    expect(
      schoolDoesNotImplyDomain('Escuela de Negocios', 'BUSINESS_MANAGEMENT'),
    ).toBe(true);
  });

  it('pipeline HEALTHY / STALE / NO_CV', () => {
    expect(
      classifySchoolPipelineState({
        hasActivePersonCv: true,
        activeCvDriveFileId: 'a',
        activeExtraction: {
          status: 'SUCCEEDED',
          isActive: true,
          driveFileId: 'a',
        },
        hasRunningOrPending: false,
      }),
    ).toBe('HEALTHY_CURRENT');

    expect(
      classifySchoolPipelineState({
        hasActivePersonCv: true,
        activeCvDriveFileId: 'a',
        activeExtraction: {
          status: 'SUCCEEDED',
          isActive: true,
          driveFileId: 'b',
        },
        hasRunningOrPending: false,
      }),
    ).toBe('STALE_SELECTED_EXTRACTION');

    expect(
      classifySchoolPipelineState({
        hasActivePersonCv: false,
        activeCvDriveFileId: null,
        activeExtraction: null,
        hasRunningOrPending: false,
      }),
    ).toBe('NO_PERSON_CV');
  });

  it('acciones C1 según estado', () => {
    expect(
      actionForSchoolC1({
        identityStatus: 'RESOLVED',
        pipelineState: 'HEALTHY_CURRENT',
        inActiveVersion: true,
      }),
    ).toBe('EVALUATE_CURRENT_EXTRACTION');
    expect(
      actionForSchoolC1({
        identityStatus: 'RESOLVED',
        pipelineState: 'STALE_SELECTED_EXTRACTION',
        contentClass: 'DIFFERENT_CONTENT',
        inActiveVersion: true,
      }),
    ).toBe('REEXTRACT');
    expect(
      actionForSchoolC1({
        identityStatus: 'RESOLVED',
        pipelineState: 'NO_USABLE_EXTRACTION',
        inActiveVersion: true,
      }),
    ).toBe('FIRST_EXTRACTION');
    expect(
      actionForSchoolC1({
        identityStatus: 'RESOLVED',
        pipelineState: 'NO_PERSON_CV',
        inActiveVersion: true,
      }),
    ).toBe('BLOCKED_NO_CV');
  });

  it('content class SAME vs DIFFERENT', () => {
    expect(
      classifySchoolContentClass({
        cvDriveFileId: 'a',
        extractionDriveFileId: 'b',
        cvSha256: 'abc',
        extractionSha256: 'abc',
      }),
    ).toBe('SAME_CONTENT_DIFFERENT_FILE_ID');
    expect(
      classifySchoolContentClass({
        cvDriveFileId: 'a',
        extractionDriveFileId: 'b',
        cvSha256: 'abc',
        extractionSha256: 'def',
      }),
    ).toBe('DIFFERENT_CONTENT');
  });

  it('no publica INFERRED_FROM_ROLE ni TOOL_ONLY como consolidada', () => {
    expect(
      isPublishableCapability(
        classifyCapabilityEvidenceLevel(
          { text: 'liderazgo' },
          { inferredFromRole: true },
        ),
      ),
    ).toBe(false);
    expect(
      classifyCapabilityEvidenceLevel({
        text: 'Photoshop',
        skillType: 'TOOL',
      }),
    ).toBe('TOOL_OR_TERM_ONLY');
    expect(
      classifyCapabilityEvidenceLevel({
        text: 'gestion academica',
        evidenceLevel: 'STRONG',
        hasWorkExperience: true,
        sourceType: 'WORK_EXPERIENCE',
      }),
    ).toBe('STRONG_PROFESSIONAL_EVIDENCE');
  });

  it('detecta familias de capacidad sin forzar por escuela', () => {
    expect(matchCapabilityFamilies('Gestión académica y currículo')).toContain(
      'GESTION_ACADEMICA',
    );
    expect(personNameMatchesExpected('VIVIANA ANDREA CABRERA CABRERA', 'Viviana Andrea Cabrera Cabrera')).toBe(
      true,
    );
    expect(normalizeSchoolText('ANDRÉS')).toBe('andres');
  });

  it('diagnóstico de dominio nuevo', () => {
    expect(
      diagnoseNewDomainOverall({
        clusters: [],
        profilesWithoutRepresentableDomain: 5,
      }),
    ).toBe('NO_NEW_DOMAIN_SIGNAL');
    expect(
      diagnoseNewDomainOverall({
        clusters: [
          {
            signalClass: 'DOMAIN_CANDIDATE',
            personCount: 4,
          },
        ],
        profilesWithoutRepresentableDomain: 4,
      }),
    ).toBe('STRONG_DOMAIN_CANDIDATE');
    expect(
      classifyClusterSignal({
        personCount: 2,
        strongHits: 3,
        coveredByOperativeDomain: false,
      }),
    ).toBe('REPEATED_CROSS_PROFILE_SIGNAL');
    expect(matrixStrengthFromLevels(['STRONG_PROFESSIONAL_EVIDENCE'])).toBe(
      'STRONG',
    );
  });
});
