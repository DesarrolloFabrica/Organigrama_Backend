import { DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS } from './org-chart-directory-export.constants';
import {
  buildDirectoryExcelXml,
  getOrgChartDirectoryExportEmailsSet,
  isOrgChartDirectoryExportEmail,
  isRegularDocenteRole,
  shouldIncludeDirectoryRow,
  xmlEscape,
} from './org-chart-directory-export.util';

describe('org-chart-directory-export.util', () => {
  const originalEnv = process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    } else {
      process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = originalEnv;
    }
  });

  it('usa defaults cuando ORG_CHART_DIRECTORY_EXPORT_EMAILS está vacía', () => {
    delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    expect(getOrgChartDirectoryExportEmailsSet()).toEqual(
      new Set(DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS),
    );
  });

  it('lee correos desde ORG_CHART_DIRECTORY_EXPORT_EMAILS', () => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS =
      ' Uno@cun.edu.co , dos@cun.edu.co ';
    expect(getOrgChartDirectoryExportEmailsSet()).toEqual(
      new Set(['uno@cun.edu.co', 'dos@cun.edu.co']),
    );
  });

  it.each(DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS)(
    'autoriza %s',
    (email) => {
      delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
      expect(isOrgChartDirectoryExportEmail(email.toUpperCase())).toBe(true);
    },
  );

  it('rechaza un correo no autorizado', () => {
    delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    expect(isOrgChartDirectoryExportEmail('otro_usuario@cun.edu.co')).toBe(
      false,
    );
  });

  it('excluye docentes de planta e incluye líderes docentes', () => {
    expect(isRegularDocenteRole('DOCENTE')).toBe(true);
    expect(isRegularDocenteRole('DOCENTE FACILITADOR')).toBe(true);
    expect(isRegularDocenteRole('LÍDER DOCENTE')).toBe(false);
    expect(isRegularDocenteRole('LIDER DOCENTE')).toBe(false);
    expect(isRegularDocenteRole('COORDINADOR')).toBe(false);
  });

  it('shouldIncludeDirectoryRow filtra vacantes y docentes', () => {
    expect(
      shouldIncludeDirectoryRow({
        fullName: 'Ana Pérez',
        document: '123',
        roleName: 'COORDINADOR',
      }),
    ).toBe(true);
    expect(
      shouldIncludeDirectoryRow({
        fullName: 'Ana Pérez',
        document: '123',
        roleName: 'DOCENTE',
      }),
    ).toBe(false);
    expect(
      shouldIncludeDirectoryRow({
        fullName: 'VACANTE - COORDINADOR',
        document: 'VAC-1',
        roleName: 'COORDINADOR',
      }),
    ).toBe(false);
    expect(
      shouldIncludeDirectoryRow({
        fullName: 'Líder equipo',
        document: '99',
        roleName: 'LÍDER DOCENTE',
      }),
    ).toBe(true);
  });

  it('xmlEscape y Excel incluyen contacto de emergencia', () => {
    expect(xmlEscape('A & B <C>')).toBe('A &amp; B &lt;C&gt;');
    const xml = buildDirectoryExcelXml(
      [
        {
          fullName: 'Ana Pérez',
          document: '123',
          eduEmail: 'ana_perez@cun.edu.co',
          phone: '3001234567',
          areaName: 'Operaciones',
          schoolName: '',
          programName: '',
          roleName: 'COORDINADOR',
          hierarchyName: 'Nivel 3',
          bossName: 'Raúl Valencia',
          bossEduEmail: 'raul_valencia@cun.edu.co',
          emergencyName: 'Luis Pérez',
          emergencyPhone: '3100000000',
          emergencyRelationship: 'Padre',
        },
      ],
      'v-current (activa)',
    );
    expect(xml).toContain('Luis Pérez');
    expect(xml).toContain('3100000000');
    expect(xml).toContain('Padre');
    expect(xml).toContain('Operaciones');
    expect(xml).toContain('Raúl Valencia');
  });
});
