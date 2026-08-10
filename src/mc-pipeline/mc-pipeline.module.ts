import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McCvSnapshot } from './entities/mc-cv-snapshot.entity';
import { McCvSnapshotService } from './p0/mc-cv-snapshot.service';

@Module({
  imports: [TypeOrmModule.forFeature([McCvSnapshot])],
  providers: [McCvSnapshotService],
  exports: [TypeOrmModule, McCvSnapshotService],
})
export class McPipelineModule {}
