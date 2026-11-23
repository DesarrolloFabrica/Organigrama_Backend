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

  it.each([undefined, '', '   ', ' , '])(
    'deshabilitado por defecto: ORG_CHART_DIRECTORY_EXPORT_EMAILS=%p no autoriza a nadie',
    (value) => {
      if (value === undefined) {
        delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
      } else {
        process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = value;
      }
      expect(getOrgChartDirectoryExportEmailsSet().size).toBe(0);
      expect(
        isOrgChartDirectoryExportEmail('desarrollofabrica@cun.edu.co'),
      ).toBe(false);
      expect(isOrgChartDirectoryExportEmail('raul_valencia@cun.edu.co')).toBe(
        false,
      );
    },
  );

  it('lee correos desde ORG_CHART_DIRECTORY_EXPORT_EMAILS', () => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS =
      ' Uno@cun.edu.co , dos@cun.edu.co ';
    expect(getOrgChartDirectoryExportEmailsSet()).toEqual(
      new Set(['uno@cun.edu.co', 'dos@cun.edu.co']),
    );
  });

  it('autoriza solo los correos listados, sin distinguir mayúsculas', () => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS =
      'autorizado.sintetico@example.test';
    expect(
      isOrgChartDirectoryExportEmail('  AUTORIZADO.SINTETICO@example.test '),
    ).toBe(true);
    expect(isOrgChartDirectoryExportEmail('otro@example.test')).toBe(false);
    expect(isOrgChartDirectoryExportEmail(null)).toBe(false);
  });

  it('rechaza un correo no autorizado', () => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS =
      'autorizado.sintetico@example.test';
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
          documentType: 'CC',
          document: '123',
          eduEmail: 'ana_perez@cun.edu.co',
          personalEmail: 'ana@gmail.com',
          phone: '3001234567',
          address: 'Calle 1',
          areaName: 'Operaciones',
          schoolName: '',
          programName: '',
          roleName: 'COORDINADOR',
          hierarchyName: 'Nivel 3',
          contractTypeName: 'Indefinido',
          bossName: 'Raúl Valencia',
          bossEduEmail: 'raul_valencia@cun.edu.co',
          regionName: 'Bogotá',
          cityName: 'Bogotá',
          campusName: 'Calle 12',
          gender: 'F',
          maritalStatus: 'Soltera',
          bornDate: '1990-01-01',
          bornCity: 'Bogotá',
          emergencyName: 'Luis Pérez',
          emergencyPhone: '3100000000',
          emergencyRelationship: 'Padre',
          skills: 'Excel (Ofimática)',
        },
      ],
      'v-current (activa)',
    );
    expect(xml).toContain('Luis Pérez');
    expect(xml).toContain('3100000000');
    expect(xml).toContain('Padre');
    expect(xml).toContain('Operaciones');
    expect(xml).toContain('Raúl Valencia');
    expect(xml).toContain('Excel (Ofimática)');
    expect(xml).toContain('ana@gmail.com');
  });
});
