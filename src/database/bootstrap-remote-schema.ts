import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { OrgRelation } from '../org-chart/entities/org-relation.entity';
import { Role } from '../catalogs/entities/role.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';
import { School } from '../catalogs/entities/school.entity';
import { Program } from '../catalogs/entities/program.entity';
import { City } from '../catalogs/entities/city.entity';
import { Campus } from '../catalogs/entities/campus.entity';
import { ContractType } from '../catalogs/entities/contract-type.entity';
import { Region } from '../catalogs/entities/region.entity';

/**
 * Crea o alinea tablas del organigrama en una BD remota (TypeORM synchronize).
 * Requiere REMOTE_DB_HOST, REMOTE_DB_USER, REMOTE_DB_NAME, REMOTE_DB_PASSWORD.
 * Opcional: REMOTE_DB_PORT (5432), REMOTE_DB_SSL=false para desactivar SSL.
 */
async function main(): Promise<void> {
  const host = process.env.REMOTE_DB_HOST;
  const port = parseInt(process.env.REMOTE_DB_PORT ?? '5432', 10);
  const username = process.env.REMOTE_DB_USER;
  const password = process.env.REMOTE_DB_PASSWORD;
  const database = process.env.REMOTE_DB_NAME;
  if (!host || !username || !database || password === undefined) {
    console.error(
      'Definir REMOTE_DB_HOST, REMOTE_DB_USER, REMOTE_DB_NAME y REMOTE_DB_PASSWORD.',
    );
    process.exit(1);
  }
  const ssl =
    process.env.REMOTE_DB_SSL === '0' ||
    process.env.REMOTE_DB_SSL === 'false'
      ? false
      : { rejectUnauthorized: false };

  const ds = new DataSource({
    type: 'postgres',
    host,
    port,
    username,
    password,
    database,
    entities: [
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
    ],
    synchronize: true,
    logging: process.env.REMOTE_DB_LOGGING === 'true',
    ssl,
  });
  await ds.initialize();
  console.log('Esquema creado o alineado en remoto.');
  await ds.destroy();
}

void main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
