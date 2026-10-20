import type { DataSource } from 'typeorm';
import {
  buildChangeTokenSql,
  ORG_CHART_CHANGE_TOKEN_UNAVAILABLE,
  OrgChartChangeTokenService,
} from './org-chart-change-token.service';
import type { OrgChartService } from './org-chart.service';
import type { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgChartHierarchyExceptionService } from './org-chart-hierarchy-exception.service';

describe('buildChangeTokenSql', () => {
  it('incluye overrides de Planta cuando la capa está activa', () => {
    const sql = buildChangeTokenSql(true);
    expect(sql).toContain('core.planta_org_override');
    expect(sql).toContain('organigrama.org_visual_relation');
    expect(sql).toContain('core.person');
    expect(sql).toContain('vacancies.vacancy');
  });

  it('omite Planta en bases sin la tabla', () => {
    expect(buildChangeTokenSql(false)).not.toContain('planta_org_override');
  });

  it('incluye el estado de las excepciones provisionales si la capa existe', () => {
    expect(buildChangeTokenSql(true, true)).toContain(
      'organigrama.org_chart_hierarchy_exception',
    );
    expect(buildChangeTokenSql(true, false)).not.toContain(
      'org_chart_hierarchy_exception',
    );
  });

  it('incluye el estado de las supresiones de aristas si la tabla existe', () => {
    expect(buildChangeTokenSql(true, true, true)).toContain(
      'organigrama.org_chart_relation_suppression',
    );
    expect(buildChangeTokenSql(true, true, false)).not.toContain(
      'org_chart_relation_suppression',
    );
  });
});

describe('OrgChartChangeTokenService', () => {
  let query: jest.Mock;
  let clearResponseCaches: jest.Mock;
  let clearDescendantCache: jest.Mock;
  let service: OrgChartChangeTokenService;

  beforeEach(() => {
    jest.useFakeTimers();
    query = jest.fn();
    clearResponseCaches = jest.fn();
    clearDescendantCache = jest.fn();
    service = new OrgChartChangeTokenService(
      { query } as unknown as DataSource,
      { clearResponseCaches } as unknown as OrgChartService,
      { clearDescendantCache } as unknown as OrgChartVisibilityService,
      {
        isPublishedLayerAvailable: jest.fn().mockResolvedValue(true),
        isSuppressionLayerAvailable: jest.fn().mockResolvedValue(true),
      } as unknown as OrgChartHierarchyExceptionService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('devuelve la huella y no vacía caches en la primera lectura', async () => {
    query.mockResolvedValueOnce([{ token: 'a' }]);

    await expect(service.getChangeToken()).resolves.toEqual({ token: 'a' });
    expect(clearResponseCaches).not.toHaveBeenCalled();
  });

  it('reutiliza la huella dentro de la ventana de memo', async () => {
    query.mockResolvedValue([{ token: 'a' }]);

    await service.getChangeToken();
    await service.getChangeToken();

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('vacía caches del árbol y de visibilidad cuando la huella cambia', async () => {
    query
      .mockResolvedValueOnce([{ token: 'a' }])
      .mockResolvedValueOnce([{ token: 'a' }])
      .mockResolvedValueOnce([{ token: 'b' }]);

    await service.getChangeToken();
    jest.advanceTimersByTime(6_000);
    await service.getChangeToken();
    expect(clearResponseCaches).not.toHaveBeenCalled();

    jest.advanceTimersByTime(6_000);
    await expect(service.getChangeToken()).resolves.toEqual({ token: 'b' });
    expect(clearResponseCaches).toHaveBeenCalledTimes(1);
    expect(clearDescendantCache).toHaveBeenCalledTimes(1);
  });

  it('responde unavailable si la consulta falla', async () => {
    query.mockRejectedValueOnce(new Error('boom'));

    await expect(service.getChangeToken()).resolves.toEqual({
      token: ORG_CHART_CHANGE_TOKEN_UNAVAILABLE,
    });
    expect(clearResponseCaches).not.toHaveBeenCalled();
  });
});
