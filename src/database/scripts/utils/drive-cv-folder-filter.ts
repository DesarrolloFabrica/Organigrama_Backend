/**
 * Normalización y filtros por área / escuela (subárea) para inventario Drive CV.
 * La normalización solo se usa para comparar; no altera valores persistidos.
 */

/** Quita tildes y pasa a minúsculas para comparación. */
export function normalizeFolderLabel(value: string): string {
  return value
    .trim()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function folderLabelsEqual(a: string, b: string): boolean {
  return normalizeFolderLabel(a) === normalizeFolderLabel(b);
}

export type DriveCvAreaFilter = {
  area?: string;
  /** Alias operativo de subárea (escuelas en OPERACIONES ACADEMICAS). */
  school?: string;
  subarea?: string;
};

/**
 * Resuelve school/subarea a un único label de subárea.
 * --school requiere --area (validado en parseo CLI).
 */
export function resolveSubareaFilter(filter: DriveCvAreaFilter): string | undefined {
  const raw = filter.subarea ?? filter.school;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
