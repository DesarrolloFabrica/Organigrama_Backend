import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Employee } from '../employees/employee.entity';
import { OrgChartController } from './org-chart.controller';
import { OrgChartService } from './org-chart.service';

@Module({
  imports: [TypeOrmModule.forFeature([Employee])],
  controllers: [OrgChartController],
  providers: [OrgChartService],
})
export class OrgChartModule {}
