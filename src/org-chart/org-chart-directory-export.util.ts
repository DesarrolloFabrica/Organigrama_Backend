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

function headerCell(value: string): string {
  return `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(value)}</Data></Cell>`;
}

export function buildDirectoryExcelXml(
  rows: DirectoryExportRow[],
  versionLabel: string,
): string {
  const header = DIRECTORY_EXPORT_COLUMNS.map(headerCell).join('');
  const meta = `<Row><Cell ss:MergeAcross="${DIRECTORY_EXPORT_COLUMNS.length - 1}"><Data ss:Type="String">${xmlEscape(
    `Operaciones — ${versionLabel}`,
  )}</Data></Cell></Row>`;
  const body = rows
    .map((row) => {
      const values: string[] = [
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
