export interface EvidenceCliArgs {
  enrichmentId?: string;
  evaluationId?: string;
  dryRun: boolean;
  persist: boolean;
  activate: boolean;
  confirmPersist: boolean;
  confirmActivate: boolean;
  outputDir: string;
  rulesVersion: 'er1' | 'er2';
}

export function parseEvidenceCliArgs(argv: string[]): EvidenceCliArgs {
  let enrichmentId: string | undefined;
  let evaluationId: string | undefined;
  let dryRun = false;
  let persist = false;
  let activate = false;
  let confirmPersist = false;
  let confirmActivate = false;
  let outputDir = 'tmp/cv-evidence';
  let rulesVersion: 'er1' | 'er2' = 'er2';
  let batch = false;
  const enrichmentIds: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--enrichmentId=')) {
      const v = arg.slice('--enrichmentId='.length).trim();
      enrichmentId = v;
      enrichmentIds.push(v);
    } else if (arg.startsWith('--evaluationId=')) {
      evaluationId = arg.slice('--evaluationId='.length).trim();
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--persist' || arg.startsWith('--persist=')) {
      persist = true;
    } else if (arg === '--activate' || arg.startsWith('--activate=')) {
      activate = true;
    } else if (arg === '--i-confirm-persist') {
      confirmPersist = true;
    } else if (arg === '--i-confirm-activate') {
      confirmActivate = true;
    } else if (arg.startsWith('--outputDir=')) {
      outputDir = arg.slice('--outputDir='.length).trim();
    } else if (arg.startsWith('--rulesVersion=')) {
      const v = arg.slice('--rulesVersion='.length).trim().toLowerCase();
      if (v !== 'er1' && v !== 'er2') {
        throw new Error('--rulesVersion debe ser er1 o er2.');
      }
      rulesVersion = v;
    } else if (arg === '--batch' || arg.startsWith('--batch=')) {
      batch = true;
    }
  }

  if (batch) {
    throw new Error('E5 no permite lotes (--batch). Abortado.');
  }
  if (enrichmentIds.length > 1) {
    throw new Error('E5 permite un solo --enrichmentId. Abortado.');
  }
  if (enrichmentId && !/^\d+$/.test(enrichmentId)) {
    throw new Error('enrichmentId inválido (solo dígitos).');
  }
  if (evaluationId && !/^\d+$/.test(evaluationId)) {
    throw new Error('evaluationId inválido (solo dígitos).');
  }

  return {
    enrichmentId,
    evaluationId,
    dryRun,
    persist,
    activate,
    confirmPersist,
    confirmActivate,
    outputDir,
    rulesVersion,
  };
}

export function assertEvidenceMainCli(args: EvidenceCliArgs): void {
  if (args.persist && args.dryRun) {
    throw new Error('No combines --persist y --dry-run.');
  }
  if (!args.persist && !args.dryRun) {
    throw new Error('Requiere --dry-run o --persist.');
  }
  if (!args.enrichmentId) {
    throw new Error('Requiere --enrichmentId=<id>.');
  }
  if (args.persist) {
    if (!args.confirmPersist) {
      throw new Error(
        '--persist requiere --i-confirm-persist. Abortado sin escritura.',
      );
    }
    if (args.activate && !args.confirmActivate) {
      throw new Error('--activate requiere --i-confirm-activate. Abortado.');
    }
  } else if (args.activate) {
    throw new Error(
      '--activate sin --persist no está permitido aquí. Usa evaluate:cv-evidence:activate.',
    );
  }
}

export function assertEvidenceActivateCli(args: EvidenceCliArgs): void {
  if (!args.evaluationId) {
    throw new Error('Requiere --evaluationId=<id>.');
  }
  if (!args.confirmActivate) {
    throw new Error(
      'Activación requiere --i-confirm-activate. Abortado.',
    );
  }
}

export function assertEvidenceStatusCli(args: EvidenceCliArgs): void {
  if (!args.enrichmentId && !args.evaluationId) {
    throw new Error('Requiere --enrichmentId=<id> o --evaluationId=<id>.');
  }
  if (args.enrichmentId && args.evaluationId) {
    throw new Error('Usa solo uno: --enrichmentId o --evaluationId.');
  }
}

export function assertEvidenceInspectCli(args: EvidenceCliArgs): void {
  if (!args.evaluationId) {
    throw new Error('Requiere --evaluationId=<id>.');
  }
}
