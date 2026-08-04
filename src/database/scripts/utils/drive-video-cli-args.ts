/**
 * CLI args para diag:drive-video (sin --apply).
 */

export type DiagDriveVideoArgs = {
  mode: 'run' | 'help';
  folderId: string | null;
  json: boolean;
  showInvalid: boolean;
  showDuplicates: boolean;
  maxItems: number | null;
};

export function printDiagDriveVideoHelp(): void {
  console.log(`
diag:drive-video — Inventario diagnóstico de videos en Google Drive (solo lectura).

Uso:
  npm run diag:drive-video -- [opciones]

Opciones:
  --folderId=<id>     Carpeta raíz (default: GOOGLE_DRIVE_VIDEO_FOLDER_ID)
  --json              Imprime summary JSON en stdout
  --show-invalid      Lista nombres inválidos en consola
  --show-duplicates   Lista grupos duplicados por documento
  --max-items=<n>     Tope de archivos no-carpeta inventariados
  --help              Esta ayuda

No existe --apply. No escribe PostgreSQL ni Drive.
Reportes: tmp/person-video-drive-inventory/summary.json
          tmp/person-video-drive-inventory/inventory.private.json
`);
}

export function parseDiagDriveVideoArgs(argv: string[]): DiagDriveVideoArgs {
  const args: DiagDriveVideoArgs = {
    mode: 'run',
    folderId: null,
    json: false,
    showInvalid: false,
    showDuplicates: false,
    maxItems: null,
  };

  for (const raw of argv) {
    if (raw === '--help' || raw === '-h') {
      args.mode = 'help';
      continue;
    }
    if (raw === '--json') {
      args.json = true;
      continue;
    }
    if (raw === '--show-invalid') {
      args.showInvalid = true;
      continue;
    }
    if (raw === '--show-duplicates') {
      args.showDuplicates = true;
      continue;
    }
    if (raw === '--apply') {
      throw new Error(
        'diag:drive-video no admite --apply (fase diagnóstica solamente).',
      );
    }
    if (raw.startsWith('--folderId=')) {
      args.folderId = raw.slice('--folderId='.length).trim() || null;
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
