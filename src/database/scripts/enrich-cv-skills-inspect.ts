/**
 * CLI: npm run enrich:cv-skills:inspect -- --extractionId=<id>
 *
 * Vista resumida extracción + enrichment activo + evidenceItems (sin endpoint público).
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import {
  assertInspectCli,
  parseEnrichCliArgs,
} from '../../cv-skills-enrichment/cv-skills-enrichment.cli-args';

const TAG = '[CV Skills Enricher Inspect]';

async function main(): Promise<void> {
  const args = parseEnrichCliArgs(process.argv.slice(2));
  assertInspectCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const persistence = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistenceService);

    const view = await persistence.inspectExtraction(args.extractionId!);
    console.log(JSON.stringify(view, null, 2));
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
