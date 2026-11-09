import {
  Controller,
  Get,
  GoneException,
  Header,
  Logger,
  Param,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  isOrgChartLegacyEnabled,
  LEGACY_ORG_CHART_DISABLED_MESSAGE,
} from './org-chart-legacy.config';
import { OrgChartService } from './org-chart.service';
import { OrgChartVersionService } from './org-chart-version.service';
import { OrgChartCvService } from './org-chart-cv.service';
import { OrgChartVacancyService } from './vacancies/org-chart-vacancy.service';
import { OrgChartDirectoryExportService } from './org-chart-directory-export.service';
import { resolveOrgChartVersionId } from './org-chart-version-query.util';
import { buildOrgViewerContext } from './org-chart-viewer.util';
import type { PersonCvResponseDto } from './dto/person-cv.response.dto';
import type { VacancyListResponseDto } from './vacancies/dto/vacancy.response.dto';

@Controller('org-chart')
export class OrgChartController {
  private readonly log = new Logger(OrgChartController.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly versionService: OrgChartVersionService,
    private readonly cvService: OrgChartCvService,
    private readonly vacancyService: OrgChartVacancyService,
    private readonly directoryExportService: OrgChartDirectoryExportService,
  ) {}

  private async resolveVersion(
    req: Request,
    versionId?: string,
    versionCode?: string,
  ): Promise<string> {
    const viewer = buildOrgViewerContext(req);
    return resolveOrgChartVersionId(this.versionService, viewer, {
      versionId,
      versionCode,
    });
  }

  /**
   * LEGACY ENDPOINT — @deprecated
   * Devuelve el árbol completo del organigrama (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/root`, `GET /api/org-chart/node/:id` y
   * `GET /api/org-chart/children/:id` para carga progresiva.
   */
  @Get()
  async getOrgChart(
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    if (!isOrgChartLegacyEnabled()) {
      this.log.warn(
        '[OrgChartLegacy] Blocked deprecated endpoint GET /api/org-chart because ORG_CHART_LEGACY_ENABLED=false',
      );
      throw new GoneException({
        message: LEGACY_ORG_CHART_DISABLED_MESSAGE,
      });
    }

    this.log.warn(
      '[OrgChartLegacy] Deprecated endpoint GET /api/org-chart was called',
    );
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getOrgChartTree(
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /** Busca personas y devuelve su ruta jerárquica dentro del organigrama. */
  @Get('search')
  async searchOrgChart(
    @Query('q') query: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.searchOrgChart(
      query,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /**
   * Excel del organigrama **activo** (área, jefe, contacto y emergencia).
   * Solo correos en ORG_CHART_DIRECTORY_EXPORT_EMAILS.
   */
  @Get('export/directory')
  @Header('Content-Type', 'application/vnd.ms-excel; charset=utf-8')
  async exportActiveDirectory(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.directoryExportService.exportActiveDirectory(
      buildOrgViewerContext(req),
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.filename}"`,
    );
    return new StreamableFile(file.buffer);
  }

  /**
   * Lista las vacantes desde el schema externo `vacancies` (solo lectura).
   *
   * Devuelve un DTO limpio para el frontend, enriquecido con nombres de core
   * (área, escuela, programa) cuando existe la referencia por ID.
   */
  @Get('vacancies')
  async getVacancies(): Promise<VacancyListResponseDto> {
    return this.vacancyService.getVacancies();
  }

  /** Detalle de persona con visibilidad jerárquica. */
  @Get('person/:id')
  async getPersonDetail(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getPersonDetail(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /**
   * Devuelve si una persona tiene hoja de vida (CV) y la URL almacenada.
   *
   * El CV es información SENSIBLE: aplica la MISMA política de visibilidad
   * jerárquica que la ficha completa (self / jefes-descendientes / ORG_READ_ALL).
   * Si el viewer no tiene permiso, el servicio responde { hasCv: false } sin
   * revelar la existencia del archivo.
   *
   * Lee desde organigrama.person_cv (no consulta Google Drive en tiempo real).
   * Hereda el mismo guard global de autenticación (JwtAuthGuard) que el resto
   * de endpoints de org-chart.
   */
  @Get('person/:personId/cv')
  async getPersonCv(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ): Promise<PersonCvResponseDto> {
    // Construimos el contexto del usuario autenticado desde el JWT
    // (personId, email y permisos) y resolvemos la versión vigente para
    // evaluar la jerarquía con la misma base que el resto del organigrama.
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.cvService.getPersonCv(viewer, personId, resolvedVersionId);
  }

  /**
   * LEGACY ENDPOINT — @deprecated
   * Subárbol completo con la persona indicada como raíz (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/node/:id` y `GET /api/org-chart/children/:id`.
   */
  @Get('team/:id')
  async getOrgChartTeamRoot(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    if (!isOrgChartLegacyEnabled()) {
      this.log.warn(
        '[OrgChartLegacy] Blocked deprecated endpoint GET /api/org-chart/team/:id because ORG_CHART_LEGACY_ENABLED=false',
      );
      throw new GoneException({
        message: LEGACY_ORG_CHART_DISABLED_MESSAGE,
      });
    }

    this.log.warn(
      '[OrgChartLegacy] Deprecated endpoint GET /api/org-chart/team/:id was called',
    );
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getOrgChartSubtree(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /**
   * Persona como raíz del lienzo + solo hijos directos (carga superficial).
   *
   * `relationId` (opcional): posición visual (`org_visual_relation.id`) que ocupa
   * la persona. Si se provee y la posición tiene equipo propio, los hijos se
   * resuelven para esa posición; si no, comportamiento por `parent_person_id`.
   */
  @Get('node/:id')
  async getOrgChartNode(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('relationId') relationId?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getOrgChartNode(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
      relationId ?? null,
    );
  }

  /**
   * Devuelve solo los hijos directos de una persona.
   *
   * `relationId` (opcional): si viene, se buscan primero los hijos colgados de
   * esa posición visual; si la posición no tiene equipo propio, se cae al
   * comportamiento actual por `parent_person_id`.
   */
  @Get('children/:id')
  async getOrgChartChildren(
    @Param('id') id: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('relationId') relationId?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getOrgChartChildren(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
      relationId ?? null,
    );
  }

  /** Devuelve la raíz del organigrama con solo sus hijos directos. */
  @Get('root')
  async getOrgChartRoot(
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getOrgChartRoot(
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /** Resumen por áreas generales (hijos directos del root + totales bajo jerarquía). */
  @Get('summary/general-areas')
  async getGeneralAreasSummary(
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getGeneralAreasSummary(
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /** Resumen jerárquico de un nodo: general + desglose por hijos directos. */
  @Get('summary/:personId')
  async getNodeSummary(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ) {
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getNodeSummary(
      personId,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }
}
