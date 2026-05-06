import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { Person } from '../person/entities/person.entity';
import { OrgRelation } from './entities/org-relation.entity';
import { OrgChartController } from './org-chart.controller';
import { OrgChartService } from './org-chart.service';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';
import { School } from '../catalogs/entities/school.entity';
import { Program } from '../catalogs/entities/program.entity';
import { City } from '../catalogs/entities/city.entity';
import { Region } from '../catalogs/entities/region.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Person,
      OrgRelation,
      Role,
      Hierarchy,
      Area,
      School,
      Program,
      City,
      Campus,
      ContractType,
      Region,
    ]),
  ],
  controllers: [OrgChartController],
  providers: [OrgChartService],
})
export class OrgChartModule {}
