/**
 * MC1.1B cierre — persistencia atómica multidominio + desactivación global.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { McPa2Service } from './mc-pa2.service';
import { McProfileEvaluation } from './entities';

function makeMeta(domainCode: string, domainId: string) {
  return {
    personId: '42',
    personCvId: '1',
    extractionId: '10',
    enrichmentId: '20',
    evidenceEvaluationId: '30',
    catalogVersionId: '2',
    catalogVersion: 'mc1.8-2026-07-28',
    domainId,
    domainCode,
    mappingHash: 'a'.repeat(64),
    configHash: 'b'.repeat(64),
    mappingPackCode: `${domainCode.toLowerCase()}-mappings`,
    mappingPackVersion: '1.0.0',
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
  };
}

describe('McPa2Service persistencia MC1.1B cierre', () => {
  const serviceSource = readFileSync(
    resolve(__dirname, 'mc-pa2.service.ts'),
    'utf8',
  );

  it('expone persistMultidomainEvaluationRun y desactivación global', () => {
    expect(serviceSource).toContain('persistMultidomainEvaluationRun');
    expect(serviceSource).toContain(
      'desactivación global por persona (máx. 1 activa publicada)',
    );
    expect(serviceSource).not.toMatch(
      /Desactivar evaluaciones activas previas de la misma persona\+dominio/,
    );
  });

  it('batch: 3 dominios, 1 activo, 2 inactivos; desactiva todas las previas', async () => {
    const savedRows: Array<{
      domain_code: string;
      is_active: boolean;
      domain_qualification: string | null;
    }> = [];
    const capturedWheres: string[] = [];
    const capturedParams: Record<string, unknown>[] = [];

    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn(function (
        this: typeof mockQb,
        sql: string,
        params?: Record<string, unknown>,
      ) {
        capturedWheres.push(sql);
        if (params) capturedParams.push(params);
        return this;
      }),
      andWhere: jest.fn(function (
        this: typeof mockQb,
        sql: string,
        params?: Record<string, unknown>,
      ) {
        capturedWheres.push(sql);
        if (params) capturedParams.push(params);
        return this;
      }),
      execute: jest.fn().mockResolvedValue({ affected: 2 }),
    };

    const mockManager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      create: jest.fn((_, data) => data),
      save: jest.fn(async (row: Record<string, unknown>) => {
        if (row.set_context_hash || row.schema_version) {
          return { id: '100', ...row };
        }
        if (row.evaluation_set_id && !row.person_id) {
          return { id: '200', ...row };
        }
        if (row.domain_code && row.person_id) {
          savedRows.push({
            domain_code: String(row.domain_code),
            is_active: Boolean(row.is_active),
            domain_qualification: (row.domain_qualification as string) ?? null,
          });
          return { id: String(savedRows.length), ...row };
        }
        return { id: '999', ...row };
      }),
    };

    const mockDataSource = {
      transaction: jest.fn(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
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

    const outcomes = result.domainResults;
    expect(result.evaluationSetId).toBeTruthy();
    expect(outcomes).toHaveLength(3);
    expect(savedRows.filter((r) => r.is_active)).toHaveLength(1);
    expect(savedRows.find((r) => r.is_active)?.domain_code).toBe(
      'VISUAL_DESIGN',
    );
    expect(savedRows.find((r) => r.domain_code === 'SOFTWARE')).toEqual({
      domain_code: 'SOFTWARE',
      is_active: false,
      domain_qualification: 'OUTSIDE',
    });
    expect(
      savedRows.find((r) => r.domain_code === 'AUDIOVISUAL_PRODUCTION'),
    ).toEqual({
      domain_code: 'AUDIOVISUAL_PRODUCTION',
      is_active: false,
      domain_qualification: 'SECONDARY_SIGNAL',
    });

    // Desactivación global de publicación: person_id sin filtrar por dominio
    const deactivateSql = capturedWheres.filter((w) =>
      w.includes('person_id = :personId'),
    );
    expect(deactivateSql.length).toBeGreaterThan(0);
    expect(deactivateSql.join(' ')).not.toMatch(/domain_code/);
    expect(capturedParams.some((p) => p.personId === '42')).toBe(true);
    expect(mockQb.update).toHaveBeenCalledWith(McProfileEvaluation);
  });

  it('batch sin ganador: no desactiva activas previas', async () => {
    const mockQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const mockManager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      create: jest.fn((_, data) => data),
      save: jest.fn(async (row: Record<string, unknown>) => {
        if (row.set_context_hash || row.schema_version) {
          return { id: '100', ...row };
        }
        if (row.evaluation_set_id && !row.person_id) {
          return { id: '200', ...row };
        }
        return { id: '1', ...row };
      }),
    };
    const mockDataSource = {
      transaction: jest.fn(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
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

    await service.persistMultidomainEvaluationRun([
      {
        meta: makeMeta('SOFTWARE', '5'),
        result: makeResult(0) as never,
        config: { engineRulesVersion: 'pa2-software-1.1.0' } as never,
        inputSkillsCount: 3,
        domainQualification: 'OUTSIDE',
        activateOnPersist: false,
      },
    ]);

    expect(mockQb.update).not.toHaveBeenCalledWith(McProfileEvaluation);
  });

  it('batch rechaza más de un ganador', async () => {
    const service = new McPa2Service(
      { transaction: jest.fn() } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOne: jest.fn() } as never,
      {} as never,
    );

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
          meta: makeMeta('VISUAL_DESIGN', '6'),
          result: makeResult(1) as never,
          config: { engineRulesVersion: 'pa2-visual-design-1.1.0' } as never,
          inputSkillsCount: 1,
          domainQualification: 'PRIMARY_MATCH',
          activateOnPersist: true,
        },
      ]),
    ).rejects.toThrow(/máximo 1/);
  });

  it('batch falla → transaction no confirma (rollback)', async () => {
    const mockManager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
      create: jest.fn((_, data) => data),
      save: jest.fn(async (row: Record<string, unknown>) => {
        if (row.set_context_hash || row.schema_version) {
          return { id: '100', ...row };
        }
        if (row.evaluation_set_id && !row.person_id) {
          return { id: '200', ...row };
        }
        if (row.domain_code === 'SOFTWARE') {
          return { id: '1', domain_code: 'SOFTWARE' };
        }
        throw new Error('SIMULATED_FAIL');
      }),
    };
    const mockDataSource = {
      transaction: jest.fn(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
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
});
