/**
 * CLI: npm run evaluate:cv-attributes:catalog -- --catalogVersion=pa1-2026-07-24
 *
 * Inspecciona el catálogo. Con --seed --i-confirm-seed crea la versión pa1.
 * Con --activate --i-confirm-activate la activa.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvAttributesModule } from '../../cv-attributes/cv-attributes.module';
import { CvAttributeCatalogService } from '../../cv-attributes/cv-attributes-catalog.service';
import {
  assertAttributeCatalogCli,
  parseAttributeCliArgs,
} from '../../cv-attributes/cv-attributes.cli-args';

const TAG = '[CV Attribute Catalog]';

async function main(): Promise<void> {
  const args = parseAttributeCliArgs(process.argv.slice(2));
  assertAttributeCatalogCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app
      .select(CvAttributesModule)
      .get(CvAttributeCatalogService);

    if (args.seed) {
      const outcome = await service.seedPa1({ activate: args.activate });
      console.log(`${TAG} outcome=${outcome.outcome}`);
      console.log(`${TAG} catalogVersionId=${outcome.catalogVersionId}`);
      console.log(
        `${TAG} ${outcome.catalogCode}/${outcome.catalogVersion} ` +
          `status=${outcome.status} isActive=${outcome.isActive}`,
      );
      console.log(
        `${TAG} macros=${outcome.macroCount} subs=${outcome.subCount} ` +
          `mappings=${outcome.mappingCount} unmappedDeclared=${outcome.unmappedDeclaredCount}`,
      );
      console.log(`${TAG} definitionHash=${outcome.definitionHash}`);
      console.log(`${TAG} mappingHash=${outcome.mappingHash}`);
    } else if (args.activate) {
      const catalog = await service.loadCatalog(
        args.catalogVersion ? { catalogVersion: args.catalogVersion } : {},
      );
      const act = await service.activate(catalog.catalogVersionId);
      console.log(`${TAG} activated=${act.activated}`);
      console.log(`${TAG} catalogVersionId=${act.catalogVersionId}`);
      console.log(`${TAG} previousActiveId=${act.previousActiveId ?? 'none'}`);
      console.log(`${TAG} alreadyActive=${act.alreadyActive}`);
    }

    const inspection = await service.inspect(
      args.catalogVersion ? { catalogVersion: args.catalogVersion } : {},
    );
    console.log(JSON.stringify(inspection, null, 2));
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
