/**
 * Args CLI del enricher — archivo separado para tests sin bootstrap Nest.
 */
import {
  DEFAULT_ENRICHER_BLOCK_SIZE,
  DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS,
  ENRICHER_BLOCK_SIZE_MAX,
  ENRICHER_BLOCK_SIZE_MIN,
  ENRICHER_MAX_ATTEMPTS_MAX,
  ENRICHER_MAX_ATTEMPTS_MIN,
} from './cv-skills-enrichment.constants';

export interface EnrichCliArgs {
  document?: string;
  inventoryArtifact?: string;
  extractionId?: string;
  enrichmentId?: string;
  dryRun: boolean;
  persist: boolean;
  activate: boolean;
  confirmPersist: boolean;
  confirmActivate: boolean;
  confirmDeactivate: boolean;
  blockSize: number;
  maxAttempts: number;
  outputDir: string;
  model?: string;
}

export function parseEnrichCliArgs(argv: string[]): EnrichCliArgs {
  let document: string | undefined;
  let inventoryArtifact: string | undefined;
  let extractionId: string | undefined;
  let enrichmentId: string | undefined;
  let dryRun = false;
  let persist = false;
  let activate = false;
  let confirmPersist = false;
  let confirmActivate = false;
  let confirmDeactivate = false;
  let blockSize = DEFAULT_ENRICHER_BLOCK_SIZE;
  let maxAttempts = DEFAULT_ENRICHER_MAX_BLOCK_ATTEMPTS;
  let outputDir = 'tmp/cv-skills-enrichment';
  let model: string | undefined;
  let versionId: string | undefined;
  let batch = false;
  const extractionIds: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--document=')) {
      document = arg.slice('--document='.length).trim();
    } else if (arg.startsWith('--inventoryArtifact=')) {
      inventoryArtifact = arg.slice('--inventoryArtifact='.length).trim();
    } else if (arg.startsWith('--extractionId=')) {
      const v = arg.slice('--extractionId='.length).trim();
      extractionId = v;
      extractionIds.push(v);
    } else if (arg.startsWith('--enrichmentId=')) {
      enrichmentId = arg.slice('--enrichmentId='.length).trim();
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
    } else if (arg === '--i-confirm-deactivate') {
      confirmDeactivate = true;
    } else if (arg.startsWith('--blockSize=')) {
      blockSize = Number(arg.slice('--blockSize='.length));
    } else if (arg.startsWith('--maxAttempts=')) {
      maxAttempts = Number(arg.slice('--maxAttempts='.length));
    } else if (arg.startsWith('--outputDir=')) {
      outputDir = arg.slice('--outputDir='.length).trim();
    } else if (arg.startsWith('--model=')) {
      model = arg.slice('--model='.length).trim() || undefined;
    } else if (arg.startsWith('--versionId=')) {
      versionId = arg.slice('--versionId='.length).trim();
    } else if (arg === '--batch' || arg.startsWith('--batch=')) {
      batch = true;
    }
  }

  if (versionId) {
    throw new Error('E3 no permite --versionId. Abortado.');
  }
  if (batch) {
    throw new Error('E3 no permite lotes (--batch). Abortado.');
  }
  if (extractionIds.length > 1) {
    throw new Error('E3 permite un solo --extractionId. Abortado.');
  }

  if (document !== undefined && !/^\d+$/.test(document)) {
    throw new Error(
      'Documento inválido. Usa --document=<cedula> (solo dígitos).',
    );
  }

  if (inventoryArtifact && extractionId) {
    throw new Error(
      'Usa solo una fuente de inventario: --inventoryArtifact o --extractionId.',
    );
  }
  if (extractionId && !/^\d+$/.test(extractionId)) {
    throw new Error('extractionId inválido (solo dígitos).');
  }
  if (enrichmentId && !/^\d+$/.test(enrichmentId)) {
    throw new Error('enrichmentId inválido (solo dígitos).');
  }

  if (
    !Number.isInteger(blockSize) ||
    blockSize < ENRICHER_BLOCK_SIZE_MIN ||
    blockSize > ENRICHER_BLOCK_SIZE_MAX
  ) {
    throw new Error(
      `blockSize debe ser entero entre ${ENRICHER_BLOCK_SIZE_MIN} y ${ENRICHER_BLOCK_SIZE_MAX}.`,
    );
  }
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < ENRICHER_MAX_ATTEMPTS_MIN ||
    maxAttempts > ENRICHER_MAX_ATTEMPTS_MAX
  ) {
    throw new Error(
      `maxAttempts debe ser entero entre ${ENRICHER_MAX_ATTEMPTS_MIN} y ${ENRICHER_MAX_ATTEMPTS_MAX}.`,
    );
  }

  return {
    document,
    inventoryArtifact,
    extractionId,
    enrichmentId,
    dryRun,
    persist,
    activate,
    confirmPersist,
    confirmActivate,
    confirmDeactivate,
    blockSize,
    maxAttempts,
    outputDir,
    model,
  };
}

/**
 * Valida reglas de la CLI principal enrich:cv-skills (dry-run | persist).
 */
export function assertEnrichMainCli(args: EnrichCliArgs): void {
  if (args.persist && args.dryRun) {
    throw new Error('No combines --persist y --dry-run.');
  }
  if (!args.persist && !args.dryRun) {
    throw new Error(
      'Requiere --dry-run o --persist. Ejemplo: --extractionId=201 --dry-run',
    );
  }
  if (args.persist) {
    if (!args.confirmPersist) {
      throw new Error(
        ' --persist requiere --i-confirm-persist. Abortado sin escritura.',
      );
    }
    if (!args.extractionId) {
      throw new Error(
        '--persist requiere --extractionId=<id> (inventario DATABASE).',
      );
    }
    if (args.inventoryArtifact) {
      throw new Error(
        '--persist no admite --inventoryArtifact (solo DATABASE).',
      );
    }
    if (args.activate && !args.confirmActivate) {
      throw new Error(
        '--activate requiere --i-confirm-activate. Abortado.',
      );
    }
  } else {
    if (args.activate) {
      throw new Error(
        '--activate sin --persist no está permitido aquí. Usa enrich:cv-skills:activate.',
      );
    }
    if (!args.inventoryArtifact && !args.extractionId) {
      throw new Error(
        'Falta inventario: usa --inventoryArtifact=<ruta> o --extractionId=<id>.',
      );
    }
    if (!args.document && !args.extractionId) {
      throw new Error(
        'Documento inválido o ausente. Usa --document=<cedula> o --extractionId.',
      );
    }
    if (args.document === undefined && args.inventoryArtifact) {
      throw new Error(
        'Documento inválido o ausente. Usa --document=<cedula> (solo dígitos).',
      );
    }
  }
}

export function assertActivateCli(args: EnrichCliArgs): void {
  if (!args.enrichmentId) {
    throw new Error('Requiere --enrichmentId=<id>.');
  }
  if (!args.confirmActivate) {
    throw new Error(
      'Activación requiere --i-confirm-activate. Abortado.',
    );
  }
  if (args.persist || args.dryRun) {
    throw new Error(
      'enrich:cv-skills:activate solo acepta --enrichmentId y --i-confirm-activate.',
    );
  }
}

export function assertDeactivateCli(args: EnrichCliArgs): void {
  if (!args.enrichmentId) {
    throw new Error('Requiere --enrichmentId=<id>.');
  }
  if (!args.confirmDeactivate) {
    throw new Error(
      'Desactivación requiere --i-confirm-deactivate. Abortado.',
    );
  }
  if (args.persist || args.dryRun || args.activate) {
    throw new Error(
      'enrich:cv-skills:deactivate solo acepta --enrichmentId y --i-confirm-deactivate.',
    );
  }
}

export function assertStatusCli(args: EnrichCliArgs): void {
  if (!args.extractionId && !args.enrichmentId) {
    throw new Error('Requiere --extractionId=<id> o --enrichmentId=<id>.');
  }
  if (args.extractionId && args.enrichmentId) {
    throw new Error('Usa solo uno: --extractionId o --enrichmentId.');
  }
}

export function assertInspectCli(args: EnrichCliArgs): void {
  if (!args.extractionId) {
    throw new Error('Requiere --extractionId=<id>.');
  }
}
