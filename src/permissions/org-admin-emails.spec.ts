import { isBuiltInOrgAdminEmail } from './org-admin-emails';

describe('isBuiltInOrgAdminEmail', () => {
  it('reconoce la cuenta técnica de fábrica', () => {
    expect(isBuiltInOrgAdminEmail('desarrollofabrica@cun.edu.co')).toBe(true);
    expect(isBuiltInOrgAdminEmail('  DesarrolloFabrica@cun.edu.co ')).toBe(
      true,
    );
  });

  it('no marca correos de colaboradores', () => {
    expect(isBuiltInOrgAdminEmail('raul_valencia@cun.edu.co')).toBe(false);
    expect(isBuiltInOrgAdminEmail(null)).toBe(false);
    expect(isBuiltInOrgAdminEmail('')).toBe(false);
  });
});
