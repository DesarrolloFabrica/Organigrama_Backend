import {
  CvAttributeActivationRejectedError,
  CvAttributePersistenceError,
  CvAttributePersistenceService,
} from './cv-attributes-persistence.service';
import {
  assertAttributeActivateCli,
  assertAttributeCatalogCli,
  assertAttributeInspectCli,
  assertAttributeMainCli,
  assertAttributeStatusCli,
  parseAttributeCliArgs,
} from './cv-attributes.cli-args';
import { getDefaultAttributeEngineConfig } from './cv-attributes.config';
import { computeAttributeConfigHash, computeMappingHash } from './cv-attributes.hash';
import type { AttributeCatalog } from './cv-attributes.types';
import type { CvAttributeRun } from './entities';

// ─── H. CLI ───────────────────────────────────────────────────────────────────

describe('parseAttributeCliArgs', () => {
  it('parsea dry-run con evaluationId', () => {
    const args = parseAttributeCliArgs(['--evaluationId=2', '--dry-run']);
    expect(args.evaluationId).toBe('2');
    expect(args.dryRun).toBe(true);
    expect(args.persist).toBe(false);
    expect(args.outputDir).toBe('tmp/cv-attributes');
    expect(() => assertAttributeMainCli(args)).not.toThrow();
  });

  it('rechaza lotes y múltiples evaluationId', () => {
    expect(() => parseAttributeCliArgs(['--batch'])).toThrow(/lotes/);
    expect(() =>
      parseAttributeCliArgs(['--evaluationId=1', '--evaluationId=2']),
    ).toThrow(/un solo/);
  });

  it('rechaza ids no numéricos', () => {
    expect(() => parseAttributeCliArgs(['--evaluationId=abc'])).toThrow(
      /solo dígitos/,
    );
    expect(() => parseAttributeCliArgs(['--attributeRunId=1;DROP'])).toThrow(
      /solo dígitos/,
    );
  });

  it('exige confirmación explícita para persistir y activar', () => {
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs(['--evaluationId=2', '--persist']),
      ),
    ).toThrow(/--i-confirm-persist/);
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs([
          '--evaluationId=2',
          '--persist',
          '--i-confirm-persist',
          '--activate',
        ]),
      ),
    ).toThrow(/--i-confirm-activate/);
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs([
          '--evaluationId=2',
          '--persist',
          '--activate',
          '--i-confirm-persist',
          '--i-confirm-activate',
        ]),
      ),
    ).not.toThrow();
  });

  it('rechaza combinaciones incoherentes', () => {
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs(['--evaluationId=2', '--dry-run', '--persist']),
      ),
    ).toThrow(/No combines/);
    expect(() =>
      assertAttributeMainCli(parseAttributeCliArgs(['--evaluationId=2'])),
    ).toThrow(/--dry-run o --persist/);
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs([
          '--evaluationId=2',
          '--enrichmentId=1',
          '--dry-run',
        ]),
      ),
    ).toThrow(/solo uno/);
    expect(() =>
      assertAttributeMainCli(
        parseAttributeCliArgs(['--evaluationId=2', '--dry-run', '--activate']),
      ),
    ).toThrow(/no está permitido/);
  });

  it('valida los CLIs de activate, status, inspect y catalog', () => {
    expect(() =>
      assertAttributeActivateCli(parseAttributeCliArgs(['--attributeRunId=1'])),
    ).toThrow(/--i-confirm-activate/);
    expect(() =>
      assertAttributeActivateCli(
        parseAttributeCliArgs(['--attributeRunId=1', '--i-confirm-activate']),
      ),
    ).not.toThrow();

    expect(() => assertAttributeStatusCli(parseAttributeCliArgs([]))).toThrow(
      /attributeRunId/,
    );
    expect(() =>
      assertAttributeStatusCli(
        parseAttributeCliArgs(['--attributeRunId=1', '--evaluationId=2']),
      ),
    ).toThrow(/solo uno/);

    expect(() => assertAttributeInspectCli(parseAttributeCliArgs([]))).toThrow(
      /attributeRunId/,
    );

    expect(() =>
      assertAttributeCatalogCli(parseAttributeCliArgs(['--seed'])),
    ).toThrow(/--i-confirm-seed/);
    expect(() =>
      assertAttributeCatalogCli(
        parseAttributeCliArgs(['--seed', '--i-confirm-seed']),
      ),
    ).not.toThrow();
    expect(() =>
      assertAttributeCatalogCli(parseAttributeCliArgs(['--activate'])),
    ).toThrow(/--i-confirm-activate/);
  });
});

// ─── F/G. Idempotencia, persistencia y activación ─────────────────────────────

function catalogStub(catalogVersionId = '10'): AttributeCatalog {
  return {
    catalogVersionId,
    catalogCode: 'professional-attributes',
    catalogVersion: 'pa1-2026-07-24',
    status: 'ACTIVE',
    macroattributes: [
      { id: '1', code: 'M', name: 'M', sortOrder: 1, isActive: true },
    ],
    subattributes: [
      {
        id: '1',
        macroattributeId: '1',
        code: 'A',
        name: 'A',
        sortOrder: 1,
        isActive: true,
        minimumSupportingSkills: 3,
      },
    ],
    mappings: [
      {
        id: '1',
        skillId: '100',
        subattributeId: '1',
        weight: 0.5,
        mappingType: 'DIRECT',
        isActive: true,
      },
    ],
  };
}

function runStub(overrides: Partial<CvAttributeRun> = {}): CvAttributeRun {
  return {
    id: '1',
    evidence_evaluation_id: '2',
    enrichment_id: '1',
    extraction_id: '201',
    person_id: '5',
    catalog_version_id: '10',
    mapping_hash: 'mh',
    algorithm_version: '1.0.0',
    config_version: 'ac1-2026-07-24',
    config_hash: 'ch',
    config_json: {},
    status: 'SUCCEEDED',
    is_active: false,
    input_skills_count: 23,
    mapped_skills_count: 22,
    unmapped_skills_count: 1,
    contributing_skills_count: 17,
    ignored_none_skills_count: 4,
    subattributes_with_support_count: 15,
    macroattributes_with_support_count: 4,
    warnings_count: 1,
    metrics: { inputSkills: 23 },
    warnings: [],
    errors: null,
    error_stage: null,
    error_code: null,
    error_message: null,
    started_at: new Date('2026-07-24T10:00:00Z'),
    completed_at: new Date('2026-07-24T10:00:01Z'),
    created_at: new Date('2026-07-24T10:00:00Z'),
    updated_at: new Date('2026-07-24T10:00:01Z'),
    ...overrides,
  } as CvAttributeRun;
}

interface Harness {
  service: CvAttributePersistenceService;
  runs: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  managed: Map<string, CvAttributeRun>;
  advisoryLocks: Array<[number, number]>;
  commits: number;
  rollbacks: number;
}

function buildHarness(rows: CvAttributeRun[]): Harness {
  const managed = new Map(rows.map((r) => [r.id, { ...r }]));
  const advisoryLocks: Array<[number, number]> = [];
  const counters = { commits: 0, rollbacks: 0 };

  const manager = {
    findOne: jest.fn(async (_entity: unknown, options: any) => {
      const where = options.where ?? {};
      const values = [...managed.values()];
      if (where.id) return values.find((r) => r.id === String(where.id)) ?? null;
      return (
        values.find(
          (r) =>
            r.evidence_evaluation_id === String(where.evidence_evaluation_id) &&
            r.is_active === where.is_active,
        ) ?? null
      );
    }),
    save: jest.fn(async (_entity: unknown, row: CvAttributeRun) => {
      managed.set(row.id, { ...row });
      return row;
    }),
    query: jest.fn(async (_sql: string, params: [number, number]) => {
      advisoryLocks.push(params);
      return [];
    }),
  };

  const queryRunner = {
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => {
      counters.commits += 1;
    }),
    rollbackTransaction: jest.fn(async () => {
      counters.rollbacks += 1;
    }),
    release: jest.fn(async () => undefined),
    manager,
  };

  const dataSource = {
    createQueryRunner: jest.fn(() => queryRunner),
    query: jest.fn(async () => []),
  };

  const runs = {
    findOne: jest.fn(async ({ where }: any) => {
      const values = [...managed.values()];
      if (where.id) return values.find((r) => r.id === String(where.id)) ?? null;
      return (
        values.find(
          (r) =>
            r.evidence_evaluation_id === String(where.evidence_evaluation_id) &&
            r.catalog_version_id === String(where.catalog_version_id) &&
            r.mapping_hash === where.mapping_hash &&
            r.algorithm_version === where.algorithm_version &&
            r.config_hash === where.config_hash &&
            r.status === where.status,
        ) ?? null
      );
    }),
    save: jest.fn(async (row: CvAttributeRun) => {
      managed.set(row.id, { ...row });
      return row;
    }),
    create: jest.fn((row: Partial<CvAttributeRun>) => ({ id: '99', ...row })),
  };

  const counted = { count: jest.fn(async () => 0), find: jest.fn(async () => []) };

  const service = new CvAttributePersistenceService(
    dataSource as never,
    { loadCatalog: jest.fn(async () => catalogStub()) } as never,
    runs as never,
    counted as never,
    counted as never,
    counted as never,
  );

  return {
    service,
    runs,
    managed,
    advisoryLocks,
    get commits() {
      return counters.commits;
    },
    get rollbacks() {
      return counters.rollbacks;
    },
  } as Harness;
}

describe('idempotencia del attribute run', () => {
  const config = getDefaultAttributeEngineConfig();
  const catalog = catalogStub();
  const configHash = computeAttributeConfigHash(config);
  const mappingHash = computeMappingHash(catalog);

  it('reconoce un run SUCCEEDED con la misma clave', async () => {
    const { service } = buildHarness([
      runStub({ config_hash: configHash, mapping_hash: mappingHash }),
    ]);
    const found = await service.findIdempotentSucceeded({
      evidenceEvaluationId: '2',
      catalogVersionId: '10',
      mappingHash,
      algorithmVersion: '1.0.0',
      configHash,
    });
    expect(found?.id).toBe('1');
  });

  it('no reconoce el run si cambia el mappingHash', async () => {
    const { service } = buildHarness([
      runStub({ config_hash: configHash, mapping_hash: mappingHash }),
    ]);
    const found = await service.findIdempotentSucceeded({
      evidenceEvaluationId: '2',
      catalogVersionId: '10',
      mappingHash: 'otro-mapping-hash',
      algorithmVersion: '1.0.0',
      configHash,
    });
    expect(found).toBeNull();
  });

  it('no reconoce el run si cambia la versión de catálogo o el configHash', async () => {
    const { service } = buildHarness([
      runStub({ config_hash: configHash, mapping_hash: mappingHash }),
    ]);
    expect(
      await service.findIdempotentSucceeded({
        evidenceEvaluationId: '2',
        catalogVersionId: '11',
        mappingHash,
        algorithmVersion: '1.0.0',
        configHash,
      }),
    ).toBeNull();
    expect(
      await service.findIdempotentSucceeded({
        evidenceEvaluationId: '2',
        catalogVersionId: '10',
        mappingHash,
        algorithmVersion: '1.0.0',
        configHash: 'otro',
      }),
    ).toBeNull();
  });

  it('un run previo FAILED no cuenta como idempotente', async () => {
    const { service } = buildHarness([
      runStub({
        status: 'FAILED',
        config_hash: configHash,
        mapping_hash: mappingHash,
      }),
    ]);
    expect(
      await service.findIdempotentSucceeded({
        evidenceEvaluationId: '2',
        catalogVersionId: '10',
        mappingHash,
        algorithmVersion: '1.0.0',
        configHash,
      }),
    ).toBeNull();
  });
});

describe('transiciones de estado', () => {
  it('markRunning rechaza un run ya SUCCEEDED', async () => {
    const { service } = buildHarness([runStub({ status: 'SUCCEEDED' })]);
    await expect(service.markRunning('1')).rejects.toThrow(
      CvAttributePersistenceError,
    );
  });

  it('markRunning acepta PENDING y fija started_at', async () => {
    const { service, managed } = buildHarness([
      runStub({ status: 'PENDING', started_at: null }),
    ]);
    await service.markRunning('1');
    expect(managed.get('1')!.status).toBe('RUNNING');
    expect(managed.get('1')!.started_at).toBeInstanceOf(Date);
  });

  it('failRun no puede degradar un run SUCCEEDED', async () => {
    const { service } = buildHarness([runStub({ status: 'SUCCEEDED' })]);
    await expect(
      service.failRun('1', { errorStage: 'engine', errorMessage: 'x' }),
    ).rejects.toThrow(/ya SUCCEEDED/);
  });

  it('failRun guarda etapa, código y lista de errores', async () => {
    const { service, managed } = buildHarness([runStub({ status: 'RUNNING' })]);
    await service.failRun('1', {
      errorStage: 'engine',
      errorCode: 'INVALID_CATALOG',
      errorMessage: 'weights inválidos',
      errors: ['WEIGHT_SUM_EXCEEDED: skill 1'],
    });
    const row = managed.get('1')!;
    expect(row.status).toBe('FAILED');
    expect(row.is_active).toBe(false);
    expect(row.error_code).toBe('INVALID_CATALOG');
    expect(row.errors).toEqual(['WEIGHT_SUM_EXCEEDED: skill 1']);
  });
});

describe('activación y rollback', () => {
  it('activa un run SUCCEEDED y desactiva el anterior bajo advisory lock', async () => {
    const harness = buildHarness([
      runStub({ id: '1', is_active: true }),
      runStub({ id: '2', is_active: false }),
    ]);
    const result = await harness.service.activateSucceeded('2');
    expect(result.activated).toBe(true);
    expect(result.previousActiveId).toBe('1');
    expect(harness.managed.get('1')!.is_active).toBe(false);
    expect(harness.managed.get('2')!.is_active).toBe(true);
    expect(harness.advisoryLocks).toHaveLength(1);
  });

  it('permite volver al run anterior sin recalcular', async () => {
    const harness = buildHarness([
      runStub({ id: '1', is_active: false }),
      runStub({ id: '2', is_active: true }),
    ]);
    const back = await harness.service.activateSucceeded('1');
    expect(back.previousActiveId).toBe('2');
    expect(harness.managed.get('1')!.is_active).toBe(true);
    expect(harness.managed.get('2')!.is_active).toBe(false);

    const forward = await harness.service.activateSucceeded('2');
    expect(forward.previousActiveId).toBe('1');
    expect(harness.managed.get('2')!.is_active).toBe(true);
    expect(harness.managed.get('1')!.is_active).toBe(false);
  });

  it('activar un run ya activo es idempotente', async () => {
    const harness = buildHarness([runStub({ id: '1', is_active: true })]);
    const result = await harness.service.activateSucceeded('1');
    expect(result.alreadyActive).toBe(true);
    expect(result.activated).toBe(true);
  });

  it('rechaza activar un run que no está SUCCEEDED', async () => {
    const harness = buildHarness([runStub({ id: '1', status: 'FAILED' })]);
    await expect(harness.service.activateSucceeded('1')).rejects.toThrow(
      CvAttributeActivationRejectedError,
    );
    expect(harness.rollbacks).toBe(1);
  });

  it('desactivar deja cero runs activos y es idempotente', async () => {
    const harness = buildHarness([runStub({ id: '1', is_active: true })]);
    const first = await harness.service.deactivate('1');
    expect(first.alreadyInactive).toBe(false);
    expect(harness.managed.get('1')!.is_active).toBe(false);

    const second = await harness.service.deactivate('1');
    expect(second.alreadyInactive).toBe(true);
  });
});
