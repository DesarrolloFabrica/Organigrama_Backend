import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { resolveBackendRoot } from './mc1-preview-backend-root';
import {
  findBestValidProfilePack,
  findValidProfilePacks,
  Mc1ProfilePreviewService,
} from './mc1-profile-preview.service';

describe('Mc1 preview artifact resolution (9B.1.1)', () => {
  const backendRoot = resolve(__dirname, '..', '..', '..');

  it('resolveBackendRoot finds tmp/mc1-profile-pilot from dist-like depth', () => {
    const fakeDistPreview = resolve(
      backendRoot,
      'dist',
      'src',
      'mc-pipeline',
      'preview',
    );
    const root = resolveBackendRoot(fakeDistPreview);
    expect(root).toBe(backendRoot);
  });

  it('resolveBackendRoot is independent of process.cwd()', () => {
    const prev = process.cwd();
    try {
      process.chdir(tmpdir());
      const root = resolveBackendRoot(
        resolve(backendRoot, 'dist', 'src', 'mc-pipeline', 'preview'),
      );
      expect(root).toBe(backendRoot);
    } finally {
      process.chdir(prev);
    }
  });

  it('never classifies PROFILE_AVAILABLE packs as PIPELINE_NOT_READY (snaps 1/2/5/6/7)', () => {
    const svc = new Mc1ProfilePreviewService(backendRoot);
    // Simulate Nest default (__dirname under dist/src/...): service must still work
    // when constructed with resolved root; also verify default walk.
    const fromDist = new Mc1ProfilePreviewService(
      resolveBackendRoot(
        resolve(backendRoot, 'dist', 'src', 'mc-pipeline', 'preview'),
      ),
    );

    for (const snap of ['1', '2', '5', '6', '7']) {
      const best = findBestValidProfilePack(backendRoot, snap);
      expect(best).toBeTruthy();
      expect(best!.envelope.payload.snapshotId).toBe(snap);
      expect(best!.envelope.payload.fields.length).toBeGreaterThan(0);

      const caseId = `snap-${snap}`;
      for (const service of [svc, fromDist]) {
        const presentation = service.getCase({ caseId });
        expect(presentation).toBeTruthy();
        expect(presentation!.availability).not.toBe('PIPELINE_NOT_READY');
        expect(presentation!.fields.length).toBeGreaterThan(0);
        expect(
          presentation!.fields.some((f) => f.specialties.length > 0),
        ).toBe(true);
        expect(
          presentation!.fields.some((f) =>
            f.skillsBySpecialty.some((g) => g.skills.length > 0),
          ),
        ).toBe(true);
        expect(
          presentation!.fields.some((f) =>
            f.radar.axes.some((a) => a.relativeCoverage > 0),
          ),
        ).toBe(true);
      }
    }

    const cases = svc.listCases();
    for (const c of cases.filter((x) => x.kind === 'ARTIFACT_SNAPSHOT')) {
      expect(c.availability).toBe('PROFILE_AVAILABLE');
    }
  });

  it('selects latest valid pack by producedAt among multiples (MULTI_FIELD snap 1)', () => {
    const packs = findValidProfilePacks(backendRoot, '1');
    expect(packs.length).toBeGreaterThan(1);
    const best = findBestValidProfilePack(backendRoot, '1');
    expect(best!.packDir).toBe(packs[0].packDir);
    expect(best!.envelope.payload.r1FieldResolutionStatus).toBe('MULTI_FIELD');
    expect(best!.envelope.payload.fields.length).toBeGreaterThan(1);
  });

  it('selects single-field pack for snapshot 6 by contract snapshotId', () => {
    const best = findBestValidProfilePack(backendRoot, '6');
    expect(best).toBeTruthy();
    expect(best!.envelope.payload.fields.map((f) => f.fieldCode)).toEqual([
      'PROJECT_PROGRAM_MGMT',
    ]);
  });

  it('ignores directories whose contract snapshotId does not match', () => {
    const sandbox = mkdtempSync(join(tmpdir(), 'mc1-preview-'));
    try {
      const pilot = join(sandbox, 'tmp', 'mc1-profile-pilot');
      mkdirSync(pilot, { recursive: true });
      const decoy = join(pilot, 'PROF-8E-S99-fake');
      mkdirSync(decoy);
      writeFileSync(
        join(decoy, 'profile-contract.json'),
        JSON.stringify({
          contractCode: 'MC1.PROFILE.PILOT',
          contractVersion: '1.0.0',
          stageCode: 'PROFILE_PILOT',
          producedAt: '2099-01-01T00:00:00.000Z',
          warnings: [],
          payload: {
            snapshotId: '1',
            r1FieldResolutionStatus: 'RESOLVED',
            fields: [
              {
                fieldCode: 'VISUAL_DESIGN',
                role: 'PRIMARY',
                specialties: [{ specialtyCode: 'GRAPHIC_DESIGN', confidence: 1 }],
                skills: [],
                toolsTechnologies: [],
                skillDimensionMappings: [],
                radar: { fieldCode: 'VISUAL_DESIGN', axes: [] },
                evidenceVolume: 'LOW',
                evidenceUnitCount: 0,
              },
            ],
            presentationNotes: {
              weakHiddenFromPrimary: true,
              toolsSeparatedFromSkills: true,
              radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
              formulaVersion: 'test',
            },
            provenance: {
              r1PackDir: 'x',
              p3PackDir: 'x',
              p4PackDir: 'x',
              mode: 'ARTIFACT_ONLY',
              dimensionsDoc: 'x',
            },
          },
        }),
      );

      // Named S99 but contract says snapshot 1 — must be discovered for snap 1
      const for1 = findValidProfilePacks(sandbox, '1');
      expect(for1.some((p) => p.packDir === decoy)).toBe(true);
      // Must NOT be discovered for snap 99 (metadata wins over folder name)
      const for99 = findValidProfilePacks(sandbox, '99');
      expect(for99).toEqual([]);
    } finally {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it('lists real-person cases including Grupo C software cohort', () => {
    const svc = new Mc1ProfilePreviewService(backendRoot);
    const persons = svc.listCases().filter((c) => c.kind === 'REAL_PERSON');
    expect(persons.length).toBeGreaterThanOrEqual(8);
    const groupC = persons.filter((p) => p.cohortGroup === 'C');
    expect(groupC.map((p) => p.caseId).sort()).toEqual([
      'person-alejandro',
      'person-camilo',
      'person-johan',
      'person-jose',
      'person-zuany',
    ]);
  });

  it('lists Grupo D audiovisual cohort cases', () => {
    const svc = new Mc1ProfilePreviewService(backendRoot);
    const groupD = svc
      .listCases()
      .filter((c) => c.kind === 'REAL_PERSON' && c.cohortGroup === 'D');
    expect(groupD.map((p) => p.caseId).sort()).toEqual([
      'person-camilo-ramirez',
      'person-juan-pablo-sanabria',
      'person-santiago-vanegas',
    ]);
  });

  it('lists Grupo E content-presenter cohort cases', () => {
    const svc = new Mc1ProfilePreviewService(backendRoot);
    const groupE = svc
      .listCases()
      .filter((c) => c.kind === 'REAL_PERSON' && c.cohortGroup === 'E');
    expect(groupE.map((p) => p.caseId).sort()).toEqual([
      'person-alejandra-sanabria',
      'person-danna-fierro',
      'person-katherin-araque',
      'person-linda-aguilera',
    ]);
  });
});
