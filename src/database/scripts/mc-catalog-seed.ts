/**
 * CLI: npm run mc:catalog -- --seed --activate --i-confirm-seed
 *
 * Siembra / inspecciona el catálogo MC1 (dominios + especialidades).
 * No crea mappings ni calcula Coverage/Confidence.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McCatalogService } from '../../mc-catalog/mc-catalog.service';

const TAG = '[MC Catalog]';

function parseArgs(argv: string[]): {
  seed: boolean;
  activate: boolean;
  confirmSeed: boolean;
  catalogVersion?: string;
} {
  const out = {
    seed: false,
    activate: false,
    confirmSeed: false,
    catalogVersion: undefined as string | undefined,
  };
  for (const arg of argv) {
    if (arg === '--seed') out.seed = true;
    else if (arg === '--activate') out.activate = true;
    else if (arg === '--i-confirm-seed') out.confirmSeed = true;
    else if (arg.startsWith('--catalogVersion=')) {
      out.catalogVersion = arg.slice('--catalogVersion='.length);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.seed && !args.confirmSeed) {
    throw new Error(
      'Seed requiere --i-confirm-seed (escritura en BD del catálogo MC1).',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.select(McCatalogModule).get(McCatalogService);

    if (args.seed) {
      const outcome = await service.seedMc12({ activate: args.activate });
      console.log(`${TAG} outcome=${outcome.outcome}`);
      console.log(`${TAG} catalogVersionId=${outcome.catalogVersionId}`);
      console.log(
        `${TAG} ${outcome.catalogCode}/${outcome.catalogVersion} ` +
          `status=${outcome.status} isActive=${outcome.isActive}`,
      );
      console.log(
        `${TAG} domains=${outcome.domainCount} specialties=${outcome.specialtyCount}`,
      );
      console.log(`${TAG} configHash=${outcome.configHash}`);
    }

    const snapshot = await service.loadSnapshot({
      catalogVersion: args.catalogVersion,
    });
    console.log(JSON.stringify(snapshot, null, 2));
  } finally {
    await app.close();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
