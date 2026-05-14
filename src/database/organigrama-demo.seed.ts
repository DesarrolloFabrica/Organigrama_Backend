import { DataSource } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { OrgRelation } from '../org-chart/entities/org-relation.entity';
import { Role } from '../catalogs/entities/role.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Area } from '../catalogs/entities/area.entity';

/**
 * Inserta catálogos mínimos, personas demo y relaciones si `person` está vacía.
 * Idempotente: no hace nada si ya hay filas en `person`.
 */
export async function seedOrganigramaDemoIfEmpty(ds: DataSource): Promise<void> {
  const personRepo = ds.getRepository(Person);
  if ((await personRepo.count()) > 0) {
    return;
  }

  const qr = ds.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const hr = qr.manager.getRepository(Hierarchy);
    await hr.save([
      { id: '1', name: 'Dirección', description: null, is_active: true },
      { id: '2', name: 'Coordinación', description: null, is_active: true },
      { id: '3', name: 'Operativo', description: null, is_active: true },
    ]);

    const roleRepo = qr.manager.getRepository(Role);
    await roleRepo.save([
      { id: '1', name: 'Director', description: null, is_active: true },
      {
        id: '2',
        name: 'Coordinador académico',
        description: null,
        is_active: true,
      },
      {
        id: '3',
        name: 'Coordinador de procesos',
        description: null,
        is_active: true,
      },
      { id: '4', name: 'Analista', description: null, is_active: true },
    ]);

    const areaRepo = qr.manager.getRepository(Area);
    await areaRepo.save([
      {
        id: '1',
        name: 'Dirección de Operaciones',
        description: null,
        is_active: true,
      },
    ]);

    const persons = qr.manager.getRepository(Person);
    const director = await persons.save(
      persons.create({
        document: 'DIR-001',
        full_name: 'Director de Operaciones',
        hierarchy_id: '1',
        role_id: '1',
        area_id: '1',
      }),
    );
    const coordAcad = await persons.save(
      persons.create({
        document: 'COO-AC-001',
        full_name: 'Coordinador académico',
        hierarchy_id: '2',
        role_id: '2',
        area_id: '1',
      }),
    );
    const coordProc = await persons.save(
      persons.create({
        document: 'COO-PR-001',
        full_name: 'Coordinador de procesos',
        hierarchy_id: '2',
        role_id: '3',
        area_id: '1',
      }),
    );

    const rel = qr.manager.getRepository(OrgRelation);
    await rel.save(
      rel.create({
        parent_person_id: String(director.id),
        child_person_id: String(coordAcad.id),
        hierarchy_id: '2',
        role_id: '2',
        area_id: '1',
        is_active: true,
      }),
    );
    await rel.save(
      rel.create({
        parent_person_id: String(director.id),
        child_person_id: String(coordProc.id),
        hierarchy_id: '2',
        role_id: '3',
        area_id: '1',
        is_active: true,
      }),
    );

    await qr.commitTransaction();
    console.log('[seed] organigrama demo: catálogos, personas y org_relation creados.');
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}
