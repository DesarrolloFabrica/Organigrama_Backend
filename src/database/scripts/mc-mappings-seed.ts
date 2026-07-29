/**
 * CLI: npm run mc:mappings -- --seed --i-confirm-seed [--domain=SOFTWARE|VISUAL_DESIGN]
 *      npm run mc:mappings -- --verify-extraction=206 [--domain=SOFTWARE]
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McMappingService } from '../../mc-catalog/mc-catalog.mapping.service';

const TAG = '[MC Mappings]';

function parseArgs(argv: string[]): {
  seed: boolean;
  confirmSeed: boolean;
  forceReseed: boolean;
  confirmReseed: boolean;
  verifyExtraction?: string;
  catalogVersion?: string;
  domainCode: string;
} {
  const out = {
    seed: false,
    confirmSeed: false,
    forceReseed: false,
    confirmReseed: false,
    verifyExtraction: undefined as string | undefined,
    catalogVersion: undefined as string | undefined,
    domainCode: 'SOFTWARE',
  };
  for (const arg of argv) {
    if (arg === '--seed') out.seed = true;
    else if (arg === '--i-confirm-seed') out.confirmSeed = true;
    else if (arg === '--force-reseed') out.forceReseed = true;
    else if (arg === '--i-confirm-reseed') out.confirmReseed = true;
    else if (arg.startsWith('--verify-extraction=')) {
      out.verifyExtraction = arg.slice('--verify-extraction='.length);
    } else if (arg.startsWith('--catalogVersion=')) {
      out.catalogVersion = arg.slice('--catalogVersion='.length);
    } else if (arg.startsWith('--domain=')) {
      out.domainCode = arg.slice('--domain='.length).trim().toUpperCase();
    }
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.seed && !args.confirmSeed) {
    throw new Error('Seed requiere --i-confirm-seed');
  }
  if (args.forceReseed && !args.confirmReseed) {
    throw new Error('Reseed requiere --force-reseed --i-confirm-reseed');
  }
  if (args.forceReseed && !args.seed) {
    throw new Error('--force-reseed requiere --seed');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.select(McCatalogModule).get(McMappingService);

    if (args.seed) {
      const outcome = await service.seedDomainMappings({
        domainCode: args.domainCode,
        catalogVersion: args.catalogVersion,
        forceReseed: args.forceReseed,
      });
      console.log(`${TAG} outcome=${outcome.outcome}`);
      console.log(`${TAG} catalogVersionId=${outcome.catalogVersionId}`);
      console.log(
        `${TAG} domain=${outcome.domainCode} rules=${outcome.mappingRulesVersion}`,
      );
      console.log(
        `${TAG} classifications=${outcome.classificationCount} mappings=${outcome.mappingCount}`,
      );
      console.log(`${TAG} distribution=${JSON.stringify(outcome.distribution)}`);
      console.log(`${TAG} mappingHash=${outcome.mappingHash}`);
    }

    if (args.verifyExtraction) {
      const verified = await service.assertExtractionFullyClassified({
        extractionId: args.verifyExtraction,
        catalogVersion: args.catalogVersion,
        domainCode: args.domainCode,
      });
      console.log(`${TAG} extractionVerified=${JSON.stringify(verified)}`);
    }

    const views = await service.loadSkillMappings({
      catalogVersion: args.catalogVersion,
      domainCode: args.domainCode,
    });
    console.log(
      JSON.stringify(
        {
          domain: args.domainCode,
          registered: service.listRegisteredDomains(),
          skillCount: views.length,
          skills: views,
        },
        null,
        2,
      ),
    );
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
