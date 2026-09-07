import {
  Controller,
  Get,
  GoneException,
  Logger,
  Param,
  Query,
  Req,
  Res,
  HttpException,
  UseInterceptors,
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
import { OrgChartWorkforceEventsService } from './workforce-events/org-chart-workforce-events.service';
import { OrgChartCompetenciesService } from './org-chart-competencies.service';
import { CompetencyPeopleSearchService } from './competency-people-search.service';
import { OrgChartVideoService } from './video/org-chart-video.service';
import {
  OrgChartVideoStreamService,
  applyPersonVideoStreamCors,
} from './video/org-chart-video-stream.service';
import { PersonVideoStreamHttpError } from './video/org-chart-video-stream.types';
import { resolveOrgChartVersionId } from './org-chart-version-query.util';
import { OrgChartVersionReadPlanInterceptor } from './org-chart-version-read-plan.interceptor';
import { buildOrgViewerContext } from './org-chart-viewer.util';
import type { PersonCvResponseDto } from './dto/person-cv.response.dto';
import type { VacancyListResponseDto } from './vacancies/dto/vacancy.response.dto';
import type { WorkforceEventListResponseDto } from './workforce-events/dto/workforce-event.response.dto';
import type {
  CompetencyDomainDetailDto,
  CompetencyExplorerSummaryDto,
  CompetencyProfessionalProfileDto,
  CompetencySpecialtyDetailDto,
} from './dto/competencies.response.dto';
import type { PersonVideoResponseDto } from './video/org-chart-video.types';
import { Public } from '../auth/public.decorator';
import type { CompetencyPeopleSearchResponseDto } from './dto/competency-people-search.response.dto';
import { requireOrgChartIdParam } from './org-chart-id-param.util';

@Controller('org-chart')
@UseInterceptors(OrgChartVersionReadPlanInterceptor)
export class OrgChartController {
  private readonly log = new Logger(OrgChartController.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly versionService: OrgChartVersionService,
    private readonly cvService: OrgChartCvService,
    private readonly vacancyService: OrgChartVacancyService,
    private readonly workforceEventsService: OrgChartWorkforceEventsService,
    private readonly competenciesService: OrgChartCompetenciesService,
    private readonly competencyPeopleSearchService: CompetencyPeopleSearchService,
    private readonly videoService: OrgChartVideoService,
    private readonly videoStreamService: OrgChartVideoStreamService,
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
   * Buscador progresivo de personas por el perfil MC1 publicado.
   * Solo opera sobre el mismo universo autorizado de ficha completa.
   */
  @Get('competency-people-search')
  async searchPeopleByCompetency(
    @Req() req: Request,
    @Query('domain') domain?: string,
    @Query('specialty') specialty?: string,
    @Query('skills') skills?: string | string[],
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ): Promise<CompetencyPeopleSearchResponseDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.competencyPeopleSearchService.search(
      viewer,
      resolvedVersionId,
      { domain, specialty, skills, page, pageSize },
    );
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
   * Historial de novedades (`workforce_events`) de una persona.
   * Solo lectura: Organigrama no crea ni cambia estado (eso vive en Orbit).
   * Misma visibilidad que la ficha completa; sin permiso → `{ items: [] }`.
   */
  @Get('person/:personId/workforce-events')
  async getPersonWorkforceEvents(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ): Promise<WorkforceEventListResponseDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.workforceEventsService.listByPersonId(
      viewer,
      personId,
      resolvedVersionId,
    );
  }

  /**
   * Disponibilidad, metadatos, ticket y streamUrl.
   * Presentación: cualquier usuario autenticado (no usa canViewFullProfile).
   * Vacante / sin video → { hasVideo: false }. Persona inexistente/inactiva → 404.
   * Ficha y CV siguen la política jerárquica aparte.
   */
  @Get('person/:personId/video')
  async getPersonVideo(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
  ): Promise<PersonVideoResponseDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.videoService.getPersonVideo(
      viewer,
      personId,
      resolvedVersionId,
    );
  }

  /**
   * Streaming Range del video de presentación (Fase 3C).
   * Credencial: únicamente `ticket` (no Bearer / no JWT de sesión en query).
   */
  @Public()
  @Get('person/:personId/video/stream')
  async streamPersonVideo(
    @Param('personId') personId: string,
    @Query('ticket') ticket: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // CORS también en errores JSON: <video crossOrigin> exige ACAO incluso en 4xx/5xx.
    applyPersonVideoStreamCors(req, res);
    try {
      const rangeHeader =
        typeof req.headers.range === 'string' ? req.headers.range : undefined;
      await this.videoStreamService.streamToResponse({
        personId,
        ticket,
        rangeHeader,
        req,
        res,
        requestId: (req.headers['x-request-id'] as string) || undefined,
      });
    } catch (err) {
      if (err instanceof PersonVideoStreamHttpError) {
        if (!res.headersSent) {
          applyPersonVideoStreamCors(req, res);
          if (err.headers) {
            for (const [k, v] of Object.entries(err.headers)) {
              res.setHeader(k, v);
            }
          }
          res.status(err.httpStatus).json({
            statusCode: err.httpStatus,
            message: err.message,
            code: err.code,
          });
        }
        return;
      }
      if (err instanceof HttpException) {
        if (!res.headersSent) {
          applyPersonVideoStreamCors(req, res);
          const status = err.getStatus();
          const body = err.getResponse();
          res
            .status(status)
            .json(
              typeof body === 'string'
                ? { statusCode: status, message: body }
                : body,
            );
        }
        return;
      }
      this.log.error(
        `streamPersonVideo unexpected error personId=${personId}`,
        err instanceof Error ? err.stack : undefined,
      );
      if (!res.headersSent) {
        applyPersonVideoStreamCors(req, res);
        res.status(500).json({
          statusCode: 500,
          message: 'Error al transmitir el video',
          code: 'STREAM_PIPE_ERROR',
        });
      }
    }
  }

  /**
   * Resumen del Explorador de Competencias (MC1.3.4).
   * Misma política de visibilidad que la ficha completa.
   * Lee evaluaciones PA2 persistidas; no recalcula.
   *
   * Query:
   *  - includeHidden=true → incluye especialidades HIDDEN (auditoría)
   *  - includeAudit=true → metadatos de evaluación (soporte)
   */
  @Get('person/:personId/competencies')
  async getPersonCompetencies(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('includeHidden') includeHidden?: string,
    @Query('includeAudit') includeAudit?: string,
  ): Promise<CompetencyExplorerSummaryDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.competenciesService.getExplorerSummary(
      viewer,
      personId,
      resolvedVersionId,
      {
        includeHidden: includeHidden === 'true',
        includeAudit: includeAudit === 'true',
      },
    );
  }

  /**
   * Perfil profesional multidominio (piloto MC1).
   * Dominios publicables de la extracción activa + default determinístico.
   * CDR solo si existe persistido (hoy: null).
   */
  @Get('person/:personId/competencies/professional-profile')
  async getPersonProfessionalProfile(
    @Param('personId') personId: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('includeHidden') includeHidden?: string,
    @Query('includeAudit') includeAudit?: string,
  ): Promise<CompetencyProfessionalProfileDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.competenciesService.getProfessionalProfile(
      viewer,
      personId,
      resolvedVersionId,
      {
        includeHidden: includeHidden === 'true',
        includeAudit: includeAudit === 'true',
      },
    );
  }

  /**
   * Detalle de un área profesional evaluada (p. ej. SOFTWARE).
   */
  @Get('person/:personId/competencies/domains/:domainCode')
  async getPersonCompetencyDomain(
    @Param('personId') personId: string,
    @Param('domainCode') domainCode: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('includeHidden') includeHidden?: string,
    @Query('includeAudit') includeAudit?: string,
  ): Promise<CompetencyDomainDetailDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.competenciesService.getDomainDetail(
      viewer,
      personId,
      domainCode,
      resolvedVersionId,
      {
        includeHidden: includeHidden === 'true',
        includeAudit: includeAudit === 'true',
      },
    );
  }

  /**
   * Detalle de especialidad con skills y evidencias fragmentarias permitidas.
   * Las evidencias completas van aquí (no en el resumen inicial).
   */
  @Get(
    'person/:personId/competencies/domains/:domainCode/specialties/:specialtyCode',
  )
  async getPersonCompetencySpecialty(
    @Param('personId') personId: string,
    @Param('domainCode') domainCode: string,
    @Param('specialtyCode') specialtyCode: string,
    @Req() req: Request,
    @Query('versionId') versionId?: string,
    @Query('versionCode') versionCode?: string,
    @Query('includeAudit') includeAudit?: string,
  ): Promise<CompetencySpecialtyDetailDto> {
    const viewer = buildOrgViewerContext(req);
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.competenciesService.getSpecialtyDetail(
      viewer,
      personId,
      domainCode,
      specialtyCode,
      resolvedVersionId,
      { includeAudit: includeAudit === 'true' },
    );
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
    const resolvedPersonId = requireOrgChartIdParam(personId, 'personId');
    const resolvedVersionId = await this.resolveVersion(
      req,
      versionId,
      versionCode,
    );
    return this.orgChartService.getNodeSummary(
      resolvedPersonId,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }
}
