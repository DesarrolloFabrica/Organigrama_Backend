import {
  buildOrgChartVersionReadPlanCacheKey,
  isOrgChartPlantaEnabled,
  runWithOrgChartVersionReadPlan,
  type OrgChartVersionReadPlan,
} from './org-chart-version-read-plan';
import {
  composedRelationsCall,
  effectiveRelationsCte,
  visualRelationSqlSource,
  withOverlayQueryParams,
} from './org-chart-effective-relation.sql';
import { findActiveVisualRelationsByParentId } from './org-visual-relation.query';
import type { Repository } from 'typeorm';
import type { OrgVisualRelation } from './entities/org-visual-relation.entity';

function plan(
  overlayIds: string[],
  applyPlanta: boolean,
): OrgChartVersionReadPlan {
  return {
    globalVersionId: '4',
    overlays: overlayIds.map((versionId) => ({
      versionId,
      scopeCode: 'fabrica-contenidos',
      scopeLabel: 'Fábrica de contenidos',
      rootPersonId: '49',
    })),
    applyPlanta,
    cacheKey: buildOrgChartVersionReadPlanCacheKey(
      '4',
      overlayIds,
      applyPlanta,
    ),
  };
}

function within<T>(p: OrgChartVersionReadPlan, fn: () => T): T {
  return runWithOrgChartVersionReadPlan(p, fn) as T;
}

describe('isOrgChartPlantaEnabled (ORG_CHART_PLANTA_ENABLED + ORG_CHART_PLANTA_OVERLAY_ENABLED)', () => {
  const env = (vars: Record<string, string>) => vars as NodeJS.ProcessEnv;

  it('configuración actual de Cloud Run (solo OVERLAY=true): activa', () => {
    expect(
      isOrgChartPlantaEnabled(
        env({ ORG_CHART_PLANTA_OVERLAY_ENABLED: 'true' }),
      ),
    ).toBe(true);
  });

  it('sin ninguna variable: activa por defecto', () => {
    expect(isOrgChartPlantaEnabled(env({}))).toBe(true);
  });

  it.each([
    [{ ORG_CHART_PLANTA_ENABLED: 'false' }],
    [{ ORG_CHART_PLANTA_OVERLAY_ENABLED: 'false' }],
    [{ ORG_CHART_PLANTA_OVERLAY_ENABLED: ' FALSE ' }],
    [{ ORG_CHART_PLANTA_ENABLED: '0' }],
    [{ ORG_CHART_PLANTA_OVERLAY_ENABLED: 'off' }],
  ])('un false explícito apaga Planta: %o', (vars) => {
    expect(isOrgChartPlantaEnabled(env(vars))).toBe(false);
  });

  it('un false deliberado no lo anula la otra variable en true', () => {
    expect(
      isOrgChartPlantaEnabled(
        env({
          ORG_CHART_PLANTA_ENABLED: 'true',
          ORG_CHART_PLANTA_OVERLAY_ENABLED: 'false',
        }),
      ),
    ).toBe(false);
    expect(
      isOrgChartPlantaEnabled(
        env({
          ORG_CHART_PLANTA_ENABLED: 'false',
          ORG_CHART_PLANTA_OVERLAY_ENABLED: 'true',
        }),
      ),
    ).toBe(false);
  });

  it('ambas en true: activa', () => {
    expect(
      isOrgChartPlantaEnabled(
        env({
          ORG_CHART_PLANTA_ENABLED: '1',
          ORG_CHART_PLANTA_OVERLAY_ENABLED: 'yes',
        }),
      ),
    ).toBe(true);
  });

  it('vacío o no reconocido cuenta como no definido (no apaga)', () => {
    expect(
      isOrgChartPlantaEnabled(
        env({
          ORG_CHART_PLANTA_ENABLED: '',
          ORG_CHART_PLANTA_OVERLAY_ENABLED: 'quizas',
        }),
      ),
    ).toBe(true);
  });
});

describe('buildOrgChartVersionReadPlanCacheKey', () => {
  it('distingue global sin overlay de un overlay de Fábrica', () => {
    expect(buildOrgChartVersionReadPlanCacheKey('1', [])).toBe('g1|onone');
    expect(buildOrgChartVersionReadPlanCacheKey('1', ['9'])).toBe('g1|o9');
  });

  it('distingue la lectura con capa Planta', () => {
    expect(buildOrgChartVersionReadPlanCacheKey('4', ['6'], true)).toBe(
      'g4|o6|planta',
    );
  });
});

describe('visualRelationSqlSource', () => {
  it('usa la tabla original cuando no hay overlays en el plan', () => {
    const source = visualRelationSqlSource('r', '$2', '$3');
    expect(source.from).toBe('organigrama.org_visual_relation r');
    expect(source.versionPredicate).toBe('r.version_id = $2');
    expect(source.overlayIds).toEqual([]);
  });

  it('con Planta usa la función compuesta aunque no haya overlays', () => {
    const source = within(plan([], true), () =>
      visualRelationSqlSource('r', '$2', '$3'),
    );
    expect(source.from).toBe(
      'organigrama.org_chart_effective_relations_planta($2, ARRAY[]::bigint[]) r',
    );
    expect(source.versionPredicate).toBe('TRUE');
    expect(source.overlayIds).toEqual([]);
  });
});

describe('composedRelationsCall', () => {
  it('sin overlays ni Planta: tabla original', () => {
    expect(
      within(plan([], false), () => composedRelationsCall('$1', '$2')),
    ).toEqual({ call: null, overlayIds: [] });
  });

  it('overlays sin Planta (histórico): composición sin overrides de Orbit', () => {
    expect(
      within(plan(['6'], false), () => composedRelationsCall('$1', '$2')),
    ).toEqual({
      call: 'organigrama.org_chart_effective_relations($1, $2::bigint[])',
      overlayIds: ['6'],
    });
  });

  it('versión vigente con overlays: composición + Planta', () => {
    expect(
      within(plan(['6'], true), () => composedRelationsCall('$1', '$2')),
    ).toEqual({
      call: 'organigrama.org_chart_effective_relations_planta($1, $2::bigint[])',
      overlayIds: ['6'],
    });
  });

  it('con excepciones instaladas lee el grafo publicado (gana a Planta)', () => {
    const p = { ...plan(['6'], true), applyExceptions: true };
    expect(within(p, () => composedRelationsCall('$1', '$2'))).toEqual({
      call: 'organigrama.org_chart_effective_relations_published($1, $2::bigint[])',
      overlayIds: ['6'],
    });
  });

  it('las excepciones no aplican sin Planta (históricos)', () => {
    const p = { ...plan(['6'], false), applyExceptions: true };
    expect(within(p, () => composedRelationsCall('$1', '$2')).call).toBe(
      'organigrama.org_chart_effective_relations($1, $2::bigint[])',
    );
  });

  it('el CTE effective lee de la misma fuente', () => {
    const cte = within(plan(['6'], true), () =>
      effectiveRelationsCte('$2', '$3'),
    );
    expect(cte.sql).toContain(
      'FROM organigrama.org_chart_effective_relations_planta($2, $3::bigint[])',
    );
    expect(withOverlayQueryParams(['1082', '4'], cte.overlayIds)).toEqual([
      '1082',
      '4',
      ['6'],
    ]);
  });
});

describe('findActiveVisualRelationsByParentId', () => {
  function repo() {
    const find = jest.fn().mockResolvedValue([]);
    const query = jest.fn().mockResolvedValue([]);
    const relations = {
      find,
      query,
    } as unknown as Repository<OrgVisualRelation>;
    return { relations, find, query };
  }

  it('sin overlays ni Planta consulta la tabla por versión', async () => {
    const { relations, find, query } = repo();
    await within(plan([], false), () =>
      findActiveVisualRelationsByParentId(relations, '1082', '4'),
    );
    expect(find).toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('con Planta y sin overlays no envía parámetro de overlays', async () => {
    const { relations, query } = repo();
    await within(plan([], true), () =>
      findActiveVisualRelationsByParentId(relations, '1082', '4'),
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      'organigrama.org_chart_effective_relations_planta($1, ARRAY[]::bigint[])',
    );
    expect(sql).toContain('parent_person_id = $2');
    expect(params).toEqual(['4', '1082']);
  });

  it('con Planta y overlays envía global, padre y overlays', async () => {
    const { relations, query } = repo();
    await within(plan(['6'], true), () =>
      findActiveVisualRelationsByParentId(relations, '1082', '4'),
    );
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain(
      'organigrama.org_chart_effective_relations_planta($1, $3::bigint[])',
    );
    expect(params).toEqual(['4', '1082', ['6']]);
  });
});
