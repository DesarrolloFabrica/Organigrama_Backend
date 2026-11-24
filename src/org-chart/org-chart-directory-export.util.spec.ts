import {
  buildDirectoryExcelXml,
  directoryExportDateStamp,
  isRegularDocenteRole,
  shouldIncludeDirectoryRow,
  xmlEscape,
} from './org-chart-directory-export.util';

describe('org-chart-directory-export.util', () => {
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

  describe('fecha de los archivos (hora de Colombia)', () => {
    it('después de las 19:00 en Colombia conserva el día local (UTC ya cambió)', () => {
      // 2026-11-23 20:30 en Bogotá = 2026-11-24 01:30 UTC
      expect(directoryExportDateStamp(new Date('2026-11-24T01:30:00Z'))).toBe(
        '2026-11-23',
      );
    });

    it('a medianoche de Colombia ya es el día siguiente', () => {
      expect(directoryExportDateStamp(new Date('2026-11-24T05:00:00Z'))).toBe(
        '2026-11-24',
      );
    });
  });
});
