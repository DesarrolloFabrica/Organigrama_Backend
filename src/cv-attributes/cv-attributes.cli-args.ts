export interface AttributeCliArgs {
  evaluationId?: string;
  enrichmentId?: string;
  attributeRunId?: string;
  catalogVersion?: string;
  dryRun: boolean;
  persist: boolean;
  activate: boolean;
  seed: boolean;
  confirmPersist: boolean;
  confirmActivate: boolean;
  confirmSeed: boolean;
  outputDir: string;
}

export function parseAttributeCliArgs(argv: string[]): AttributeCliArgs {
  let evaluationId: string | undefined;
  let enrichmentId: string | undefined;
  let attributeRunId: string | undefined;
  let catalogVersion: string | undefined;
  let dryRun = false;
  let persist = false;
  let activate = false;
  let seed = false;
  let confirmPersist = false;
  let confirmActivate = false;
  let confirmSeed = false;
  let outputDir = 'tmp/cv-attributes';
  let batch = false;
  const evaluationIds: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--evaluationId=')) {
      const v = arg.slice('--evaluationId='.length).trim();
      evaluationId = v;
      evaluationIds.push(v);
    } else if (arg.startsWith('--enrichmentId=')) {
      enrichmentId = arg.slice('--enrichmentId='.length).trim();
    } else if (arg.startsWith('--attributeRunId=')) {
      attributeRunId = arg.slice('--attributeRunId='.length).trim();
    } else if (arg.startsWith('--catalogVersion=')) {
      catalogVersion = arg.slice('--catalogVersion='.length).trim();
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--persist' || arg.startsWith('--persist=')) {
      persist = true;
    } else if (arg === '--activate' || arg.startsWith('--activate=')) {
      activate = true;
    } else if (arg === '--seed' || arg.startsWith('--seed=')) {
      seed = true;
    } else if (arg === '--i-confirm-persist') {
      confirmPersist = true;
    } else if (arg === '--i-confirm-activate') {
      confirmActivate = true;
    } else if (arg === '--i-confirm-seed') {
      confirmSeed = true;
    } else if (arg.startsWith('--outputDir=')) {
      outputDir = arg.slice('--outputDir='.length).trim();
    } else if (arg === '--batch' || arg.startsWith('--batch=')) {
      batch = true;
    }
  }

  if (batch) {
    throw new Error('E6 no permite lotes (--batch). Abortado.');
  }
  if (evaluationIds.length > 1) {
    throw new Error('E6 permite un solo --evaluationId. Abortado.');
  }
  assertNumeric('evaluationId', evaluationId);
  assertNumeric('enrichmentId', enrichmentId);
  assertNumeric('attributeRunId', attributeRunId);

  return {
    evaluationId,
    enrichmentId,
    attributeRunId,
    catalogVersion,
    dryRun,
    persist,
    activate,
    seed,
    confirmPersist,
    confirmActivate,
    confirmSeed,
    outputDir,
  };
}

export function assertAttributeMainCli(args: AttributeCliArgs): void {
  if (args.persist && args.dryRun) {
    throw new Error('No combines --persist y --dry-run.');
  }
  if (!args.persist && !args.dryRun) {
    throw new Error('Requiere --dry-run o --persist.');
  }
  if (!args.evaluationId && !args.enrichmentId) {
    throw new Error('Requiere --evaluationId=<id> o --enrichmentId=<id>.');
  }
  if (args.evaluationId && args.enrichmentId) {
    throw new Error('Usa solo uno: --evaluationId o --enrichmentId.');
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
      '--activate sin --persist no está permitido aquí. Usa evaluate:cv-attributes:activate.',
    );
  }
}

export function assertAttributeActivateCli(args: AttributeCliArgs): void {
  if (!args.attributeRunId) {
    throw new Error('Requiere --attributeRunId=<id>.');
  }
  if (!args.confirmActivate) {
    throw new Error('Activación requiere --i-confirm-activate. Abortado.');
  }
}

export function assertAttributeStatusCli(args: AttributeCliArgs): void {
  if (!args.attributeRunId && !args.evaluationId) {
    throw new Error('Requiere --attributeRunId=<id> o --evaluationId=<id>.');
  }
  if (args.attributeRunId && args.evaluationId) {
    throw new Error('Usa solo uno: --attributeRunId o --evaluationId.');
  }
}

export function assertAttributeInspectCli(args: AttributeCliArgs): void {
  if (!args.attributeRunId) {
    throw new Error('Requiere --attributeRunId=<id>.');
  }
}

export function assertAttributeCatalogCli(args: AttributeCliArgs): void {
  if (args.seed && !args.confirmSeed) {
    throw new Error('--seed requiere --i-confirm-seed. Abortado sin escritura.');
  }
  if (args.activate && !args.confirmActivate) {
    throw new Error('--activate requiere --i-confirm-activate. Abortado.');
  }
}

function assertNumeric(label: string, value?: string): void {
  if (value !== undefined && !/^\d+$/.test(value)) {
    throw new Error(`${label} inválido (solo dígitos).`);
  }
}
