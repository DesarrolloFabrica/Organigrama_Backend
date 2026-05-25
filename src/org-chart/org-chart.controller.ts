import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  /** Devuelve el árbol completo del organigrama. */
  @Get()
  getOrgChart() {
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

  /** Subárbol con la persona indicada como raíz (misma forma que GET /org-chart). */
  @Get('team/:id')
  getOrgChartTeamRoot(@Param('id') id: string) {
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
