import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getDefaultMcPa2EngineConfig,
  getMcPa2EngineConfigV100,
  getMcPa2EngineConfigV110,
  getMcPa2EngineConfigVisualDesignV110,
  computeMcPa2ConfigHash,
} from './mc-pa2.config';
import {
  McPa2EngineError,
  runMcPa2Engine,
  compareSpecialtyLexicographic,
} from './mc-pa2.engine';
import type {
  McPa2EngineInput,
  McPa2MappingInput,
  McPa2SkillEvidenceInput,
  McPa2SpecialtyInput,
} from './mc-pa2.types';
import {
  MC_SOFTWARE_SPECIALTY_CODES,
  MC_VISUAL_DESIGN_SPECIALTY_CODES,
} from './mc-catalog.definition-mc12';

function baseSpecialties(): McPa2SpecialtyInput[] {
  return MC_SOFTWARE_SPECIALTY_CODES.map((code, i) => ({
    specialtyId: String(i + 1),
    specialtyCode: code,
    specialtyName: code,
    lifecycleStatus: 'ACTIVE' as const,
    sortOrder: i + 1,
  }));
}

describe('mc-pa2.engine métricas', () => {
  const config = getDefaultMcPa2EngineConfig();

  function run(partial: {
    mappings: McPa2MappingInput[];
    skills: McPa2SkillEvidenceInput[];
    specialties?: McPa2SpecialtyInput[];
  }) {
    return runMcPa2Engine({
      domainCode: 'SOFTWARE',
      config,
      specialties: partial.specialties ?? [
        {
          specialtyId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyName: 'DB',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
      ],
      mappings: partial.mappings,
      skills: partial.skills,
    });
  }

  it('Coverage correcto con skill NONE', () => {
    const result = run({
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 0.6,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 0.4,
          mappingType: 'SECONDARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'pg',
          skillName: 'PostgreSQL',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 50,
          evidenceConfidence: 0.8,
        },
        {
          skillId: '2',
          skillKey: 'tsql',
          skillName: 'T-SQL',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'NONE',
          evidenceStrength: 0,
          evidenceConfidence: 0.42,
        },
      ],
    });
    const s = result.specialtyResults[0];
    expect(s.mappedSkillCount).toBe(2);
    expect(s.evidencedSkillCount).toBe(1);
    expect(s.coverage).toBe(0.5);
    expect(s.strength).toBe(50);
    expect(s.confidence).toBe(0.8);
  });

  it('Confidence y Strength ponderados por weight', () => {
    const result = run({
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 0.7,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 0.3,
          mappingType: 'SECONDARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'a',
          skillName: 'A',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'STRONG',
          evidenceStrength: 80,
          evidenceConfidence: 0.9,
        },
        {
          skillId: '2',
          skillKey: 'b',
          skillName: 'B',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 40,
          evidenceConfidence: 0.6,
        },
      ],
    });
    const s = result.specialtyResults[0];
    // strength = (80*0.7 + 40*0.3) / 1.0 = 68
    expect(s.strength).toBe(68);
    // confidence = (0.9*0.7 + 0.6*0.3) = 0.81
    expect(s.confidence).toBe(0.81);
  });

  it('mapping dual cuenta en cada especialidad', () => {
    const result = runMcPa2Engine({
      domainCode: 'SOFTWARE',
      config,
      specialties: [
        {
          specialtyId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyName: 'DB',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          specialtyId: '2',
          specialtyCode: 'SOFTWARE_BACKEND',
          specialtyName: 'BE',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
      ],
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 0.65,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_BACKEND',
          specialtyId: '2',
          weight: 0.35,
          mappingType: 'SECONDARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'typeorm',
          skillName: 'TypeORM',
          skillType: 'TOOL',
          evidenceLevel: 'MODERATE',
          evidenceStrength: 48.5,
          evidenceConfidence: 0.86,
        },
      ],
    });
    const data = result.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_DATA',
    )!;
    const be = result.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_BACKEND',
    )!;
    expect(data.mappedSkillCount).toBe(1);
    expect(be.mappedSkillCount).toBe(1);
    expect(data.coverage).toBe(1);
    expect(be.coverage).toBe(1);
  });

  it('sin mappings → HIDDEN', () => {
    const result = run({
      mappings: [],
      skills: [
        {
          skillId: '1',
          skillKey: 'x',
          skillName: 'X',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'STRONG',
          evidenceStrength: 90,
          evidenceConfidence: 0.9,
        },
      ],
    });
    expect(result.specialtyResults[0].presentationStatus).toBe('HIDDEN');
  });

  it('evidencia insuficiente → EMERGENT', () => {
    const result = run({
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 1,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'a',
          skillName: 'A',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'WEAK',
          evidenceStrength: 10,
          evidenceConfidence: 0.5,
        },
        // skill 2 not in extraction → only 1 mapped in result
      ],
    });
    // Only one skill present → mapped=1 evidenced=1 → EMERGENT (below minimums)
    expect(result.specialtyResults[0].presentationStatus).toBe('EMERGENT');
  });

  it('soporte suficiente → ACTIVE', () => {
    const skills: McPa2SkillEvidenceInput[] = [1, 2, 3].map((i) => ({
      skillId: String(i),
      skillKey: `s${i}`,
      skillName: `S${i}`,
      skillType: 'TECHNOLOGY',
      evidenceLevel: 'MODERATE' as const,
      evidenceStrength: 50,
      evidenceConfidence: 0.8,
    }));
    const mappings: McPa2MappingInput[] = skills.map((s) => ({
      skillId: s.skillId,
      specialtyCode: 'SOFTWARE_DATA',
      specialtyId: '1',
      weight: 1 / 3,
      mappingType: 'PRIMARY' as const,
    }));
    // Fix: only one PRIMARY allowed per skill, but multiple skills each PRIMARY OK
    const result = run({ mappings, skills });
    expect(result.specialtyResults[0].presentationStatus).toBe('ACTIVE');
    expect(result.specialtyResults[0].coverage).toBe(1);
  });

  it('override genérico evidencia fuerte + baja cardinalidad', () => {
    const result = run({
      mappings: [
        {
          skillId: '1',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 1,
          mappingType: 'SECONDARY',
        },
      ],
      skills: [
        {
          skillId: '1',
          skillKey: 'ia',
          skillName: 'IA',
          skillType: 'PROFESSIONAL_KNOWLEDGE',
          evidenceLevel: 'STRONG',
          evidenceStrength: 87.6,
          evidenceConfidence: 0.86,
        },
        {
          skillId: '2',
          skillKey: 'prompt',
          skillName: 'prompting',
          skillType: 'PROFESSIONAL_KNOWLEDGE',
          evidenceLevel: 'NONE',
          evidenceStrength: 0,
          evidenceConfidence: 0.42,
        },
      ],
    });
    // weight sum for skill1=1 and skill2=1 → sum by skill is OK (different skills)
    const s = result.specialtyResults[0];
    expect(s.presentationStatus).toBe('ACTIVE');
    expect(s.overrideApplied).toBe(true);
    expect(s.warnings.some((w) => w.includes('LOW_CARDINALITY'))).toBe(true);
  });

  it('rechaza suma de pesos > 1', () => {
    expect(() =>
      run({
        mappings: [
          {
            skillId: '1',
            specialtyCode: 'SOFTWARE_DATA',
            specialtyId: '1',
            weight: 0.7,
            mappingType: 'PRIMARY',
          },
          {
            skillId: '1',
            specialtyCode: 'SOFTWARE_DATA',
            specialtyId: '1',
            weight: 0.5,
            mappingType: 'SECONDARY',
          },
        ],
        skills: [],
      }),
    ).toThrow(McPa2EngineError);
  });

  it('solo una especialidad default y nunca EMERGENT', () => {
    const specs = baseSpecialties().slice(0, 2);
    const result = runMcPa2Engine({
      domainCode: 'SOFTWARE',
      config,
      specialties: specs,
      mappings: [
        {
          skillId: '1',
          specialtyCode: specs[0].specialtyCode,
          specialtyId: specs[0].specialtyId,
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '2',
          specialtyCode: specs[0].specialtyCode,
          specialtyId: specs[0].specialtyId,
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '3',
          specialtyCode: specs[0].specialtyCode,
          specialtyId: specs[0].specialtyId,
          weight: 1,
          mappingType: 'PRIMARY',
        },
        {
          skillId: '4',
          specialtyCode: specs[1].specialtyCode,
          specialtyId: specs[1].specialtyId,
          weight: 1,
          mappingType: 'PRIMARY',
        },
      ],
      skills: [
        ...[1, 2, 3].map((i) => ({
          skillId: String(i),
          skillKey: `a${i}`,
          skillName: `A${i}`,
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'STRONG' as const,
          evidenceStrength: 80,
          evidenceConfidence: 0.9,
        })),
        {
          skillId: '4',
          skillKey: 'b',
          skillName: 'B',
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'WEAK',
          evidenceStrength: 5,
          evidenceConfidence: 0.5,
        },
      ],
    });
    const defaults = result.specialtyResults.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].presentationStatus).toBe('ACTIVE');
    expect(result.defaultSpecialtyCode).toBe(defaults[0].specialtyCode);
  });

  it('ranking determinista (mismo input → mismo orden)', () => {
    const build = () =>
      run({
        mappings: [1, 2, 3].map((i) => ({
          skillId: String(i),
          specialtyCode: 'SOFTWARE_DATA',
          specialtyId: '1',
          weight: 1 / 3,
          mappingType: 'PRIMARY' as const,
        })),
        skills: [1, 2, 3].map((i) => ({
          skillId: String(i),
          skillKey: `s${i}`,
          skillName: `S${i}`,
          skillType: 'TECHNOLOGY',
          evidenceLevel: 'MODERATE' as const,
          evidenceStrength: 40 + i,
          evidenceConfidence: 0.8,
        })),
      });
    const a = build();
    const b = build();
    expect(a.specialtyResults.map((r) => r.rank)).toEqual(
      b.specialtyResults.map((r) => r.rank),
    );
    expect(a.configHash).toBe(computeMcPa2ConfigHash(config));
  });
});

describe('mc-pa2.engine piloto Camilo (fixture)', () => {
  it('reproduce distribución esperada MC1.1 y default FRONTEND', () => {
    const snap = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../tmp/cv-attributes/mc1-camilo-source-snapshot.json'),
        'utf8',
      ),
    );
    const art = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../tmp/cv-attributes/mc1.3.2-camilo-skill-mappings.json',
        ),
        'utf8',
      ),
    );

    const specialties: McPa2SpecialtyInput[] = MC_SOFTWARE_SPECIALTY_CODES.map(
      (code, i) => ({
        specialtyId: String(i + 1),
        specialtyCode: code,
        specialtyName: code,
        lifecycleStatus: 'ACTIVE' as const,
        sortOrder: i + 1,
      }),
    );
    const codeToId = Object.fromEntries(
      specialties.map((s) => [s.specialtyCode, s.specialtyId]),
    );

    const skills: McPa2SkillEvidenceInput[] = snap.skills.map(
      (s: {
        skill_id: string;
        normalized_key: string;
        normalized_name: string;
        skill_type: string;
        evidence_level: string;
        evidence_strength: number;
        evidence_confidence: number;
      }) => ({
        skillId: s.skill_id,
        skillKey: s.normalized_key,
        skillName: s.normalized_name,
        skillType: s.skill_type,
        evidenceLevel: s.evidence_level,
        evidenceStrength: Number(s.evidence_strength),
        evidenceConfidence: Number(s.evidence_confidence),
      }),
    );

    const mappings: McPa2MappingInput[] = [];
    for (const row of art.skills) {
      if (row.classification !== 'DOMAIN_SPECIALTY') continue;
      const skill = snap.skills.find(
        (s: { normalized_key: string; skill_type: string }) =>
          s.normalized_key === row.skillKey && s.skill_type === row.skillType,
      );
      if (!skill) throw new Error(`missing ${row.skillKey}`);
      mappings.push({
        skillId: skill.skill_id,
        specialtyCode: row.primary,
        specialtyId: codeToId[row.primary],
        weight: row.primaryWeight,
        mappingType: 'PRIMARY',
      });
      if (row.secondary) {
        mappings.push({
          skillId: skill.skill_id,
          specialtyCode: row.secondary,
          specialtyId: codeToId[row.secondary],
          weight: row.secondaryWeight,
          mappingType: 'SECONDARY',
        });
      }
    }

    const result = runMcPa2Engine({
      domainCode: 'SOFTWARE',
      config: getDefaultMcPa2EngineConfig(),
      specialties,
      mappings,
      skills,
    });

    const byCode = Object.fromEntries(
      result.specialtyResults.map((r) => [r.specialtyCode, r]),
    );

    expect(byCode.SOFTWARE_FRONTEND.presentationStatus).toBe('ACTIVE');
    expect(byCode.SOFTWARE_BACKEND.presentationStatus).toBe('ACTIVE');
    expect(byCode.SOFTWARE_DATA.presentationStatus).toBe('ACTIVE');
    expect(byCode.SOFTWARE_ENGINEERING_QUALITY.presentationStatus).toBe(
      'ACTIVE',
    );
    expect(byCode.SOFTWARE_AI_APPLIED.presentationStatus).toBe('ACTIVE');
    expect(byCode.SOFTWARE_AI_APPLIED.overrideApplied).toBe(true);
    expect(byCode.SOFTWARE_API_INTEGRATION.presentationStatus).toBe('EMERGENT');
    expect(byCode.SOFTWARE_CLOUD_DEPLOY.presentationStatus).toBe('EMERGENT');

    expect(result.defaultSpecialtyCode).toBe('SOFTWARE_FRONTEND');
    expect(byCode.SOFTWARE_FRONTEND.isDefault).toBe(true);

    const defaults = result.specialtyResults.filter((r) => r.isDefault);
    expect(defaults).toHaveLength(1);
  });

  it('pa2-software-1.1.0: default Backend; métricas invariantes; estados iguales', () => {
    const snap = JSON.parse(
      readFileSync(
        resolve(__dirname, '../../tmp/cv-attributes/mc1-camilo-source-snapshot.json'),
        'utf8',
      ),
    );
    const art = JSON.parse(
      readFileSync(
        resolve(
          __dirname,
          '../../tmp/cv-attributes/mc1.3.2-camilo-skill-mappings.json',
        ),
        'utf8',
      ),
    );

    const specialties: McPa2SpecialtyInput[] = MC_SOFTWARE_SPECIALTY_CODES.map(
      (code, i) => ({
        specialtyId: String(i + 1),
        specialtyCode: code,
        specialtyName: code,
        lifecycleStatus: 'ACTIVE' as const,
        sortOrder: i + 1,
      }),
    );
    const codeToId = Object.fromEntries(
      specialties.map((s) => [s.specialtyCode, s.specialtyId]),
    );

    const skills: McPa2SkillEvidenceInput[] = snap.skills.map(
      (s: {
        skill_id: string;
        normalized_key: string;
        normalized_name: string;
        skill_type: string;
        evidence_level: string;
        evidence_strength: number;
        evidence_confidence: number;
      }) => ({
        skillId: s.skill_id,
        skillKey: s.normalized_key,
        skillName: s.normalized_name,
        skillType: s.skill_type,
        evidenceLevel: s.evidence_level,
        evidenceStrength: Number(s.evidence_strength),
        evidenceConfidence: Number(s.evidence_confidence),
      }),
    );

    const mappings: McPa2MappingInput[] = [];
    for (const row of art.skills) {
      if (row.classification !== 'DOMAIN_SPECIALTY') continue;
      const skill = snap.skills.find(
        (s: { normalized_key: string; skill_type: string }) =>
          s.normalized_key === row.skillKey && s.skill_type === row.skillType,
      );
      if (!skill) throw new Error(`missing ${row.skillKey}`);
      mappings.push({
        skillId: skill.skill_id,
        specialtyCode: row.primary,
        specialtyId: codeToId[row.primary],
        weight: row.primaryWeight,
        mappingType: 'PRIMARY',
      });
      if (row.secondary) {
        mappings.push({
          skillId: skill.skill_id,
          specialtyCode: row.secondary,
          specialtyId: codeToId[row.secondary],
          weight: row.secondaryWeight,
          mappingType: 'SECONDARY',
        });
      }
    }

    const inputBase = { domainCode: 'SOFTWARE', specialties, mappings, skills };
    const v100 = runMcPa2Engine({
      ...inputBase,
      config: getMcPa2EngineConfigV100(),
    });
    const v110 = runMcPa2Engine({
      ...inputBase,
      config: getMcPa2EngineConfigV110(),
    });

    expect(v100.defaultSpecialtyCode).toBe('SOFTWARE_FRONTEND');
    expect(v110.defaultSpecialtyCode).toBe('SOFTWARE_BACKEND');
    expect(v110.activeCount).toBe(5);
    expect(v110.emergentCount).toBe(2);

    const fe100 = v100.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_FRONTEND',
    )!;
    const be100 = v100.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_BACKEND',
    )!;
    const fe110 = v110.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_FRONTEND',
    )!;
    const be110 = v110.specialtyResults.find(
      (r) => r.specialtyCode === 'SOFTWARE_BACKEND',
    )!;

    expect(fe110.coverage).toBe(fe100.coverage);
    expect(be110.coverage).toBe(be100.coverage);
    expect(fe110.strength).toBe(fe100.strength);
    expect(be110.strength).toBe(be100.strength);
    expect(fe110.confidence).toBe(fe100.confidence);
    expect(be110.confidence).toBe(be100.confidence);
    expect(fe110.presentationStatus).toBe(fe100.presentationStatus);
    expect(be110.presentationStatus).toBe(be100.presentationStatus);

    expect(be110.rank).toBe(1);
    expect(fe110.rank).toBe(2);
    expect(be110.isDefault).toBe(true);
    expect(fe110.isDefault).toBe(false);
    expect(v110.specialtyResults.filter((r) => r.isDefault)).toHaveLength(1);
  });

  it('pa2-visual-design-1.1.0: anti-tool oculta especialidad solo con tools', () => {
    const specialties: McPa2SpecialtyInput[] =
      MC_VISUAL_DESIGN_SPECIALTY_CODES.map((code, i) => ({
        specialtyId: String(i + 1),
        specialtyCode: code,
        specialtyName: code,
        lifecycleStatus: 'ACTIVE' as const,
        sortOrder: i + 1,
      }));
    const codeToId = Object.fromEntries(
      specialties.map((s) => [s.specialtyCode, s.specialtyId]),
    );
    const skills: McPa2SkillEvidenceInput[] = [
      {
        skillId: '1',
        skillKey: 'adobe_indesign',
        skillName: 'Adobe InDesign',
        skillType: 'TOOL',
        evidenceLevel: 'STRONG',
        evidenceStrength: 80,
        evidenceConfidence: 0.9,
      },
      {
        skillId: '2',
        skillKey: 'adobe_photoshop',
        skillName: 'Adobe Photoshop',
        skillType: 'TOOL',
        evidenceLevel: 'STRONG',
        evidenceStrength: 75,
        evidenceConfidence: 0.85,
      },
    ];
    const mappings: McPa2MappingInput[] = [
      {
        skillId: '1',
        specialtyCode: 'VISUAL_EDITORIAL',
        specialtyId: codeToId.VISUAL_EDITORIAL,
        weight: 0.55,
        mappingType: 'PRIMARY',
      },
      {
        skillId: '2',
        specialtyCode: 'VISUAL_GRAPHIC',
        specialtyId: codeToId.VISUAL_GRAPHIC,
        weight: 0.4,
        mappingType: 'PRIMARY',
      },
    ];
    const cfg = getMcPa2EngineConfigVisualDesignV110();
    const result = runMcPa2Engine({
      domainCode: 'VISUAL_DESIGN',
      config: cfg,
      specialties,
      mappings,
      skills,
    });
    for (const r of result.specialtyResults.filter((s) => s.mappedSkillCount > 0)) {
      expect(r.presentationStatus).toBe('HIDDEN');
      expect(
        r.reasons.some((x) => x.includes('anti-tool')),
      ).toBe(true);
    }
    expect(result.activeCount).toBe(0);
    expect(result.emergentCount).toBe(0);
  });

  it('primaryStrong no domina Strength bajo ranking lexicográfico', () => {
    expect(
      compareSpecialtyLexicographic(
        {
          evidencedSkillCount: 11,
          coverage: 1,
          strength: 31,
          confidence: 0.83,
          primaryStrongCount: 3,
          mappedSkillCount: 11,
          specialtyCode: 'SOFTWARE_FRONTEND',
        },
        {
          evidencedSkillCount: 11,
          coverage: 1,
          strength: 48.1,
          confidence: 0.85,
          primaryStrongCount: 1,
          mappedSkillCount: 11,
          specialtyCode: 'SOFTWARE_BACKEND',
        },
      ),
    ).toBeGreaterThan(0); // Backend primero (compare a,b > 0 ⇒ b before a)
  });
});
