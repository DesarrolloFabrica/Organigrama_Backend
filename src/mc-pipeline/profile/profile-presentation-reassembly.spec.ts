import type { Mc1PersonCompetenciesPresentationDto } from '../person-profile/mc1-person-profile.types';
import { presentationFingerprint } from './profile-presentation-reassembly';

function presentation(
  relativeCoverage: number,
  displayCoverage: number,
): Mc1PersonCompetenciesPresentationDto {
  return {
    status: 'AVAILABLE',
    source: 'ARTIFACT_ONLY_LOCAL',
    calibration: {
      policy: 'MC1.PROFILE.RADAR_CALIBRATION',
      version: '1.1.0',
    },
    fields: [
      {
        code: 'DATA_ANALYTICS',
        label: 'Datos y Analitica',
        role: 'PRIMARY',
        specialties: [],
        tools: [],
        competencyMap: {
          dimensions: [
            {
              code: 'DA_DATA_PIPELINE',
              label: 'Pipeline',
              relativeCoverage,
              displayCoverage,
              evidenceState: 'OBSERVED',
            },
          ],
        },
        evidenceVolume: 'MEDIUM',
      },
    ],
  };
}

describe('MC1 calibrated presentation publisher fingerprint', () => {
  it('is stable and derives identity from original coverage, not a stale display', () => {
    const expected = presentationFingerprint(presentation(32.4, 44.4));
    expect(expected).toMatch(/^weak-radar-sha256:[a-f0-9]{24}$/);
    expect(presentationFingerprint(presentation(32.4, 99))).toBe(expected);
    expect(presentationFingerprint(presentation(47.7, 58.7))).not.toBe(
      expected,
    );
  });
});
