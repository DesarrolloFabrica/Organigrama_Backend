import { DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS } from './org-chart-directory-export.constants';
import {
  isVacancyDisplayName,
  isVacancyRoleName,
} from './org-chart-vacancy';

/**
 * Correos autorizados para descargar el directorio del organigrama activo.
 * Variable: ORG_CHART_DIRECTORY_EXPORT_EMAILS (coma, trim + lowercase).
 */
export function getOrgChartDirectoryExportEmailsSet(): Set<string> {
  const raw = process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS?.trim();
  const source =
    raw && raw.length > 0
      ? raw
      : DEFAULT_ORG_CHART_DIRECTORY_EXPORT_EMAILS.join(',');

  return new Set(
    source
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isOrgChartDirectoryExportEmail(
  email: string | null | undefined,
): boolean {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return getOrgChartDirectoryExportEmailsSet().has(normalized);
}

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

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DIRECTORY_EXPORT_COLUMNS = [
  'Nombre',
  'Documento',
  'Correo institucional',
  'Teléfono',
  'Área',
  'Escuela',
  'Programa',
  'Cargo',
  'Nivel',
  'Jefe',
  'Correo del jefe',
  'Contacto de emergencia',
  'Teléfono de emergencia',
  'Parentesco',
] as const;

export type DirectoryExportRow = {
  fullName: string;
  document: string;
  eduEmail: string;
  phone: string;
  areaName: string;
  schoolName: string;
  programName: string;
  roleName: string;
  hierarchyName: string;
  bossName: string;
  bossEduEmail: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
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
  const meta = `<Row><Cell ss:MergeAcross="13"><Data ss:Type="String">${xmlEscape(
    `Organigrama activo — ${versionLabel}`,
  )}</Data></Cell></Row>`;
  const body = rows
    .map((row) => {
      const values: string[] = [
        row.fullName,
        row.document,
        row.eduEmail,
        row.phone,
        row.areaName,
        row.schoolName,
        row.programName,
        row.roleName,
        row.hierarchyName,
        row.bossName,
        row.bossEduEmail,
        row.emergencyName,
        row.emergencyPhone,
        row.emergencyRelationship,
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
