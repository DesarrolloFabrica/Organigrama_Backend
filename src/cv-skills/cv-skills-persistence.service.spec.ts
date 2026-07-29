import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import {
  CvSkillsPersistenceService,
  sanitizePersistenceErrorMessage,
  toCanonicalKey,
} from './cv-skills-persistence.service';
import { CvSkillsAliasConflictError } from './cv-skills-persistence.types';
import type { ExtractedCvSkills } from './cv-skills.types';
import { CvExtraction } from './entities/cv-extraction.entity';
import { CvExtractionCertification } from './entities/cv-extraction-certification.entity';
import { CvExtractionLanguage } from './entities/cv-extraction-language.entity';
import { CvExtractionSkill } from './entities/cv-extraction-skill.entity';
import { CvSkill } from './entities/cv-skill.entity';
import { CvSkillAlias } from './entities/cv-skill-alias.entity';

function sampleResult(overrides?: Partial<ExtractedCvSkills>): ExtractedCvSkills {
  return {
    categories: [
      {
        category: 'Frontend',
        evidence: 'Habilidades: React, Tailwind',
        skills: [
          {
            originalName: 'react',
            normalizedName: 'React',
            skillType: 'TECHNOLOGY',
            confidence: 0.95,
            isExplicit: true,
            level: null,
            evidenceItems: [
              {
                sourceType: 'SKILLS_SECTION',
                evidenceText: 'Habilidades: React, Tailwind',
                occurrenceIndex: 1,
              },
            ],
          },
          {
            originalName: 'Tailwind',
            normalizedName: 'Tailwind CSS',
            skillType: 'TOOL',
            confidence: 0.9,
            isExplicit: true,
            evidenceItems: [
              {
                sourceType: 'SKILLS_SECTION',
                evidenceText: 'Habilidades: React, Tailwind',
                occurrenceIndex: 1,
              },
            ],
          },
        ],
      },
    ],
    languages: [
      {
        name: 'Inglés',
        level: 'B2',
        isCertified: false,
        evidence: 'Inglés B2',
      },
    ],
    certifications: [
      {
        name: 'AWS Cloud Practitioner',
        issuer: 'Amazon',
        evidence: 'Certificación AWS',
      },
    ],
    warnings: ['pocas skills soft'],
    ...overrides,
  };
}

function runningExtraction(partial?: Partial<CvExtraction>): CvExtraction {
  return {
    id: '10',
    person_id: '1082',
    person_cv_id: '55',
    document: '80723984',
    drive_file_id: 'drive-abc',
    drive_file_name: '80723984.pdf',
    pdf_sha256: 'a'.repeat(64),
    pdf_byte_size: '1000',
    model: 'gemini-3.6-flash',
    prompt_version: 'c1-2026-07-21',
    extractor_version: '1.0.0',
    status: 'RUNNING',
    is_active: false,
    started_at: new Date('2026-07-22T12:00:00Z'),
    finished_at: null,
    error_message: null,
    warnings: [],
    raw_result: null,
    skills_count: null,
    created_at: new Date('2026-07-22T12:00:00Z'),
    updated_at: new Date('2026-07-22T12:00:00Z'),
    ...partial,
  } as CvExtraction;
}

describe('toCanonicalKey / sanitizePersistenceErrorMessage', () => {
  it('normaliza clave canónica (acentos y espacios→_)', () => {
    expect(toCanonicalKey('  Tailwind  CSS ')).toBe('tailwind_css');
    expect(toCanonicalKey('Gestión')).toBe('gestion');
  });

  it('sanea mensajes de error', () => {
    const msg = sanitizePersistenceErrorMessage(
      'Bearer secret-token-xyz failed\n    at Object.<anonymous>',
    );
    expect(msg).toContain('Bearer [REDACTED]');
    expect(msg).not.toContain('secret-token');
    expect(msg).not.toContain('at Object');
  });

  it('redacta connection strings y API keys', () => {
    expect(
      sanitizePersistenceErrorMessage(
        'postgres://user:pass@host/db AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      ),
    ).toMatch(/postgresql:\/\/\[REDACTED\]/);
    expect(
      sanitizePersistenceErrorMessage(
        'postgres://user:pass@host/db AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567',
      ),
    ).toContain('[REDACTED]');
  });
});

describe('CvSkillsPersistenceService', () => {
  let service: CvSkillsPersistenceService;
  let extractionsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    isTransactionActive: boolean;
    manager: typeof manager;
  };
  let dataSource: { createQueryRunner: jest.Mock };

  beforeEach(async () => {
    extractionsRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => ({ ...x })),
      save: jest.fn(async (x) => ({ id: x.id ?? '99', ...x })),
    };

    const updateExecute = jest.fn().mockResolvedValue({ affected: 1 });
    const updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: updateExecute,
    };

    manager = {
      findOne: jest.fn(),
      create: jest.fn((_Entity, data) => ({ ...data })),
      save: jest.fn(async (_Entity, data) => {
        if (data.id) return data;
        return { id: String(Math.floor(Math.random() * 10000) + 1), ...data };
      }),
      query: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: '' }]),
      createQueryBuilder: jest.fn(() => updateQb),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager,
    };

    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CvSkillsPersistenceService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(CvExtraction), useValue: extractionsRepo },
      ],
    }).compile();

    service = moduleRef.get(CvSkillsPersistenceService);
  });

  it('detecta una extracción exitosa equivalente', async () => {
    const existing = runningExtraction({ id: '7', status: 'SUCCEEDED', is_active: true });
    extractionsRepo.findOne.mockResolvedValue(existing);

    const found = await service.findExistingSucceededExtraction({
      personId: 1082,
      pdfSha256: 'a'.repeat(64),
      model: 'gemini-3.6-flash',
      promptVersion: 'c1-2026-07-21',
      extractorVersion: '1.0.0',
    });

    expect(found?.id).toBe('7');
    expect(extractionsRepo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ status: 'SUCCEEDED' }),
    });
  });

  it('MC1.5.2C: hash PDF distinto no reutiliza extracción (idempotencia por sha256)', async () => {
    extractionsRepo.findOne.mockResolvedValue(null);

    const found = await service.findExistingSucceededExtraction({
      personId: 1163,
      pdfSha256: '467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6',
      model: 'gemini-3.6-flash',
      promptVersion: 'c2.1-2026-07-24',
      extractorVersion: '1.1.0',
    });

    expect(found).toBeNull();
    expect(extractionsRepo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({
        person_id: '1163',
        pdf_sha256:
          '467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6',
        status: 'SUCCEEDED',
      }),
    });
  });

  it('crea una extracción RUNNING', async () => {
    extractionsRepo.save.mockImplementation(async (x) => ({ id: '11', ...x }));

    const created = await service.createRunningExtraction({
      personId: 1082,
      personCvId: 55,
      document: '80723984',
      driveFileId: 'drive-abc',
      driveFileName: '80723984.pdf',
      pdfSha256: 'b'.repeat(64),
      pdfByteSize: 2048,
      model: 'gemini-3.6-flash',
      promptVersion: 'c1-2026-07-21',
      extractorVersion: '1.0.0',
    });

    expect(created.status).toBe('RUNNING');
    expect(created.is_active).toBe(false);
    expect(created.finished_at).toBeNull();
    expect(created.pdf_byte_size).toBe('2048');
  });

  it('completa y activa una extracción; desactiva la anterior solo tras inserts', async () => {
    const running = runningExtraction();
    const callOrder: string[] = [];

    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) return null;
      if (Entity === CvSkillAlias) return null;
      return null;
    });

    manager.save.mockImplementation(async (Entity, data) => {
      if (Entity === CvSkill) {
        callOrder.push('skill');
        return { id: data.normalized_key === 'react' ? '1' : '2', ...data };
      }
      if (Entity === CvSkillAlias) {
        callOrder.push('alias');
        return { id: 'a1', ...data };
      }
      if (Entity === CvExtractionSkill) {
        callOrder.push('extraction_skill');
        return { id: 'es1', ...data };
      }
      if (Entity === CvExtractionLanguage) {
        callOrder.push('language');
        return { id: 'el1', ...data };
      }
      if (Entity === CvExtractionCertification) {
        callOrder.push('cert');
        return { id: 'ec1', ...data };
      }
      if (Entity === CvExtraction) {
        callOrder.push('activate');
        return data;
      }
      return data;
    });

    const updateExecute = jest.fn().mockImplementation(async () => {
      callOrder.push('deactivate_previous');
      return { affected: 1 };
    });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: updateExecute,
    });

    const completed = await service.completeExtraction('10', sampleResult(), {
      durationMs: 1500,
    });

    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1)',
      [1082],
    );
    expect(completed.status).toBe('SUCCEEDED');
    expect(completed.is_active).toBe(true);
    expect(completed.skills_count).toBe(2);
    expect(completed.warnings).toEqual(['pocas skills soft']);
    expect(completed.raw_result).toMatchObject({
      meta: { durationMs: 1500 },
    });
    expect(queryRunner.commitTransaction).toHaveBeenCalled();

    const deactivateIdx = callOrder.indexOf('deactivate_previous');
    const lastRelationIdx = Math.max(
      callOrder.lastIndexOf('extraction_skill'),
      callOrder.lastIndexOf('language'),
      callOrder.lastIndexOf('cert'),
    );
    expect(deactivateIdx).toBeGreaterThan(lastRelationIdx);
    expect(callOrder.indexOf('activate')).toBeGreaterThan(deactivateIdx);

    const skillSaves = manager.save.mock.calls.filter(
      ([Entity]) => Entity === CvExtractionSkill,
    );
    expect(skillSaves.length).toBe(2);
    const reactRow = skillSaves.find(
      ([, data]) => data.original_name === 'react',
    )?.[1];
    expect(reactRow.evidence).toBe('Habilidades: React, Tailwind');
    expect(reactRow.evidence_items).toEqual([
      {
        sourceType: 'SKILLS_SECTION',
        evidenceText: 'Habilidades: React, Tailwind',
        occurrenceIndex: 1,
      },
    ]);
    expect(completed.raw_result).toMatchObject({
      normalizedResult: expect.objectContaining({
        categories: expect.any(Array),
      }),
      meta: expect.objectContaining({ durationMs: 1500 }),
    });
  });

  it('consolida evidenceItems de la misma skill en dos categorías', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) return null;
      if (Entity === CvSkillAlias) return null;
      return null;
    });
    manager.save.mockImplementation(async (Entity, data) => {
      if (Entity === CvSkill) {
        return { id: '1', ...data };
      }
      if (Entity === CvSkillAlias) {
        return { id: 'a1', ...data };
      }
      if (Entity === CvExtractionSkill) {
        return { id: 'es1', ...data };
      }
      if (Entity === CvExtraction) return data;
      return data;
    });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    const result = sampleResult({
      categories: [
        {
          category: 'Frontend',
          evidence: 'Skills: React',
          skills: [
            {
              originalName: 'React',
              normalizedName: 'React',
              skillType: 'TECHNOLOGY',
              confidence: 0.8,
              isExplicit: true,
              evidenceItems: [
                {
                  sourceType: 'SKILLS_SECTION',
                  evidenceText: 'Skills: React',
                  occurrenceIndex: 1,
                },
              ],
            },
          ],
        },
        {
          category: 'Experiencia',
          evidence: 'Experiencia con React',
          skills: [
            {
              originalName: 'React',
              normalizedName: 'React',
              skillType: 'TECHNOLOGY',
              confidence: 0.95,
              isExplicit: true,
              evidenceItems: [
                {
                  sourceType: 'WORK_EXPERIENCE',
                  evidenceText: 'Desarrollo de SPAs con React',
                  occurrenceIndex: 1,
                },
              ],
            },
          ],
        },
      ],
      languages: [],
      certifications: [],
      warnings: [],
    });

    const completed = await service.completeExtraction('10', result, {
      durationMs: 100,
    });

    expect(completed.skills_count).toBe(1);
    const skillSave = manager.save.mock.calls.find(
      ([Entity]) => Entity === CvExtractionSkill,
    )?.[1];
    expect(skillSave.confidence).toBe('0.950');
    expect(skillSave.evidence).toBe('Desarrollo de SPAs con React');
    expect(skillSave.evidence_items).toEqual([
      {
        sourceType: 'WORK_EXPERIENCE',
        evidenceText: 'Desarrollo de SPAs con React',
        occurrenceIndex: 1,
      },
      {
        sourceType: 'SKILLS_SECTION',
        evidenceText: 'Skills: React',
        occurrenceIndex: 2,
      },
    ]);
  });

  it('una extracción fallida no reemplaza la activa', async () => {
    extractionsRepo.findOne.mockResolvedValue(
      runningExtraction({ id: '20', status: 'RUNNING', is_active: false }),
    );
    extractionsRepo.save.mockImplementation(async (x) => x);

    const failed = await service.failExtraction('20', {
      errorStage: 'GEMINI',
      errorMessage: 'timeout',
    });

    expect(failed.status).toBe('FAILED');
    expect(failed.is_active).toBe(false);
    expect(failed.error_message).toMatch(/^\[GEMINI\]/);
    // No hay update masivo de is_active de otras filas.
    expect(dataSource.createQueryRunner).not.toHaveBeenCalled();
  });

  it('reutiliza una skill existente', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) {
        return {
          id: '99',
          normalized_key: 'react',
          skill_type: 'TECHNOLOGY',
          is_active: true,
        };
      }
      if (Entity === CvSkillAlias) return null;
      return null;
    });

    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    await service.completeExtraction(
      '10',
      sampleResult({
        categories: [
          {
            category: 'FE',
            evidence: 'React',
            skills: [
              {
                originalName: 'React',
                normalizedName: 'React',
                skillType: 'TECHNOLOGY',
                confidence: 1,
                isExplicit: true,
              },
            ],
          },
        ],
        languages: [],
        certifications: [],
        warnings: [],
      }),
    );

    const skillCreates = manager.save.mock.calls.filter((c) => c[0] === CvSkill);
    expect(skillCreates).toHaveLength(0);
    const itemSaves = manager.save.mock.calls.filter(
      (c) => c[0] === CvExtractionSkill,
    );
    expect(itemSaves[0][1].skill_id).toBe('99');
  });

  it('crea una skill inexistente', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      return null;
    });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    await service.completeExtraction(
      '10',
      sampleResult({
        categories: [
          {
            category: 'FE',
            evidence: 'Vue',
            skills: [
              {
                originalName: 'Vue',
                normalizedName: 'Vue.js',
                skillType: 'TECHNOLOGY',
                confidence: 0.8,
                isExplicit: true,
              },
            ],
          },
        ],
        languages: [],
        certifications: [],
        warnings: [],
      }),
    );

    const skillCreates = manager.save.mock.calls.filter((c) => c[0] === CvSkill);
    expect(skillCreates.length).toBeGreaterThanOrEqual(1);
    expect(skillCreates[0][1].normalized_key).toBe('vue.js');
  });

  it('no duplica aliases', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) {
        return {
          id: '2',
          normalized_key: 'tailwind_css',
          skill_type: 'TOOL',
          is_active: true,
        };
      }
      if (Entity === CvSkillAlias && opts?.where?.alias_key === 'tailwind') {
        return { id: 'a1', skill_id: '2', alias_key: 'tailwind' };
      }
      return null;
    });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    await service.completeExtraction(
      '10',
      sampleResult({
        categories: [
          {
            category: 'CSS',
            evidence: 'Tailwind',
            skills: [
              {
                originalName: 'Tailwind',
                normalizedName: 'Tailwind CSS',
                skillType: 'TOOL',
                confidence: 0.9,
                isExplicit: true,
              },
            ],
          },
        ],
        languages: [],
        certifications: [],
        warnings: [],
      }),
    );

    const aliasSaves = manager.save.mock.calls.filter((c) => c[0] === CvSkillAlias);
    expect(aliasSaves).toHaveLength(0);
  });

  it('rechaza conflicto de alias', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) {
        return {
          id: '5',
          normalized_key: 'tailwind_css',
          skill_type: 'TOOL',
          is_active: true,
        };
      }
      if (Entity === CvSkillAlias) {
        return { id: 'a9', skill_id: '999', alias_key: 'tailwind' };
      }
      return null;
    });

    await expect(
      service.completeExtraction(
        '10',
        sampleResult({
          categories: [
            {
              category: 'CSS',
              evidence: 'Tailwind',
              skills: [
                {
                  originalName: 'Tailwind',
                  normalizedName: 'Tailwind CSS',
                  skillType: 'TOOL',
                  confidence: 0.9,
                  isExplicit: true,
                },
              ],
            },
          ],
          languages: [],
          certifications: [],
          warnings: [],
        }),
      ),
    ).rejects.toBeInstanceOf(CvSkillsAliasConflictError);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('persiste languages y certifications', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) {
        return {
          id: '1',
          normalized_key: 'react',
          skill_type: 'TECHNOLOGY',
          is_active: true,
        };
      }
      return null;
    });
    manager.createQueryBuilder.mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    });

    await service.completeExtraction('10', sampleResult());

    const langs = manager.save.mock.calls.filter(
      (c) => c[0] === CvExtractionLanguage,
    );
    const certs = manager.save.mock.calls.filter(
      (c) => c[0] === CvExtractionCertification,
    );
    expect(langs).toHaveLength(1);
    expect(langs[0][1].name_key).toBe('ingles');
    expect(certs).toHaveLength(1);
    expect(certs[0][1].issuer).toBe('Amazon');
  });

  it('hace rollback si falla una relación', async () => {
    const running = runningExtraction();
    manager.findOne.mockImplementation(async (Entity, opts) => {
      if (Entity === CvExtraction) {
        if (opts?.where?.status === 'SUCCEEDED') return null;
        return { ...running };
      }
      if (Entity === CvSkill) {
        return {
          id: '1',
          normalized_key: 'react',
          skill_type: 'TECHNOLOGY',
          is_active: true,
        };
      }
      return null;
    });
    manager.save.mockImplementation(async (Entity, data) => {
      if (Entity === CvExtractionSkill) {
        throw new Error('insert extraction_skill failed');
      }
      return { id: 'x', ...data };
    });

    await expect(
      service.completeExtraction(
        '10',
        sampleResult({
          categories: [
            {
              category: 'FE',
              evidence: 'React',
              skills: [
                {
                  originalName: 'React',
                  normalizedName: 'React',
                  skillType: 'TECHNOLOGY',
                  confidence: 1,
                  isExplicit: true,
                },
              ],
            },
          ],
          languages: [],
          certifications: [],
          warnings: [],
        }),
      ),
    ).rejects.toThrow(/extraction_skill failed/);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('maneja carrera por idempotencia recuperando SUCCEEDED existente', async () => {
    const running = runningExtraction({ id: '10' });
    const winner = runningExtraction({
      id: '77',
      status: 'SUCCEEDED',
      is_active: true,
    });

    manager.findOne
      .mockResolvedValueOnce({ ...running }) // first load
      .mockResolvedValueOnce({ ...running }) // after lock
      .mockResolvedValueOnce(winner); // existing SUCCEEDED

    manager.save.mockImplementation(async (_E, data) => data);

    const result = await service.completeExtraction('10', sampleResult());
    expect(result.id).toBe('77');
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('persistSucceededExtraction retorna ALREADY_EXISTS sin crear RUNNING', async () => {
    const existing = runningExtraction({
      id: '3',
      status: 'SUCCEEDED',
      is_active: true,
    });
    extractionsRepo.findOne.mockResolvedValue(existing);

    const out = await service.persistSucceededExtraction({
      personId: 1082,
      personCvId: 55,
      document: '80723984',
      driveFileId: 'd',
      driveFileName: '80723984.pdf',
      pdfSha256: 'a'.repeat(64),
      pdfByteSize: 100,
      model: 'gemini-3.6-flash',
      promptVersion: 'c1-2026-07-21',
      extractorVersion: '1.0.0',
      result: sampleResult(),
    });

    expect(out.status).toBe('ALREADY_EXISTS');
    expect(extractionsRepo.create).not.toHaveBeenCalled();
  });

  it('detecta unique violation (código 23505)', () => {
    const err = new QueryFailedError('INSERT', [], {
      code: '23505',
      message: 'duplicate key',
    } as never);
    expect(
      (service as unknown as { isUniqueViolation(e: unknown): boolean })
        .isUniqueViolation(err),
    ).toBe(true);
  });
});
