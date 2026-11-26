import { DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS } from './org-chart-versioning.constants';
import {
  getOrgChartVersionAdminEmailsSet,
  isOrgChartVersionAdminEmail,
} from './org-chart-versioning.util';

describe('org-chart-versioning.util', () => {
  const originalEnv = process.env.ORG_CHART_VERSION_ADMIN_EMAILS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ORG_CHART_VERSION_ADMIN_EMAILS;
    } else {
      process.env.ORG_CHART_VERSION_ADMIN_EMAILS = originalEnv;
    }
  });

  it('usa defaults cuando ORG_CHART_VERSION_ADMIN_EMAILS está vacía', () => {
    delete process.env.ORG_CHART_VERSION_ADMIN_EMAILS;
    expect(getOrgChartVersionAdminEmailsSet()).toEqual(
      new Set(DEFAULT_ORG_CHART_VERSION_ADMIN_EMAILS),
    );
  });

  it('por defecto solo autoriza a la cuenta de desarrollo', () => {
    delete process.env.ORG_CHART_VERSION_ADMIN_EMAILS;
    expect(getOrgChartVersionAdminEmailsSet()).toEqual(
      new Set(['desarrollofabrica@cun.edu.co']),
    );
    for (const email of [
      'iron_fuentes@cun.edu.co',
      'raul_valencia@cun.edu.co',
      'haider_bello@cun.edu.co',
      'sara_murillofo@cun.edu.co',
    ]) {
      expect(isOrgChartVersionAdminEmail(email)).toBe(false);
    }
  });

  it('lee correos desde ORG_CHART_VERSION_ADMIN_EMAILS', () => {
    process.env.ORG_CHART_VERSION_ADMIN_EMAILS =
      ' Uno@cun.edu.co , dos@cun.edu.co ';
    expect(getOrgChartVersionAdminEmailsSet()).toEqual(
      new Set(['uno@cun.edu.co', 'dos@cun.edu.co']),
    );
  });

  it('isOrgChartVersionAdminEmail normaliza mayúsculas', () => {
    delete process.env.ORG_CHART_VERSION_ADMIN_EMAILS;
    expect(isOrgChartVersionAdminEmail('DesarrolloFabrica@cun.edu.co')).toBe(
      true,
    );
    expect(isOrgChartVersionAdminEmail('noautorizado@cun.edu.co')).toBe(false);
  });
});
