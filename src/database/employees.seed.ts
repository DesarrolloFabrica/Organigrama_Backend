import { DataSource } from 'typeorm';
import { seedOrganigramaDemoIfEmpty } from './organigrama-demo.seed';

/**
 * @deprecated Conservar nombre para tests e2e; delega en el seed del organigrama actual.
 */
export async function seedEmployeesIfEmpty(ds: DataSource): Promise<void> {
  await seedOrganigramaDemoIfEmpty(ds);
}
