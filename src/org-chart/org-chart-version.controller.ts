import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CreateOrgChartSnapshotDto } from './dto/create-org-chart-snapshot.dto';
import { OrgChartVersionService } from './org-chart-version.service';
import { buildOrgViewerContext } from './org-chart-viewer.util';

@Controller('org-chart/versions')
export class OrgChartVersionController {
  constructor(private readonly versionService: OrgChartVersionService) {}

  @Get()
  listVersions(@Req() req: Request) {
    return this.versionService.listVersions(buildOrgViewerContext(req));
  }

  @Get('compare')
  compareVersions(
    @Req() req: Request,
    @Query('baseVersionId') baseVersionId: string,
    @Query('targetVersionId') targetVersionId: string,
  ) {
    return this.versionService.compareVersions(
      buildOrgViewerContext(req),
      baseVersionId,
      targetVersionId,
    );
  }

  @Post('snapshot')
  createSnapshot(@Req() req: Request, @Body() body: CreateOrgChartSnapshotDto) {
    return this.versionService.createSnapshot(buildOrgViewerContext(req), body);
  }
}
