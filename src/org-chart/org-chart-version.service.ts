import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import type { CreateOrgChartSnapshotDto } from './dto/create-org-chart-snapshot.dto';
import type { OrgChartVersionCompareDto } from './dto/org-chart-version-compare.dto';
import type { OrgChartVersionDto } from './dto/org-chart-version.dto';
import { OrgChartVersion } from './entities/org-chart-version.entity';
import {
  ORG_CHART_VERSIONING_EDU_EMAIL,
  ORG_CHART_VERSIONING_PERSON_ID,
} from './org-chart-versioning.constants';
import type { OrgViewerContext } from './org-viewer-context';

export type ResolveVersionParams = {
  versionId?: string;
  versionCode?: string;
};

@Injectable()
export class OrgChartVersionService {
  private readonly log = new Logger(OrgChartVersionService.name);

  constructor(
    @InjectRepository(OrgChartVersion)
    private readonly versions: Repository<OrgChartVersion>,
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Versionamiento habilitado únicamente para personId=1229 y desarrollofabrica@cun.edu.co.
   * No usa ORG_READ_ALL ni permisos admin genéricos.
   */
  canUseVersioning(viewer: OrgViewerContext): boolean {
    const personId = String(viewer.personId).trim();
    const email = this.normalizeEmail(viewer.eduEmail);
    const allowed =
      personId === ORG_CHART_VERSIONING_PERSON_ID &&
      email === ORG_CHART_VERSIONING_EDU_EMAIL;

    if (allowed) {
      this.log.log(
        `[OrgChartVersioning] versioning access granted personId=${personId} email=${email}`,
      );
    }

    return allowed;
  }

  async ensureCanUseVersioning(viewer: OrgViewerContext): Promise<void> {
    await Promise.resolve();
    if (this.canUseVersioning(viewer)) {
      return;
    }

    const email = viewer.eduEmail ?? '(missing)';
    this.log.warn(
      `[OrgChartVersioning] denied version access personId=${viewer.personId} email=${email}`,
    );
    throw new ForbiddenException({
      message: 'No tienes permiso para consultar versiones del organigrama',
    });
  }

  /**
   * Solo el usuario técnico 1229 puede editar relaciones.
   * Solo versiones borrador (no activas, no bloqueadas) son editables.
   * `current` y snapshots históricos locked no se modifican.
   */
  async assertVersionEditable(
    viewer: OrgViewerContext,
    versionId: string,
  ): Promise<OrgChartVersion> {
    await this.ensureCanUseVersioning(viewer);

    const version = await this.getVersionById(versionId);

    if (version.is_locked) {
      throw new ForbiddenException({
        message: `La versión "${version.code}" está bloqueada y no se puede modificar.`,
      });
    }

    if (version.is_active) {
      throw new ForbiddenException({
        message: `La versión activa "${version.code}" no se puede modificar. Use el borrador de trabajo.`,
      });
    }

    return version;
  }

  async compareVersions(
    viewer: OrgViewerContext,
    baseVersionId: string,
    targetVersionId: string,
  ): Promise<OrgChartVersionCompareDto> {
    await this.ensureCanUseVersioning(viewer);

    const baseVersion = await this.getVersionById(baseVersionId);
    const targetVersion = await this.getVersionById(targetVersionId);

    type RelationRow = {
      parent_person_id: string;
      child_person_id: string;
      relation_type: string;
      visual_level: number | null;
    };

    type MoveRow = {
      child_person_id: string;
      base_parent_person_id: string;
      target_parent_person_id: string;
    };

    const [addedRows, removedRows, movedRows, unchangedCountRows] =
      await Promise.all([
        this.dataSource.query<RelationRow[]>(
          `
          SELECT
            t.parent_person_id,
            t.child_person_id,
            t.relation_type,
            t.visual_level
          FROM organigrama.org_visual_relation t
          WHERE t.version_id = $2
            AND t.is_active = true
            AND NOT EXISTS (
              SELECT 1
              FROM organigrama.org_visual_relation b
              WHERE b.version_id = $1
                AND b.is_active = true
                AND b.parent_person_id = t.parent_person_id
                AND b.child_person_id = t.child_person_id
            )
          ORDER BY t.parent_person_id, t.child_person_id
          `,
          [baseVersion.id, targetVersion.id],
        ),
        this.dataSource.query<RelationRow[]>(
          `
          SELECT
            b.parent_person_id,
            b.child_person_id,
            b.relation_type,
            b.visual_level
          FROM organigrama.org_visual_relation b
          WHERE b.version_id = $1
            AND b.is_active = true
            AND NOT EXISTS (
              SELECT 1
              FROM organigrama.org_visual_relation t
              WHERE t.version_id = $2
                AND t.is_active = true
                AND t.parent_person_id = b.parent_person_id
                AND t.child_person_id = b.child_person_id
            )
          ORDER BY b.parent_person_id, b.child_person_id
          `,
          [baseVersion.id, targetVersion.id],
        ),
        this.dataSource.query<MoveRow[]>(
          `
          WITH added AS (
            SELECT
              t.parent_person_id,
              t.child_person_id
            FROM organigrama.org_visual_relation t
            WHERE t.version_id = $2
              AND t.is_active = true
              AND NOT EXISTS (
                SELECT 1
                FROM organigrama.org_visual_relation b
                WHERE b.version_id = $1
                  AND b.is_active = true
                  AND b.parent_person_id = t.parent_person_id
                  AND b.child_person_id = t.child_person_id
              )
          ),
          removed AS (
            SELECT
              b.parent_person_id,
              b.child_person_id
            FROM organigrama.org_visual_relation b
            WHERE b.version_id = $1
              AND b.is_active = true
              AND NOT EXISTS (
                SELECT 1
                FROM organigrama.org_visual_relation t
                WHERE t.version_id = $2
                  AND t.is_active = true
                  AND t.parent_person_id = b.parent_person_id
                  AND t.child_person_id = b.child_person_id
              )
          )
          SELECT DISTINCT
            rem.child_person_id,
            rem.parent_person_id AS base_parent_person_id,
            add.parent_person_id AS target_parent_person_id
          FROM removed rem
          INNER JOIN added add ON add.child_person_id = rem.child_person_id
          ORDER BY rem.child_person_id
          `,
          [baseVersion.id, targetVersion.id],
        ),
        this.dataSource.query<{ cnt: string }[]>(
          `
          SELECT COUNT(*)::int AS cnt
          FROM organigrama.org_visual_relation b
          INNER JOIN organigrama.org_visual_relation t
            ON t.parent_person_id = b.parent_person_id
            AND t.child_person_id = b.child_person_id
          WHERE b.version_id = $1
            AND t.version_id = $2
            AND b.is_active = true
            AND t.is_active = true
          `,
          [baseVersion.id, targetVersion.id],
        ),
      ]);

    const added = (addedRows ?? []).map((row) => this.toRelationRef(row));
    const removed = (removedRows ?? []).map((row) => this.toRelationRef(row));
    const moved = (movedRows ?? []).map((row) => ({
      childPersonId: Number(row.child_person_id),
      baseParentPersonId: Number(row.base_parent_person_id),
      targetParentPersonId: Number(row.target_parent_person_id),
    }));
    const unchanged = Number(unchangedCountRows?.[0]?.cnt ?? 0);

    this.log.log(
      `[OrgChartVersioning] compare baseVersionId=${baseVersion.id} targetVersionId=${targetVersion.id} added=${added.length} removed=${removed.length} moved=${moved.length} unchanged=${unchanged}`,
    );

    return {
      baseVersion: {
        id: Number(baseVersion.id),
        code: baseVersion.code,
        name: baseVersion.name,
      },
      targetVersion: {
        id: Number(targetVersion.id),
        code: targetVersion.code,
        name: targetVersion.name,
      },
      summary: {
        added: added.length,
        removed: removed.length,
        moved: moved.length,
        unchanged,
      },
      changes: {
        added,
        removed,
        moved,
      },
    };
  }

  async getActiveVersion(): Promise<OrgChartVersion> {
    const active = await this.versions.findOne({
      where: { is_active: true },
      order: { id: 'ASC' },
    });

    if (!active) {
      throw new NotFoundException(
        'No existe una versión activa del organigrama. Contacte al administrador.',
      );
    }

    this.log.log(
      `[OrgChartVersioning] resolved active version id=${active.id}`,
    );
    return active;
  }

  async getVersionById(id: string): Promise<OrgChartVersion> {
    const version = await this.versions.findOne({ where: { id } });
    if (!version) {
      throw new NotFoundException(
        `Versión del organigrama ${id} no encontrada.`,
      );
    }
    return version;
  }

  async getVersionByCode(code: string): Promise<OrgChartVersion> {
    const version = await this.versions.findOne({
      where: { code: code.trim() },
    });
    if (!version) {
      throw new NotFoundException(
        `Versión del organigrama con código "${code}" no encontrada.`,
      );
    }
    return version;
  }

  async listVersions(viewer: OrgViewerContext): Promise<OrgChartVersionDto[]> {
    await this.ensureCanUseVersioning(viewer);

    const rows = await this.versions.find({
      order: { is_active: 'DESC', created_at: 'DESC', id: 'DESC' },
    });

    return rows.map((row) => this.toDto(row));
  }

  async resolveVersionForRequest(
    viewer: OrgViewerContext,
    params: ResolveVersionParams,
  ): Promise<string> {
    const versionIdParam = params.versionId?.trim();
    const versionCodeParam = params.versionCode?.trim();

    if (versionIdParam && versionCodeParam) {
      throw new BadRequestException(
        'Use solo versionId o versionCode, no ambos a la vez.',
      );
    }

    if (!versionIdParam && !versionCodeParam) {
      const active = await this.getActiveVersion();
      return String(active.id);
    }

    await this.ensureCanUseVersioning(viewer);

    let version: OrgChartVersion;
    if (versionIdParam) {
      version = await this.getVersionById(versionIdParam);
    } else {
      version = await this.getVersionByCode(versionCodeParam!);
    }

    this.log.log(
      `[OrgChartVersioning] resolved requested version id=${version.id} code=${version.code}`,
    );
    return String(version.id);
  }

  async createSnapshot(
    viewer: OrgViewerContext,
    dto: CreateOrgChartSnapshotDto,
  ): Promise<OrgChartVersionDto> {
    await this.ensureCanUseVersioning(viewer);

    if (!dto.sourceVersionId || dto.sourceVersionId < 1) {
      throw new BadRequestException('sourceVersionId es obligatorio.');
    }
    if (!dto.code?.trim() || !dto.name?.trim()) {
      throw new BadRequestException('code y name son obligatorios.');
    }

    const sourceVersion = await this.getVersionById(
      String(dto.sourceVersionId),
    );
    const code = dto.code.trim();

    const existingCode = await this.versions.findOne({ where: { code } });
    if (existingCode) {
      throw new ConflictException(
        `Ya existe una versión del organigrama con código "${code}".`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const now = new Date();
      const insertResult = await queryRunner.manager.insert(OrgChartVersion, {
        code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        period_label: dto.periodLabel?.trim() ?? null,
        is_active: false,
        is_locked: false,
        created_at: now,
        updated_at: now,
        created_by_person_id: ORG_CHART_VERSIONING_PERSON_ID,
        updated_by_person_id: null,
      });

      const newVersionId = String(insertResult.identifiers[0]?.id);
      if (!newVersionId || newVersionId === 'undefined') {
        throw new Error('No se pudo crear la versión del organigrama.');
      }

      await queryRunner.manager.query(
        `
        INSERT INTO organigrama.org_visual_relation (
          version_id,
          parent_person_id,
          child_person_id,
          relation_type,
          visual_level,
          is_active,
          created_at,
          updated_at
        )
        SELECT
          $1::bigint,
          r.parent_person_id,
          r.child_person_id,
          r.relation_type,
          r.visual_level,
          r.is_active,
          NOW(),
          NOW()
        FROM organigrama.org_visual_relation r
        WHERE r.version_id = $2::bigint
        `,
        [newVersionId, sourceVersion.id],
      );

      const countRows = await queryRunner.manager.query<{ cnt: string }[]>(
        `
        SELECT COUNT(*)::int AS cnt
        FROM organigrama.org_visual_relation
        WHERE version_id = $1::bigint
        `,
        [newVersionId],
      );
      const copiedCount = Number(countRows?.[0]?.cnt ?? 0);

      await queryRunner.commitTransaction();

      this.log.log(
        `[OrgChartVersioning] snapshot created sourceVersionId=${sourceVersion.id} targetVersionId=${newVersionId} relationsCopied=${copiedCount}`,
      );

      const created = await this.getVersionById(newVersionId);
      return this.toDto(created);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Resuelve eduEmail desde JWT o BD si falta en sesión antigua. */
  async resolveViewerEduEmail(
    viewer: OrgViewerContext,
  ): Promise<string | null> {
    if (viewer.eduEmail) {
      return viewer.eduEmail;
    }

    const person = await this.persons.findOne({
      where: { id: viewer.personId, is_active: true },
      select: ['id', 'edu_email'],
    });

    return person?.edu_email ?? null;
  }

  async canUseVersioningWithResolvedEmail(
    viewer: OrgViewerContext,
  ): Promise<boolean> {
    const eduEmail = await this.resolveViewerEduEmail(viewer);
    return this.canUseVersioning({ ...viewer, eduEmail });
  }

  private normalizeEmail(email: string | null | undefined): string {
    return (email ?? '').trim().toLowerCase();
  }

  private toRelationRef(row: {
    parent_person_id: string;
    child_person_id: string;
    relation_type: string;
    visual_level: number | null;
  }) {
    return {
      parentPersonId: Number(row.parent_person_id),
      childPersonId: Number(row.child_person_id),
      relationType: row.relation_type,
      visualLevel: row.visual_level,
    };
  }

  private toDto(version: OrgChartVersion): OrgChartVersionDto {
    return {
      id: Number(version.id),
      code: version.code,
      name: version.name,
      description: version.description,
      periodLabel: version.period_label,
      isActive: version.is_active,
      isLocked: version.is_locked,
      createdAt: version.created_at.toISOString(),
      updatedAt: version.updated_at.toISOString(),
    };
  }
}
