/**
 * Parseo de args del CLI de validación de perfiles curados (RO).
 */

export interface CuratedValidateCliArgs {
  file?: string;
  documentOverride?: string;
  out?: string;
}

export function parseCuratedValidateCliArgs(
  argv: string[],
): CuratedValidateCliArgs {
  const out: CuratedValidateCliArgs = {};
  for (const arg of argv) {
    if (arg === '--confirm' || arg.startsWith('--confirm=')) {
      throw new Error(
        'Este comando es solo lectura y no acepta --confirm.',
      );
    }
    if (arg.startsWith('--file=')) out.file = arg.slice('--file='.length);
    else if (arg === '--file') {
      throw new Error('Use --file=ruta (forma con =).');
    } else if (arg.startsWith('--document=')) {
      out.documentOverride = arg.slice('--document='.length);
    } else if (arg.startsWith('--out=')) {
      out.out = arg.slice('--out='.length);
    }
  }
  return out;
}
