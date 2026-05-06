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
}
