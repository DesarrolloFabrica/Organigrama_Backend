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
import { getAuthSessionFromRequest } from '../auth/auth-request.util';
import {
  isOrgChartLegacyEnabled,
  LEGACY_ORG_CHART_DISABLED_MESSAGE,
} from './org-chart-legacy.config';
import { OrgChartService } from './org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  private readonly log = new Logger(OrgChartController.name);

  constructor(private readonly orgChartService: OrgChartService) {}

  private viewerPersonId(req: Request): string {
    return getAuthSessionFromRequest(req)!.personId;
  }

  /**
   * LEGACY ENDPOINT — @deprecated
   * Devuelve el árbol completo del organigrama (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/root`, `GET /api/org-chart/node/:id` y
   * `GET /api/org-chart/children/:id` para carga progresiva.
   */
  @Get()
  getOrgChart(@Req() req: Request) {
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
    return this.orgChartService.getOrgChartTree(this.viewerPersonId(req));
  }

  /** Busca personas y devuelve su ruta jerárquica dentro del organigrama. */
  @Get('search')
  searchOrgChart(@Query('q') query: string, @Req() req: Request) {
    return this.orgChartService.searchOrgChart(
      query,
      this.viewerPersonId(req),
    );
  }

  /** Detalle de persona con visibilidad jerárquica. */
  @Get('person/:id')
  getPersonDetail(@Param('id') id: string, @Req() req: Request) {
    return this.orgChartService.getPersonDetail(id, this.viewerPersonId(req));
  }

  /**
   * LEGACY ENDPOINT — @deprecated
   * Subárbol completo con la persona indicada como raíz (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/node/:id` y `GET /api/org-chart/children/:id`.
   */
  @Get('team/:id')
  getOrgChartTeamRoot(@Param('id') id: string, @Req() req: Request) {
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
    return this.orgChartService.getOrgChartSubtree(
      id,
      this.viewerPersonId(req),
    );
  }

  /** Persona como raíz del lienzo + solo hijos directos (carga superficial). */
  @Get('node/:id')
  getOrgChartNode(@Param('id') id: string, @Req() req: Request) {
    return this.orgChartService.getOrgChartNode(id, this.viewerPersonId(req));
  }

  /** Devuelve solo los hijos directos de una persona. */
  @Get('children/:id')
  getOrgChartChildren(@Param('id') id: string, @Req() req: Request) {
    return this.orgChartService.getOrgChartChildren(
      id,
      this.viewerPersonId(req),
    );
  }

  /** Devuelve la raíz del organigrama con solo sus hijos directos. */
  @Get('root')
  getOrgChartRoot(@Req() req: Request) {
    return this.orgChartService.getOrgChartRoot(this.viewerPersonId(req));
  }

  /** Resumen por áreas generales (hijos directos del root + totales bajo jerarquía). */
  @Get('summary/general-areas')
  getGeneralAreasSummary(@Req() req: Request) {
    return this.orgChartService.getGeneralAreasSummary(
      this.viewerPersonId(req),
    );
  }

  /** Resumen jerárquico de un nodo: general + desglose por hijos directos. */
  @Get('summary/:personId')
  getNodeSummary(@Param('personId') personId: string, @Req() req: Request) {
    return this.orgChartService.getNodeSummary(
      personId,
      this.viewerPersonId(req),
    );
  }
}
