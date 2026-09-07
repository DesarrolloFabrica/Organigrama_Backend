import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type { P3ContractEnvelope } from '../p3/p3.types';
import type { P4ContractEnvelope } from '../p4/p4.types';
import type { R1ContractEnvelope } from '../r1/r1.types';
import { assembleProfilePilot } from './profile-assembler';
import {
  listObservedP3Specialties,
  listObservedP4Skills,
} from './profile-pack-loader';
import {
  applyWeakEvidenceRadarSemantics,
  collectWeakRadarSignals,
  WEAK_EVIDENCE_FLOOR,
  dimensionsForWeakSpecialty,
} from './profile-radar-weak-semantics';
import { mapProfilePackToPresentation } from '../person-profile/mc1-person-profile.reader';
import type { RadarAxisResult } from './profile-radar';
import type { ProfilePilotEnvelope } from './profile.types';
import { reassembleMc1Presentation } from './profile-presentation-reassembly';

const BACKEND_ROOT = resolve(__dirname, '../../..');

function axis(
  partial: Partial<RadarAxisResult> & Pick<RadarAxisResult, 'dimensionCode'>,
): RadarAxisResult {
  return {
    label: partial.dimensionCode,
    rawScore: 0,
    relativeCoverage: 0,
    contributingSkillCodes: [],
    supportingEvidenceUnitIds: [],
    ...partial,
  };
}

function p3Envelope(
  snapshotId: string,
  specialties: Array<{
    fieldCode?: string;
    specialtyCode: string;
    status: 'OBSERVED' | 'WEAK' | 'REJECTED';
    eus?: string[];
  }>,
): P3ContractEnvelope {
  const byField = new Map<string, typeof specialties>();
  for (const s of specialties) {
    const f = s.fieldCode ?? 'DATA_ANALYTICS';
    if (!byField.has(f)) byField.set(f, []);
    byField.get(f)!.push(s);
  }
  return {
    payload: {
      snapshotId,
      fieldResults: [...byField.entries()].map(([fieldCode, specs]) => ({
        fieldCode,
        observedSpecialties: specs.map((s) => ({
          specialtyCode: s.specialtyCode,
          parentFieldCode: fieldCode,
          status: s.status,
          confidence: 0.7,
          supportingEvidenceUnitIds: s.eus ?? ['eu-1'],
          rationaleCode: 'THIN_BUT_TRACABLE',
        })),
      })),
    },
  } as P3ContractEnvelope;
}

function p4Envelope(
  snapshotId: string,
  skills: Array<{
    fieldCode?: string;
    specialtyCode: string;
    skillCode: string;
    name?: string;
    status: 'OBSERVED' | 'WEAK';
    eus?: string[];
    signals?: string[];
  }>,
): P4ContractEnvelope {
  const bySpec = new Map<string, typeof skills>();
  for (const sk of skills) {
    const key = `${sk.fieldCode ?? 'DATA_ANALYTICS'}::${sk.specialtyCode}`;
    if (!bySpec.has(key)) bySpec.set(key, []);
    bySpec.get(key)!.push(sk);
  }
  return {
    payload: {
      snapshotId,
      specialtyResults: [...bySpec.entries()].map(([key, list]) => {
        const [fieldCode, specialtyCode] = key.split('::');
        return {
          fieldCode,
          specialtyCode,
          observedSkills: list.map((sk) => ({
            skillCode: sk.skillCode,
            name: sk.name ?? sk.skillCode,
            parentFieldCode: fieldCode,
            parentSpecialtyCode: specialtyCode,
            status: sk.status,
            confidence: 0.8,
            supportingEvidenceUnitIds: sk.eus ?? ['eu-s'],
            supportingSignals: sk.signals ?? [],
            toolOrTechnologySignals: [],
            rationaleCode: 'THIN_BUT_TRACABLE',
          })),
        };
      }),
    },
  } as P4ContractEnvelope;
}

function r1Envelope(snapshotId: string, primary: string): R1ContractEnvelope {
  return {
    payload: {
      snapshotId,
      fieldResolutionStatus: 'RESOLVED',
      primaryField: {
        fieldCode: primary,
        sourceKey: primary,
        catalogStatus: 'KNOWN',
        rank: 1,
        confidence: 0.9,
        candidateId: 'dc-1',
      },
      secondaryFields: [],
    },
  } as R1ContractEnvelope;
}

function writeMiniPacks(args: {
  snapshotId: string;
  r1: R1ContractEnvelope;
  p3: P3ContractEnvelope;
  p4: P4ContractEnvelope;
}): {
  backendRoot: string;
  r1PackDir: string;
  p3PackDir: string;
  p4PackDir: string;
} {
  const backendRoot = join(
    tmpdir(),
    `mc1-weak-radar-${args.snapshotId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  const r1PackDir = join(
    backendRoot,
    'tmp',
    'mc1-r1-functional',
    `R1F-8A2-S${args.snapshotId}-test`,
  );
  const p3PackDir = join(
    backendRoot,
    'tmp',
    'mc1-p3-functional',
    `P3F-8B2-S${args.snapshotId}-test`,
  );
  const p4PackDir = join(
    backendRoot,
    'tmp',
    'mc1-p4-functional',
    `P4F-8D-S${args.snapshotId}-test`,
  );
  mkdirSync(r1PackDir, { recursive: true });
  mkdirSync(p3PackDir, { recursive: true });
  mkdirSync(p4PackDir, { recursive: true });
  writeFileSync(join(r1PackDir, 'r1-contract.json'), JSON.stringify(args.r1));
  writeFileSync(join(p3PackDir, 'p3-contract.json'), JSON.stringify(args.p3));
  writeFileSync(join(p4PackDir, 'p4-contract.json'), JSON.stringify(args.p4));
  return { backendRoot, r1PackDir, p3PackDir, p4PackDir };
}

describe('WEAK evidence radar semantics', () => {
  it('maps DATA_GOVERNANCE specialty to DA_GOVERNANCE_QUALITY', () => {
    expect(dimensionsForWeakSpecialty('DATA_GOVERNANCE')).toEqual([
      'DA_GOVERNANCE_QUALITY',
    ]);
  });

  it('NONE / NOT_EMITTED → 0', () => {
    const { axes } = applyWeakEvidenceRadarSemantics({
      axes: [
        axis({ dimensionCode: 'DA_GOVERNANCE_QUALITY', relativeCoverage: 0 }),
      ],
      weakSignals: [],
    });
    expect(axes[0].relativeCoverage).toBe(0);
    expect(axes[0].evidenceState).toBe('NO_EVIDENCE');
  });

  it('P3 WEAK → floor >= 20', () => {
    const p3 = p3Envelope('x', [
      { specialtyCode: 'DATA_GOVERNANCE', status: 'WEAK', eus: ['a'] },
    ]);
    const p4 = p4Envelope('x', []);
    const signals = collectWeakRadarSignals({
      fieldCode: 'DATA_ANALYTICS',
      p3,
      p4,
      observedRadarSkillCodes: new Set(),
    });
    expect(
      signals.some((s) => s.dimensionCode === 'DA_GOVERNANCE_QUALITY'),
    ).toBe(true);
    const { axes } = applyWeakEvidenceRadarSemantics({
      axes: [axis({ dimensionCode: 'DA_GOVERNANCE_QUALITY' })],
      weakSignals: signals,
    });
    expect(axes[0].relativeCoverage).toBe(WEAK_EVIDENCE_FLOOR);
    expect(axes[0].evidenceState).toBe('WEAK_EVIDENCE');
  });

  it('overlay twice keeps WEAK_EVIDENCE at 20 (idempotent)', () => {
    const first = applyWeakEvidenceRadarSemantics({
      axes: [axis({ dimensionCode: 'DA_GOVERNANCE_QUALITY' })],
      weakSignals: [
        {
          dimensionCode: 'DA_GOVERNANCE_QUALITY',
          uniqueEvidenceUnitIds: ['a'],
        },
      ],
    });
    const second = applyWeakEvidenceRadarSemantics({
      axes: first.axes,
      weakSignals: [
        {
          dimensionCode: 'DA_GOVERNANCE_QUALITY',
          uniqueEvidenceUnitIds: ['a'],
        },
      ],
    });
    expect(second.axes[0].relativeCoverage).toBe(20);
    expect(second.axes[0].evidenceState).toBe('WEAK_EVIDENCE');
  });

  it('P3 OBSERVED + P4 WEAK → weak presentation band', () => {
    const p3 = p3Envelope('x', [
      { specialtyCode: 'DATA_GOVERNANCE', status: 'OBSERVED', eus: ['g1'] },
    ]);
    const p4 = p4Envelope('x', [
      {
        specialtyCode: 'DATA_GOVERNANCE',
        skillCode: 'information_traceability_management',
        name: 'Gestión de trazabilidad',
        status: 'WEAK',
        eus: ['g1'],
        signals: ['crear repositorio único para elevar la trazabilidad'],
      },
    ]);
    const signals = collectWeakRadarSignals({
      fieldCode: 'DATA_ANALYTICS',
      p3,
      p4,
      observedRadarSkillCodes: new Set(),
    });
    const { axes } = applyWeakEvidenceRadarSemantics({
      axes: [axis({ dimensionCode: 'DA_GOVERNANCE_QUALITY' })],
      weakSignals: signals,
    });
    expect(axes[0].evidenceState).toBe('WEAK_EVIDENCE');
    expect(axes[0].relativeCoverage).toBe(WEAK_EVIDENCE_FLOOR);
  });

  it('OBSERVED coverage is unchanged by the overlay', () => {
    const { axes } = applyWeakEvidenceRadarSemantics({
      axes: [
        axis({
          dimensionCode: 'DA_GOVERNANCE_QUALITY',
          relativeCoverage: 48.6,
          rawScore: 5,
        }),
      ],
      weakSignals: [
        {
          dimensionCode: 'DA_GOVERNANCE_QUALITY',
          uniqueEvidenceUnitIds: ['z'],
        },
      ],
    });
    expect(axes[0].relativeCoverage).toBe(48.6);
    expect(axes[0].evidenceState).toBe('OBSERVED');
  });

  it('REJECTED / tool-only does not create a weak floor', () => {
    const p3 = p3Envelope('x', [
      { specialtyCode: 'DATA_GOVERNANCE', status: 'REJECTED', eus: ['t'] },
    ]);
    const signals = collectWeakRadarSignals({
      fieldCode: 'DATA_ANALYTICS',
      p3,
      p4: p4Envelope('x', []),
      observedRadarSkillCodes: new Set(),
    });
    expect(
      signals.some((s) => s.dimensionCode === 'DA_GOVERNANCE_QUALITY'),
    ).toBe(false);
  });

  it('does not invent WEAK from sibling practice (ETL is not governance)', () => {
    const p3 = p3Envelope('x', [
      { specialtyCode: 'DATA_ENGINEERING', status: 'OBSERVED', eus: ['e'] },
      {
        specialtyCode: 'BUSINESS_INTELLIGENCE',
        status: 'OBSERVED',
        eus: ['b'],
      },
    ]);
    const p4 = p4Envelope('x', [
      {
        specialtyCode: 'DATA_ENGINEERING',
        skillCode: 'etl_and_pipeline_engineering',
        name: 'ETL and pipeline engineering',
        status: 'OBSERVED',
        eus: ['e1', 'e2'],
        signals: ['etl', 'sql', 'pipeline'],
      },
    ]);
    const signals = collectWeakRadarSignals({
      fieldCode: 'DATA_ANALYTICS',
      p3,
      p4,
      observedRadarSkillCodes: new Set(['etl_and_pipeline_engineering']),
    });
    expect(
      signals.some((s) => s.dimensionCode === 'DA_GOVERNANCE_QUALITY'),
    ).toBe(false);
  });

  it('warns when OBSERVED relativeCoverage sits below the WEAK floor', () => {
    const { warnings } = applyWeakEvidenceRadarSemantics({
      axes: [axis({ dimensionCode: 'SE_FRONTEND', relativeCoverage: 19.5 })],
      weakSignals: [],
      fieldCode: 'SOFTWARE_ENGINEERING',
    });
    expect(warnings.some((w) => w.code === 'OBSERVED_BELOW_WEAK_FLOOR')).toBe(
      true,
    );
  });
});

describe('WEAK radar matrix via Profile Assembly (12I unchanged)', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) {
      rmSync(d, { recursive: true, force: true });
    }
  });

  function assembleCase(args: {
    snapshotId: string;
    p3: P3ContractEnvelope;
    p4: P4ContractEnvelope;
    primary?: string;
  }) {
    const packs = writeMiniPacks({
      snapshotId: args.snapshotId,
      r1: r1Envelope(args.snapshotId, args.primary ?? 'DATA_ANALYTICS'),
      p3: args.p3,
      p4: args.p4,
    });
    dirs.push(packs.backendRoot);
    return assembleProfilePilot({
      backendRoot: packs.backendRoot,
      snapshotId: args.snapshotId,
      r1PackDir: packs.r1PackDir,
      p3PackDir: packs.p3PackDir,
      p4PackDir: packs.p4PackDir,
    });
  }

  it('NOT_EMITTED governance → radar 0 and no public governance skill', () => {
    const env = assembleCase({
      snapshotId: '901',
      p3: p3Envelope('901', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
        },
      ]),
      p4: p4Envelope('901', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          skillCode: 'etl_and_data_pipeline_management',
          name: 'ETL and data pipeline management',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
          signals: ['etl', 'pipeline', 'transformación'],
        },
      ]),
    });
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBe(0);
    expect(gov.evidenceState).toBe('NO_EVIDENCE');
    expect(da.specialties.map((s) => s.specialtyCode)).not.toContain(
      'DATA_GOVERNANCE',
    );
    expect(da.skills.map((s) => s.skillCode)).not.toContain(
      'data_governance_and_quality_assurance',
    );
  });

  it('P3 WEAK + P4 WEAK → radar floor, skill not public, specialty not OBSERVED', () => {
    const env = assembleCase({
      snapshotId: '902',
      p3: p3Envelope('902', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
        },
        { specialtyCode: 'DATA_GOVERNANCE', status: 'WEAK', eus: ['g1'] },
      ]),
      p4: p4Envelope('902', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          skillCode: 'etl_and_data_pipeline_management',
          name: 'ETL and data pipeline management',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
          signals: ['etl', 'pipeline'],
        },
        {
          specialtyCode: 'DATA_GOVERNANCE',
          skillCode: 'data_governance_and_quality_assurance',
          name: 'Data Governance and Quality Assurance',
          status: 'WEAK',
          eus: ['g1'],
          signals: ['garantizando la gobernanza, integridad y calidad'],
        },
      ]),
    });
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBe(WEAK_EVIDENCE_FLOOR);
    expect(gov.displayCoverage).toBe(WEAK_EVIDENCE_FLOOR);
    expect(gov.evidenceState).toBe('WEAK_EVIDENCE');
    expect(env.payload.presentationNotes).toMatchObject({
      radarCalibrationPolicy: 'MC1.PROFILE.RADAR_CALIBRATION',
      radarCalibrationVersion: '1.1.0',
    });
    expect(da.specialties.map((s) => s.specialtyCode)).toEqual([
      'DATA_ENGINEERING',
    ]);
    expect(da.skills.map((s) => s.skillCode)).not.toContain(
      'data_governance_and_quality_assurance',
    );
    const presentation = mapProfilePackToPresentation({
      packDir: 'n/a',
      envelope: env,
      producedAtMs: 0,
    });
    const pubSkills = presentation.fields[0].specialties.flatMap(
      (s) => s.skills,
    );
    expect(pubSkills.map((s) => s.code)).not.toContain(
      'data_governance_and_quality_assurance',
    );
    expect(
      presentation.fields[0].competencyMap.dimensions.find(
        (d) => d.code === 'DA_GOVERNANCE_QUALITY',
      ),
    ).toMatchObject({
      relativeCoverage: 20,
      displayCoverage: 20,
      evidenceState: 'WEAK_EVIDENCE',
    });
    expect(presentation.calibration?.version).toBe('1.1.0');
  });

  it('P3 OBSERVED + P4 WEAK (Diego-like) → weak radar, skill unpublished, specialty listed', () => {
    const env = assembleCase({
      snapshotId: '903',
      p3: p3Envelope('903', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
        },
        { specialtyCode: 'DATA_GOVERNANCE', status: 'OBSERVED', eus: ['g1'] },
      ]),
      p4: p4Envelope('903', [
        {
          specialtyCode: 'DATA_ENGINEERING',
          skillCode: 'etl_and_data_pipeline_management',
          name: 'ETL and data pipeline management',
          status: 'OBSERVED',
          eus: ['e1', 'e2'],
          signals: ['etl', 'pipeline'],
        },
        {
          specialtyCode: 'DATA_GOVERNANCE',
          skillCode: 'information_traceability_management',
          name: 'Gestión de trazabilidad',
          status: 'WEAK',
          eus: ['g1'],
          signals: ['elevar la trazabilidad de la información'],
        },
      ]),
    });
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBeGreaterThanOrEqual(WEAK_EVIDENCE_FLOOR);
    expect(gov.evidenceState).toBe('WEAK_EVIDENCE');
    expect(da.specialties.map((s) => s.specialtyCode)).toContain(
      'DATA_GOVERNANCE',
    );
    expect(da.skills.map((s) => s.parentSpecialtyCode)).not.toContain(
      'DATA_GOVERNANCE',
    );
  });

  it('P3 OBSERVED + P4 OBSERVED keeps formula coverage and public skill', () => {
    const env = assembleCase({
      snapshotId: '904',
      p3: p3Envelope('904', [
        {
          specialtyCode: 'DATA_GOVERNANCE',
          status: 'OBSERVED',
          eus: ['g1', 'g2'],
        },
      ]),
      p4: p4Envelope('904', [
        {
          specialtyCode: 'DATA_GOVERNANCE',
          skillCode: 'data_governance_and_quality_assurance',
          name: 'Data Governance and Quality Assurance',
          status: 'OBSERVED',
          eus: ['g1', 'g2'],
          signals: [
            'gobernanza',
            'integridad',
            'calidad de datos',
            'trazabilidad',
          ],
        },
      ]),
    });
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBeGreaterThan(WEAK_EVIDENCE_FLOOR);
    expect(gov.evidenceState).toBe('OBSERVED');
    expect(da.skills.map((s) => s.skillCode)).toContain(
      'data_governance_and_quality_assurance',
    );
  });

  it('P3 WEAK DevOps does not publish specialty or skill but floors SE_CLOUD_INFRA', () => {
    const env = assembleCase({
      snapshotId: '905',
      primary: 'SOFTWARE_ENGINEERING',
      p3: p3Envelope('905', [
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'FRONTEND_ENGINEERING',
          status: 'OBSERVED',
          eus: ['f1', 'f2'],
        },
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'PLATFORM_DEVOPS_ENGINEERING',
          status: 'WEAK',
          eus: ['d1', 'd2', 'd3'],
        },
      ]),
      p4: p4Envelope('905', [
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'FRONTEND_ENGINEERING',
          skillCode: 'frontend_web_development',
          name: 'Frontend web development',
          status: 'OBSERVED',
          eus: ['f1', 'f2'],
          signals: ['react', 'interfaz'],
        },
        {
          fieldCode: 'SOFTWARE_ENGINEERING',
          specialtyCode: 'PLATFORM_DEVOPS_ENGINEERING',
          skillCode: 'containerization_and_cicd',
          name: 'Containerization and CI/CD',
          status: 'OBSERVED',
          eus: ['d1', 'd2'],
          signals: ['docker', 'ci/cd'],
        },
      ]),
    });
    const se = env.payload.fields.find(
      (f) => f.fieldCode === 'SOFTWARE_ENGINEERING',
    )!;
    expect(se.specialties.map((s) => s.specialtyCode)).toEqual([
      'FRONTEND_ENGINEERING',
    ]);
    expect(se.skills.map((s) => s.skillCode)).not.toContain(
      'containerization_and_cicd',
    );
    const cloud = se.radar.axes.find(
      (a) => a.dimensionCode === 'SE_CLOUD_INFRA',
    )!;
    expect(cloud.relativeCoverage).toBe(WEAK_EVIDENCE_FLOOR);
    expect(cloud.evidenceState).toBe('WEAK_EVIDENCE');
  });
});

describe('WEAK radar — real artifacts (Gemini 0)', () => {
  function assembleReal(
    snapshotId: string,
    r1: string,
    p3: string,
    p4: string,
  ) {
    const r1PackDir = join(BACKEND_ROOT, 'tmp', 'mc1-r1-functional', r1);
    const p3PackDir = join(BACKEND_ROOT, 'tmp', 'mc1-p3-functional', p3);
    const p4PackDir = join(BACKEND_ROOT, 'tmp', 'mc1-p4-functional', p4);
    if (![r1PackDir, p3PackDir, p4PackDir].every((p) => existsSync(p))) {
      return null;
    }
    return assembleProfilePilot({
      backendRoot: BACKEND_ROOT,
      snapshotId,
      r1PackDir,
      p3PackDir,
      p4PackDir,
    });
  }

  it('Sara pre-fix: P3 WEAK governance → radar >= 20, skill unpublished', () => {
    const env = assembleReal(
      '20',
      'R1F-8A2-S20-20260813155543-f048aec4',
      'P3F-8B2-S20-20260813155600-0110e5e2',
      'P4F-8D-S20-20260813155624-c9cdc4f6',
    );
    if (!env) return;
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBeGreaterThanOrEqual(WEAK_EVIDENCE_FLOOR);
    expect(gov.evidenceState).toBe('WEAK_EVIDENCE');
    expect(da.specialties.map((s) => s.specialtyCode)).not.toContain(
      'DATA_GOVERNANCE',
    );
    expect(
      da.skills.some(
        (s) => /governance/i.test(s.skillCode) || /gobernanza/i.test(s.name),
      ),
    ).toBe(false);
  });

  it('Sara post-fix pack: overlay does not change 48.6', () => {
    const packPath = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-data-governance-semantic-fix',
      'profile',
      'PROF-8E-S20-20260813172450',
      'profile-contract.json',
    );
    if (!existsSync(packPath)) return;
    const envelope = JSON.parse(
      readFileSync(packPath, 'utf8'),
    ) as ProfilePilotEnvelope;
    const da = envelope.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const before = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(before.relativeCoverage).toBe(48.6);
    const { axes } = applyWeakEvidenceRadarSemantics({
      axes: da.radar.axes,
      weakSignals: [
        {
          dimensionCode: 'DA_GOVERNANCE_QUALITY',
          uniqueEvidenceUnitIds: ['already-observed'],
        },
      ],
    });
    expect(
      axes.find((a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY')!
        .relativeCoverage,
    ).toBe(48.6);
  });

  it('Sara post-fix reassemble: governance stays OBSERVED', () => {
    const env = assembleReal(
      '20',
      'R1F-8A2-S20-20260813155543-f048aec4',
      'P3F-8B2-S20-20260813172432-0af23cd8',
      'P4F-8D-S20-20260813172450-a061a51f',
    );
    if (!env) return;
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.evidenceState).toBe('OBSERVED');
    expect(gov.relativeCoverage).toBeGreaterThan(WEAK_EVIDENCE_FLOOR);
    expect(da.specialties.map((s) => s.specialtyCode)).toContain(
      'DATA_GOVERNANCE',
    );
  });

  it('Haider: governance NOT_EMITTED → 0', () => {
    const env = assembleReal(
      '21',
      'R1F-8A2-S21-20260813173222-655bc99c',
      'P3F-8B2-S21-20260813173235-4f5e3ed0',
      'P4F-8D-S21-20260813173300-935b4573',
    );
    if (!env) return;
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBe(0);
    expect(gov.evidenceState).toBe('NO_EVIDENCE');
    expect(da.specialties.map((s) => s.specialtyCode)).not.toContain(
      'DATA_GOVERNANCE',
    );
  });

  it('Diego: P3 OBSERVED + P4 WEAK → weak radar, skill unpublished', () => {
    const env = assembleReal(
      '22',
      'R1F-8A2-S22-20260813173529-0f43eaf2',
      'P3F-8B2-S22-20260813173554-e1773a4d',
      'P4F-8D-S22-20260813173624-b77a6ad0',
    );
    if (!env) return;
    const da = env.payload.fields.find(
      (f) => f.fieldCode === 'DATA_ANALYTICS',
    )!;
    const gov = da.radar.axes.find(
      (a) => a.dimensionCode === 'DA_GOVERNANCE_QUALITY',
    )!;
    expect(gov.relativeCoverage).toBeGreaterThanOrEqual(WEAK_EVIDENCE_FLOOR);
    expect(gov.evidenceState).toBe('WEAK_EVIDENCE');
    expect(da.specialties.map((s) => s.specialtyCode)).toContain(
      'DATA_GOVERNANCE',
    );
    expect(
      da.skills.some((s) => s.parentSpecialtyCode === 'DATA_GOVERNANCE'),
    ).toBe(false);
  });

  it('Johan: DevOps WEAK floors SE_CLOUD_INFRA without publishing the skill', () => {
    const env = assembleReal(
      '12',
      'R1F-8A2-S12-20260813155847-36b77be7',
      'P3F-8B2-S12-20260813155906-bd12c415',
      'P4F-8D-S12-20260813155932-534aec56',
    );
    if (!env) return;
    const se = env.payload.fields.find(
      (f) => f.fieldCode === 'SOFTWARE_ENGINEERING',
    )!;
    const cloud = se.radar.axes.find(
      (a) => a.dimensionCode === 'SE_CLOUD_INFRA',
    )!;
    expect(cloud.relativeCoverage).toBeGreaterThanOrEqual(WEAK_EVIDENCE_FLOOR);
    expect(cloud.evidenceState).toBe('WEAK_EVIDENCE');
    expect(se.specialties.map((s) => s.specialtyCode)).not.toContain(
      'PLATFORM_DEVOPS_ENGINEERING',
    );
  });

  it('Nidia: EDITORIAL WEAK floors VD_EDITORIAL without publishing editorial as OBSERVED specialty', () => {
    const env = assembleReal(
      '1',
      'R1F-8A2-S1-20260813160150-2baecb53',
      'P3F-8B2-S1-20260813160211-c5adf067',
      'P4F-8D-S1-20260813160236-8e07473e',
    );
    if (!env) return;
    const vd = env.payload.fields.find((f) => f.fieldCode === 'VISUAL_DESIGN');
    if (!vd) return;
    const editorial = vd.radar.axes.find(
      (a) => a.dimensionCode === 'VD_EDITORIAL',
    )!;
    expect(editorial.relativeCoverage).toBeGreaterThanOrEqual(
      WEAK_EVIDENCE_FLOOR,
    );
    expect(vd.specialties.map((s) => s.specialtyCode)).not.toContain(
      'EDITORIAL_DESIGN',
    );
  });

  it('Juan Pablo: MOTION WEAK floors VD_MOTION without publishing MOTION_DESIGN', () => {
    const env = assembleReal(
      '14',
      'R1F-8A2-S14-20260810194606-d95f480f',
      'P3F-8B2-S14-20260810200104-f98a67fe',
      'P4F-8D-S14-20260810200124-0b452bc8',
    );
    if (!env) return;
    const vd = env.payload.fields.find((f) => f.fieldCode === 'VISUAL_DESIGN');
    if (!vd) return;
    const motion = vd.radar.axes.find((a) => a.dimensionCode === 'VD_MOTION')!;
    expect(motion.relativeCoverage).toBeGreaterThanOrEqual(WEAK_EVIDENCE_FLOOR);
    expect(motion.evidenceState).toBe('WEAK_EVIDENCE');
    expect(vd.specialties.map((s) => s.specialtyCode)).not.toContain(
      'MOTION_DESIGN',
    );
  });

  it('12I filter still drops WEAK-parent skills from the public list', () => {
    const p3Path = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p3-functional',
      'P3F-8B2-S20-20260813155600-0110e5e2',
      'p3-contract.json',
    );
    const p4Path = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p4-functional',
      'P4F-8D-S20-20260813155624-c9cdc4f6',
      'p4-contract.json',
    );
    if (!existsSync(p3Path) || !existsSync(p4Path)) return;
    const p3 = JSON.parse(readFileSync(p3Path, 'utf8')) as P3ContractEnvelope;
    const p4 = JSON.parse(readFileSync(p4Path, 'utf8')) as P4ContractEnvelope;
    const observed = listObservedP3Specialties(p3);
    const publicSkills = listObservedP4Skills(p4, observed);
    expect(observed.some((s) => s.specialtyCode === 'DATA_GOVERNANCE')).toBe(
      false,
    );
    expect(
      publicSkills.some((s) => s.parentSpecialtyCode === 'DATA_GOVERNANCE'),
    ).toBe(false);
  });
});

describe('WEAK radar deploy gate invariants', () => {
  it('OBSERVED 18.3 stays 18.3 with evidenceState OBSERVED', () => {
    const { axes, warnings } = applyWeakEvidenceRadarSemantics({
      axes: [
        axis({
          dimensionCode: 'AV_EDITING_MONTAGE',
          relativeCoverage: 18.3,
          rawScore: 2.14,
          contributingSkillCodes: ['video_editing_and_postproduction'],
        }),
        axis({
          dimensionCode: 'AV_CAPTURE',
          relativeCoverage: 100,
          rawScore: 11.716,
        }),
      ],
      weakSignals: [
        {
          dimensionCode: 'AV_EDITING_MONTAGE',
          uniqueEvidenceUnitIds: ['post-weak'],
        },
      ],
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    });
    const editing = axes.find((a) => a.dimensionCode === 'AV_EDITING_MONTAGE')!;
    expect(editing.relativeCoverage).toBe(18.3);
    expect(editing.evidenceState).toBe('OBSERVED');
    expect(warnings.some((w) => w.code === 'OBSERVED_BELOW_WEAK_FLOOR')).toBe(
      true,
    );
  });

  it('rejects mixing P3 old with P4 new (Sara lineage)', () => {
    const r1 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-r1-functional',
      'R1F-8A2-S20-20260813155543-f048aec4',
    );
    const p3Old = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p3-functional',
      'P3F-8B2-S20-20260813155600-0110e5e2',
    );
    const p4New = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p4-functional',
      'P4F-8D-S20-20260813172450-a061a51f',
    );
    if (![r1, p3Old, p4New].every((p) => existsSync(p))) return;
    expect(() =>
      reassembleMc1Presentation({
        backendRoot: BACKEND_ROOT,
        snapshotId: '20',
        r1PackDir: r1,
        p3PackDir: p3Old,
        p4PackDir: p4New,
      }),
    ).toThrow(/LINEAGE_P4_P3_MISMATCH/);
  });

  it('reassembly twice is identical (fingerprint + public counts)', () => {
    const r1 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-r1-functional',
      'R1F-8A2-S22-20260813173529-0f43eaf2',
    );
    const p3 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p3-functional',
      'P3F-8B2-S22-20260813173554-e1773a4d',
    );
    const p4 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p4-functional',
      'P4F-8D-S22-20260813173624-b77a6ad0',
    );
    if (![r1, p3, p4].every((p) => existsSync(p))) return;
    const a = reassembleMc1Presentation({
      backendRoot: BACKEND_ROOT,
      snapshotId: '22',
      r1PackDir: r1,
      p3PackDir: p3,
      p4PackDir: p4,
    });
    const b = reassembleMc1Presentation({
      backendRoot: BACKEND_ROOT,
      snapshotId: '22',
      r1PackDir: r1,
      p3PackDir: p3,
      p4PackDir: p4,
    });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.publicSpecialtyCodes).toEqual(b.publicSpecialtyCodes);
    expect(a.publicSkillCodes).toEqual(b.publicSkillCodes);
    expect(JSON.stringify(a.presentation.fields)).toBe(
      JSON.stringify(b.presentation.fields),
    );
  });

  it('overlay on Sara canonical pack keeps OBSERVED 48.6 and 58.3', () => {
    const profile = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-data-governance-semantic-fix',
      'profile',
      'PROF-8E-S20-20260813172450',
    );
    const r1 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-r1-functional',
      'R1F-8A2-S20-20260813155543-f048aec4',
    );
    const p3 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p3-functional',
      'P3F-8B2-S20-20260813172432-0af23cd8',
    );
    const p4 = join(
      BACKEND_ROOT,
      'tmp',
      'mc1-p4-functional',
      'P4F-8D-S20-20260813172450-a061a51f',
    );
    if (![profile, r1, p3, p4].every((p) => existsSync(p))) return;
    const a = reassembleMc1Presentation({
      backendRoot: BACKEND_ROOT,
      snapshotId: '20',
      r1PackDir: r1,
      p3PackDir: p3,
      p4PackDir: p4,
      profilePackDir: profile,
    });
    const b = reassembleMc1Presentation({
      backendRoot: BACKEND_ROOT,
      snapshotId: '20',
      r1PackDir: r1,
      p3PackDir: p3,
      p4PackDir: p4,
      profilePackDir: profile,
    });
    const dims = a.presentation.fields[0].competencyMap.dimensions;
    expect(dims.find((d) => d.code === 'DA_GOVERNANCE_QUALITY')).toEqual(
      expect.objectContaining({
        relativeCoverage: 48.6,
        evidenceState: 'OBSERVED',
      }),
    );
    expect(dims.find((d) => d.code === 'DA_BUSINESS_REPORTING')).toEqual(
      expect.objectContaining({
        relativeCoverage: 58.3,
        evidenceState: 'OBSERVED',
      }),
    );
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it('weak overlay does not change public specialty or skill counts', () => {
    const env = assembleCaseCounts();
    if (!env) return;
    expect(env.specialtiesAfter).toEqual(env.specialtiesBefore);
    expect(env.skillsAfter).toEqual(env.skillsBefore);
  });
});

function assembleCaseCounts(): {
  specialtiesBefore: string[];
  specialtiesAfter: string[];
  skillsBefore: string[];
  skillsAfter: string[];
} | null {
  const r1Ok = join(
    BACKEND_ROOT,
    'tmp',
    'mc1-r1-functional',
    'R1F-8A2-S20-20260813155543-f048aec4',
  );
  const p3 = join(
    BACKEND_ROOT,
    'tmp',
    'mc1-p3-functional',
    'P3F-8B2-S20-20260813155600-0110e5e2',
  );
  const p4 = join(
    BACKEND_ROOT,
    'tmp',
    'mc1-p4-functional',
    'P4F-8D-S20-20260813155624-c9cdc4f6',
  );
  if (![r1Ok, p3, p4].every((p) => existsSync(p))) return null;
  const p3Env = JSON.parse(
    readFileSync(join(p3, 'p3-contract.json'), 'utf8'),
  ) as P3ContractEnvelope;
  const p4Env = JSON.parse(
    readFileSync(join(p4, 'p4-contract.json'), 'utf8'),
  ) as P4ContractEnvelope;
  const observed = listObservedP3Specialties(p3Env);
  const publicSkills = listObservedP4Skills(p4Env, observed);
  const assembled = reassembleMc1Presentation({
    backendRoot: BACKEND_ROOT,
    snapshotId: '20',
    r1PackDir: r1Ok,
    p3PackDir: p3,
    p4PackDir: p4,
  });
  return {
    specialtiesBefore: observed
      .map((s) => `${s.fieldCode}::${s.specialtyCode}`)
      .sort(),
    specialtiesAfter: [...assembled.publicSpecialtyCodes].sort(),
    skillsBefore: publicSkills
      .map(
        (s) => `${s.parentFieldCode}::${s.parentSpecialtyCode}::${s.skillCode}`,
      )
      .sort(),
    skillsAfter: [...assembled.publicSkillCodes].sort(),
  };
}
