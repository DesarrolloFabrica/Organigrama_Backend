import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrgViewerContext } from './org-viewer-context';
import { OrgChartVersionService } from './org-chart-version.service';
import { runWithOrgChartVersionReadPlan } from './org-chart-version-read-plan';
import {
  visualRelationSqlSource,
  withOverlayQueryParams,
} from './org-chart-effective-relation.sql';
import {
  buildOrgChartHtml,
  type PresentationPerson,
} from './org-chart-directory-presentation';
import {
  buildDirectoryExcelXml,
  isOrgChartDirectoryExportEmail,
  shouldIncludeDirectoryRow,
  type DirectoryExportRow,
} from './org-chart-directory-export.util';

type DirectoryQueryRow = {
  person_id: string;
  boss_id: string | null;
  full_name: string | null;
  type_document: string | null;
  document: string | null;
  edu_email: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  gender: string | null;
  marital_status: string | null;
  born_date: string | null;
  born_city: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  role_name: string | null;
  area_name: string | null;
  hierarchy_name: string | null;
  school_name: string | null;
  program_name: string | null;
  contract_type_name: string | null;
  region_name: string | null;
  city_name: string | null;
  campus_name: string | null;
  boss_name: string | null;
  boss_edu_email: string | null;
  skills: string | null;
  photo_url: string | null;
};

/**
 * Una fila por colaborador de la versión vigente.
 *
 * Las aristas salen del mismo plan de lectura que el mapa
 * (`visualRelationSqlSource`): versión global + overlays de coordinación +
 * Planta de Orbit + excepciones/supresiones publicadas, según corresponda.
 * Debe ejecutarse dentro de `runWithOrgChartVersionReadPlan`.
 *
 * Igual que `OrgChartTreeEngine`, los hijos por posición
 * (`org_visual_relation_position_child`) cuelgan de quien ocupa la posición
 * (`child_person_id` de la arista). Una arista persona → ella misma no es un
 * jefe, pero sus hijos por posición sí cuentan.
 *
 * Precedencia por persona (DISTINCT ON): arista directa < hijo por posición < raíz.
 */
function directorySql(): { sql: string; overlayIds: string[] } {
  const source = visualRelationSqlSource('r', '$1', '$2');
  const sql = `
WITH effective_edges AS (
  SELECT r.id, r.parent_person_id, r.child_person_id
  FROM ${source.from}
  WHERE ${source.versionPredicate}
    AND r.is_active = true
),
edges AS (
  SELECT
    ee.child_person_id::text AS person_id,
    ee.parent_person_id::text AS boss_id,
    ee.id::text AS relation_id,
    0 AS edge_rank
  FROM effective_edges ee
  WHERE ee.parent_person_id <> ee.child_person_id

  UNION ALL

  SELECT
    pc.child_person_id::text AS person_id,
    ee.child_person_id::text AS boss_id,
    NULL::text AS relation_id,
    1 AS edge_rank
  FROM organigrama.org_visual_relation_position_child pc
  INNER JOIN effective_edges ee
    ON ee.id = pc.parent_relation_id
  WHERE pc.is_active = true
    AND pc.child_person_id <> ee.child_person_id

  UNION ALL

  SELECT
    parent_edge.parent_person_id::text AS person_id,
    NULL::text AS boss_id,
    NULL::text AS relation_id,
    2 AS edge_rank
  FROM effective_edges parent_edge
  WHERE NOT EXISTS (
    SELECT 1
    FROM effective_edges child_edge
    WHERE child_edge.child_person_id = parent_edge.parent_person_id
      AND child_edge.parent_person_id <> child_edge.child_person_id
  )
)
SELECT DISTINCT ON (e.person_id)
  e.person_id,
  e.boss_id,
  p.full_name,
  p.type_document,
  p.document,
  p.edu_email,
  p.email,
  p.phone,
  p.address,
  p.gender,
  p.marital_status,
  to_char(p.born_date, 'YYYY-MM-DD') AS born_date,
  p.born_city,
  p.emergency_contact_name,
  p.emergency_contact_phone,
  p.emergency_contact_relationship,
  visual_role.name AS role_name,
  a.name AS area_name,
  h.name AS hierarchy_name,
  s.name AS school_name,
  pr.name AS program_name,
  ct.name AS contract_type_name,
  region.name AS region_name,
  city.name AS city_name,
  campus.name AS campus_name,
  boss.full_name AS boss_name,
  boss.edu_email AS boss_edu_email,
  skills.skills,
  photo_state.profile_photo_url AS photo_url
FROM edges e
INNER JOIN core.person p
  ON p.id::text = e.person_id
 AND p.is_active = true
LEFT JOIN core.person boss
  ON boss.id::text = e.boss_id
LEFT JOIN organigrama.org_visual_relation_override rovr
  ON e.relation_id IS NOT NULL
 AND rovr.relation_id::text = e.relation_id
 AND rovr.is_active = true
LEFT JOIN organigrama.org_chart_person_override povr
  ON povr.person_id::text = e.person_id
 AND povr.version_id = $1
LEFT JOIN core.role visual_role
  ON visual_role.id = COALESCE(rovr.role_id_override, povr.role_id_override, p.role_id)
LEFT JOIN core.area a ON a.id = p.area_id
LEFT JOIN core.hierarchy h ON h.id = p.hierarchy_id
LEFT JOIN core.school s ON s.id = p.school_id
LEFT JOIN core.program pr ON pr.id = p.program_id
LEFT JOIN core.contract_type ct ON ct.id = p.contract_type_id
LEFT JOIN core.region region ON region.id = p.region_id
LEFT JOIN core.city city ON city.id = p.city_id
LEFT JOIN core.campus campus ON campus.id = p.campus_id
LEFT JOIN organigrama.person_profile_state photo_state
  ON photo_state.person_id = p.id
LEFT JOIN LATERAL (
  SELECT string_agg(
    skill.normalized_name || ' (' || extracted.category || ')',
    ' | ' ORDER BY extracted.sort_order, skill.normalized_name
  ) AS skills
  FROM organigrama.cv_extraction extraction
  INNER JOIN organigrama.cv_extraction_skill extracted
    ON extracted.extraction_id = extraction.id
  INNER JOIN organigrama.cv_skill skill
    ON skill.id = extracted.skill_id
   AND skill.is_active = true
  WHERE extraction.person_id = p.id
    AND extraction.status = 'SUCCEEDED'
    AND extraction.id = (
      SELECT latest.id
      FROM organigrama.cv_extraction latest
      WHERE latest.person_id = p.id
        AND latest.status = 'SUCCEEDED'
      ORDER BY latest.is_active DESC, latest.finished_at DESC NULLS LAST, latest.id DESC
      LIMIT 1
    )
) skills ON true
ORDER BY e.person_id, e.edge_rank, e.boss_id NULLS LAST
`;
  return { sql, overlayIds: source.overlayIds };
}

function text(value: string | null | undefined): string {
  return (value ?? '').trim();
}

@Injectable()
export class OrgChartDirectoryExportService {
  private readonly log = new Logger(OrgChartDirectoryExportService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly versionService: OrgChartVersionService,
  ) {}

  ensureCanExport(viewer: OrgViewerContext): void {
    if (isOrgChartDirectoryExportEmail(viewer.eduEmail)) {
      return;
    }

    this.log.warn(
      `[OrgChartDirectoryExport] denied personId=${viewer.personId} hasEmail=${viewer.eduEmail ? 'yes' : 'no'}`,
    );
    throw new ForbiddenException({
      message: 'No tienes permiso para descargar el directorio del organigrama',
    });
  }

  async exportActiveDirectory(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
    versionLabel: string;
    rowCount: number;
  }> {
    const { queryRows, versionLabel, versionId } =
      await this.loadActiveDirectoryRows(viewer);

    const rows: DirectoryExportRow[] = queryRows
      .filter((row) =>
        shouldIncludeDirectoryRow({
          fullName: row.full_name,
          document: row.document,
          roleName: row.role_name,
        }),
      )
      .map((row) => ({
        fullName: text(row.full_name),
        documentType: text(row.type_document),
        document: text(row.document),
        eduEmail: text(row.edu_email),
        personalEmail: text(row.email),
        phone: text(row.phone),
        address: text(row.address),
        areaName: text(row.area_name),
        schoolName: text(row.school_name),
        programName: text(row.program_name),
        roleName: text(row.role_name),
        hierarchyName: text(row.hierarchy_name),
        contractTypeName: text(row.contract_type_name),
        bossName: text(row.boss_name),
        bossEduEmail: text(row.boss_edu_email),
        regionName: text(row.region_name),
        cityName: text(row.city_name),
        campusName: text(row.campus_name),
        gender: text(row.gender),
        maritalStatus: text(row.marital_status),
        bornDate: text(row.born_date),
        bornCity: text(row.born_city),
        emergencyName: text(row.emergency_contact_name),
        emergencyPhone: text(row.emergency_contact_phone),
        emergencyRelationship: text(row.emergency_contact_relationship),
        skills: text(row.skills),
      }))
      .sort((a, b) => {
        const area = a.areaName.localeCompare(b.areaName, 'es');
        if (area !== 0) return area;
        const boss = a.bossName.localeCompare(b.bossName, 'es');
        if (boss !== 0) return boss;
        return a.fullName.localeCompare(b.fullName, 'es');
      });

    const xml = buildDirectoryExcelXml(rows, versionLabel);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `organigrama-activo-${date}.xls`;

    this.log.log(
      `[OrgChartDirectoryExport] exported rows=${rows.length} version=${versionId} personId=${viewer.personId}`,
    );

    return {
      filename,
      buffer: Buffer.from(xml, 'utf8'),
      versionLabel,
      rowCount: rows.length,
    };
  }

  async exportActiveHtml(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
  }> {
    const { people, versionLabel, versionId } =
      await this.loadPresentation(viewer);
    const base = frontendPublicBase();
    const html = buildOrgChartHtml(people, versionLabel, {
      logoUrl: `${base}/img/LogoOrganigramasOp.png`,
      submarineUrl: `${base}/img/Submarino.png`,
    });
    const date = new Date().toISOString().slice(0, 10);
    this.log.log(
      `[OrgChartDirectoryExport] html people=${people.length} version=${versionId} personId=${viewer.personId}`,
    );
    return {
      filename: `organigrama-${date}.html`,
      buffer: Buffer.from(html, 'utf8'),
    };
  }

  private async loadPresentation(viewer: OrgViewerContext): Promise<{
    people: PresentationPerson[];
    versionLabel: string;
    versionId: string;
  }> {
    const { queryRows, versionLabel, versionId } =
      await this.loadActiveDirectoryRows(viewer);
    const people = queryRows
      .filter((row) =>
        shouldIncludeDirectoryRow({
          fullName: row.full_name,
          document: row.document,
          roleName: row.role_name,
        }),
      )
      .map((row) => ({
        personId: text(row.person_id),
        bossId: text(row.boss_id),
        fullName: text(row.full_name),
        document: text(row.document),
        roleName: text(row.role_name),
        areaName: text(row.area_name),
        photoUrl: text(row.photo_url),
      }));
    return { people, versionLabel, versionId };
  }

  /**
   * Filas del directorio de la versión global vigente.
   * El plan se resuelve sin parámetros de la petición: siempre la versión
   * activa publicada (con Planta/overlays/excepciones), aunque la URL traiga
   * versionId/versionCode.
   */
  private async loadActiveDirectoryRows(viewer: OrgViewerContext): Promise<{
    queryRows: DirectoryQueryRow[];
    versionLabel: string;
    versionId: string;
  }> {
    this.ensureCanExport(viewer);

    const plan = await this.versionService.resolveReadPlan(viewer, {});
    const versionId = plan.globalVersionId;
    const version = await this.versionService.getVersionById(versionId);
    const versionLabel = `${version.name} · ${version.code}${
      version.is_active ? ' (activa)' : ''
    }`;

    const queryRows = await runWithOrgChartVersionReadPlan(plan, () => {
      const { sql, overlayIds } = directorySql();
      return this.dataSource.query<DirectoryQueryRow[]>(
        sql,
        withOverlayQueryParams([versionId], overlayIds),
      );
    });

    return { queryRows, versionLabel, versionId };
  }
}

const FRONTEND_PUBLIC_FALLBACK =
  'https://organigrama-frontend-550902908078.us-central1.run.app';

function frontendPublicBase(): string {
  const raw =
    process.env.ORG_CHART_FRONTEND_PUBLIC_URL || process.env.CORS_ORIGIN || '';
  const first = raw.split(',')[0]?.trim().replace(/\/$/, '') ?? '';
  return /^https:\/\//i.test(first) ? first : FRONTEND_PUBLIC_FALLBACK;
}
