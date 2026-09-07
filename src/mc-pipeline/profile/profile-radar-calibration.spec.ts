import {
  applyRadarCalibrationToAxes,
  calibrateDimensionCoverage,
  RADAR_CALIBRATION_METADATA,
  RADAR_CALIBRATION_POLICY,
} from './profile-radar-calibration';

describe('MC1 radar calibration policy 1.1.0', () => {
  it('exposes one versioned source of truth', () => {
    expect(RADAR_CALIBRATION_POLICY).toEqual({
      policy: 'MC1.PROFILE.RADAR_CALIBRATION',
      version: '1.1.0',
      observedGamma: 0.56,
      weakDisplayCoverage: 20,
      noEvidenceDisplayCoverage: 0,
    });
    expect(RADAR_CALIBRATION_METADATA).toEqual({
      policy: 'MC1.PROFILE.RADAR_CALIBRATION',
      version: '1.1.0',
    });
  });

  it.each([
    [82.3, 89.7],
    [47.7, 66.1],
    [32.4, 53.2],
    [19.5, 40.0],
    [18.3, 38.6],
  ])(
    'calibrates real OBSERVED case %s to approximately %s',
    (relative, expected) => {
      expect(
        calibrateDimensionCoverage({
          relativeCoverage: relative,
          evidenceState: 'OBSERVED',
        }),
      ).toBeCloseTo(expected, 1);
    },
  );

  it('keeps state-specific invariants and endpoints', () => {
    expect(
      calibrateDimensionCoverage({
        relativeCoverage: 0,
        evidenceState: 'NO_EVIDENCE',
      }),
    ).toBe(0);
    expect(
      calibrateDimensionCoverage({
        relativeCoverage: 20,
        evidenceState: 'WEAK_EVIDENCE',
      }),
    ).toBe(20);
    expect(
      calibrateDimensionCoverage({
        relativeCoverage: 0,
        evidenceState: 'OBSERVED',
      }),
    ).toBe(0);
    expect(
      calibrateDimensionCoverage({
        relativeCoverage: 100,
        evidenceState: 'OBSERVED',
      }),
    ).toBe(100);
  });

  it('uses the historical compatibility rule when evidenceState is absent', () => {
    expect(calibrateDimensionCoverage({ relativeCoverage: 0 })).toBe(0);
    expect(calibrateDimensionCoverage({ relativeCoverage: 32.4 })).toBeCloseTo(
      53.2,
      1,
    );
  });

  it('is strictly monotonic for positive OBSERVED values', () => {
    let previous = calibrateDimensionCoverage({
      relativeCoverage: 0.1,
      evidenceState: 'OBSERVED',
    });
    for (let relative = 0.2; relative <= 100; relative += 0.1) {
      const current = calibrateDimensionCoverage({
        relativeCoverage: relative,
        evidenceState: 'OBSERVED',
      });
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
  });

  it('always returns a display value in range', () => {
    for (const evidenceState of [
      'NO_EVIDENCE',
      'WEAK_EVIDENCE',
      'OBSERVED',
    ] as const) {
      for (const relativeCoverage of [-10, 0, 0.1, 18.3, 20, 50, 100, 120]) {
        const display = calibrateDimensionCoverage({
          relativeCoverage,
          evidenceState,
        });
        expect(display).toBeGreaterThanOrEqual(0);
        expect(display).toBeLessThanOrEqual(100);
      }
    }
  });

  it('preserves axis count, order, labels, states and extra properties', () => {
    const axes = [
      {
        dimensionCode: 'A',
        label: 'Axis A',
        relativeCoverage: 19.5,
        evidenceState: 'OBSERVED' as const,
        role: 'PRIMARY' as const,
      },
      {
        dimensionCode: 'B',
        label: 'Axis B',
        relativeCoverage: 20,
        evidenceState: 'WEAK_EVIDENCE' as const,
        role: 'SECONDARY' as const,
      },
      {
        dimensionCode: 'C',
        label: 'Axis C',
        relativeCoverage: 0,
        evidenceState: 'NO_EVIDENCE' as const,
        role: 'SECONDARY' as const,
      },
    ];

    const calibrated = applyRadarCalibrationToAxes(axes);
    expect(calibrated).toHaveLength(axes.length);
    expect(calibrated.map((a) => a.dimensionCode)).toEqual(['A', 'B', 'C']);
    expect(calibrated.map((a) => a.label)).toEqual([
      'Axis A',
      'Axis B',
      'Axis C',
    ]);
    expect(calibrated.map((a) => a.evidenceState)).toEqual([
      'OBSERVED',
      'WEAK_EVIDENCE',
      'NO_EVIDENCE',
    ]);
    expect(calibrated.map((a) => a.role)).toEqual([
      'PRIMARY',
      'SECONDARY',
      'SECONDARY',
    ]);
    expect(calibrated.map((a) => a.relativeCoverage)).toEqual([19.5, 20, 0]);
  });

  it('is idempotent because it always derives from relativeCoverage', () => {
    const once = applyRadarCalibrationToAxes([
      {
        dimensionCode: 'A',
        relativeCoverage: 32.4,
        evidenceState: 'OBSERVED' as const,
        displayCoverage: 99,
      },
    ]);
    const twice = applyRadarCalibrationToAxes(once);
    expect(twice).toEqual(once);
    expect(once[0].displayCoverage).toBeCloseTo(53.2, 1);
  });
});
