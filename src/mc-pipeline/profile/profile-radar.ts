/**
 * Fórmula experimental de radar 8E — determinística, no definitiva.
 *
 * rawScore(dim) = Σ_skills (
 *   confidence
 *   * sqrt(evidenceCount)
 *   * (1 + 0.15 * min(diversitySignals, 4))
 *   * explicitnessBoost
 * )
 *
 * relativeCoverage: normaliza max(raw) del Field a 100.
 * evidenceVolume(Field): LOW <4 unique EUs · MEDIUM 4–9 · HIGH ≥10
 */

export const PROFILE_RADAR_FORMULA_VERSION = '8E.EXPERIMENTAL.1';

export type Explicitness = 'EXPLICIT' | 'STRONGLY_SUPPORTED' | 'OTHER' | 'UNKNOWN';

export type RadarSkillContribution = {
  skillCode: string;
  confidence: number;
  evidenceUnitIds: string[];
  signalCount: number;
  /** Promedio simple de boost por EU (1.0 default, 1.15 EXPLICIT, 1.08 STRONGLY_SUPPORTED). */
  explicitnessBoost: number;
};

export type RadarAxisResult = {
  dimensionCode: string;
  label: string;
  rawScore: number;
  relativeCoverage: number;
  contributingSkillCodes: string[];
  supportingEvidenceUnitIds: string[];
};

export function explicitnessBoostFor(
  levels: Explicitness[],
): number {
  if (!levels.length) return 1;
  const map: Record<Explicitness, number> = {
    EXPLICIT: 1.15,
    STRONGLY_SUPPORTED: 1.08,
    OTHER: 1,
    UNKNOWN: 1,
  };
  const sum = levels.reduce((a, l) => a + map[l], 0);
  return sum / levels.length;
}

export function rawScoreForContributions(
  contribs: RadarSkillContribution[],
): number {
  let total = 0;
  for (const c of contribs) {
    const ev = Math.max(0, c.evidenceUnitIds.length);
    const diversity = 1 + 0.15 * Math.min(Math.max(0, c.signalCount), 4);
    total += c.confidence * Math.sqrt(ev) * diversity * c.explicitnessBoost;
  }
  return Math.round(total * 1000) / 1000;
}

export function normalizeRadarAxes(
  axes: Array<Omit<RadarAxisResult, 'relativeCoverage'> & { relativeCoverage?: number }>,
): RadarAxisResult[] {
  const max = Math.max(0, ...axes.map((a) => a.rawScore));
  return axes.map((a) => ({
    ...a,
    relativeCoverage:
      max <= 0 ? 0 : Math.round((a.rawScore / max) * 1000) / 10,
  }));
}

export function classifyEvidenceVolume(
  uniqueEvidenceCount: number,
): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (uniqueEvidenceCount >= 10) return 'HIGH';
  if (uniqueEvidenceCount >= 4) return 'MEDIUM';
  return 'LOW';
}
