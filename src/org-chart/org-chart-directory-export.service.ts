import {
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { PersonPermissionService } from '../permissions/person-permission.service';
import type { OrgViewerContext } from './org-viewer-context';
import {
  OrgChartDirectoryExportAuditService,
  errorName,
} from './org-chart-directory-export-audit.service';
import {
  DIRECTORY_EXPORT_FORMATS,
  DIRECTORY_EXPORT_PERMISSION,
  type DirectoryExportFormat,
  type DirectoryExportPermissionsDto,
} from './org-chart-directory-export.permissions';
import { OrgChartVersionService } from './org-chart-version.service';
import { OrgChartService } from './org-chart.service';
import { runWithOrgChartVersionReadPlan } from './org-chart-version-read-plan';
import {
  formatBossEmails,
  formatBossNames,
  resolveDirectoryPeople,
  type ResolvedDirectoryPerson,
  type RoleNameOverrides,
} from './org-chart-directory-people';
import {
  visualRelationSqlSource,
  withOverlayQueryParams,
} from './org-chart-effective-relation.sql';
import {
  buildOrgChartHtml,
  type PresentationPerson,
} from './org-chart-directory-presentation';
import {
  BASE_GENERAL_SHEET_NAME,
  buildDirectoryWorkbookXml,
  directoryExportDateStamp,
  shouldIncludeDirectoryRow,
  type DirectoryExportRow,
} from './org-chart-directory-export.util';
import {
  buildCoordinationSheets,
  groupDirectoryByCoordination,
  type CoordinationPlacement,
} from './org-chart-directory-coordinations';
import { ORG_CHART_ROOT_PERSON_ID } from './photos/photo.config';

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
  /** Arista efectiva de esta ubicación (null en hijos por posición y raíces). */
  relation_id: string | null;
  /** Cargo de core.person.role_id; los overrides los resuelve OrgChartService. */
  base_role_name: string | null;
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
  boss_is_active: boolean | null;
  skills: string | null;
  photo_url: string | null;
};

/** Persona del informe: sus datos (primera ubicación) y jefes/cargo resueltos. */
type DirectoryPerson = {
  row: DirectoryQueryRow;
  resolved: ResolvedDirectoryPerson;
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
 * Una fila por UBICACIÓN (persona, jefe): una persona con varios jefes
 * efectivos devuelve una fila por jefe, como el mapa la pinta bajo cada uno.
 * La raíz (sin jefe) solo se usa si la persona no tiene ningún jefe. Para un
 * mismo jefe se prefiere la arista directa sobre el hijo por posición.
 *
 * El cargo NO se resuelve aquí: se devuelve el cargo base y la arista, y los
 * overrides (por arista > por persona con overlay > global) los aplica
 * `OrgChartService.getRoleNameOverridesForVersion`, igual que el mapa.
 *
 * El jefe se une sin filtrar `is_active` para conservar a quien cuelga de un
 * jefe inactivo (se marca «(inactivo)»); la persona exportada sí debe estar activa.
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
),
placements AS (
  SELECT DISTINCT ON (e.person_id, COALESCE(e.boss_id, ''))
    e.person_id,
    e.boss_id,
    e.relation_id,
    e.edge_rank
  FROM edges e
  ORDER BY e.person_id, COALESCE(e.boss_id, ''), e.edge_rank, e.relation_id NULLS LAST
)
SELECT
  e.person_id,
  e.boss_id,
  e.relation_id,
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
  base_role.name AS base_role_name,
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
  boss.is_active AS boss_is_active,
  skills.skills,
  photo_state.profile_photo_url AS photo_url
FROM placements e
INNER JOIN core.person p
  ON p.id::text = e.person_id
 AND p.is_active = true
LEFT JOIN core.person boss
  ON boss.id::text = e.boss_id
LEFT JOIN core.role base_role ON base_role.id = p.role_id
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
    private readonly orgChartService: OrgChartService,
    private readonly permissionService: PersonPermissionService,
    private readonly audit: OrgChartDirectoryExportAuditService,
  ) {}

  /**
   * Autoriza la descarga de `format` consultando los permisos VIGENTES en
   * core.person_permission (no el JWT): una revocación aplica de inmediato.
   *
   * - Sin persona en la sesión → 401.
   * - Fallo al consultar permisos → 503 (fail-closed), auditado como ERROR.
   * - Sin el permiso del formato → 403, auditado como DENIED.
   *
   * ORG_ADMIN / ORG_READ_ALL / ORG_CONTACT_READ_ALL no autorizan nada aquí.
   */
  async ensureCanExport(
    viewer: OrgViewerContext,
    format: DirectoryExportFormat,
  ): Promise<void> {
    const personId = viewer.personId?.trim();
    if (!personId) {
      throw new UnauthorizedException('Sesión inválida');
    }

    const required = DIRECTORY_EXPORT_PERMISSION[format];
    let granted: string[];
    try {
      granted = await this.permissionService.getPersistedPermissionCodes(
        personId,
        [required],
      );
    } catch (error) {
      this.log.error(
        `[OrgChartDirectoryExport] permission check failed format=${format} personId=${personId} cause=${errorName(error)}`,
      );
      await this.audit.recordBestEffort({
        personId,
        format,
        result: 'ERROR',
        errorCode: 'PERMISSION_CHECK_FAILED',
      });
      throw new ServiceUnavailableException(
        'No se pudo verificar el permiso de exportación. Intenta más tarde.',
      );
    }

    if (granted.includes(required)) return;

    this.log.warn(
      `[OrgChartDirectoryExport] denied format=${format} personId=${personId}`,
    );
    await this.audit.recordBestEffort({
      personId,
      format,
      result: 'DENIED',
      errorCode: 'FORBIDDEN',
    });
    throw new ForbiddenException({
      message: 'No tienes permiso para descargar este informe del organigrama',
      code: 'DIRECTORY_EXPORT_FORBIDDEN',
      format,
    });
  }

  /** Formatos que la persona puede descargar ahora mismo (leído de PostgreSQL). */
  async getExportPermissions(
    viewer: OrgViewerContext,
  ): Promise<DirectoryExportPermissionsDto> {
    const personId = viewer.personId?.trim();
    if (!personId) {
      throw new UnauthorizedException('Sesión inválida');
    }
    const granted = await this.permissionService.getPersistedPermissionCodes(
      personId,
      DIRECTORY_EXPORT_FORMATS.map((f) => DIRECTORY_EXPORT_PERMISSION[f]),
    );
    return {
      html: granted.includes(DIRECTORY_EXPORT_PERMISSION.html),
      xls: granted.includes(DIRECTORY_EXPORT_PERMISSION.xls),
    };
  }

  async exportActiveDirectory(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
    versionLabel: string;
    versionId: string;
    rowCount: number;
  }> {
    return this.runAuditedExport(viewer, 'xls', () =>
      this.buildDirectoryFile(viewer),
    );
  }

  async exportActiveHtml(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
    versionId: string;
    rowCount: number;
  }> {
    return this.runAuditedExport(viewer, 'html', () =>
      this.buildHtmlFile(viewer),
    );
  }

  /**
   * Autoriza → genera → audita. El archivo solo se entrega si el evento
   * SUCCESS quedó registrado (fail-closed): una descarga de datos personales
   * nunca sale sin traza.
   */
  private async runAuditedExport<
    T extends { versionId: string; rowCount: number },
  >(
    viewer: OrgViewerContext,
    format: DirectoryExportFormat,
    build: () => Promise<T>,
  ): Promise<T> {
    await this.ensureCanExport(viewer, format);
    const personId = viewer.personId.trim();

    let file: T;
    try {
      file = await build();
    } catch (error) {
      this.log.error(
        `[OrgChartDirectoryExport] generation failed format=${format} personId=${personId} cause=${errorName(error)}`,
      );
      await this.audit.recordBestEffort({
        personId,
        format,
        result: 'ERROR',
        errorCode: 'GENERATION_FAILED',
      });
      throw error;
    }

    try {
      await this.audit.record({
        personId,
        format,
        result: 'SUCCESS',
        versionId: file.versionId,
        rowCount: file.rowCount,
      });
    } catch (error) {
      this.log.error(
        `[OrgChartDirectoryExport] audit write failed; download cancelled format=${format} personId=${personId} cause=${errorName(error)}`,
      );
      throw new ServiceUnavailableException(
        'No se pudo registrar la exportación; la descarga se canceló.',
      );
    }

    this.log.log(
      `[OrgChartDirectoryExport] exported format=${format} rows=${file.rowCount} version=${file.versionId} personId=${personId}`,
    );
    return file;
  }

  private async buildDirectoryFile(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
    versionLabel: string;
    versionId: string;
    rowCount: number;
  }> {
    const { people, placements, versionLabel, versionId } =
      await this.loadActiveDirectoryPeople(viewer);

    // Una fila por persona; todos sus jefes efectivos en «Jefe», por nombre.
    const rowById = new Map<string, DirectoryExportRow>();
    for (const { row, resolved } of people) {
      rowById.set(text(row.person_id), {
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
        roleName: text(resolved.roleName),
        hierarchyName: text(row.hierarchy_name),
        contractTypeName: text(row.contract_type_name),
        bossName: formatBossNames(resolved.bosses),
        bossEduEmail: formatBossEmails(resolved.bosses),
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
      });
    }

    // «Base general»: el directorio completo, con el mismo orden de siempre.
    const rows = [...rowById.values()].sort((a, b) => {
      const area = a.areaName.localeCompare(b.areaName, 'es');
      if (area !== 0) return area;
      const boss = a.bossName.localeCompare(b.bossName, 'es');
      if (boss !== 0) return boss;
      return a.fullName.localeCompare(b.fullName, 'es');
    });

    // Pestañas de Dirección y por coordinación, calculadas en cada descarga
    // desde las mismas ubicaciones (misma instantánea): ver
    // org-chart-directory-coordinations (reglas, orden y duplicados).
    const grouping = groupDirectoryByCoordination(
      placements,
      ORG_CHART_ROOT_PERSON_ID,
    );
    const {
      sheets: coordinationSheets,
      directionSheetCount,
      unassignedIds,
      areaMismatchIds,
    } = buildCoordinationSheets(grouping, placements, rowById, versionLabel);
    // Solo conteos (sin datos personales). areaDistinta = personas que salen
    // en una coordinación por su jefe efectivo pero con otra área registrada.
    this.log.log(
      `[OrgChartDirectoryExport] pestañas direccion=${directionSheetCount} coordinaciones=${coordinationSheets.length - directionSheetCount} sinPestana=${unassignedIds.length} areaDistinta=${areaMismatchIds.length} version=${versionId}`,
    );

    const xml = buildDirectoryWorkbookXml([
      {
        // Presentación original aprobada: solo se agregan hojas nuevas.
        name: BASE_GENERAL_SHEET_NAME,
        title: `Operaciones — ${versionLabel}`,
        rows,
        layout: 'original',
      },
      ...coordinationSheets,
    ]);
    const filename = `organigrama-activo-${directoryExportDateStamp()}.xls`;

    return {
      filename,
      buffer: Buffer.from(xml, 'utf8'),
      versionLabel,
      versionId,
      rowCount: rows.length,
    };
  }

  private async buildHtmlFile(viewer: OrgViewerContext): Promise<{
    filename: string;
    buffer: Buffer;
    versionId: string;
    rowCount: number;
  }> {
    const { people, versionLabel, versionId } =
      await this.loadPresentation(viewer);
    const base = frontendPublicBase();
    const html = buildOrgChartHtml(people, versionLabel, {
      logoUrl: `${base}/img/LogoOrganigramasOp.png`,
      submarineUrl: `${base}/img/Submarino.png`,
    });
    return {
      filename: `organigrama-${directoryExportDateStamp()}.html`,
      buffer: Buffer.from(html, 'utf8'),
      versionId,
      rowCount: people.length,
    };
  }

  private async loadPresentation(viewer: OrgViewerContext): Promise<{
    people: PresentationPerson[];
    versionLabel: string;
    versionId: string;
  }> {
    const { people, versionLabel, versionId } =
      await this.loadActiveDirectoryPeople(viewer);
    return {
      people: people.map(({ row, resolved }) => ({
        personId: text(row.person_id),
        // Todos los jefes efectivos: el HTML pinta a la persona bajo cada uno
        // (como el mapa) y la cuenta una sola vez en los totales.
        bossIds: resolved.bosses.map((boss) => boss.personId),
        inactiveBossNames: resolved.bosses
          .filter((boss) => !boss.isActive)
          .map((boss) => text(boss.name)),
        fullName: text(row.full_name),
        document: text(row.document),
        roleName: text(resolved.roleName),
        areaName: text(row.area_name),
        photoUrl: text(row.photo_url),
      })),
      versionLabel,
      versionId,
    };
  }

  /**
   * Personas del informe (una por persona, ya filtradas: sin vacantes ni
   * docentes de planta), con jefes y cargo resueltos.
   */
  private async loadActiveDirectoryPeople(viewer: OrgViewerContext): Promise<{
    people: DirectoryPerson[];
    /** Todas las ubicaciones efectivas (también de no elegibles), para agrupar. */
    placements: CoordinationPlacement[];
    versionLabel: string;
    versionId: string;
  }> {
    const { queryRows, overrides, versionLabel, versionId } =
      await this.loadActiveDirectoryRows(viewer);

    const resolvedById = resolveDirectoryPeople(
      queryRows.map((row) => ({
        personId: text(row.person_id),
        bossId: row.boss_id == null ? null : text(row.boss_id),
        relationId: row.relation_id == null ? null : text(row.relation_id),
        bossName: text(row.boss_name),
        bossEduEmail: text(row.boss_edu_email),
        bossIsActive: row.boss_is_active,
        baseRoleName: text(row.base_role_name),
      })),
      overrides,
    );

    // Los datos personales son los mismos en todas las ubicaciones: primera fila.
    const firstRowById = new Map<string, DirectoryQueryRow>();
    for (const row of queryRows) {
      const id = text(row.person_id);
      if (!firstRowById.has(id)) firstRowById.set(id, row);
    }

    const people: DirectoryPerson[] = [];
    for (const [id, row] of firstRowById) {
      const resolved = resolvedById.get(id);
      if (!resolved) continue;
      if (
        !shouldIncludeDirectoryRow({
          fullName: row.full_name,
          document: row.document,
          roleName: resolved.roleName,
        })
      ) {
        continue;
      }
      people.push({ row, resolved });
    }
    const placements: CoordinationPlacement[] = queryRows.map((row) => ({
      personId: text(row.person_id),
      bossId: row.boss_id == null ? null : text(row.boss_id),
      areaName: text(row.area_name),
      fullName: text(row.full_name),
    }));
    return { people, placements, versionLabel, versionId };
  }

  /**
   * Ubicaciones de la versión global vigente y overrides de cargo del plan.
   * El plan se resuelve sin parámetros de la petición: siempre la versión
   * activa publicada (con Planta/overlays/excepciones), aunque la URL traiga
   * versionId/versionCode. Los overrides salen del mismo servicio que el mapa
   * y dentro del mismo plan, así que respetan overlay > global.
   *
   * Solo se llama desde runAuditedExport, después de ensureCanExport.
   */
  private async loadActiveDirectoryRows(viewer: OrgViewerContext): Promise<{
    queryRows: DirectoryQueryRow[];
    overrides: RoleNameOverrides;
    versionLabel: string;
    versionId: string;
  }> {
    const plan = await this.versionService.resolveReadPlan(viewer, {});
    const versionId = plan.globalVersionId;
    const version = await this.versionService.getVersionById(versionId);
    const versionLabel = `${version.name} · ${version.code}${
      version.is_active ? ' (activa)' : ''
    }`;

    const { queryRows, overrides } = await runWithOrgChartVersionReadPlan(
      plan,
      () =>
        this.inReadOnlySnapshot(async (manager) => {
          const { sql, overlayIds } = directorySql();
          const rows = await manager.query<DirectoryQueryRow[]>(
            sql,
            withOverlayQueryParams([versionId], overlayIds),
          );
          // Sin las cachés del mapa: overrides leídos en esta misma instantánea.
          const roleOverrides =
            await this.orgChartService.getRoleNameOverridesForVersion(
              versionId,
              { manager },
            );
          return { queryRows: rows, overrides: roleOverrides };
        }),
    );

    return { queryRows, overrides, versionLabel, versionId };
  }

  /**
   * Ejecuta `work` en una transacción de solo lectura REPEATABLE READ: todas
   * sus consultas ven la MISMA instantánea de PostgreSQL, así personas,
   * relaciones (incluida Planta de Orbit) y cargos de un archivo son
   * coherentes entre sí aunque Orbit escriba durante la generación.
   */
  private async inReadOnlySnapshot<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    try {
      await runner.connect();
      await runner.startTransaction('REPEATABLE READ');
      try {
        await runner.query('SET TRANSACTION READ ONLY');
        const result = await work(runner.manager);
        await runner.commitTransaction();
        return result;
      } catch (error) {
        if (runner.isTransactionActive) {
          await runner.rollbackTransaction().catch(() => undefined);
        }
        throw error;
      }
    } finally {
      await runner.release();
    }
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
