import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Area } from '../catalogs/entities/area.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Program } from '../catalogs/entities/program.entity';
import { Role } from '../catalogs/entities/role.entity';
import { School } from '../catalogs/entities/school.entity';
import { Person } from '../person/entities/person.entity';
import { ProfileDevController } from './dev/profile-dev.controller';
import { ProfileDevGuard } from './dev/profile-dev.guard';
import { PersonProfileState } from './entities/person-profile-state.entity';
import { ProfileCompletionService } from './profile-completion.service';
import { OrgChartModule } from '../org-chart/org-chart.module';
import { OrgChartPhotosModule } from '../org-chart/photos/org-chart-photos.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    OrgChartPhotosModule,
    forwardRef(() => OrgChartModule),
    TypeOrmModule.forFeature([
      Person,
      PersonProfileState,
      Role,
      Hierarchy,
      Area,
      School,
      Program,
    ]),
  ],
  controllers: [ProfileController, ProfileDevController],
  providers: [ProfileService, ProfileCompletionService, ProfileDevGuard],
  exports: [ProfileService, ProfileCompletionService],
})
export class ProfileModule {}
