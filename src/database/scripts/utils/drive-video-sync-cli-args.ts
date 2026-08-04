/**
 * CLI args sync:drive-video
 */

export type SyncDriveVideoArgs = {
  mode: 'run' | 'help';
  planPath: string | null;
  dryRun: boolean;
  json: boolean;
  maxItems: number | null;
  execute: boolean;
  confirmCloudVideoSync: boolean;
};

export function printSyncDriveVideoHelp(): void {
  console.log(`
sync:drive-video — Aplica plan congelado de videos a organigrama.person_video.

Por defecto: valida + precheck Cloud (SELECT) y NO escribe.

Opciones:
  --plan=<ruta>                 Default: tmp/person-video-drive-plan/plan.private.json
  --dry-run                     Forzar modo sin escritura (default)
  --json                        Imprime precheck/summary JSON
  --max-items=<n>               Solo para diagnóstico (no altera expectativas del plan)
  --help

Escritura (ambos obligatorios juntos):
  --execute --confirm-cloud-video-sync

No consulta Drive. No admite folderId ni flags de CV.
`);
}

export function parseSyncDriveVideoArgs(argv: string[]): SyncDriveVideoArgs {
  const args: SyncDriveVideoArgs = {
    mode: 'run',
    planPath: null,
    dryRun: true,
    json: false,
    maxItems: null,
    execute: false,
    confirmCloudVideoSync: false,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.mode = 'help';
      continue;
    }
    if (raw === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (raw === '--execute') {
      args.execute = true;
      continue;
    }
    if (raw === '--confirm-cloud-video-sync') {
      args.confirmCloudVideoSync = true;
      continue;
    }
    if (raw.startsWith('--plan=')) {
      args.planPath = raw.slice('--plan='.length).trim() || null;
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
    if (
      raw === '--apply' ||
      raw === '--folderId' ||
      raw.startsWith('--folderId=') ||
      raw.includes('drive-cv') ||
      raw.includes('person_cv')
    ) {
      throw new Error(`Flag no permitido en sync:drive-video: ${raw}`);
    }
    throw new Error(`Argumento no reconocido: ${raw} (use --help)`);
  }

  if (args.execute !== args.confirmCloudVideoSync) {
    throw new Error(
      'Escritura requiere AMBOS flags juntos: --execute --confirm-cloud-video-sync',
    );
  }
  if (args.execute && args.confirmCloudVideoSync) {
    args.dryRun = false;
  }

  return args;
}

export function assertWriteFlagsComplete(args: SyncDriveVideoArgs): void {
  if (args.execute !== args.confirmCloudVideoSync) {
    throw new Error(
      'Escritura requiere AMBOS flags: --execute --confirm-cloud-video-sync',
    );
  }
}
