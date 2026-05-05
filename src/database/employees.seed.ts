import { DataSource } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatus } from '../employees/employee-status.enum';

/** UUID fijos para el demo: facilitan depuración y datos relacionables en seeds. */
export const SEED_IDS = {
  director: '11111111-1111-4111-8111-111111111101',
  coordAcademico: '11111111-1111-4111-8111-111111111102',
  coordProcesos: '11111111-1111-4111-8111-111111111103',
  analista1: '11111111-1111-4111-8111-111111111104',
  analista2: '11111111-1111-4111-8111-111111111105',
  analista3: '11111111-1111-4111-8111-111111111106',
} as const;

/**
 * Inserta el organigrama demo si la tabla está vacía (idempotente para desarrollo).
 * Para entornos donde ya hay datos, no borra filas existentes.
 */
export async function seedEmployeesIfEmpty(ds: DataSource): Promise<void> {
  const repo = ds.getRepository(Employee);
  const count = await repo.count();
  if (count > 0) {
    console.log('[seed] employees: ya existen filas, se omite la siembra.');
    return;
  }

  const nowDate = '2025-01-15';

  const rows: Array<Partial<Employee>> = [
    {
      id: SEED_IDS.director,
      documentNumber: 'DIRECTOR-OP-001',
      fullName: 'Director de Operaciones',
      roleName: 'Director',
      level: 1,
      areaId: 'AREA-DO',
      areaName: 'Dirección de Operaciones',
      schoolId: null,
      schoolName: null,
      programId: null,
      programName: null,
      managerId: null,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Indefinido',
      startDate: nowDate,
    },
    {
      id: SEED_IDS.coordAcademico,
      documentNumber: 'COORD-OP-001',
      fullName: 'Coordinador Académico',
      roleName: 'Coordinador',
      level: 2,
      areaId: 'AREA-OA',
      areaName: 'Operaciones Académicas',
      schoolId: 'SCH-01',
      schoolName: 'Sede Central',
      programId: null,
      programName: null,
      managerId: SEED_IDS.director,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Indefinido',
      startDate: nowDate,
    },
    {
      id: SEED_IDS.coordProcesos,
      documentNumber: 'COORD-OP-002',
      fullName: 'Coordinador de Procesos',
      roleName: 'Coordinador',
      level: 2,
      areaId: 'AREA-PROC',
      areaName: 'Procesos Operativos',
      schoolId: 'SCH-01',
      schoolName: 'Sede Central',
      programId: null,
      programName: null,
      managerId: SEED_IDS.director,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Temporal',
      startDate: nowDate,
    },
    {
      id: SEED_IDS.analista1,
      documentNumber: 'AN-OP-001',
      fullName: 'Analista de Operaciones I',
      roleName: 'Analista',
      level: 3,
      areaId: 'AREA-OA',
      areaName: 'Operaciones Académicas',
      schoolId: 'SCH-01',
      schoolName: 'Sede Central',
      programId: 'PRG-101',
      programName: 'Programa Ejecutivo A',
      managerId: SEED_IDS.coordAcademico,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Obra o labor',
      startDate: nowDate,
    },
    {
      id: SEED_IDS.analista2,
      documentNumber: 'AN-OP-002',
      fullName: 'Analista de Operaciones II',
      roleName: 'Analista',
      level: 3,
      areaId: 'AREA-OA',
      areaName: 'Operaciones Académicas',
      schoolId: 'SCH-02',
      schoolName: 'Sede Norte',
      programId: 'PRG-102',
      programName: 'Programa Ejecutivo B',
      managerId: SEED_IDS.coordAcademico,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Indefinido',
      startDate: nowDate,
    },
    {
      id: SEED_IDS.analista3,
      documentNumber: 'AN-OP-003',
      fullName: 'Analista de Procesos',
      roleName: 'Analista',
      level: 3,
      areaId: 'AREA-PROC',
      areaName: 'Procesos Operativos',
      schoolId: 'SCH-01',
      schoolName: 'Sede Central',
      programId: 'PRG-201',
      programName: 'Optimización de flujos',
      managerId: SEED_IDS.coordProcesos,
      status: EmployeeStatus.ACTIVE,
      contractType: 'Indefinido',
      startDate: nowDate,
    },
  ];

  await repo.insert(rows);

  console.log(`[seed] employees: insertadas ${rows.length} filas demo.`);
}
