/**
 * Bootstrap TypeORM DataSource + McCvSnapshotService para scripts Observatory.
 */
import { DataSource } from 'typeorm';
import { McCvSnapshot } from '../mc-pipeline/entities/mc-cv-snapshot.entity';
import { McCvSnapshotService } from '../mc-pipeline/p0/mc-cv-snapshot.service';
import { P0DriveDocumentSource } from '../mc-pipeline/p0/p0-drive-document-source';
import type { MdeConnectionTarget } from '../mc-pipeline/p0/mde-guard';

export async function createMdeDataSource(
  mde: MdeConnectionTarget & { username: string; password: string },
): Promise<DataSource> {
  const ds = new DataSource({
    type: 'postgres',
    host: mde.host,
    port: Number(mde.port),
    username: mde.username,
    password: mde.password,
    database: mde.database,
    entities: [McCvSnapshot],
    synchronize: false,
    logging: false,
  });
  await ds.initialize();
  return ds;
}

export function createP0Service(
  ds: DataSource,
  mde: MdeConnectionTarget,
): McCvSnapshotService {
  const repo = ds.getRepository(McCvSnapshot);
  return McCvSnapshotService.create(repo, {
    dataSource: ds,
    driveSource: new P0DriveDocumentSource(ds),
    mdeTarget: mde,
  });
}
