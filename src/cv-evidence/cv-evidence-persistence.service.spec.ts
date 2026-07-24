import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  CvEvidencePersistenceService,
  CvEvidenceActivationRejectedError,
} from './cv-evidence-persistence.service';
import { CvEvidenceEvaluation } from './entities/cv-evidence-evaluation.entity';
import { CvEvidenceEvaluationItem } from './entities/cv-evidence-evaluation-item.entity';
import { computeEvidenceConfigHash } from './cv-evidence.hash';
import { getDefaultEvidenceEngineConfig } from './cv-evidence.config';
import {
  CV_EVIDENCE_ALGORITHM_VERSION,
  CV_EVIDENCE_RULES_VERSION,
  CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
  CV_EVIDENCE_RULES_VERSION_ER1,
} from './cv-evidence.constants';

function sampleEval(
  partial?: Partial<CvEvidenceEvaluation>,
): CvEvidenceEvaluation {
  return {
    id: '10',
    enrichment_id: '1',
    extraction_id: '201',
    person_id: '1350',
    evidence_rules_version: CV_EVIDENCE_RULES_VERSION,
    source_weight_version: CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
    algorithm_version: CV_EVIDENCE_ALGORITHM_VERSION,
    config_hash: computeEvidenceConfigHash(getDefaultEvidenceEngineConfig()),
    config_json: {},
    status: 'SUCCEEDED',
    is_active: false,
    input_skills_count: 2,
    output_skills_count: 2,
    strong_skills_count: 0,
    moderate_skills_count: 1,
    weak_skills_count: 1,
    no_evidence_skills_count: 0,
    applied_evidence_skills_count: 1,
    warnings_count: 0,
    metrics: {},
    warnings: [],
    error_stage: null,
    error_code: null,
    error_message: null,
    started_at: new Date(),
    completed_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    ...partial,
  } as CvEvidenceEvaluation;
}

describe('CvEvidencePersistenceService', () => {
  let service: CvEvidencePersistenceService;
  let evaluationsRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let itemsRepo: { find: jest.Mock; count: jest.Mock };
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
    evaluationsRepo = {
      findOne: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ ...x, id: x.id || '10' })),
    };
    itemsRepo = {
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
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
      query: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        CvEvidencePersistenceService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(CvEvidenceEvaluation),
          useValue: evaluationsRepo,
        },
        {
          provide: getRepositoryToken(CvEvidenceEvaluationItem),
          useValue: itemsRepo,
        },
      ],
    }).compile();

    service = moduleRef.get(CvEvidencePersistenceService);
  });

  it('findIdempotentSucceeded usa clave lógica', async () => {
    evaluationsRepo.findOne.mockResolvedValue(sampleEval());
    const row = await service.findIdempotentSucceeded({
      enrichmentId: '1',
      evidenceRulesVersion: CV_EVIDENCE_RULES_VERSION,
      sourceWeightVersion: CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
      algorithmVersion: CV_EVIDENCE_ALGORITHM_VERSION,
      configHash: computeEvidenceConfigHash(getDefaultEvidenceEngineConfig()),
    });
    expect(row?.status).toBe('SUCCEEDED');
  });

  it('activate rechaza FAILED', async () => {
    manager.findOne.mockResolvedValue(sampleEval({ status: 'FAILED' }));
    await expect(service.activateSucceeded('10')).rejects.toBeInstanceOf(
      CvEvidenceActivationRejectedError,
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
  });

  it('activate SUCCEEDED con lock', async () => {
    const row = sampleEval({ is_active: false });
    manager.findOne
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(row)
      .mockResolvedValueOnce(null);
    const result = await service.activateSucceeded('10');
    expect(result.activated).toBe(true);
    expect(queryRunner.commitTransaction).toHaveBeenCalled();
  });

  it('deactivate idempotente', async () => {
    const row = sampleEval({ is_active: false });
    manager.findOne.mockResolvedValueOnce(row).mockResolvedValueOnce(row);
    const result = await service.deactivate('10');
    expect(result.alreadyInactive).toBe(true);
  });

  it('FAILED no aparece en idempotencia SUCCEEDED', async () => {
    evaluationsRepo.findOne.mockResolvedValue(null);
    const row = await service.findIdempotentSucceeded({
      enrichmentId: '1',
      evidenceRulesVersion: CV_EVIDENCE_RULES_VERSION,
      sourceWeightVersion: CV_EVIDENCE_SOURCE_WEIGHT_VERSION,
      algorithmVersion: CV_EVIDENCE_ALGORITHM_VERSION,
      configHash: 'abc',
    });
    expect(row).toBeNull();
  });

  it('cambio configHash permite nuevo run (clave distinta)', () => {
    const a = computeEvidenceConfigHash(getDefaultEvidenceEngineConfig());
    const b = computeEvidenceConfigHash({
      ...getDefaultEvidenceEngineConfig(),
      penalties: {
        ...getDefaultEvidenceEngineConfig().penalties,
        shortText: 99,
      },
    });
    expect(a).not.toBe(b);
  });

  it('er2 versions por defecto en sample', () => {
    expect(CV_EVIDENCE_RULES_VERSION).toBe('er2-2026-07-24');
    expect(CV_EVIDENCE_SOURCE_WEIGHT_VERSION).toBe('sw2');
    expect(CV_EVIDENCE_ALGORITHM_VERSION).toBe('1.1.0');
    expect(CV_EVIDENCE_RULES_VERSION_ER1).toBe('er1-2026-07-24');
  });
});
