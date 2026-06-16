import {
  Controller,
  Get,
  GoneException,
  Logger,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  isOrgChartLegacyEnabled,
  LEGACY_ORG_CHART_DISABLED_MESSAGE,
} from './org-chart-legacy.config';
import { OrgChartService } from './org-chart.service';
import { OrgChartVersionService } from './org-chart-version.service';
import { resolveOrgChartVersionId } from './org-chart-version-query.util';
import { buildOrgViewerContext } from './org-chart-viewer.util';

@Controller('org-chart')
export class OrgChartController {
  private readonly log = new Logger(OrgChartController.name);

  constructor(
    private readonly orgChartService: OrgChartService,
    private readonly versionService: OrgChartVersionService,
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

  /** Persona como raíz del lienzo + solo hijos directos (carga superficial). */
  @Get('node/:id')
  async getOrgChartNode(
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
    return this.orgChartService.getOrgChartNode(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
    );
  }

  /** Devuelve solo los hijos directos de una persona. */
  @Get('children/:id')
  async getOrgChartChildren(
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
    return this.orgChartService.getOrgChartChildren(
      id,
      buildOrgViewerContext(req),
      resolvedVersionId,
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
