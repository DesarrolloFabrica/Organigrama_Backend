import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrgViewerContext } from './org-viewer-context';
import { OrgChartVersionService } from './org-chart-version.service';
import { isOrgChartPlantaEnabled } from './org-chart-version-read-plan';
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
 * Con Planta, el jefe es el de la capa más reciente (Orbit), no el de la arista vieja.
 */
function directorySql(): string {
  const planta = isOrgChartPlantaEnabled();
  const relationFrom = planta
    ? `organigrama.org_chart_effective_relations_planta($1, ARRAY[]::bigint[])`
    : `organigrama.org_visual_relation`;
  const versionFilter = planta ? '' : `AND r.version_id = $1`;
  return `
WITH planta AS (
  SELECT r.parent_person_id, r.child_person_id
  FROM ${relationFrom} r
  WHERE r.is_active = true
    AND r.parent_person_id <> r.child_person_id
    ${versionFilter}
),
edges AS (
  SELECT
    child_person_id::text AS person_id,
    parent_person_id::text AS boss_id
  FROM planta

  UNION ALL

  SELECT
    parent_person_id::text AS person_id,
    NULL::text AS boss_id
  FROM planta parent_edge
  WHERE NOT EXISTS (
    SELECT 1
    FROM planta child_edge
    WHERE child_edge.child_person_id = parent_edge.parent_person_id
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
LEFT JOIN organigrama.org_chart_person_override povr
  ON povr.person_id::text = e.person_id
 AND povr.version_id = $1
LEFT JOIN core.role visual_role
  ON visual_role.id = COALESCE(povr.role_id_override, p.role_id)
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
ORDER BY e.person_id, e.boss_id NULLS LAST
`;
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
      `[OrgChartDirectoryExport] denied personId=${viewer.personId} email=${viewer.eduEmail ?? '(missing)'}`,
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
    this.ensureCanExport(viewer);

    const active = await this.versionService.getActiveVersion();
    const versionId = String(active.id);
    const versionLabel = `${active.name} · ${active.code}${
      active.is_active ? ' (activa)' : ''
    }`;

    const queryRows = (await this.dataSource.query(directorySql(), [
      versionId,
    ])) as DirectoryQueryRow[];

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
    const { people, versionLabel, versionId } = await this.loadPresentation(viewer);
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
    this.ensureCanExport(viewer);
    const active = await this.versionService.getActiveVersion();
    const versionId = String(active.id);
    const versionLabel = `${active.name} · ${active.code}${
      active.is_active ? ' (activa)' : ''
    }`;
    const queryRows = (await this.dataSource.query(directorySql(), [
      versionId,
    ])) as DirectoryQueryRow[];
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
}

const FRONTEND_PUBLIC_FALLBACK =
  'https://organigrama-frontend-550902908078.us-central1.run.app';

function frontendPublicBase(): string {
  const raw =
    process.env.ORG_CHART_FRONTEND_PUBLIC_URL || process.env.CORS_ORIGIN || '';
  const first = raw.split(',')[0]?.trim().replace(/\/$/, '') ?? '';
  return /^https:\/\//i.test(first) ? first : FRONTEND_PUBLIC_FALLBACK;
}

