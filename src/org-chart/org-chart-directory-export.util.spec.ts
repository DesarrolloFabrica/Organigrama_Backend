import {
  BASE_GENERAL_SHEET_NAME,
  buildDirectoryExcelXml,
  buildDirectoryWorkbookXml,
  DIRECTORY_EXPORT_COLUMNS,
  type DirectoryExportRow,
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

  describe('libro con varias hojas (SpreadsheetML 2003)', () => {
    /**
     * Copia literal del generador aprobado en 2928dee (una sola hoja
     * «Organigrama»): referencia para comprobar que la «Base general» no
     * cambia de presentación.
     */
    function legacyDirectoryExcelXml(
      rows: DirectoryExportRow[],
      versionLabel: string,
    ): string {
      const cell = (value: string) =>
        `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
      const headerCell = (value: string) =>
        `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
      const header = DIRECTORY_EXPORT_COLUMNS.map(headerCell).join('');
      const meta = `<Row><Cell ss:MergeAcross="${DIRECTORY_EXPORT_COLUMNS.length - 1}"><Data ss:Type="String">${xmlEscape(
        `Operaciones — ${versionLabel}`,
      )}</Data></Cell></Row>`;
      const body = rows
        .map((r) => {
          const values: string[] = [
            r.fullName,
            r.documentType,
            r.document,
            r.eduEmail,
            r.personalEmail,
            r.phone,
            r.address,
            r.areaName,
            r.schoolName,
            r.programName,
            r.roleName,
            r.hierarchyName,
            r.contractTypeName,
            r.bossName,
            r.bossEduEmail,
            r.regionName,
            r.cityName,
            r.campusName,
            r.gender,
            r.maritalStatus,
            r.bornDate,
            r.bornCity,
            r.emergencyName,
            r.emergencyPhone,
            r.emergencyRelationship,
            r.skills,
          ];
          return `<Row>${values.map(cell).join('')}</Row>`;
        })
        .join('');
      return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Organigrama">
    <Table>
      ${meta}
      <Row>${header}</Row>
      ${body}
    </Table>
  </Worksheet>
</Workbook>`;
    }

    const row = (fullName: string): DirectoryExportRow =>
      Object.fromEntries(
        [
          'fullName',
          'documentType',
          'document',
          'eduEmail',
          'personalEmail',
          'phone',
          'address',
          'areaName',
          'schoolName',
          'programName',
          'roleName',
          'hierarchyName',
          'contractTypeName',
          'bossName',
          'bossEduEmail',
          'regionName',
          'cityName',
          'campusName',
          'gender',
          'maritalStatus',
          'bornDate',
          'bornCity',
          'emergencyName',
          'emergencyPhone',
          'emergencyRelationship',
          'skills',
        ].map((k) => [k, k === 'fullName' ? fullName : `${k}-${fullName}`]),
      ) as DirectoryExportRow;
    const worksheets = (xml: string) =>
      [
        ...xml.matchAll(
          /<Worksheet ss:Name="([^"]*)">([\s\S]*?)<\/Worksheet>/g,
        ),
      ].map((m) => ({ name: m[1], body: m[2] }));

    it('la base general conserva sus 26 columnas, título y filas', () => {
      const xml = buildDirectoryExcelXml(
        [row('Ana'), row('Beto')],
        'v4 (activa)',
      );
      const [sheet, ...rest] = worksheets(xml);
      expect(rest).toHaveLength(0);
      expect(sheet.name).toBe(BASE_GENERAL_SHEET_NAME);
      expect(sheet.body).toContain('Operaciones — v4 (activa)');
      const rows = [...sheet.body.matchAll(/<Row[^>]*>([\s\S]*?)<\/Row>/g)];
      expect(rows).toHaveLength(4); // título + encabezados + 2 personas
      const headers = [
        ...rows[1][1].matchAll(/<Data[^>]*>([^<]*)<\/Data>/g),
      ].map((m) => m[1]);
      expect(headers).toEqual([...DIRECTORY_EXPORT_COLUMNS]);
      expect(headers).toHaveLength(26);
      expect([...rows[2][1].matchAll(/<Cell>/g)]).toHaveLength(26);
    });

    it('la base general es idéntica al Excel aprobado (2928dee), salvo el nombre de la hoja', () => {
      const rows = [row('Ana'), row('Beto & Cía <S.A.>')];
      const nuevo = worksheets(buildDirectoryExcelXml(rows, 'v4 (activa)'))[0];
      expect(nuevo.body).toBe(
        worksheets(legacyDirectoryExcelXml(rows, 'v4 (activa)'))[0].body,
      );
      // Sin las mejoras visuales de las pestañas nuevas.
      expect(nuevo.body).not.toMatch(
        /<Column |AutoFilter|FreezePanes|_FilterDatabase|CoordHeader|CoordTitle/,
      );
    });

    it('pestañas nuevas: anchos de 26 columnas, encabezado inmovilizado y autofiltro', () => {
      const xml = buildDirectoryWorkbookXml([
        {
          name: 'Base general',
          title: 'T',
          rows: [row('Ana'), row('Beto'), row('Caro')],
          layout: 'original',
        },
        {
          name: "B2B & Ventas d'Or",
          title: 'T2',
          rows: [row('Ana')],
          layout: 'coordinacion',
        },
        { name: 'Vacía', title: 'T3', rows: [], layout: 'coordinacion' },
      ]);
      const sheets = worksheets(xml);
      expect(sheets.map((s) => s.name)).toEqual([
        'Base general',
        "B2B &amp; Ventas d'Or",
        'Vacía',
      ]);
      expect(sheets[0].body).not.toContain('AutoFilter');
      for (const sheet of sheets.slice(1)) {
        expect(sheet.body.match(/<Column ss:Width="\d+"\/>/g)).toHaveLength(26);
        expect(sheet.body).toContain('<FreezePanes/>');
        expect(sheet.body).toContain('<SplitHorizontal>2</SplitHorizontal>');
        expect(sheet.body).toContain('ss:StyleID="CoordHeader"');
        expect(sheet.body).not.toContain('<Selected/>');
      }
      expect(sheets[1].body).toContain('<AutoFilter x:Range="R2C1:R3C26"');
      // Apóstrofo duplicado dentro del nombre citado, & escapado para XML.
      expect(sheets[1].body).toContain(
        `RefersTo="='B2B &amp; Ventas d''Or'!R2C1:R3C26"`,
      );
      expect(sheets[2].body).toContain('<AutoFilter x:Range="R2C1:R2C26"');
      // El estilo original del encabezado sigue siendo solo negrita.
      expect(xml).toMatch(
        /<Style ss:ID="Header">\s*<Font ss:Bold="1"\/>\s*<\/Style>/,
      );
      expect(xml).toContain('xmlns:x="urn:schemas-microsoft-com:office:excel"');
    });
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
