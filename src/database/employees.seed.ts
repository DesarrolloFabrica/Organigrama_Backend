import { DataSource } from 'typeorm';

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
 * Seed legado del módulo `employees` (eliminado).
 * Se conserva exportado para no romper imports existentes.
 */
export async function seedEmployeesIfEmpty(_ds: DataSource): Promise<void> {
  void _ds;
  await Promise.resolve();
  console.log(
    '[seed] employees: módulo obsoleto, no se insertan datos desde este seed.',
  );
}
