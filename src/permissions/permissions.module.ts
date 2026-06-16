import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonPermission } from './entities/person-permission.entity';
import { PersonPermissionService } from './person-permission.service';

@Module({
  imports: [TypeOrmModule.forFeature([PersonPermission])],
  providers: [PersonPermissionService],
  exports: [PersonPermissionService],
})
export class PermissionsModule {}
