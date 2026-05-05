import { Controller, Get } from '@nestjs/common';
import { OrgChartService } from './org-chart.service';

@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly orgChartService: OrgChartService) {}

  @Get()
  getOrgChart() {
    return this.orgChartService.getOrgChartTree();
  }
}
