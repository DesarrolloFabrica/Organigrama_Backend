import type { RadarEvidenceState } from './profile-radar';

/**
 * Post-procesamiento de presentacion del radar MC1.
 *
 * `relativeCoverage` sigue siendo la salida original de 8E. Esta politica
 * deriva siempre `displayCoverage` desde ese valor original y nunca desde una
 * calibracion previa.
 */
export const RADAR_CALIBRATION_POLICY = {
  policy: 'MC1.PROFILE.RADAR_CALIBRATION',
  version: '1.1.0',
  observedGamma: 0.56,
  weakDisplayCoverage: 20,
  noEvidenceDisplayCoverage: 0,
} as const;

export const RADAR_CALIBRATION_METADATA = {
  policy: RADAR_CALIBRATION_POLICY.policy,
  version: RADAR_CALIBRATION_POLICY.version,
} as const;

export type RadarCalibrationInput = {
  relativeCoverage: number;
  evidenceState?: RadarEvidenceState;
};

function inferHistoricalEvidenceState(
  relativeCoverage: number,
): RadarEvidenceState {
  return relativeCoverage > 0 ? 'OBSERVED' : 'NO_EVIDENCE';
}

function clampCoverage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

/** Pure, deterministic and idempotent: input is always relativeCoverage. */
export function calibrateDimensionCoverage({
  relativeCoverage,
  evidenceState,
}: RadarCalibrationInput): number {
  const state = evidenceState ?? inferHistoricalEvidenceState(relativeCoverage);

  if (state === 'NO_EVIDENCE') {
    return RADAR_CALIBRATION_POLICY.noEvidenceDisplayCoverage;
  }
  if (state === 'WEAK_EVIDENCE') {
    return RADAR_CALIBRATION_POLICY.weakDisplayCoverage;
  }

  const relative = clampCoverage(relativeCoverage);
  if (relative === 0 || relative === 100) return relative;

  return 100 * (relative / 100) ** RADAR_CALIBRATION_POLICY.observedGamma;
}

/**
 * Preserves axis identity, order and technical values; only overwrites the
 * derived presentation field so applying it repeatedly cannot accumulate.
 */
export function applyRadarCalibrationToAxes<T extends RadarCalibrationInput>(
  axes: readonly T[],
): Array<T & { displayCoverage: number }> {
  return axes.map((axis) => ({
    ...axis,
    displayCoverage: calibrateDimensionCoverage(axis),
  }));
}
