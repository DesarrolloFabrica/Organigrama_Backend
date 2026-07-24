import {
  getDefaultEvidenceEngineConfig,
  getEvidenceEngineConfig,
} from './cv-evidence.config';
import { evaluateEvidenceSkills } from './cv-evidence-engine.service';
import { computeEvidenceConfigHash } from './cv-evidence.hash';
import { normalizeEvidenceItems, normalizeEvidenceText } from './cv-evidence.normalization';
import { classifyEvidenceText } from './cv-evidence.classify';
import {
  computeEvidenceConfidence,
  computeEvidenceStrength,
  resolveEvidenceLevel,
} from './cv-evidence.scoring';
import { computeQualityFlags } from './cv-evidence.flags';
import { buildEvidenceExplanation } from './cv-evidence.explanation';
import {
  assertEvidenceMainCli,
  parseEvidenceCliArgs,
} from './cv-evidence.cli-args';
import type { EvidenceSkillInput } from './cv-evidence.types';

const er1 = getEvidenceEngineConfig('er1');
const er2 = getEvidenceEngineConfig('er2');

function skill(
  name: string,
  evidence: Array<{ sourceType: string; evidenceText: string }>,
  id = '1',
): EvidenceSkillInput {
  return {
    enrichmentItemId: `ei-${id}`,
    extractionSkillId: id,
    normalizedName: name,
    evidenceItems: evidence,
  };
}

describe('cv-evidence normalization', () => {
  it('normaliza espacios y case', () => {
    expect(normalizeEvidenceText('  Foo   BAR ')).toBe('foo bar');
  });

  it('dedupe por texto+sourceType', () => {
    const { unique, duplicateCount } = normalizeEvidenceItems(
      [
        { sourceType: 'SKILLS_SECTION', evidenceText: 'Docker' },
        { sourceType: 'SKILLS_SECTION', evidenceText: ' docker ' },
        { sourceType: 'WORK_EXPERIENCE', evidenceText: 'Docker' },
      ],
      'Docker',
      er2,
    );
    expect(unique).toHaveLength(2);
    expect(duplicateCount).toBe(1);
  });
});

describe('classifyEvidenceText', () => {
  it('name-only español', () => {
    const c = classifyEvidenceText({
      evidenceText: 'Comunicación efectiva',
      normalizedName: 'Comunicación efectiva',
      sourceType: 'PROFILE_SUMMARY',
    });
    expect(c.isNameOnly).toBe(true);
    expect(c.isAmbiguous).toBe(true);
    expect(c.isSubstantive).toBe(false);
  });

  it('name-only inglés', () => {
    const c = classifyEvidenceText({
      evidenceText: 'Teamwork',
      normalizedName: 'Teamwork',
      sourceType: 'PROFILE_SUMMARY',
    });
    expect(c.isNameOnly).toBe(true);
    expect(c.isAmbiguous).toBe(true);
  });

  it('bullet list', () => {
    const c = classifyEvidenceText({
      evidenceText: '• Docker, Kubernetes, Terraform',
      normalizedName: 'Docker',
      sourceType: 'SKILLS_SECTION',
    });
    expect(c.isListing).toBe(true);
  });

  it('WORK_EXPERIENCE sustantiva', () => {
    const c = classifyEvidenceText({
      evidenceText:
        'Presentar las características y tutoriales de productos frente a la cámara.',
      normalizedName: 'Presentación',
      sourceType: 'WORK_EXPERIENCE',
    });
    expect(c.isSubstantive).toBe(true);
    expect(c.isAmbiguous).toBe(false);
  });

  it('herramienta solo skills no name-only si hay contexto de herramientas', () => {
    const c = classifyEvidenceText({
      evidenceText: 'usando herramientas como CapCut, Filmora e InShot.',
      normalizedName: 'CapCut',
      sourceType: 'SKILLS_SECTION',
    });
    expect(c.isListing).toBe(true);
    expect(c.isNameOnly).toBe(false);
    expect(c.isSubstantive).toBe(false);
    expect(c.isAmbiguous).toBe(false);
  });
});

describe('er1 regression (floor)', () => {
  it('no evidence → strength 0 NONE', () => {
    const r = evaluateEvidenceSkills([skill('X', [])], er1);
    expect(r.skills[0].evidenceStrength).toBe(0);
    expect(r.skills[0].evidenceLevel).toBe('NONE');
  });

  it('only skills con floor er1 ≥ 1', () => {
    const r = evaluateEvidenceSkills(
      [
        skill('CapCut', [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'usando CapCut y Filmora',
          },
        ]),
      ],
      er1,
    ).skills[0];
    expect(r.evidenceStrength).toBeGreaterThanOrEqual(1);
    expect(r.evidenceLevel).toBe('WEAK');
  });

  it('applied > only skills', () => {
    const onlySkills = evaluateEvidenceSkills(
      [
        skill('CapCut', [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'usando CapCut y Filmora',
          },
        ]),
      ],
      er1,
    ).skills[0];
    const withWork = evaluateEvidenceSkills(
      [
        skill('Presentación', [
          {
            sourceType: 'WORK_EXPERIENCE',
            evidenceText:
              'Presentar características y tutoriales frente a la cámara de forma natural.',
          },
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'Locución, Presentación y Actuación',
          },
        ]),
      ],
      er1,
    ).skills[0];
    expect(onlySkills.evidenceStrength).toBeLessThan(withWork.evidenceStrength);
  });
});

describe('er2 calibration', () => {
  it('default config es er2', () => {
    expect(getDefaultEvidenceEngineConfig().rulesProfile).toBe('er2');
  });

  it('config hash er2 ≠ er1', () => {
    expect(computeEvidenceConfigHash(er1)).not.toBe(
      computeEvidenceConfigHash(er2),
    );
  });

  it('evidenceCount>0 puede tener strength=0 → NONE (only ambiguous)', () => {
    const r = evaluateEvidenceSkills(
      [
        skill('Trabajo en equipo', [
          {
            sourceType: 'PROFILE_SUMMARY',
            evidenceText: 'trabajo en equipo',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(r.evidenceCount).toBeGreaterThan(0);
    expect(r.qualityFlags).toContain('ONLY_AMBIGUOUS_EVIDENCE');
    expect(r.evidenceLevel).toBe('NONE');
    expect(r.evidenceStrength).toBe(0);
    expect(r.scoringBreakdown.noneReason).toBeTruthy();
  });

  it('only listing cap ≤ 15 y WEAK', () => {
    const r = evaluateEvidenceSkills(
      [
        skill('Canva', [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'presentaciones mediante Canva.',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(r.evidenceLevel).toBe('WEAK');
    expect(r.evidenceStrength).toBeGreaterThanOrEqual(1);
    expect(r.evidenceStrength).toBeLessThanOrEqual(15);
    expect(r.qualityFlags).toContain('ONLY_LISTING_EVIDENCE');
    expect(r.evidenceConfidence).toBeGreaterThanOrEqual(0.75);
  });

  it('name-only soft ≠ herramienta listada', () => {
    const soft = evaluateEvidenceSkills(
      [
        skill('Comunicación efectiva', [
          {
            sourceType: 'PROFILE_SUMMARY',
            evidenceText: 'comunicación efectiva',
          },
        ]),
      ],
      er2,
    ).skills[0];
    const tool = evaluateEvidenceSkills(
      [
        skill('Canva', [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'presentaciones mediante Canva.',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(soft.evidenceLevel).toBe('NONE');
    expect(tool.evidenceLevel).toBe('WEAK');
    expect(tool.evidenceStrength).toBeGreaterThan(soft.evidenceStrength);
    expect(tool.evidenceConfidence).toBeGreaterThan(soft.evidenceConfidence);
  });

  it('Locución-like PROFILE+SKILLS > herramienta solo SKILLS', () => {
    const locution = evaluateEvidenceSkills(
      [
        skill('Locución', [
          {
            sourceType: 'PROFILE_SUMMARY',
            evidenceText:
              'conocimientos en presentación, locución, creación de contenido',
          },
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText:
              'Locución, Presentación y Actuación: Manejo de voz frente a micrófonos (radio)',
          },
        ]),
      ],
      er2,
    ).skills[0];
    const canva = evaluateEvidenceSkills(
      [
        skill('Canva', [
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'presentaciones mediante Canva.',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(locution.evidenceStrength).toBeGreaterThan(canva.evidenceStrength);
    expect(locution.substantiveEvidenceCount).toBeGreaterThan(0);
  });

  it('Locución no supera Actuación con WORK', () => {
    const locution = evaluateEvidenceSkills(
      [
        skill('Locución', [
          {
            sourceType: 'PROFILE_SUMMARY',
            evidenceText:
              'conocimientos en presentación, locución, creación de contenido',
          },
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'Locución, Presentación y Actuación',
          },
        ]),
      ],
      er2,
    ).skills[0];
    const acting = evaluateEvidenceSkills(
      [
        skill('Actuación', [
          {
            sourceType: 'WORK_EXPERIENCE',
            evidenceText:
              'Actuar como el rostro y la voz principal de empresas en campañas de video marketing.',
          },
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'Locución, Presentación y Actuación',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(acting.evidenceStrength).toBeGreaterThan(locution.evidenceStrength);
    expect(acting.qualityFlags).toContain('HAS_APPLIED_EVIDENCE');
  });

  it('no regresión: applied evidencia alta', () => {
    const r = evaluateEvidenceSkills(
      [
        skill('Presentación', [
          {
            sourceType: 'WORK_EXPERIENCE',
            evidenceText:
              'Presentar características, beneficios y tutoriales frente a la cámara.',
          },
          {
            sourceType: 'WORK_EXPERIENCE',
            evidenceText: 'incluyendo edición y presentación de material multimedia.',
          },
          {
            sourceType: 'PROFILE_SUMMARY',
            evidenceText: 'conocimientos en presentación',
          },
          {
            sourceType: 'SKILLS_SECTION',
            evidenceText: 'Locución, Presentación y Actuación',
          },
        ]),
      ],
      er2,
    ).skills[0];
    expect(r.evidenceStrength).toBeGreaterThanOrEqual(70);
    expect(r.evidenceLevel).toBe('STRONG');
    expect(r.qualityFlags).not.toContain('ONLY_LISTING_EVIDENCE');
  });

  it('STRONG requiere applied (o no listing puro)', () => {
    const r = evaluateEvidenceSkills(
      [
        skill('X', [
          { sourceType: 'SKILLS_SECTION', evidenceText: 'X, Y, Z tools' },
          { sourceType: 'PROFILE_SUMMARY', evidenceText: 'experiencia con X' },
        ]),
      ],
      er2,
    ).skills[0];
    expect(r.evidenceLevel).not.toBe('STRONG');
  });

  it('confidence listing vs ambiguous', () => {
    const listing = computeEvidenceConfidence({
      uniqueCount: 1,
      sourceDiversity: 1,
      appliedCount: 0,
      substantiveCount: 0,
      flags: ['ONLY_SKILLS_SECTION', 'ONLY_LISTING_EVIDENCE'],
      config: er2,
    });
    const ambiguous = computeEvidenceConfidence({
      uniqueCount: 1,
      sourceDiversity: 1,
      appliedCount: 0,
      substantiveCount: 0,
      flags: ['ONLY_AMBIGUOUS_EVIDENCE', 'NAME_ONLY_EVIDENCE'],
      config: er2,
    });
    expect(listing.confidence).toBeGreaterThanOrEqual(0.75);
    expect(ambiguous.confidence).toBeLessThanOrEqual(0.6);
  });

  it('level thresholds sin floor', () => {
    expect(resolveEvidenceLevel(0, er2, true, ['ONLY_AMBIGUOUS_EVIDENCE'])).toBe(
      'NONE',
    );
    expect(resolveEvidenceLevel(20, er2, true)).toBe('WEAK');
    expect(resolveEvidenceLevel(50, er2, true)).toBe('MODERATE');
    expect(resolveEvidenceLevel(70, er2, true)).toBe('STRONG');
  });

  it('explanation NONE ambiguous', () => {
    const t = buildEvidenceExplanation({
      level: 'NONE',
      flags: ['ONLY_AMBIGUOUS_EVIDENCE', 'NAME_ONLY_EVIDENCE'],
      evidenceCount: 1,
      uniqueEvidenceCount: 1,
      appliedEvidenceCount: 0,
      substantiveEvidenceCount: 0,
      ambiguousEvidenceCount: 1,
      sourceDiversity: 1,
      evidenceStrength: 0,
      rulesProfile: 'er2',
      noneReason: 'STRENGTH_ZERO_ONLY_AMBIGUOUS',
    });
    expect(t).toMatch(/no contienen contexto suficiente/);
  });
});

describe('cv-evidence CLI', () => {
  it('dry-run válido default er2', () => {
    const args = parseEvidenceCliArgs(['--enrichmentId=1', '--dry-run']);
    assertEvidenceMainCli(args);
    expect(args.rulesVersion).toBe('er2');
  });

  it('acepta rulesVersion er1', () => {
    expect(
      parseEvidenceCliArgs([
        '--enrichmentId=1',
        '--dry-run',
        '--rulesVersion=er1',
      ]).rulesVersion,
    ).toBe('er1');
  });

  it('persist sin confirmación aborta', () => {
    expect(() =>
      assertEvidenceMainCli(
        parseEvidenceCliArgs(['--enrichmentId=1', '--persist']),
      ),
    ).toThrow(/i-confirm-persist/);
  });
});

describe('strength caps unit', () => {
  it('penalties + caps documentados en breakdown', () => {
    const { unique } = normalizeEvidenceItems(
      [{ sourceType: 'SKILLS_SECTION', evidenceText: 'docker' }],
      'Docker',
      er2,
    );
    const flags = computeQualityFlags({
      unique,
      duplicateCount: 0,
      sourceTypes: new Set(['SKILLS_SECTION']),
      appliedCount: 0,
      substantiveCount: unique.filter((u) => u.isSubstantive).length,
      ambiguousCount: unique.filter((u) => u.isAmbiguous).length,
      listingCount: unique.filter((u) => u.isListing).length,
      config: er2,
    });
    const scored = computeEvidenceStrength({
      unique,
      flags,
      sourceTypes: new Set(['SKILLS_SECTION']),
      appliedCount: 0,
      duplicateCount: 0,
      substantiveCount: unique.filter((u) => u.isSubstantive).length,
      config: er2,
    });
    expect(scored.breakdown.sameSourceDecay).toBe(0.4);
    expect(scored.strength).toBeLessThanOrEqual(15);
  });
});
