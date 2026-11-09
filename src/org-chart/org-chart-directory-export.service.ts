import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrgViewerContext } from './org-viewer-context';
import { OrgChartVersionService } from './org-chart-version.service';
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
  document: string | null;
  edu_email: string | null;
  email: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  role_name: string | null;
  area_name: string | null;
  hierarchy_name: string | null;
  school_name: string | null;
  program_name: string | null;
  boss_name: string | null;
  boss_edu_email: string | null;
};

const DIRECTORY_SQL = `
WITH edges AS (
  SELECT
    r.id::text AS edge_id,
    r.child_person_id::text AS person_id,
    r.parent_person_id::text AS boss_id,
    r.id::text AS relation_id
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = $1
    AND r.is_active = true

  UNION ALL

  SELECT
    ('pc:' || pc.id::text) AS edge_id,
    pc.child_person_id::text AS person_id,
    parent_rel.parent_person_id::text AS boss_id,
    pc.parent_relation_id::text AS relation_id
  FROM organigrama.org_visual_relation_position_child pc
  INNER JOIN organigrama.org_visual_relation parent_rel
    ON parent_rel.id = pc.parent_relation_id
  WHERE pc.version_id = $1
    AND pc.is_active = true

  UNION ALL

  SELECT
    ('root:' || r.parent_person_id::text) AS edge_id,
    r.parent_person_id::text AS person_id,
    NULL::text AS boss_id,
    NULL::text AS relation_id
  FROM organigrama.org_visual_relation r
  WHERE r.version_id = $1
    AND r.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM organigrama.org_visual_relation child
      WHERE child.version_id = $1
        AND child.is_active = true
        AND child.child_person_id = r.parent_person_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM organigrama.org_visual_relation_position_child pc
      WHERE pc.version_id = $1
        AND pc.is_active = true
        AND pc.child_person_id = r.parent_person_id
    )
)
SELECT DISTINCT ON (
  e.person_id,
  COALESCE(e.boss_id, ''),
  COALESCE(e.relation_id, '')
)
  e.person_id,
  e.boss_id,
  p.full_name,
  p.document,
  p.edu_email,
  p.email,
  p.phone,
  p.emergency_contact_name,
  p.emergency_contact_phone,
  p.emergency_contact_relationship,
  visual_role.name AS role_name,
  a.name AS area_name,
  h.name AS hierarchy_name,
  s.name AS school_name,
  pr.name AS program_name,
  boss.full_name AS boss_name,
  boss.edu_email AS boss_edu_email
FROM edges e
INNER JOIN core.person p
  ON p.id::text = e.person_id
 AND p.is_active = true
LEFT JOIN core.person boss
  ON boss.id::text = e.boss_id
LEFT JOIN organigrama.org_visual_relation_override rovr
  ON e.relation_id IS NOT NULL
 AND rovr.relation_id::text = e.relation_id
 AND rovr.version_id = $1
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
ORDER BY
  e.person_id,
  COALESCE(e.boss_id, ''),
  COALESCE(e.relation_id, '')
`;

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
    const versionLabel = `${active.code}${active.is_active ? ' (activa)' : ''}`;

    const queryRows = (await this.dataSource.query(DIRECTORY_SQL, [
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
        document: text(row.document),
        eduEmail: text(row.edu_email) || text(row.email),
        phone: text(row.phone),
        areaName: text(row.area_name),
        schoolName: text(row.school_name),
        programName: text(row.program_name),
        roleName: text(row.role_name),
        hierarchyName: text(row.hierarchy_name),
        bossName: text(row.boss_name),
        bossEduEmail: text(row.boss_edu_email),
        emergencyName: text(row.emergency_contact_name),
        emergencyPhone: text(row.emergency_contact_phone),
        emergencyRelationship: text(row.emergency_contact_relationship),
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
}
