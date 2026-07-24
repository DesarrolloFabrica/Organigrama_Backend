/**
 * Compara artefactos dry-run del Skill Enricher (sin BD).
 */
import type { EnrichmentArtifact } from './cv-skills-enrichment.types';

const APPLIED = new Set([
  'WORK_EXPERIENCE',
  'PROJECT',
  'ACHIEVEMENT',
  'RESPONSIBILITY',
]);

export function normalizeEvidenceText(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'en'));
}

export function compareEnrichmentArtifacts(
  runs: Array<{ label: string; artifact: EnrichmentArtifact }>,
) {
  if (runs.length < 2) {
    throw new Error('Se requieren al menos 2 artefactos para comparar.');
  }

  const perRun = runs.map(({ label, artifact: a }) => ({
    label,
    status: a.meta.status,
    model: a.meta.model,
    promptVersion: a.meta.promptVersion,
    enricherVersion: a.meta.enricherVersion,
    blockConfigVersion: a.meta.blockConfigVersion,
    blockSize: a.meta.blockSize,
    durationMs: a.meta.durationMs,
    inventoryHash: a.meta.inventoryHash,
    metrics: a.metrics,
    warningsCount: a.warnings.length,
  }));

  const byRunSkills = runs.map(({ artifact }) => {
    const map = new Map<
      string,
      {
        normalizedName: string;
        evidenceCount: number;
        sourceTypes: string[];
        evidenceTexts: string[];
        evidenceKeys: string[];
      }
    >();
    for (const s of artifact.validatedResult.skills) {
      const texts = (s.evidenceItems || []).map((e) => e.evidenceText);
      map.set(s.extractionSkillId, {
        normalizedName: s.normalizedName,
        evidenceCount: texts.length,
        sourceTypes: uniqueSorted(
          (s.evidenceItems || []).map((e) => e.sourceType),
        ),
        evidenceTexts: texts,
        evidenceKeys: uniqueSorted(texts.map(normalizeEvidenceText)),
      });
    }
    return map;
  });

  const allIds = new Set<string>();
  for (const m of byRunSkills) for (const id of m.keys()) allIds.add(id);

  const intersectionIds = [...allIds].filter((id) =>
    byRunSkills.every((m) => m.has(id)),
  );

  const skillReports = [...allIds]
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map((id) => {
      const runsDetail = byRunSkills.map((m, i) => {
        const s = m.get(id);
        return {
          label: runs[i].label,
          present: !!s,
          evidenceCount: s?.evidenceCount ?? 0,
          sourceTypes: s?.sourceTypes ?? [],
          evidenceTexts: s?.evidenceTexts ?? [],
          evidenceKeys: s?.evidenceKeys ?? [],
        };
      });

      const presentInAllRuns = runsDetail.every((r) => r.present);
      const hasEvidenceInAllRuns = runsDetail.every((r) => r.evidenceCount >= 1);
      const counts = runsDetail.map((r) => r.evidenceCount);
      const typeSets = runsDetail.map((r) => new Set(r.sourceTypes));
      const typeUnion = new Set(typeSets.flatMap((s) => [...s]));
      const typeInter = [...typeUnion].filter((t) =>
        typeSets.every((s) => s.has(t)),
      );
      const keySets = runsDetail.map((r) => new Set(r.evidenceKeys));
      const keyUnion = new Set(keySets.flatMap((s) => [...s]));
      const keyInter = [...keyUnion].filter((k) =>
        keySets.every((s) => s.has(k)),
      );

      const appliedFlags = runsDetail.map((r) =>
        r.sourceTypes.some((t) => APPLIED.has(t)),
      );
      const appliedCount = appliedFlags.filter(Boolean).length;

      const stabilityFlags: string[] = [];
      if (!presentInAllRuns) stabilityFlags.push('MISSING_IN_SOME_RUN');
      if (!hasEvidenceInAllRuns) stabilityFlags.push('EMPTY_IN_SOME_RUN');
      if (typeUnion.size > 0 && typeInter.length === 0) {
        stabilityFlags.push('NO_SHARED_SOURCE_TYPE');
      }
      if (keyUnion.size > 0 && keyInter.length === 0) {
        stabilityFlags.push('NO_SHARED_EVIDENCE_TEXT');
      }
      if (Math.max(...counts) - Math.min(...counts) >= 3) {
        stabilityFlags.push('EVIDENCE_COUNT_SWING');
      }

      const name =
        runsDetail.find((r) => r.present)?.evidenceTexts &&
        byRunSkills.find((m) => m.has(id))?.get(id)?.normalizedName;

      return {
        extractionSkillId: id,
        normalizedName:
          byRunSkills.map((m) => m.get(id)?.normalizedName).find(Boolean) ||
          name ||
          id,
        runs: runsDetail.map(({ label, present, evidenceCount, sourceTypes, evidenceTexts }) => ({
          label,
          present,
          evidenceCount,
          sourceTypes,
          evidenceTexts,
        })),
        presentInAllRuns,
        hasEvidenceInAllRuns,
        stableSourceTypes: typeInter,
        sourceTypeUnion: [...typeUnion],
        sourceTypeJaccard:
          typeUnion.size === 0 ? 1 : +(typeInter.length / typeUnion.size).toFixed(3),
        evidenceTextIntersection: keyInter,
        evidenceTextUnionSize: keyUnion.size,
        evidenceTextIntersectionSize: keyInter.length,
        evidenceCountRange: {
          min: Math.min(...counts),
          max: Math.max(...counts),
        },
        appliedEvidenceRuns: appliedCount,
        stabilityFlags,
      };
    });

  const identityStability =
    intersectionIds.length / (byRunSkills[0]?.size || 1);
  const coverageStability =
    skillReports.filter((s) => s.hasEvidenceInAllRuns).length /
    (byRunSkills[0]?.size || 1);
  const avgSourceTypeJaccard =
    skillReports.reduce((sum, s) => sum + s.sourceTypeJaccard, 0) /
    (skillReports.length || 1);

  const appliedBuckets = { '3/3': 0, '2/3': 0, '1/3': 0, '0/3': 0 };
  for (const s of skillReports) {
    const key = `${s.appliedEvidenceRuns}/3` as keyof typeof appliedBuckets;
    if (key in appliedBuckets) appliedBuckets[key] += 1;
  }

  const evidenceTextBuckets = {
    sameCitesAllRuns: skillReports.filter(
      (s) =>
        s.evidenceTextUnionSize > 0 &&
        s.evidenceTextIntersectionSize === s.evidenceTextUnionSize,
    ).length,
    partialOverlap: skillReports.filter(
      (s) =>
        s.evidenceTextIntersectionSize > 0 &&
        s.evidenceTextIntersectionSize < s.evidenceTextUnionSize,
    ).length,
    completelyDifferent: skillReports.filter(
      (s) =>
        s.evidenceTextUnionSize > 0 && s.evidenceTextIntersectionSize === 0,
    ).length,
    evidenceDisappears: skillReports.filter((s) => !s.hasEvidenceInAllRuns)
      .length,
  };

  return {
    generatedAt: new Date().toISOString(),
    runCount: runs.length,
    perRun,
    global: {
      unionSkills: allIds.size,
      intersectionSkills: intersectionIds.length,
      identityStability: +identityStability.toFixed(4),
      evidenceCoverageStability: +coverageStability.toFixed(4),
      avgSourceTypeJaccard: +avgSourceTypeJaccard.toFixed(4),
      appliedEvidenceBuckets: appliedBuckets,
      evidenceTextBuckets,
      skillsWithFlags: skillReports.filter((s) => s.stabilityFlags.length > 0)
        .length,
    },
    skills: skillReports,
  };
}
