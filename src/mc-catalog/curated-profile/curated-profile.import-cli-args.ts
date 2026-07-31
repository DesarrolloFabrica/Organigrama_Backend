/**
 * Args CLI import / rollback curados.
 */

export interface CuratedImportCliArgs {
  file?: string;
  documentOverride?: string;
  out?: string;
  execute: boolean;
  confirm: boolean;
  allowReactivateIdentical: boolean;
  verify: boolean;
}

export function parseCuratedImportCliArgs(argv: string[]): CuratedImportCliArgs {
  const out: CuratedImportCliArgs = {
    execute: false,
    confirm: false,
    allowReactivateIdentical: false,
    verify: true,
  };
  for (const arg of argv) {
    if (arg.startsWith('--file=')) out.file = arg.slice('--file='.length);
    else if (arg.startsWith('--document=')) {
      out.documentOverride = arg.slice('--document='.length);
    } else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg === '--execute') out.execute = true;
    else if (arg === '--confirm') out.confirm = true;
    else if (arg === '--allow-reactivate-identical') {
      out.allowReactivateIdentical = true;
    } else if (arg === '--verify') out.verify = true;
    else if (arg === '--no-verify') out.verify = false;
  }
  return out;
}

export function assertImportWriteFlags(args: CuratedImportCliArgs): void {
  if (args.execute && !args.confirm) {
    throw new Error('--execute requiere --confirm.');
  }
  if (args.confirm && !args.execute) {
    throw new Error('--confirm requiere --execute (dry-run es el default).');
  }
}

export interface CuratedRollbackCliArgs {
  document?: string;
  extractionId?: string;
  out?: string;
  execute: boolean;
  confirm: boolean;
}

export function parseCuratedRollbackCliArgs(
  argv: string[],
): CuratedRollbackCliArgs {
  const out: CuratedRollbackCliArgs = {
    execute: false,
    confirm: false,
  };
  for (const arg of argv) {
    if (arg.startsWith('--document=')) {
      out.document = arg.slice('--document='.length);
    } else if (arg.startsWith('--extraction-id=')) {
      out.extractionId = arg.slice('--extraction-id='.length);
    } else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
    else if (arg === '--execute') out.execute = true;
    else if (arg === '--confirm') out.confirm = true;
  }
  return out;
}

export function assertRollbackWriteFlags(args: CuratedRollbackCliArgs): void {
  if (args.execute && !args.confirm) {
    throw new Error('--execute requiere --confirm.');
  }
  if (args.confirm && !args.execute) {
    throw new Error('--confirm requiere --execute.');
  }
}
