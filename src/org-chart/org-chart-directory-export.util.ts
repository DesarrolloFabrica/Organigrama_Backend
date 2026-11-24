import { isVacancyDisplayName, isVacancyRoleName } from './org-chart-vacancy';

// La autorización de los exportadores vive en
// org-chart-directory-export.permissions.ts (permisos en core.person_permission).

function normalizeRoleName(roleName: string | null | undefined): string {
  return (roleName ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Docente de planta (se excluye del Excel).
 * Los líderes docentes (`LÍDER DOCENTE`, etc.) sí se incluyen.
 */
export function isRegularDocenteRole(
  roleName: string | null | undefined,
): boolean {
  const name = normalizeRoleName(roleName);
  if (!name.includes('docente')) return false;
  if (name.includes('lider')) return false;
  return true;
}

export function shouldIncludeDirectoryRow(row: {
  fullName: string | null | undefined;
  document: string | null | undefined;
  roleName: string | null | undefined;
}): boolean {
  if (isVacancyDisplayName(row.fullName)) return false;
  if ((row.document ?? '').trim().toUpperCase().startsWith('VAC-')) {
    return false;
  }
  if (isVacancyRoleName(row.roleName)) return false;
  if (isRegularDocenteRole(row.roleName)) return false;
  return true;
}

/** Zona horaria institucional para la fecha de los archivos exportados. */
export const DIRECTORY_EXPORT_TIME_ZONE = 'America/Bogota';

/**
 * Fecha AAAA-MM-DD en hora de Colombia (UTC−5, sin horario de verano).
 * Con `toISOString()` (UTC) una descarga después de las 19:00 salía con la
 * fecha del día siguiente.
 */
export function directoryExportDateStamp(now: Date = new Date()): string {
  // en-CA produce AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DIRECTORY_EXPORT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DIRECTORY_EXPORT_COLUMNS = [
  'Nombre',
  'Tipo de documento',
  'Documento',
  'Correo institucional',
  'Correo personal',
  'Teléfono',
  'Dirección',
  'Área',
  'Escuela',
  'Programa',
  'Cargo',
  'Nivel',
  'Tipo de contrato',
  'Jefe',
  'Correo del jefe',
  'Región',
  'Ciudad',
  'Campus',
  'Género',
  'Estado civil',
  'Fecha de nacimiento',
  'Ciudad de nacimiento',
  'Contacto de emergencia',
  'Teléfono de emergencia',
  'Parentesco',
  'Skills',
] as const;

export type DirectoryExportRow = {
  fullName: string;
  documentType: string;
  document: string;
  eduEmail: string;
  personalEmail: string;
  phone: string;
  address: string;
  areaName: string;
  schoolName: string;
  programName: string;
  roleName: string;
  hierarchyName: string;
  contractTypeName: string;
  bossName: string;
  bossEduEmail: string;
  regionName: string;
  cityName: string;
  campusName: string;
  gender: string;
  maritalStatus: string;
  bornDate: string;
  bornCity: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  skills: string;
};

function cell(value: string): string {
  return `<Cell><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

function headerCell(value: string, styleId = 'Header'): string {
  return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

/** Nombre de la primera hoja: el directorio completo (contenido histórico). */
export const BASE_GENERAL_SHEET_NAME = 'Base general';

/**
 * Ancho (puntos) de cada una de las 26 columnas en las pestañas por
 * coordinación, en el mismo orden que `DIRECTORY_EXPORT_COLUMNS`. La «Base
 * general» conserva su presentación original (sin anchos fijos).
 */
const DIRECTORY_EXPORT_COLUMN_WIDTHS: readonly number[] = [
  220, 70, 90, 200, 190, 90, 180, 170, 150, 180, 230, 60, 140, 230, 200, 90,
  100, 120, 60, 80, 90, 110, 170, 110, 90, 300,
];

/**
 * Una hoja del libro: título (fila 1), encabezados (fila 2) y una fila por
 * persona, siempre con las mismas 26 columnas.
 *
 * - `original`: presentación aprobada de la «Base general», idéntica a la
 *   del Excel anterior (título y encabezados en negrita, sin anchos ni filtros).
 * - `coordinacion`: pestañas nuevas, con anchos de columna, encabezado
 *   inmovilizado y autofiltro.
 */
export type DirectoryExportSheet = {
  name: string;
  title: string;
  rows: DirectoryExportRow[];
  layout?: 'original' | 'coordinacion';
};

function rowValues(row: DirectoryExportRow): string[] {
  return [
    row.fullName,
    row.documentType,
    row.document,
    row.eduEmail,
    row.personalEmail,
    row.phone,
    row.address,
    row.areaName,
    row.schoolName,
    row.programName,
    row.roleName,
    row.hierarchyName,
    row.contractTypeName,
    row.bossName,
    row.bossEduEmail,
    row.regionName,
    row.cityName,
    row.campusName,
    row.gender,
    row.maritalStatus,
    row.bornDate,
    row.bornCity,
    row.emergencyName,
    row.emergencyPhone,
    row.emergencyRelationship,
    row.skills,
  ];
}

function bodyXml(rows: readonly DirectoryExportRow[]): string {
  return rows
    .map((row) => `<Row>${rowValues(row).map(cell).join('')}</Row>`)
    .join('');
}

/** Referencia a una hoja en una fórmula: 'Nombre con espacios'!R1C1. */
function sheetRef(name: string): string {
  return `'${name.replace(/'/g, "''")}'`;
}

/** «Base general»: mismo marcado que el Excel aprobado (solo cambia el nombre de la hoja). */
function originalWorksheetXml(sheet: DirectoryExportSheet): string {
  const header = DIRECTORY_EXPORT_COLUMNS.map((h) => headerCell(h)).join('');
  const meta = `<Row><Cell ss:MergeAcross="${DIRECTORY_EXPORT_COLUMNS.length - 1}"><Data ss:Type="String">${xmlEscape(
    sheet.title,
  )}</Data></Cell></Row>`;
  return `  <Worksheet ss:Name="${xmlEscape(sheet.name)}">
    <Table>
      ${meta}
      <Row>${header}</Row>
      ${bodyXml(sheet.rows)}
    </Table>
  </Worksheet>`;
}

/**
 * Pestaña por coordinación: título, encabezados inmovilizados, anchos de
 * columna y autofiltro sobre encabezados + datos.
 */
function coordinationWorksheetXml(sheet: DirectoryExportSheet): string {
  const columnCount = DIRECTORY_EXPORT_COLUMNS.length;
  const lastRow = 2 + sheet.rows.length; // fila 1 título, fila 2 encabezados
  const range = `R2C1:R${lastRow}C${columnCount}`;
  const columns = DIRECTORY_EXPORT_COLUMN_WIDTHS.map(
    (width) => `<Column ss:Width="${width}"/>`,
  ).join('');
  const title = `<Row ss:Height="20"><Cell ss:StyleID="CoordTitle" ss:MergeAcross="${columnCount - 1}"><Data ss:Type="String">${xmlEscape(
    sheet.title,
  )}</Data></Cell></Row>`;
  const header = `<Row>${DIRECTORY_EXPORT_COLUMNS.map((h) => headerCell(h, 'CoordHeader')).join('')}</Row>`;
  return `  <Worksheet ss:Name="${xmlEscape(sheet.name)}">
    <Names>
      <NamedRange ss:Name="_FilterDatabase" ss:RefersTo="=${xmlEscape(sheetRef(sheet.name))}!${range}" ss:Hidden="1"/>
    </Names>
    <Table>
      ${columns}
      ${title}
      ${header}
      ${bodyXml(sheet.rows)}
    </Table>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>2</SplitHorizontal>
      <TopRowBottomPane>2</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <Panes><Pane><Number>3</Number></Pane><Pane><Number>2</Number></Pane></Panes>
    </WorksheetOptions>
    <AutoFilter x:Range="${range}" xmlns="urn:schemas-microsoft-com:office:excel"/>
  </Worksheet>`;
}

/**
 * Libro Excel 2003 (SpreadsheetML, .xls) con varias hojas, cada una con las
 * mismas 26 columnas. Los nombres de hoja deben venir ya validados
 * (`uniqueSheetNames`). Excel abre la primera hoja.
 *
 * El estilo `Header` es el original (negrita) y solo lo usa la «Base
 * general»; las pestañas nuevas usan `CoordTitle` / `CoordHeader`.
 */
export function buildDirectoryWorkbookXml(
  sheets: readonly DirectoryExportSheet[],
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:x="urn:schemas-microsoft-com:office:excel">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1"/>
    </Style>
    <Style ss:ID="CoordTitle">
      <Font ss:Bold="1" ss:Size="12"/>
    </Style>
    <Style ss:ID="CoordHeader">
      <Alignment ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
      <Font ss:Bold="1"/>
      <Interior ss:Color="#D9E1F2" ss:Pattern="Solid"/>
    </Style>
  </Styles>
${sheets
  .map((sheet) =>
    sheet.layout === 'coordinacion'
      ? coordinationWorksheetXml(sheet)
      : originalWorksheetXml(sheet),
  )
  .join('\n')}
</Workbook>`;
}

/** Libro con solo la «Base general» (el directorio completo de la versión). */
export function buildDirectoryExcelXml(
  rows: DirectoryExportRow[],
  versionLabel: string,
): string {
  return buildDirectoryWorkbookXml([
    {
      name: BASE_GENERAL_SHEET_NAME,
      title: `Operaciones — ${versionLabel}`,
      rows,
      layout: 'original',
    },
  ]);
}
