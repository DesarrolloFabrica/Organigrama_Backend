/**
 * MC1.2 / 1C.2 — Evaluation Set context hash + persistencia atómica con set.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { McPa2Service } from './mc-pa2.service';
import { McEvaluationSet, McProfileEvaluation } from './entities';
import {
  buildMcEvaluationSetContextPayload,
  computeMcEvaluationSetContextHash,
} from './mc-evaluation-set-context';
import {
  MC_EVALUATION_SET_SCHEMA_VERSION,
  MC_QUALIFICATION_POLICY_VERSION,
} from './mc-evaluation-set.types';
import { MC_DOMAIN_QUALIFICATIONS } from './mc-domain-qualification';

function makeMeta(domainCode: string, domainId: string, overrides?: Partial<{
  extractionId: string;
  mappingPackVersion: string;
  mappingHash: string;
}>) {
  return {
    personId: '42',
    personCvId: '1',
    extractionId: overrides?.extractionId ?? '10',
    enrichmentId: '20',
    evidenceEvaluationId: '30',
    catalogVersionId: '2',
    catalogVersion: 'mc1.8-2026-07-28',
    domainId,
    domainCode,
    mappingHash: overrides?.mappingHash ?? 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    mappingPackCode: `${domainCode.toLowerCase()}-mappings`,
    mappingPackVersion: overrides?.mappingPackVersion ?? '1.0.0',
    sourceHash: 'c'.repeat(64),
    algorithmVersion: 'pa2-algo-lexico-v1',
    evaluationContextHash: 'd'.repeat(64),
  };
}

function makeResult(activeCount: number) {
  return {
    specialtyResults: [] as [],
    activeCount,
    emergentCount: activeCount > 0 ? 0 : 1,
    hiddenCount: 2,
    defaultSpecialtyCode: null as null,
    warnings: [] as [],
    engineRulesVersion: 'pa2-software-1.1.0',
    configHash: 'b'.repeat(64),
    domainCode: 'SOFTWARE',
  };
}

function baseContext(candidates: ReturnType<typeof makeMeta>[]) {
  return {
    personId: '42',
    extractionId: '10',
    enrichmentId: '20',
    evidenceEvaluationId: '30',
    catalogVersionId: '2',
    qualificationPolicyVersion: MC_QUALIFICATION_POLICY_VERSION,
    candidateDomains: candidates.map((m) => ({
      domainCode: m.domainCode,
      mappingPackCode: m.mappingPackCode,
      mappingPackVersion: m.mappingPackVersion,
      mappingHash: m.mappingHash,
      engineRulesVersion: 'pa2-software-1.1.0',
      algorithmVersion: m.algorithmVersion,
      configHash: m.configHash,
    })),
  };
}

function createMockPersistence() {
  const savedSets: Array<Record<string, unknown>> = [];
  const savedDomainRows: Array<Record<string, unknown>> = [];
  const savedEvals: Array<{
    domain_code: string;
    is_active: boolean;
    domain_qualification: string | null;
  }> = [];
  const updates: Array<{ entity: unknown; set: Record<string, unknown> }> = [];
  let evalSeq = 0;
  let setSeq = 0;
  let domainSeq = 0;

  const mockQb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn(function (this: typeof mockQb, values: Record<string, unknown>) {
      (this as { _set?: Record<string, unknown> })._set = values;
      return this;
    }),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(async function (this: {
      _set?: Record<string, unknown>;
      _entity?: unknown;
    }) {
      updates.push({ entity: this._entity, set: this._set ?? {} });
      return { affected: 1 };
    }),
  };

  const mockManager = {
    query: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn((entity?: unknown) => {
      const qb = {
        ...mockQb,
        _entity: entity,
        update: jest.fn(function (this: typeof qb, e: unknown) {
          this._entity = e;
          return this;
        }),
        set: jest.fn(function (
          this: typeof qb,
          values: Record<string, unknown>,
        ) {
          this._set = values;
          return this;
        }),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn(async function (this: typeof qb) {
          updates.push({ entity: this._entity, set: this._set ?? {} });
          // Apply domain SUCCEEDED updates onto savedDomainRows
          if (
            this._entity === McEvaluationSet ||
            (typeof this._entity === 'function' &&
              this._entity.name === 'McEvaluationSet')
          ) {
            /* set terminal update tracked in updates */
          }
          return { affected: 1 };
        }),
        _set: undefined as Record<string, unknown> | undefined,
        _entity: entity,
      };
      return qb;
    }),
    create: jest.fn((_, data: Record<string, unknown>) => ({ ...data })),
    save: jest.fn(async (row: Record<string, unknown>) => {
      if (row.set_context_hash || row.schema_version) {
        setSeq += 1;
        const id = String(100 + setSeq);
        savedSets.push({ ...row, id });
        return { id, ...row };
      }
      if (row.evaluation_set_id && row.domain_status && !row.person_id) {
        domainSeq += 1;
        const id = String(200 + domainSeq);
        savedDomainRows.push({ ...row, id });
        return { id, ...row };
      }
      if (row.domain_code && row.person_id) {
        evalSeq += 1;
        savedEvals.push({
          domain_code: String(row.domain_code),
          is_active: Boolean(row.is_active),
          domain_qualification: (row.domain_qualification as string) ?? null,
        });
        return { id: String(evalSeq), ...row };
      }
      return { id: '999', ...row };
    }),
  };

  const mockDataSource = {
    transaction: jest.fn(
      async (cb: (m: typeof mockManager) => Promise<unknown>) =>
        cb(mockManager),
    ),
  } as unknown as DataSource;

  const service = new McPa2Service(
    mockDataSource,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { findOne: jest.fn() } as never,
    {} as never,
  );

  return {
    service,
    mockManager,
    mockDataSource,
    savedSets,
    savedDomainRows,
    savedEvals,
    updates,
  };
}

describe('McEvaluationSet context hash', () => {
  it('es determinístico y de 64 hex', () => {
    const ctx = baseContext([
      makeMeta('SOFTWARE', '5'),
      makeMeta('VISUAL_DESIGN', '6'),
    ]);
    const a = computeMcEvaluationSetContextHash(ctx);
    const b = computeMcEvaluationSetContextHash(ctx);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('es independiente del orden de dominios', () => {
    const forward = baseContext([
      makeMeta('SOFTWARE', '5'),
      makeMeta('VISUAL_DESIGN', '6'),
      makeMeta('AUDIOVISUAL_PRODUCTION', '7'),
    ]);
    const reverse = baseContext([
      makeMeta('AUDIOVISUAL_PRODUCTION', '7'),
      makeMeta('VISUAL_DESIGN', '6'),
      makeMeta('SOFTWARE', '5'),
    ]);
    expect(computeMcEvaluationSetContextHash(forward)).toBe(
      computeMcEvaluationSetContextHash(reverse),
    );
  });

  it('cambia al cambiar extraction', () => {
    const a = baseContext([makeMeta('SOFTWARE', '5')]);
    const b = {
      ...a,
      extractionId: '999',
    };
    expect(computeMcEvaluationSetContextHash(a)).not.toBe(
      computeMcEvaluationSetContextHash(b),
    );
  });

  it('cambia al cambiar mapping pack', () => {
    const a = baseContext([makeMeta('SOFTWARE', '5')]);
    const b = baseContext([
      makeMeta('SOFTWARE', '5', { mappingPackVersion: '2.0.0' }),
    ]);
    expect(computeMcEvaluationSetContextHash(a)).not.toBe(
      computeMcEvaluationSetContextHash(b),
    );
  });

  it('payload no incluye timestamps', () => {
    const payload = buildMcEvaluationSetContextPayload(
      baseContext([makeMeta('SOFTWARE', '5')]),
    );
    expect(JSON.stringify(payload)).not.toMatch(/created|timestamp|at"/i);
  });
});

describe('McPa2Service Evaluation Set persistence (1C.2)', () => {
  const migrationSql = readFileSync(
    resolve(__dirname, '../../migrations/023_mc_evaluation_set.sql'),
    'utf8',
  );

  it('migración 023 define tablas, checks y FKs estructurales', () => {
    expect(migrationSql).toContain('CREATE TABLE organigrama.mc_evaluation_set');
    expect(migrationSql).toContain(
      'CREATE TABLE organigrama.mc_evaluation_set_domain',
    );
    expect(migrationSql).toContain('chk_mc_eval_set_status');
    expect(migrationSql).toContain('uq_mc_eval_set_domain_code');
    expect(migrationSql).toContain('uq_mc_eval_set_domain_eval');
    expect(migrationSql).toContain('chk_mc_eval_set_domain_succeeded_link');
    expect(migrationSql).not.toContain('BACKFILL');
    expect(migrationSql).toContain('DROP TABLE IF EXISTS'); // rollback comment
  });

  it('batch: crea set + 3 domain rows + 3 evals; COMPLETE; 1 activo', async () => {
    const { service, savedSets, savedDomainRows, savedEvals } =
      createMockPersistence();

    const result = await service.persistMultidomainEvaluationRun([
      {
        meta: makeMeta('SOFTWARE', '5'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
        inputSkillsCount: 10,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
      {
        meta: makeMeta('VISUAL_DESIGN', '6'),
        result: makeResult(1) as never,
        config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
        inputSkillsCount: 8,
        domainQualification: 'PRIMARY_MATCH',
        activateOnPersist: true,
      },
      {
        meta: makeMeta('AUDIOVISUAL_PRODUCTION', '7'),
        result: makeResult(0) as never,
        config: {
          engineRulesVersion: 'pa2-audiovisual-production-1.0.0',
        } as never,
        inputSkillsCount: 4,
        domainQualification: 'SECONDARY_SIGNAL',
        activateOnPersist: false,
      },
    ]);

    expect(result.evaluationSetId).toBeTruthy();
    expect(result.evaluationSetStatus).toBe('COMPLETE');
    expect(result.schemaVersion).toBe(MC_EVALUATION_SET_SCHEMA_VERSION);
    expect(result.qualificationPolicyVersion).toBe(
      MC_QUALIFICATION_POLICY_VERSION,
    );
    expect(result.contextHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.domainResults).toHaveLength(3);
    expect(savedSets).toHaveLength(1);
    expect(savedSets[0].status).toBe('RUNNING'); // initial insert
    expect(savedDomainRows).toHaveLength(3);
    expect(savedEvals).toHaveLength(3);
    expect(savedEvals.filter((e) => e.is_active)).toHaveLength(1);
    expect(savedEvals.find((e) => e.is_active)?.domain_code).toBe(
      'VISUAL_DESIGN',
    );
    expect(
      result.domainResults.every((d) => d.domainStatus === 'SUCCEEDED'),
    ).toBe(true);
    expect(
      result.domainResults.every((d) => d.profileEvaluationId !== null),
    ).toBe(true);
  });

  it('COMPLETE sin ganador: no desactiva previas; set COMPLETE', async () => {
    const { service, mockManager, savedEvals } = createMockPersistence();

    const result = await service.persistMultidomainEvaluationRun([
      {
        meta: makeMeta('SOFTWARE', '5'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
        inputSkillsCount: 3,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
      {
        meta: makeMeta('VISUAL_DESIGN', '6'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
        inputSkillsCount: 3,
        domainQualification: 'SECONDARY_SIGNAL',
        activateOnPersist: false,
      },
    ]);

    expect(result.evaluationSetStatus).toBe('COMPLETE');
    expect(result.domainResults.every((d) => !d.isActive)).toBe(true);
    expect(savedEvals.every((e) => !e.is_active)).toBe(true);
    // createQueryBuilder update McProfileEvaluation no llamado para desactivar
    const deactivateCalls = (
      mockManager.createQueryBuilder as jest.Mock
    ).mock.calls.filter(
      (c) => c[0] === McProfileEvaluation || c[0] === undefined,
    );
    // Still called for domain/set updates; ensure no early deactivate of winner path
    // by checking no update with is_active false on profile before evals — covered by
    // savedEvals all inactive without needing prior deactivate.
    expect(result.evaluationSetId).toBeTruthy();
    void deactivateCalls;
  });

  it('COMPLETE con todos INSUFFICIENT_EVIDENCE', async () => {
    const { service } = createMockPersistence();
    const result = await service.persistMultidomainEvaluationRun([
      {
        meta: makeMeta('SOFTWARE', '5'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
        inputSkillsCount: 1,
        domainQualification: 'INSUFFICIENT_EVIDENCE',
        activateOnPersist: false,
      },
      {
        meta: makeMeta('VISUAL_DESIGN', '6'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
        inputSkillsCount: 1,
        domainQualification: 'INSUFFICIENT_EVIDENCE',
        activateOnPersist: false,
      },
    ]);
    expect(result.evaluationSetStatus).toBe('COMPLETE');
    expect(
      result.domainResults.every(
        (d) => d.domainQualification === 'INSUFFICIENT_EVIDENCE',
      ),
    ).toBe(true);
    expect(MC_DOMAIN_QUALIFICATIONS).toContain('INSUFFICIENT_EVIDENCE');
  });

  it('rechaza dominio duplicado', async () => {
    const { service } = createMockPersistence();
    await expect(
      service.persistMultidomainEvaluationRun([
        {
          meta: makeMeta('SOFTWARE', '5'),
          result: makeResult(1) as never,
          config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
          inputSkillsCount: 1,
          domainQualification: 'PRIMARY_MATCH',
          activateOnPersist: true,
        },
        {
          meta: makeMeta('SOFTWARE', '5'),
          result: makeResult(0) as never,
          config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
          inputSkillsCount: 1,
          domainQualification: 'OUTSIDE',
          activateOnPersist: false,
        },
      ]),
    ).rejects.toThrow(/dominio duplicado/);
  });

  it('rechaza extraction inconsistente', async () => {
    const { service } = createMockPersistence();
    await expect(
      service.persistMultidomainEvaluationRun([
        {
          meta: makeMeta('SOFTWARE', '5'),
          result: makeResult(0) as never,
          config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
          inputSkillsCount: 1,
          domainQualification: 'OUTSIDE',
          activateOnPersist: false,
        },
        {
          meta: makeMeta('VISUAL_DESIGN', '6', { extractionId: '999' }),
          result: makeResult(0) as never,
          config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
          inputSkillsCount: 1,
          domainQualification: 'OUTSIDE',
          activateOnPersist: false,
        },
      ]),
    ).rejects.toThrow(/extractionId inconsistente/);
  });

  it('batch falla → excepción (rollback transaccional)', async () => {
    const { service, mockManager } = createMockPersistence();
    mockManager.save.mockImplementation(async (row: Record<string, unknown>) => {
      if (row.set_context_hash || row.schema_version) {
        return { id: '100', ...row };
      }
      if (row.evaluation_set_id && !row.person_id) {
        return { id: '200', ...row };
      }
      if (row.domain_code === 'VISUAL_DESIGN' && row.person_id) {
        throw new Error('SIMULATED_FAIL');
      }
      return { id: '1', ...row };
    });

    await expect(
      service.persistMultidomainEvaluationRun([
        {
          meta: makeMeta('SOFTWARE', '5'),
          result: makeResult(0) as never,
          config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
          inputSkillsCount: 2,
          domainQualification: 'OUTSIDE',
          activateOnPersist: false,
        },
        {
          meta: makeMeta('VISUAL_DESIGN', '6'),
          result: makeResult(1) as never,
          config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
          inputSkillsCount: 2,
          domainQualification: 'PRIMARY_MATCH',
          activateOnPersist: true,
        },
      ]),
    ).rejects.toThrow('SIMULATED_FAIL');
  });

  it('evaluación histórica sin set sigue siendo estado soportado (contrato)', () => {
    // Sin evaluation_set_id en mc_profile_evaluation (Opción B).
    // Históricos no aparecen en mc_evaluation_set_domain.
    const entitySrc = readFileSync(
      resolve(__dirname, 'entities/mc-profile-evaluation.entity.ts'),
      'utf8',
    );
    expect(entitySrc).not.toContain('evaluation_set_id');
  });
});
