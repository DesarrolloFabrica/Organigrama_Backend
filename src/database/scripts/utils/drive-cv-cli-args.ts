/**
 * Parsing de argumentos CLI compartidos para diag/sync Drive CV.
 */

import type { DriveCvAreaFilter } from './drive-cv-folder-filter';
import { isAreaFilterActive } from './drive-cv-sync-planner';

export type DriveCvCliMode = 'help' | 'dry-run' | 'apply' | 'diag';

export type DriveCvCliArgs = {
  mode: DriveCvCliMode;
  filter: DriveCvAreaFilter;
  /** Override opcional de GOOGLE_DRIVE_CV_FOLDER_ID (solo proceso). */
  folderId?: string;
  sourceFolderId?: string;
  targetFolderId?: string;
  /** Propone/aplica desactivación de person_cv ausentes del inventario raíz. */
  deactivateMissing: boolean;
  /**
   * Limita inventario/plan a un único documento (cédula, solo dígitos).
   * No desactiva otros person_cv; incompatible con --deactivate-missing.
   */
  document?: string;
};

function parseBoolFlag(raw: string): boolean {
  const v = raw.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

/**
 * Parsea --area, --school/--subarea, --folderId, --document,
 * --dry-run, --apply, --deactivate-missing.
 */
export function parseDriveCvCliArgs(argv: string[]): DriveCvCliArgs {
  let area: string | undefined;
  let school: string | undefined;
  let subarea: string | undefined;
  let folderId: string | undefined;
  let sourceFolderId: string | undefined;
  let targetFolderId: string | undefined;
  let dryRun = false;
  let apply = false;
  let help = false;
  let deactivateMissing = false;
  let document: string | undefined;

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg.startsWith('--dry-run=')) {
      dryRun = parseBoolFlag(arg.slice('--dry-run='.length));
    } else if (arg === '--apply') {
      apply = true;
    } else if (arg.startsWith('--apply=')) {
      apply = parseBoolFlag(arg.slice('--apply='.length));
    } else if (arg === '--deactivate-missing') {
      deactivateMissing = true;
    } else if (arg.startsWith('--deactivate-missing=')) {
      deactivateMissing = parseBoolFlag(
        arg.slice('--deactivate-missing='.length),
      );
    } else if (arg.startsWith('--document=')) {
      document = arg.slice('--document='.length).trim();
    } else if (arg === '--document') {
      throw new Error('Usa --document=<cedula> (solo dígitos).');
    } else if (arg.startsWith('--area=')) {
      area = arg.slice('--area='.length).trim();
    } else if (arg === '--area') {
      throw new Error('Usa --area="<nombre>" (con valor).');
    } else if (arg.startsWith('--school=')) {
      school = arg.slice('--school='.length).trim();
    } else if (arg === '--school') {
      throw new Error('Usa --school="<nombre>" (con valor).');
    } else if (arg.startsWith('--subarea=')) {
      subarea = arg.slice('--subarea='.length).trim();
    } else if (arg === '--subarea') {
      throw new Error('Usa --subarea="<nombre>" (con valor).');
    } else if (arg.startsWith('--folderId=')) {
      folderId = arg.slice('--folderId='.length).trim();
    } else if (arg.startsWith('--sourceFolderId=')) {
      sourceFolderId = arg.slice('--sourceFolderId='.length).trim();
    } else if (arg.startsWith('--targetFolderId=')) {
      targetFolderId = arg.slice('--targetFolderId='.length).trim();
    } else if (arg.startsWith('-')) {
      throw new Error(`Argumento desconocido: ${arg}`);
    }
  }

  if (document !== undefined) {
    if (!/^\d+$/.test(document)) {
      throw new Error(
        `--document inválido "${document}": se esperan solo dígitos (cédula).`,
      );
    }
  }

  if (school && subarea && school !== subarea) {
    throw new Error(
      'No combines --school y --subarea con valores distintos; son alias del mismo filtro.',
    );
  }

  const resolvedSub = subarea ?? school;
  if (resolvedSub && !area) {
    throw new Error(
      '--school/--subarea requiere --area. Ejemplo: --area="OPERACIONES ACADEMICAS" --school="INGENIERIA"',
    );
  }

  if (dryRun && apply) {
    throw new Error('No combines --dry-run y --apply. Usa uno u otro.');
  }

  const filter: DriveCvAreaFilter = { area, school, subarea };

  if (deactivateMissing) {
    if (!dryRun && !apply && !help) {
      throw new Error(
        '--deactivate-missing solo es válido con --dry-run o --apply.',
      );
    }
    if (isAreaFilterActive(filter) || resolvedSub) {
      throw new Error(
        '--deactivate-missing no puede usarse con --area/--school/--subarea. ' +
          'La desactivación por ausencia exige inventario completo de la raíz.',
      );
    }
    if (document) {
      throw new Error(
        '--deactivate-missing no puede usarse con --document. ' +
          'El sync por documento no evalúa ausencias globales.',
      );
    }
  }

  if (help) {
    return {
      mode: 'help',
      filter,
      folderId,
      sourceFolderId,
      targetFolderId,
      deactivateMissing,
      document,
    };
  }

  if (apply) {
    return {
      mode: 'apply',
      filter,
      folderId,
      sourceFolderId,
      targetFolderId,
      deactivateMissing,
      document,
    };
  }

  if (dryRun) {
    return {
      mode: 'dry-run',
      filter,
      folderId,
      sourceFolderId,
      targetFolderId,
      deactivateMissing,
      document,
    };
  }

  return {
    mode: 'diag',
    filter,
    folderId,
    sourceFolderId,
    targetFolderId,
    deactivateMissing,
    document,
  };
}

export function printSyncDriveCvHelp(): void {
  console.log(`
Uso: npm run sync:drive-cv -- --dry-run | --apply [opciones]

Obligatorio (uno):
  --dry-run                 Inventario + plan; NO escribe en BD
  --apply                   Aplica INSERT/UPDATE (y DEACTIVATE si se indica)

Desactivación de ausentes (inventario raíz completo):
  --deactivate-missing      Con --dry-run: muestra desactivaciones propuestas.
                            Con --apply: desactiva person_cv activos sin PDF
                            válido/único en la carpeta oficial.
                            Incompatible con --area/--school/--subarea.

Filtros opcionales (sin desactivación global):
  --area="<nombre>"
  --school="<nombre>"       (alias de subárea; requiere --area)
  --subarea="<nombre>"
  --folderId=<id>           Override temporal de GOOGLE_DRIVE_CV_FOLDER_ID
  --document=<cedula>       Solo ese PDF (dígitos); sin DEACTIVATE global

Ejemplos (PowerShell):
  npm run sync:drive-cv -- --dry-run --document=1000019945
  npm run sync:drive-cv -- --apply --document=1000019945
  npm run sync:drive-cv -- --dry-run --folderId=<nueva>
  npm run sync:drive-cv -- --dry-run --deactivate-missing --folderId=<nueva>
  npm run sync:drive-cv -- --apply --folderId=<nueva>
  npm run sync:drive-cv -- --apply --deactivate-missing --folderId=<nueva>
`.trim());
}

export function printDiagDriveCvHelp(): void {
  console.log(`
Uso: npm run diag:drive-cv -- [filtros]

Filtros opcionales:
  --area="<nombre>"
  --school="<nombre>"
  --subarea="<nombre>"
  --folderId=<id>
  --document=<cedula>       Solo ese PDF (dígitos)

Sin --document, el diagnóstico propone DEACTIVATE_* en inventario raíz completo.
La escritura requiere sync:drive-cv --apply --deactivate-missing.

Ejemplos (PowerShell):
  npm run diag:drive-cv -- --document=1000019945
  npm run diag:drive-cv -- --folderId=1ZNdLeKoR-KiUqoKnG4NBJT2-sWj6Yy5D
  npm run diag:drive-cv -- --area="SERVICIO"
`.trim());
}
