import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPersonSnapshotIndexEntries,
  mapProfilePackToPresentation,
  readMc1PersonProfile,
} from './mc1-person-profile.reader';
import type { ProfilePilotEnvelope } from '../profile/profile.types';

describe('mc1 person profile reader 9F', () => {
  it('builds person snapshot index by personId', () => {
    const idx = buildPersonSnapshotIndexEntries([
      { personId: 4, snapshotId: '10', caseId: 'person-jose' },
    ]);
    expect(idx['4'].snapshotId).toBe('10');
  });

  it('maps profile pack to presentation without evidence IDs', () => {
    const envelope: ProfilePilotEnvelope = {
      contractCode: 'MC1.PROFILE.PILOT',
      contractVersion: '1.0.0',
      stageCode: 'PROFILE_PILOT',
      producedAt: '2026-08-10T15:53:13.000Z',
      warnings: [],
      payload: {
        snapshotId: '10',
        r1FieldResolutionStatus: 'RESOLVED',
        fields: [
          {
            fieldCode: 'SOFTWARE_ENGINEERING',
            role: 'PRIMARY',
            r1Confidence: 0.88,
            specialties: [{ specialtyCode: 'FRONTEND_ENGINEERING', confidence: 0.9 }],
            skills: [
              {
                skillCode: 'frontend_application_development',
                name: 'Desarrollo de Aplicaciones Frontend Responsivas',
                parentSpecialtyCode: 'FRONTEND_ENGINEERING',
                confidence: 0.9,
                supportingEvidenceUnitIds: ['ceu_secret'],
              },
            ],
            toolsTechnologies: ['React', 'TypeScript'],
            skillDimensionMappings: [],
            radar: {
              fieldCode: 'SOFTWARE_ENGINEERING',
              axes: [
                {
                  dimensionCode: 'SE_FRONTEND',
                  label: 'Frontend',
                  rawScore: 1,
                  relativeCoverage: 100,
                  contributingSkillCodes: [],
                  supportingEvidenceUnitIds: [],
                },
              ],
            },
            evidenceVolume: 'MEDIUM',
            evidenceUnitCount: 2,
            derivedPresentationLabel: null,
          },
        ],
        presentationNotes: {
          weakHiddenFromPrimary: true,
          toolsSeparatedFromSkills: true,
          radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
          formulaVersion: '8E.EXPERIMENTAL.1',
        },
        provenance: {
          r1PackDir: '/tmp/r1',
          p3PackDir: '/tmp/p3',
          p4PackDir: '/tmp/p4',
          mode: 'ARTIFACT_ONLY',
          dimensionsDoc: 'docs/x.md',
        },
      },
    };

    const presentation = mapProfilePackToPresentation({
      packDir: '/tmp/pack',
      envelope,
      producedAtMs: 1,
    });

    expect(presentation.status).toBe('AVAILABLE');
    expect(presentation.fields[0].specialties[0].code).toBe(
      'FRONTEND_ENGINEERING',
    );
    expect(presentation.fields[0].specialties[0].skills[0].name).toContain(
      'Frontend',
    );
    expect(JSON.stringify(presentation)).not.toContain('ceu_secret');
    expect(JSON.stringify(presentation)).not.toContain('/tmp/');
  });

  it('12A gate: drops empty SECONDARY tabs from presentation (legacy packs)', () => {
    const envelope: ProfilePilotEnvelope = {
      contractCode: 'MC1.PROFILE.PILOT',
      contractVersion: '1.0.0',
      stageCode: 'PROFILE_PILOT',
      producedAt: '2026-08-11T15:00:00.000Z',
      warnings: [],
      payload: {
        snapshotId: '10',
        r1FieldResolutionStatus: 'MULTI_FIELD',
        fields: [
          {
            fieldCode: 'COMMUNICATIONS',
            role: 'PRIMARY',
            specialties: [
              { specialtyCode: 'DIGITAL_COMMUNICATIONS', confidence: 0.85 },
            ],
            skills: [],
            toolsTechnologies: [],
            skillDimensionMappings: [],
            radar: { fieldCode: 'COMMUNICATIONS', axes: [] },
            evidenceVolume: 'HIGH',
            evidenceUnitCount: 4,
          },
          {
            fieldCode: 'AUDIOVISUAL_PRODUCTION',
            role: 'SECONDARY',
            specialties: [],
            skills: [],
            toolsTechnologies: [],
            skillDimensionMappings: [],
            radar: { fieldCode: 'AUDIOVISUAL_PRODUCTION', axes: [] },
            evidenceVolume: 'LOW',
            evidenceUnitCount: 0,
          },
          {
            fieldCode: 'DIGITAL_MARKETING',
            role: 'SECONDARY',
            specialties: [],
            skills: [],
            toolsTechnologies: [],
            skillDimensionMappings: [],
            radar: { fieldCode: 'DIGITAL_MARKETING', axes: [] },
            evidenceVolume: 'LOW',
            evidenceUnitCount: 0,
          },
        ],
        presentationNotes: {
          weakHiddenFromPrimary: true,
          toolsSeparatedFromSkills: true,
          radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
          formulaVersion: '8E.EXPERIMENTAL.1',
        },
        provenance: {
          r1PackDir: '/tmp/r1',
          p3PackDir: '/tmp/p3',
          p4PackDir: '/tmp/p4',
          mode: 'ARTIFACT_ONLY',
          dimensionsDoc: 'docs/x.md',
        },
      },
    };

    const presentation = mapProfilePackToPresentation({
      packDir: '/tmp/pack',
      envelope,
      producedAtMs: 1,
    });
    expect(presentation.fields.map((f) => f.code)).toEqual(['COMMUNICATIONS']);
  });

  it('returns NOT_AVAILABLE when index and document miss', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mc1-9f-'));
    mkdirSync(join(root, 'tmp', 'mc1-profile-pilot'), { recursive: true });
    const ds = {
      query: async (sql: string) => {
        if (/mc1_person_profile_presentation/i.test(sql)) return [];
        return [{ document: '9999999999' }];
      },
    } as never;
    try {
      const r = await readMc1PersonProfile({
        personId: '999',
        dataSource: ds,
        backendRoot: root,
      });
      expect(r.status).toBe('NOT_AVAILABLE');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('returns AVAILABLE when person index + pack exist', async () => {
    const root = mkdtempSync(join(tmpdir(), 'mc1-9f-ok-'));
    const pilot = join(root, 'tmp', 'mc1-profile-pilot', 'PROF-8E-S10-test');
    const preview = join(root, 'tmp', 'mc1-profile-preview');
    mkdirSync(pilot, { recursive: true });
    mkdirSync(preview, { recursive: true });
    writeFileSync(
      join(preview, 'person-snapshot-index.json'),
      JSON.stringify({ '4': { snapshotId: '10' } }),
      'utf8',
    );
    writeFileSync(
      join(pilot, 'profile-contract.json'),
      JSON.stringify({
        contractCode: 'MC1.PROFILE.PILOT',
        contractVersion: '1.0.0',
        stageCode: 'PROFILE_PILOT',
        producedAt: '2026-08-10T15:53:13.000Z',
        warnings: [],
        payload: {
          snapshotId: '10',
          r1FieldResolutionStatus: 'RESOLVED',
          fields: [
            {
              fieldCode: 'SOFTWARE_ENGINEERING',
              role: 'PRIMARY',
              specialties: [
                { specialtyCode: 'FRONTEND_ENGINEERING', confidence: 0.9 },
              ],
              skills: [],
              toolsTechnologies: ['React'],
              skillDimensionMappings: [],
              radar: { fieldCode: 'SOFTWARE_ENGINEERING', axes: [] },
              evidenceVolume: 'MEDIUM',
              evidenceUnitCount: 0,
            },
          ],
          presentationNotes: {
            weakHiddenFromPrimary: true,
            toolsSeparatedFromSkills: true,
            radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
            formulaVersion: '8E.EXPERIMENTAL.1',
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
      'utf8',
    );

    const ds = {
      query: async (sql: string) => {
        if (/mc1_person_profile_presentation/i.test(sql)) return [];
        return [];
      },
    } as never;
    try {
      const r = await readMc1PersonProfile({
        personId: '4',
        dataSource: ds,
        backendRoot: root,
      });
      expect(r.status).toBe('AVAILABLE');
      if (r.status === 'AVAILABLE') {
        expect(r.presentation.fields[0].code).toBe('SOFTWARE_ENGINEERING');
        expect(r.presentation.fields[0].specialties.map((s) => s.code)).toEqual([
          'FRONTEND_ENGINEERING',
        ]);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
