import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { Person } from '../person/entities/person.entity';
import { OrgChartController } from './org-chart.controller';
import { OrgChartService } from './org-chart.service';
import { OrgChartTreeEngine } from './org-chart-tree.engine';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';
import { School } from '../catalogs/entities/school.entity';
import { Program } from '../catalogs/entities/program.entity';
import { City } from '../catalogs/entities/city.entity';
import { Region } from '../catalogs/entities/region.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';
import { OrgVisualRelation } from './entities/org-visual-relation.entity';

@Module({
  imports: [
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
  ],
  controllers: [OrgChartController],
  providers: [OrgChartService, OrgChartTreeEngine],
})
export class OrgChartModule {}
