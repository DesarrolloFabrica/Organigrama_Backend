import {
  compareEnrichmentArtifacts,
  normalizeEvidenceText,
} from './cv-skills-enrichment.compare';
import type { EnrichmentArtifact } from './cv-skills-enrichment.types';

function fakeArtifact(
  skills: Array<{
    id: string;
    name: string;
    items: Array<{ sourceType: string; evidenceText: string }>;
  }>,
): EnrichmentArtifact {
  return {
    meta: {
      document: '1',
      pdfSha256: 'x',
      inventoryHash: 'h',
      inventoryInputCount: skills.length,
      model: 'gemini-3.6-flash',
      promptVersion: 'e1-2026-07-24',
      enricherVersion: '1.0.0',
      blockConfigVersion: 'b1',
      blockSize: 15,
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 1,
      status: 'SUCCEEDED',
    },
    inventory: {
      source: { type: 'ARTIFACT', reference: 'x' },
      skills: skills.map((s, i) => ({
        extractionSkillId: s.id,
        normalizedName: s.name,
        sortOrder: i,
      })),
      hash: { algorithm: 'sha256', canonicalPayload: '', inventoryHash: 'h' },
    },
    blocks: [],
    validatedResult: {
      skills: skills.map((s) => ({
        extractionSkillId: s.id,
        normalizedName: s.name,
        evidenceItems: s.items.map((it, i) => ({
          sourceType: it.sourceType as
            | 'WORK_EXPERIENCE'
            | 'SKILLS_SECTION'
            | 'PROJECT'
            | 'OTHER',
          evidenceText: it.evidenceText,
          occurrenceIndex: i + 1,
        })),
        warnings: [],
      })),
    },
    metrics: {
      inputSkills: skills.length,
      outputSkills: skills.length,
      exactIdentityMatches: skills.length,
      missingFilledEmpty: 0,
      unknownSkillsReturned: 0,
      duplicateSkillsReturned: 0,
      skillsWithEvidence: skills.filter((s) => s.items.length).length,
      skillsWithoutEvidence: skills.filter((s) => !s.items.length).length,
      totalEvidenceItems: skills.reduce((n, s) => n + s.items.length, 0),
      averageEvidenceItems: 1,
      sourceTypeCounts: {},
      onlySkillsSectionCount: 0,
      workExperienceCount: 0,
      projectCount: 0,
      warningsCount: 0,
      geminiCalls: 1,
      blockRetries: 0,
      microRetryCalls: 0,
    },
    warnings: [],
  };
}

describe('compareEnrichmentArtifacts', () => {
  it('normaliza texto para comparación', () => {
    expect(normalizeEvidenceText('  React   JS ')).toBe('react js');
  });

  it('detecta identidad estable y citas parciales', () => {
    const a = fakeArtifact([
      {
        id: '1',
        name: 'React',
        items: [
          { sourceType: 'WORK_EXPERIENCE', evidenceText: 'Desarrollo con React' },
          { sourceType: 'SKILLS_SECTION', evidenceText: 'React' },
        ],
      },
    ]);
    const b = fakeArtifact([
      {
        id: '1',
        name: 'React',
        items: [
          { sourceType: 'WORK_EXPERIENCE', evidenceText: 'Desarrollo con React' },
          { sourceType: 'SKILLS_SECTION', evidenceText: 'Frontend: React' },
        ],
      },
    ]);
    const c = fakeArtifact([
      {
        id: '1',
        name: 'React',
        items: [{ sourceType: 'SKILLS_SECTION', evidenceText: 'React' }],
      },
    ]);
    const report = compareEnrichmentArtifacts([
      { label: 'r1', artifact: a },
      { label: 'r2', artifact: b },
      { label: 'r3', artifact: c },
    ]);
    expect(report.global.identityStability).toBe(1);
    expect(report.global.evidenceCoverageStability).toBe(1);
    expect(report.skills[0].presentInAllRuns).toBe(true);
    expect(report.skills[0].evidenceTextUnionSize).toBeGreaterThanOrEqual(2);
  });
});
