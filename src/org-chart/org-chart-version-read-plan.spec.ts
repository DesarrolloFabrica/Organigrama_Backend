import { buildOrgChartVersionReadPlanCacheKey } from './org-chart-version-read-plan';
import { visualRelationSqlSource } from './org-chart-effective-relation.sql';

describe('buildOrgChartVersionReadPlanCacheKey', () => {
  it('distingue global sin overlay de un overlay de Fábrica', () => {
    expect(buildOrgChartVersionReadPlanCacheKey('1', [])).toBe('g1|onone');
    expect(buildOrgChartVersionReadPlanCacheKey('1', ['9'])).toBe('g1|o9');
  });
});

describe('visualRelationSqlSource', () => {
  it('usa la tabla original cuando no hay overlays en el plan', () => {
    const source = visualRelationSqlSource('r', '$2', '$3');
    expect(source.from).toBe('organigrama.org_visual_relation r');
    expect(source.versionPredicate).toBe('r.version_id = $2');
    expect(source.overlayIds).toEqual([]);
  });
});
