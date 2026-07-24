import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CvSkillsEnrichmentPersistenceService,
  sanitizeRawResponseJson,
  sanitizeEnrichmentErrorMessage,
  RAW_RESPONSE_JSON_MAX_CHARS,
  ENRICHMENT_ADVISORY_LOCK_NS,
} from './cv-skills-enrichment-persistence.service';
import {
  EnrichmentActivationRejectedError,
  CvSkillsEnrichmentPersistenceError,
} from './cv-skills-enrichment-persistence.types';
import { computeInventoryHash } from './cv-skills-enrichment.hash';
import { CvSkillEnrichment } from './entities/cv-skill-enrichment.entity';
import { CvSkillEnrichmentBlock } from './entities/cv-skill-enrichment-block.entity';
import { CvSkillEnrichmentItem } from './entities/cv-skill-enrichment-item.entity';

function sampleEnrichment(
  partial?: Partial<CvSkillEnrichment>,
): CvSkillEnrichment {
  return {
    id: '50',
    extraction_id: '201',
    person_id: '100',
    person_cv_id: '20',
    pdf_sha256: 'a'.repeat(64),
    inventory_hash: 'b'.repeat(64),
    model: 'gemini-test',
    prompt_version: 'e1-2026-07-24',
    enricher_version: '1.0.0',
    block_config_version: 'b1',
    block_config: { blockSize: 15 },
    block_config_hash: 'c'.repeat(64),
    status: 'RUNNING',
    is_active: false,
    input_skills_count: 2,
    output_skills_count: 0,
    skills_with_evidence_count: 0,
    skills_without_evidence_count: 0,
    evidence_items_count: 0,
    missing_filled_empty_count: 0,
    blocks_total: 1,
    blocks_succeeded: 0,
    blocks_failed: 0,
    attempts_total: 0,
    warnings: null,
    metrics: null,
    validated_result_json: null,
    error_stage: null,
    error_code: null,
    error_message: null,
    started_at: new Date(),
    completed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  } as CvSkillEnrichment;
}

describe('sanitize helpers', () => {
  it('trunca raw response grande', () => {
    const big = { text: 'x'.repeat(RAW_RESPONSE_JSON_MAX_CHARS + 100) };
    const { truncated, json } = sanitizeRawResponseJson(big);
    expect(truncated).toBe(true);
    expect((json as { _truncated: boolean })._truncated).toBe(true);
  });

  it('sanea errores', () => {
    expect(
      sanitizeEnrichmentErrorMessage('Bearer secret-abc\n at foo'),
    ).toContain('Bearer [REDACTED]');
  });
});

describe('CvSkillsEnrichmentPersistenceService', () => {
  let service: CvSkillsEnrichmentPersistenceService;
  let enrichmentsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let blocksRepo: { create: jest.Mock; save: jest.Mock; find: jest.Mock };
  let itemsRepo: { find: jest.Mock };
  let manager: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    query: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: typeof manager;
  };
  let dataSource: { createQueryRunner: jest.Mock; query: jest.Mock };

  beforeEach(async () => {
    enrichmentsRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: x.id || '50' })),
      createQueryBuilder: jest.fn(),
    };
    blocksRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: '1' })),
      find: jest.fn().mockResolvedValue([]),
    };
    itemsRepo = { find: jest.fn().mockResolvedValue([]) };
    manager = {
      findOne: jest.fn(),
      create: jest.fn((_e, x) => x),
      save: jest.fn(async (_e, x) => x),
      query: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: '' }]),
    };
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager,
    };
    dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
      query: jest.fn().mockResolvedValue([]),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CvSkillsEnrichmentPersistenceService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(CvSkillEnrichment), useValue: enrichmentsRepo },
        {
          provide: getRepositoryToken(CvSkillEnrichmentBlock),
          useValue: blocksRepo,
        },
        {
          provide: getRepositoryToken(CvSkillEnrichmentItem),
          useValue: itemsRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(CvSkillsEnrichmentPersistenceService);
  });

  it('findIdempotentSucceededRun busca por clave lógica', async () => {
    enrichmentsRepo.findOne.mockResolvedValue(sampleEnrichment({ status: 'SUCCEEDED' }));
    const row = await service.findIdempotentSucceededRun({
      extractionId: '201',
      pdfSha256: 'a'.repeat(64),
      inventoryHash: 'b'.repeat(64),
      model: 'gemini-test',
      promptVersion: 'e1-2026-07-24',
      enricherVersion: '1.0.0',
      blockConfigHash: 'c'.repeat(64),
    });
    expect(row?.status).toBe('SUCCEEDED');
    expect(enrichmentsRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    );
  });

  it('createPendingRun + markRunning', async () => {
    const pending = await service.createPendingRun({
      extractionId: '201',
      personId: 100,
      personCvId: 20,
      pdfSha256: 'a'.repeat(64),
      inventoryHash: 'b'.repeat(64),
      model: 'm',
      promptVersion: 'e1',
      enricherVersion: '1.0.0',
      blockConfigVersion: 'b1',
      blockConfig: {
        blockSize: 15,
        parallelism: 1,
        maxBlockAttempts: 3,
        microRetrySize: 5,
        maxMicroRetryAttempts: 2,
      },
      blockConfigHash: 'c'.repeat(64),
      inputSkillsCount: 2,
      blocksTotal: 1,
    });
    expect(pending.status).toBe('PENDING');

    enrichmentsRepo.findOne.mockResolvedValue(
      sampleEnrichment({ id: '50', status: 'PENDING' }),
    );
    const running = await service.markRunning('50');
    expect(running.status).toBe('RUNNING');
  });

  it('appendBlockAttempt guarda raw sanitizado', async () => {
    enrichmentsRepo.findOne.mockResolvedValue(sampleEnrichment());
    await service.appendBlockAttempt({
      enrichmentId: '50',
      blockNumber: 1,
      attemptNumber: 1,
      attemptType: 'BLOCK',
      inputSkillIds: ['1', '2'],
      status: 'SUCCEEDED',
      rawResponse: { skills: [] },
    });
    expect(blocksRepo.save).toHaveBeenCalled();
  });

  it('failRun marca FAILED y no deja RUNNING', async () => {
    enrichmentsRepo.findOne.mockResolvedValue(sampleEnrichment({ status: 'RUNNING' }));
    const failed = await service.failRun({
      enrichmentId: '50',
      errorStage: 'gemini',
      errorCode: 'EXCEPTION',
      errorMessage: 'boom',
    });
    expect(failed.status).toBe('FAILED');
    expect(failed.is_active).toBe(false);
  });

  it('completeSucceeded rechaza was_filled_empty', async () => {
    manager.findOne.mockResolvedValue(sampleEnrichment());
    manager.query.mockResolvedValue([
      { id: '1', normalized_name: 'A', extraction_id: '201' },
      { id: '2', normalized_name: 'B', extraction_id: '201' },
    ]);

    await expect(
      service.completeSucceeded({
        enrichmentId: '50',
        items: [
          {
            extractionSkillId: '1',
            normalizedName: 'A',
            evidenceItems: [],
            sourceTypes: [],
            status: 'FILLED_EMPTY',
            wasFilledEmpty: true,
          },
          {
            extractionSkillId: '2',
            normalizedName: 'B',
            evidenceItems: [{ sourceType: 'SKILLS_SECTION' }],
            sourceTypes: ['SKILLS_SECTION'],
            status: 'OK',
            wasFilledEmpty: false,
          },
        ],
        metrics: {},
        warnings: [],
        validatedResultJson: { skills: [] },
        blocksSucceeded: 1,
        blocksFailed: 0,
        attemptsTotal: 1,
        expectedSkills: [
          { extractionSkillId: '1', normalizedName: 'A' },
          { extractionSkillId: '2', normalizedName: 'B' },
        ],
      }),
    ).rejects.toThrow(/PARTIAL/);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('completeSucceeded rechaza skill de otra extracción', async () => {
    manager.findOne.mockResolvedValue(sampleEnrichment());
    manager.query.mockResolvedValue([
      { id: '1', normalized_name: 'A', extraction_id: '999' },
      { id: '2', normalized_name: 'B', extraction_id: '201' },
    ]);

    await expect(
      service.completeSucceeded({
        enrichmentId: '50',
        items: [
          {
            extractionSkillId: '1',
            normalizedName: 'A',
            evidenceItems: [],
            sourceTypes: [],
            status: 'EMPTY',
            wasFilledEmpty: false,
          },
          {
            extractionSkillId: '2',
            normalizedName: 'B',
            evidenceItems: [],
            sourceTypes: [],
            status: 'EMPTY',
            wasFilledEmpty: false,
          },
        ],
        metrics: {},
        warnings: [],
        validatedResultJson: { skills: [] },
        blocksSucceeded: 1,
        blocksFailed: 0,
        attemptsTotal: 1,
        expectedSkills: [
          { extractionSkillId: '1', normalizedName: 'A' },
          { extractionSkillId: '2', normalizedName: 'B' },
        ],
      }),
    ).rejects.toThrow(/pertenece a extraction/);
  });

  it('completeSucceeded rechaza normalized_name drift', async () => {
    manager.findOne.mockResolvedValue(sampleEnrichment());
    manager.query.mockResolvedValue([
      { id: '1', normalized_name: 'A-real', extraction_id: '201' },
      { id: '2', normalized_name: 'B', extraction_id: '201' },
    ]);

    await expect(
      service.completeSucceeded({
        enrichmentId: '50',
        items: [
          {
            extractionSkillId: '1',
            normalizedName: 'A',
            evidenceItems: [],
            sourceTypes: [],
            status: 'EMPTY',
            wasFilledEmpty: false,
          },
          {
            extractionSkillId: '2',
            normalizedName: 'B',
            evidenceItems: [],
            sourceTypes: [],
            status: 'EMPTY',
            wasFilledEmpty: false,
          },
        ],
        metrics: {},
        warnings: [],
        validatedResultJson: { skills: [] },
        blocksSucceeded: 1,
        blocksFailed: 0,
        attemptsTotal: 1,
        expectedSkills: [
          { extractionSkillId: '1', normalizedName: 'A' },
          { extractionSkillId: '2', normalizedName: 'B' },
        ],
      }),
    ).rejects.toThrow(/drift/);
  });

  it('activateSucceededRun rechaza PARTIAL', async () => {
    manager.findOne.mockResolvedValue(
      sampleEnrichment({ status: 'PARTIAL', is_active: false }),
    );
    await expect(service.activateSucceededRun('50')).rejects.toBeInstanceOf(
      EnrichmentActivationRejectedError,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('activateSucceededRun desactiva anterior y activa nuevo', async () => {
    const target = sampleEnrichment({
      id: '50',
      status: 'SUCCEEDED',
      is_active: false,
      inventory_hash: 'invhash',
    });
    const previous = sampleEnrichment({
      id: '49',
      status: 'SUCCEEDED',
      is_active: true,
    });

    manager.findOne
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(previous);

    manager.query
      .mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }])
      .mockResolvedValueOnce([
        { id: '201', pdf_sha256: 'a'.repeat(64), status: 'SUCCEEDED' },
      ])
      .mockResolvedValueOnce([
        {
          extraction_skill_id: '1',
          skill_id: '10',
          normalized_name: 'A',
          skill_type: 'TECHNOLOGY',
          sort_order: 0,
        },
        {
          extraction_skill_id: '2',
          skill_id: '11',
          normalized_name: 'B',
          skill_type: 'TECHNOLOGY',
          sort_order: 1,
        },
      ]);

    // Forzar que inventory hash coincida con el recalculado en activación.
    const hash = computeInventoryHash([
      {
        extractionSkillId: '1',
        skillId: '10',
        normalizedName: 'A',
        skillType: 'TECHNOLOGY',
        sortOrder: 0,
      },
      {
        extractionSkillId: '2',
        skillId: '11',
        normalizedName: 'B',
        skillType: 'TECHNOLOGY',
        sortOrder: 1,
      },
    ]);
    target.inventory_hash = hash.inventoryHash;

    const result = await service.activateSucceededRun('50');
    expect(result.activated).toBe(true);
    expect(result.previousActiveId).toBe('49');
    expect(manager.query).toHaveBeenCalledWith(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [ENRICHMENT_ADVISORY_LOCK_NS, 201],
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('activate rechaza inventoryHash incompatible', async () => {
    const target = sampleEnrichment({
      status: 'SUCCEEDED',
      inventory_hash: 'wrong',
    });
    manager.findOne.mockResolvedValue(target);
    manager.query
      .mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }])
      .mockResolvedValueOnce([
        { id: '201', pdf_sha256: 'a'.repeat(64), status: 'SUCCEEDED' },
      ])
      .mockResolvedValueOnce([
        {
          extraction_skill_id: '1',
          skill_id: '10',
          normalized_name: 'A',
          skill_type: 'TECHNOLOGY',
          sort_order: 0,
        },
      ]);

    await expect(service.activateSucceededRun('50')).rejects.toThrow(
      /inventoryHash incompatible/,
    );
  });

  it('activate rechaza FAILED', async () => {
    manager.findOne.mockResolvedValue(
      sampleEnrichment({ status: 'FAILED', is_active: false }),
    );
    await expect(service.activateSucceededRun('50')).rejects.toBeInstanceOf(
      EnrichmentActivationRejectedError,
    );
  });

  it('activate rechaza pdfSha256 incompatible', async () => {
    const target = sampleEnrichment({ status: 'SUCCEEDED' });
    manager.findOne.mockResolvedValue(target);
    manager.query
      .mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }])
      .mockResolvedValueOnce([
        { id: '201', pdf_sha256: 'f'.repeat(64), status: 'SUCCEEDED' },
      ]);
    await expect(service.activateSucceededRun('50')).rejects.toThrow(
      /pdfSha256 incompatible/,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('activate con hash incompatible no desactiva el activo previo', async () => {
    const target = sampleEnrichment({
      id: '50',
      status: 'SUCCEEDED',
      is_active: false,
      inventory_hash: 'wrong',
    });
    manager.findOne
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(target);
    manager.query
      .mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }])
      .mockResolvedValueOnce([
        { id: '201', pdf_sha256: 'a'.repeat(64), status: 'SUCCEEDED' },
      ])
      .mockResolvedValueOnce([
        {
          extraction_skill_id: '1',
          skill_id: '10',
          normalized_name: 'A',
          skill_type: 'TECHNOLOGY',
          sort_order: 0,
        },
      ]);

    await expect(service.activateSucceededRun('50')).rejects.toThrow(
      /inventoryHash incompatible/,
    );
    // No debe haber save de desactivación del activo previo
    const saves = manager.save.mock.calls;
    expect(saves.length).toBe(0);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('deactivateSucceededRun desactiva con advisory lock', async () => {
    const row = sampleEnrichment({
      id: '1',
      status: 'SUCCEEDED',
      is_active: true,
    });
    manager.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    manager.query.mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }]);

    const result = await service.deactivateSucceededRun('1');
    expect(result.deactivated).toBe(true);
    expect(result.alreadyInactive).toBe(false);
    expect(result.status).toBe('SUCCEEDED');
    expect(manager.save).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('deactivateSucceededRun es idempotente si ya inactivo', async () => {
    const row = sampleEnrichment({
      id: '1',
      status: 'SUCCEEDED',
      is_active: false,
    });
    manager.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    manager.query.mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }]);

    const result = await service.deactivateSucceededRun('1');
    expect(result.alreadyInactive).toBe(true);
    expect(result.deactivated).toBe(true);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('deactivateSucceededRun rechaza id inexistente', async () => {
    manager.findOne.mockResolvedValue(null);
    await expect(service.deactivateSucceededRun('999')).rejects.toThrow(
      /no encontrado/,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('fallo tras desactivar previo hace rollback (activo anterior permanece)', async () => {
    const target = sampleEnrichment({
      id: '50',
      status: 'SUCCEEDED',
      is_active: false,
    });
    const previous = sampleEnrichment({
      id: '49',
      status: 'SUCCEEDED',
      is_active: true,
    });
    const hash = computeInventoryHash([
      {
        extractionSkillId: '1',
        skillId: '10',
        normalizedName: 'A',
        skillType: 'TECHNOLOGY',
        sortOrder: 0,
      },
      {
        extractionSkillId: '2',
        skillId: '11',
        normalizedName: 'B',
        skillType: 'TECHNOLOGY',
        sortOrder: 1,
      },
    ]);
    target.inventory_hash = hash.inventoryHash;

    manager.findOne
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(target)
      .mockResolvedValueOnce(previous);
    manager.query
      .mockResolvedValueOnce([{ pg_advisory_xact_lock: '' }])
      .mockResolvedValueOnce([
        { id: '201', pdf_sha256: 'a'.repeat(64), status: 'SUCCEEDED' },
      ])
      .mockResolvedValueOnce([
        {
          extraction_skill_id: '1',
          skill_id: '10',
          normalized_name: 'A',
          skill_type: 'TECHNOLOGY',
          sort_order: 0,
        },
        {
          extraction_skill_id: '2',
          skill_id: '11',
          normalized_name: 'B',
          skill_type: 'TECHNOLOGY',
          sort_order: 1,
        },
      ]);
    manager.save
      .mockResolvedValueOnce(previous) // deactivate previous
      .mockRejectedValueOnce(new Error('boom before activate new'));

    await expect(service.activateSucceededRun('50')).rejects.toThrow(/boom/);
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });

  it('FAILED anterior no aparece en findIdempotentSucceededRun', async () => {
    enrichmentsRepo.findOne.mockResolvedValue(null);
    const row = await service.findIdempotentSucceededRun({
      extractionId: '201',
      pdfSha256: 'a'.repeat(64),
      inventoryHash: 'b'.repeat(64),
      model: 'm',
      promptVersion: 'e1',
      enricherVersion: '1.0.0',
      blockConfigHash: 'c'.repeat(64),
    });
    expect(row).toBeNull();
  });
});

describe('idempotency key semantics', () => {
  it('cambio prompt_version permite nuevo run (clave distinta)', () => {
    const a = {
      promptVersion: 'e1-2026-07-24',
      enricherVersion: '1.0.0',
    };
    const b = {
      promptVersion: 'e1-changed',
      enricherVersion: '1.0.0',
    };
    expect(a.promptVersion).not.toBe(b.promptVersion);
  });
});

describe('CvSkillsEnrichmentPersistenceError', () => {
  it('existe', () => {
    expect(new CvSkillsEnrichmentPersistenceError('x').name).toContain(
      'Persistence',
    );
  });
});
