import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { Person } from '../person/entities/person.entity';
import { OrgChartController } from './org-chart.controller';
import { OrgChartService } from './org-chart.service';
import { OrgChartTreeEngine } from './org-chart-tree.engine';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';
import { School } from '../catalogs/entities/school.entity';
import { Program } from '../catalogs/entities/program.entity';
import { City } from '../catalogs/entities/city.entity';
import { Region } from '../catalogs/entities/region.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';
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
    ]),
    OrgChartPhotosModule,
  ],
  controllers: [OrgChartController],
  providers: [OrgChartService, OrgChartTreeEngine, OrgChartVisibilityService],
  exports: [OrgChartService, OrgChartVisibilityService],

})
export class OrgChartModule {}
