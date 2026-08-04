import { Module, forwardRef } from '@nestjs/common';

import { TypeOrmModule } from '@nestjs/typeorm';

import { Role } from '../catalogs/entities/role.entity';

import { Person } from '../person/entities/person.entity';

import { OrgChartController } from './org-chart.controller';

import { OrgChartVersionController } from './org-chart-version.controller';

import { OrgChartService } from './org-chart.service';

import { OrgChartCvService } from './org-chart-cv.service';

import { OrgChartCompetenciesService } from './org-chart-competencies.service';

import { OrgChartVideoService } from './video/org-chart-video.service';

import { OrgChartVideoTicketService } from './video/org-chart-video-ticket.service';

import { OrgChartVideoStreamService } from './video/org-chart-video-stream.service';

import { OrgChartVideoDriveStreamClient } from './video/org-chart-video-drive-stream.client';

import { OrgChartTreeEngine } from './org-chart-tree.engine';

import { OrgChartVisibilityService } from './org-chart-visibility.service';

import { OrgChartVersionService } from './org-chart-version.service';

import { OrgChartVacancyService } from './vacancies/org-chart-vacancy.service';

import { Vacancy } from './vacancies/entities/vacancy.entity';

import { Hierarchy } from '../catalogs/entities/hierarchy.entity';

import { Area } from '../catalogs/entities/area.entity';

import { School } from '../catalogs/entities/school.entity';

import { Program } from '../catalogs/entities/program.entity';

import { City } from '../catalogs/entities/city.entity';

import { Region } from '../catalogs/entities/region.entity';

import { Campus } from '../catalogs/entities/campus.entity';

import { ContractType } from '../catalogs/entities/contract-type.entity';

import { OrgVisualRelation } from './entities/org-visual-relation.entity';

import { OrgVisualRelationOverride } from './entities/org-visual-relation-override.entity';

import { OrgVisualRelationPositionChild } from './entities/org-visual-relation-position-child.entity';

import { OrgChartVersion } from './entities/org-chart-version.entity';

import { OrgChartPersonOverride } from './entities/org-chart-person-override.entity';

import { OrgChartPhotosModule } from './photos/org-chart-photos.module';

import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    forwardRef(() => ProfileModule),

    TypeOrmModule.forFeature([
      Person,

      Role,

      Hierarchy,

      Area,

      School,

      Program,

      City,

      Campus,

      ContractType,

      Region,

      OrgVisualRelation,

      OrgVisualRelationOverride,

      OrgVisualRelationPositionChild,

      OrgChartVersion,

      OrgChartPersonOverride,

      Vacancy,
    ]),

    OrgChartPhotosModule,
  ],

  controllers: [OrgChartController, OrgChartVersionController],

  providers: [
    OrgChartService,

    OrgChartCvService,

    OrgChartCompetenciesService,

    OrgChartVideoService,

    OrgChartVideoTicketService,

    OrgChartVideoStreamService,

    OrgChartVideoDriveStreamClient,

    OrgChartTreeEngine,

    OrgChartVisibilityService,

    OrgChartVersionService,

    OrgChartVacancyService,
  ],

  exports: [OrgChartService, OrgChartVisibilityService, OrgChartVersionService],
})
export class OrgChartModule {}
