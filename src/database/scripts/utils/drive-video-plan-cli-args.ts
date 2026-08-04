/**
 * Args CLI plan:drive-video (dry-run; sin escritura).
 */

export type PlanDriveVideoArgs = {
  mode: 'run' | 'help';
  inventory: string | null;
  json: boolean;
  showNew: boolean;
  showErrors: boolean;
  showReplacements: boolean;
  document: string | null;
  maxItems: number | null;
};

export function printPlanDriveVideoHelp(): void {
  console.log(`
plan:drive-video — Planner dry-run inventario Drive × core.person × person_video.

Uso:
  npm run plan:drive-video -- [opciones]

Opciones:
  --inventory=<ruta>     Default: tmp/person-video-drive-inventory/inventory.private.json
  --json                 Imprime summary JSON en stdout
  --show-new             Lista conteo/detalle enmascarado de NEW
  --show-errors          Lista acciones de bloqueo (enmascaradas)
  --show-replacements    Lista REPLACE (enmascarado)
  --document=<doc>       Filtra un documento exacto
  --max-items=<n>        Limita ítems del inventario cargado
  --help

No admite --apply / --execute ni flags de escritura.
Solo SELECT en PostgreSQL. No modifica Drive.
`);
}

const WRITE_FLAGS = new Set([
  '--apply',
  '--execute',
  '--write',
  '--commit',
  '--i-confirm-apply',
]);

export function parsePlanDriveVideoArgs(argv: string[]): PlanDriveVideoArgs {
  const args: PlanDriveVideoArgs = {
    mode: 'run',
    inventory: null,
    json: false,
    showNew: false,
    showErrors: false,
    showReplacements: false,
    document: null,
    maxItems: null,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.mode = 'help';
      continue;
    }
    if (WRITE_FLAGS.has(raw) || raw.startsWith('--apply=') || raw.startsWith('--execute=')) {
      throw new Error(
        `plan:drive-video es dry-run solamente. Flag de escritura rechazado: ${raw}`,
      );
    }
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (raw === '--show-new') {
      args.showNew = true;
      continue;
    }
    if (raw === '--show-errors') {
      args.showErrors = true;
      continue;
    }
    if (raw === '--show-replacements') {
      args.showReplacements = true;
      continue;
    }
    if (raw.startsWith('--inventory=')) {
      args.inventory = raw.slice('--inventory='.length).trim() || null;
      continue;
    }
    if (raw.startsWith('--document=')) {
      args.document = raw.slice('--document='.length);
      continue;
    }
    if (raw.startsWith('--max-items=')) {
      const n = Number(raw.slice('--max-items='.length));
      if (!Number.isFinite(n) || n < 0) {
        throw new Error(`--max-items inválido: ${raw}`);
      }
      args.maxItems = Math.floor(n);
      continue;
    }
    throw new Error(`Argumento no reconocido: ${raw} (use --help)`);
  }

  return args;
}

/** Enmascara documento para consola compartida. */
export function maskDocument(doc: string | null): string {
  if (!doc) return '(none)';
  if (doc.length <= 4) return '****';
  return `${doc.slice(0, 2)}…${doc.slice(-2)}`;
}
