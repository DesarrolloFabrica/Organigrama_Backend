/**
 * MC1.10.3 — Aislamiento de desactivación en persistEvaluation (person_id + domain_code).
 * Garantiza que persistir evaluación de persona A no desactiva evaluaciones de persona B.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { McPa2Service } from './mc-pa2.service';
import { McProfileEvaluation } from './entities';

describe('McPa2Service persistEvaluation team isolation (MC1.10.3)', () => {
  const serviceSource = readFileSync(
    resolve(__dirname, 'mc-pa2.service.ts'),
    'utf8',
  );

  const deactivationBlock = (() => {
    const start = serviceSource.indexOf(
      'MC1.1B: desactivación global por persona',
    );
    const end = serviceSource.indexOf(
      'Inactiva: no desactiva activas previas',
      start,
    );
    return serviceSource.slice(start, end);
  })();

  it('criterio SQL de desactivación usa person_id global (MC1.1B; no scope de equipo)', () => {
    expect(deactivationBlock).toContain('person_id = :personId');
    expect(deactivationBlock).toContain('is_active = TRUE');
    expect(deactivationBlock).not.toMatch(/team_id|leader_id|area_id|person_cv_id/);
    // Tras MC1.1B la desactivación al activar es global (sin domain_code).
    expect(deactivationBlock).not.toContain('domain_code = :domainCode');
  });

  it('desactivación mock: persona A no afecta persona B', async () => {
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
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    const mockManager = {
      query: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQb),
      create: jest.fn((_, data) => data),
      save: jest.fn().mockResolvedValue({ id: '999' }),
    };

    const mockDataSource = {
      transaction: jest.fn(async (cb: (m: typeof mockManager) => Promise<unknown>) =>
        cb(mockManager),
      ),
    } as unknown as DataSource;

    const mockEvaluations = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const service = new McPa2Service(
      mockDataSource,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      mockEvaluations as never,
      {} as never,
    );

    const personA = '1015482688';
    const personB = '1032488010';

    type PersistFn = (params: {
      meta: {
        personId: string;
        personCvId: string;
        extractionId: string;
        enrichmentId: string;
        evidenceEvaluationId: string;
        catalogVersionId: string;
        catalogVersion: string;
        domainId: string;
        domainCode: string;
        mappingHash: string;
        configHash: string;
        mappingPackCode: string;
        mappingPackVersion: string;
        sourceHash: string;
        algorithmVersion: string;
        evaluationContextHash: string;
      };
      result: {
        specialtyResults: [];
        activeCount: number;
        emergentCount: number;
        hiddenCount: number;
        defaultSpecialtyCode: null;
        warnings: [];
        engineRulesVersion: string;
        configHash: string;
      };
      config: { engineRulesVersion: string };
      inputSkillsCount: number;
    }) => Promise<unknown>;

    const persist = (service as unknown as { persistEvaluation: PersistFn })
      .persistEvaluation;

    await persist.call(service, {
      meta: {
        personId: personA,
        personCvId: '1',
        extractionId: '10',
        enrichmentId: '20',
        evidenceEvaluationId: '30',
        catalogVersionId: '2',
        catalogVersion: 'mc1.8-2026-07-28',
        domainId: '5',
        domainCode: 'VISUAL_DESIGN',
        mappingHash: 'a'.repeat(64),
        configHash: 'b'.repeat(64),
        mappingPackCode: 'visual-design-mappings',
        mappingPackVersion: 'mc1.8-visual-2026-07-28',
        sourceHash: 'c'.repeat(64),
        algorithmVersion: 'mc-pa2-algo-lexico-v1',
        evaluationContextHash: 'd'.repeat(64),
      },
      result: {
        specialtyResults: [],
        activeCount: 1,
        emergentCount: 0,
        hiddenCount: 0,
        defaultSpecialtyCode: null,
        warnings: [],
        engineRulesVersion: 'pa2-visual-design-1.1.0',
        configHash: 'b'.repeat(64),
      },
      config: { engineRulesVersion: 'pa2-visual-design-1.1.0' },
      inputSkillsCount: 12,
    });

    const personIdParams = capturedParams
      .map((p) => p.personId)
      .filter(Boolean);

    expect(personIdParams).toContain(personA);
    expect(personIdParams).not.toContain(personB);
    expect(capturedWheres.join(' ')).toMatch(/person_id = :personId/);
    expect(capturedWheres.join(' ')).not.toMatch(/domain_code/);
    expect(mockQb.update).toHaveBeenCalledWith(McProfileEvaluation);
  });
});
