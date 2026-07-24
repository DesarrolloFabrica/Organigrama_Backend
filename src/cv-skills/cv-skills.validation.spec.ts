import { ConfigService } from '@nestjs/config';
import { CvSkillsExtractionService } from './cv-skills-extraction.service';
import {
  addsInterpretedContext,
  isBareGenericSkillName,
  resolveNormalizedName,
} from './cv-skills.normalize';
import {
  CvSkillsValidationError,
  validateExtractedCvSkills,
} from './cv-skills.validation';

describe('normalize (C.1 / Fase A)', () => {
  it('no normaliza implementación → Implementación de UI (descarta genérica)', () => {
    const result = resolveNormalizedName(
      'implementación',
      'Implementación de UI',
      'skills[0]',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.warning).toMatch(/genérica aislada/i);
    }
    expect(addsInterpretedContext('implementación', 'Implementación de UI')).toBe(
      true,
    );
    expect(isBareGenericSkillName('implementación')).toBe(true);
  });

  it('normaliza Tailwind → Tailwind CSS', () => {
    const result = resolveNormalizedName('Tailwind', 'Tailwind', 'skills[0]');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedName).toBe('Tailwind CSS');
      expect(result.warning).toBeUndefined();
    }
  });

  it.each([
    ['Express', 'Express.js', 'Express.js'],
    ['express', 'Something', 'Express.js'],
    ['Express.js', 'Express.js', 'Express.js'],
    ['Golang', 'Go', 'Go'],
    ['Go', 'Go', 'Go'],
    ['Cloud SQL', 'Google Cloud SQL', 'Google Cloud SQL'],
    ['Google Cloud SQL', 'Google Cloud SQL', 'Google Cloud SQL'],
    ['AWS', 'Amazon Web Services', 'Amazon Web Services'],
    ['Amazon Web Services', 'Amazon Web Services', 'Amazon Web Services'],
    ['S3', 'Amazon S3', 'Amazon S3'],
    ['Amazon S3', 'Amazon S3', 'Amazon S3'],
    ['CloudFront', 'Amazon CloudFront', 'Amazon CloudFront'],
    ['Amazon CloudFront', 'Amazon CloudFront', 'Amazon CloudFront'],
    ['Azure', 'Microsoft Azure', 'Microsoft Azure'],
    ['Microsoft Azure', 'Microsoft Azure', 'Microsoft Azure'],
  ] as const)(
    'alias seguro: %s → %s',
    (original, proposed, expected) => {
      const result = resolveNormalizedName(original, proposed, 'skills[0]');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.normalizedName).toBe(expected);
        expect(result.warning).toBeUndefined();
      }
    },
  );

  it('tolera espacios externos en alias ( Express  → Express.js )', () => {
    const result = resolveNormalizedName('  Express  ', '  Express.js  ', 'x');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedName).toBe('Express.js');
    }
  });

  it('sin alias: conserva original y warning (no descarta)', () => {
    const result = resolveNormalizedName(
      'Herramienta X',
      'Plataforma Empresarial Herramienta X',
      'skills[0]',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedName).toBe('Herramienta X');
      expect(result.warning).toMatch(/se conservó el original/i);
      expect(result.warning).toMatch(/Plataforma Empresarial Herramienta X/);
    }
  });

  it('conserva skill con contexto explícito (no genérica aislada)', () => {
    const result = resolveNormalizedName(
      'diseño de piezas gráficas',
      'Diseño de piezas gráficas',
      'skills[0]',
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalizedName).toBe('Diseño de piezas gráficas');
    }
  });
});

describe('validateExtractedCvSkills', () => {
  const validFixture = {
    categories: [
      {
        category: 'Frontend',
        skills: [
          {
            originalName: 'Tailwind',
            normalizedName: 'Tailwind CSS',
            skillType: 'TECHNOLOGY',
            confidence: 1,
            isExplicit: true,
            evidenceItems: [
              {
                sourceType: 'SKILLS_SECTION',
                evidenceText: 'Frontend: React, TypeScript, Tailwind, Vite.',
                occurrenceIndex: 1,
              },
            ],
          },
        ],
        evidence: 'Frontend: React, TypeScript, Tailwind, Vite.',
      },
    ],
    languages: [
      {
        name: 'Inglés',
        level: 'B2',
        isCertified: true,
        evidence: 'Inglés B2 certificado.',
      },
    ],
    certifications: [
      {
        name: 'AWS Cloud Practitioner',
        issuer: 'Amazon',
        evidence: 'Certificación AWS Cloud Practitioner — Amazon.',
      },
    ],
    warnings: [],
  };

  it('acepta un fixture válido', () => {
    const result = validateExtractedCvSkills(validFixture);
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].skills[0].normalizedName).toBe('Tailwind CSS');
    expect(result.categories[0].skills[0].evidenceItems).toHaveLength(1);
    expect(result.languages[0].name).toBe('Inglés');
    expect(result.certifications[0].name).toBe('AWS Cloud Practitioner');
    expect(result.warnings).toEqual([]);
  });

  it('rechaza una estructura raíz inválida', () => {
    expect(() => validateExtractedCvSkills(null)).toThrow(
      CvSkillsValidationError,
    );
    expect(() => validateExtractedCvSkills({ categories: [] })).toThrow(
      /languages/,
    );
  });

  it('descarta una skill inválida y agrega advertencia', () => {
    const raw = {
      ...validFixture,
      categories: [
        {
          category: 'Frontend',
          evidence: 'Frontend: React, Foo.',
          skills: [
            {
              originalName: 'React',
              normalizedName: 'React',
              skillType: 'TECHNOLOGY',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'Inventada',
              normalizedName: 'Inventada',
              skillType: 'NOT_A_TYPE',
              confidence: 0.9,
              isExplicit: true,
            },
          ],
        },
      ],
      warnings: ['Sin sección HABILIDADES CLAVE clara.'],
    };

    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills).toHaveLength(1);
    expect(result.categories[0].skills[0].originalName).toBe('React');
    expect(
      result.warnings.some((w) => w.includes('skillType inválido')),
    ).toBe(true);
    expect(result.warnings).toContain('Sin sección HABILIDADES CLAVE clara.');
  });

  it('aplica Tailwind → Tailwind CSS al validar', () => {
    const raw = {
      ...validFixture,
      categories: [
        {
          category: 'Frontend',
          evidence: 'Frontend: Tailwind, Vite.',
          skills: [
            {
              originalName: 'Tailwind',
              normalizedName: 'Tailwind',
              skillType: 'TECHNOLOGY',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
    };
    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills[0].normalizedName).toBe('Tailwind CSS');
  });

  it('aplica alias seguros Fase A sin descartar skills', () => {
    const raw = {
      categories: [
        {
          category: 'Backend',
          evidence: 'Backend: Express, Golang.',
          skills: [
            {
              originalName: 'Express',
              normalizedName: 'Express.js',
              skillType: 'TECHNOLOGY',
              confidence: 1,
              isExplicit: true,
              level: null,
            },
            {
              originalName: 'Golang',
              normalizedName: 'Go',
              skillType: 'TECHNOLOGY',
              confidence: 0.9,
              isExplicit: true,
            },
            {
              originalName: 'AWS',
              normalizedName: 'Amazon Web Services',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'S3',
              normalizedName: 'Amazon S3',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'CloudFront',
              normalizedName: 'Amazon CloudFront',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'Azure',
              normalizedName: 'Microsoft Azure',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'Cloud SQL',
              normalizedName: 'Google Cloud SQL',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    };

    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills).toHaveLength(7);
    expect(result.categories[0].skills.map((s) => s.normalizedName)).toEqual([
      'Express.js',
      'Go',
      'Amazon Web Services',
      'Amazon S3',
      'Amazon CloudFront',
      'Microsoft Azure',
      'Google Cloud SQL',
    ]);
    expect(result.categories[0].skills[0].confidence).toBe(1);
    expect(result.categories[0].skills[0].isExplicit).toBe(true);
    expect(
      result.warnings.filter((w) => !w.includes('heredó evidence')),
    ).toEqual([]);
  });

  it('conserva skill sin alias cuando la propuesta añade contexto (con warning)', () => {
    const raw = {
      categories: [
        {
          category: 'Tools',
          evidence: 'Tools: Herramienta X.',
          skills: [
            {
              originalName: 'Herramienta X',
              normalizedName: 'Plataforma Empresarial Herramienta X',
              skillType: 'TOOL',
              confidence: 0.8,
              isExplicit: true,
              level: 'avanzado',
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    };

    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills).toHaveLength(1);
    const skill = result.categories[0].skills[0];
    expect(skill.originalName).toBe('Herramienta X');
    expect(skill.normalizedName).toBe('Herramienta X');
    expect(skill.skillType).toBe('TOOL');
    expect(skill.confidence).toBe(0.8);
    expect(skill.isExplicit).toBe(true);
    expect(skill.level).toBe('avanzado');
    expect(result.warnings.some((w) => w.includes('se conservó el original'))).toBe(
      true,
    );
  });

  it('descarta skill genérica aislada con warning (implementación)', () => {
    const raw = {
      ...validFixture,
      categories: [
        {
          category: 'UX/UI',
          evidence: 'UX/UI: Figma, prototipado e implementación.',
          skills: [
            {
              originalName: 'Figma',
              normalizedName: 'Figma',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'implementación',
              normalizedName: 'Implementación de UI',
              skillType: 'PROFESSIONAL_KNOWLEDGE',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
    };

    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills.map((s) => s.originalName)).toEqual([
      'Figma',
    ]);
    expect(
      result.warnings.some(
        (w) =>
          w.includes('implementación') &&
          (w.includes('genérica') || w.includes('contexto')),
      ),
    ).toBe(true);
    expect(
      result.categories[0].skills.some(
        (s) => s.normalizedName === 'Implementación de UI',
      ),
    ).toBe(false);
  });

  it('conserva skill explícita de experiencia aunque no esté en HABILIDADES CLAVE', () => {
    const raw = {
      categories: [
        {
          category: 'Proyectos',
          evidence:
            'Desarrollo de cómic (Blender): modelado y texturizado de personajes.',
          skills: [
            {
              originalName: 'modelado',
              normalizedName: 'Modelado',
              skillType: 'PROFESSIONAL_KNOWLEDGE',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'texturizado',
              normalizedName: 'Texturizado',
              skillType: 'PROFESSIONAL_KNOWLEDGE',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    };

    const result = validateExtractedCvSkills(raw);
    expect(result.categories[0].skills).toHaveLength(2);
    expect(result.categories[0].skills.map((s) => s.originalName)).toEqual([
      'modelado',
      'texturizado',
    ]);
  });

  it('conserva Motion Graphics, Rive y Lottie como skills distintas (no equivalentes)', () => {
    const raw = {
      categories: [
        {
          category: '3D y Motion',
          evidence: '3D y Motion: Blender, Motion Graphics.',
          skills: [
            {
              originalName: 'Motion Graphics',
              normalizedName: 'Motion Graphics',
              skillType: 'PROFESSIONAL_KNOWLEDGE',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
        {
          category: 'Interactividad y animación',
          evidence: 'Interactividad y animación: Rive, Lottie (LottieFiles).',
          skills: [
            {
              originalName: 'Rive',
              normalizedName: 'Rive',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
            {
              originalName: 'Lottie (LottieFiles)',
              normalizedName: 'Lottie',
              skillType: 'TOOL',
              confidence: 1,
              isExplicit: true,
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    };

    const result = validateExtractedCvSkills(raw);
    const names = result.categories.flatMap((c) =>
      c.skills.map((s) => s.originalName),
    );
    expect(names).toEqual([
      'Motion Graphics',
      'Rive',
      'Lottie (LottieFiles)',
    ]);
    expect(result.categories).toHaveLength(2);
  });
});

describe('CvSkillsExtractionService (config)', () => {
  it('falla de forma clara si falta GEMINI_API_KEY', async () => {
    const config = {
      get: (key: string) => (key === 'GEMINI_API_KEY' ? undefined : undefined),
    } as ConfigService;

    const service = new CvSkillsExtractionService(config);
    await expect(service.extractSkills(Buffer.from('%PDF-1.4'))).rejects.toThrow(
      /GEMINI_API_KEY/,
    );
  });

  it('falla si el Buffer está vacío', async () => {
    const config = {
      get: () => 'fake-key',
    } as unknown as ConfigService;

    const service = new CvSkillsExtractionService(config);
    await expect(service.extractSkills(Buffer.alloc(0))).rejects.toThrow(
      /vacío/,
    );
  });
});
