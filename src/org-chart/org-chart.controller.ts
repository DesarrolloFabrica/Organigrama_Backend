import {
  Controller,
  Get,
  GoneException,
  Logger,
  Param,
  Query,
} from '@nestjs/common';
import {
  isOrgChartLegacyEnabled,
  LEGACY_ORG_CHART_DISABLED_MESSAGE,
} from './org-chart-legacy.config';
import { OrgChartService } from './org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  private readonly log = new Logger(OrgChartController.name);

  constructor(private readonly orgChartService: OrgChartService) {}

  /**
   * LEGACY ENDPOINT — @deprecated
   * Devuelve el árbol completo del organigrama (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/root`, `GET /api/org-chart/node/:id` y
   * `GET /api/org-chart/children/:id` para carga progresiva.
   */
  @Get()
  getOrgChart() {
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
    return this.orgChartService.getOrgChartTree();
  }

  /** Busca personas y devuelve su ruta jerárquica dentro del organigrama. */
  @Get('search')
  searchOrgChart(@Query('q') query: string) {
    return this.orgChartService.searchOrgChart(query);
  }

  /** Devuelve el detalle completo de una persona por ID. */
  @Get('person/:id')
  getPersonDetail(@Param('id') id: string) {
    return this.orgChartService.getPersonDetail(id);
  }

  /**
   * LEGACY ENDPOINT — @deprecated
   * Subárbol completo con la persona indicada como raíz (recursión sin límite).
   * No usar en frontend principal.
   * Usar `GET /api/org-chart/node/:id` y `GET /api/org-chart/children/:id`.
   */
  @Get('team/:id')
  getOrgChartTeamRoot(@Param('id') id: string) {
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
    return this.orgChartService.getOrgChartSubtree(id);
  }

  /** Persona como raíz del lienzo + solo hijos directos (carga superficial). */
  @Get('node/:id')
  getOrgChartNode(@Param('id') id: string) {
    return this.orgChartService.getOrgChartNode(id);
  }

  /** Devuelve solo los hijos directos de una persona. */
  @Get('children/:id')
  getOrgChartChildren(@Param('id') id: string) {
    return this.orgChartService.getOrgChartChildren(id);
  }

  /** Devuelve la raíz del organigrama con solo sus hijos directos. */
  @Get('root')
  getOrgChartRoot() {
    return this.orgChartService.getOrgChartRoot();
  }

  /** Resumen por áreas generales (hijos directos del root + totales bajo jerarquía). */
  @Get('summary/general-areas')
  getGeneralAreasSummary() {
    return this.orgChartService.getGeneralAreasSummary();
  }

  /** Resumen jerárquico de un nodo: general + desglose por hijos directos. */
  @Get('summary/:personId')
  getNodeSummary(@Param('personId') personId: string) {
    return this.orgChartService.getNodeSummary(personId);
  }
}
