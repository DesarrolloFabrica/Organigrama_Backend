/**
 * CLI: npm run enrich:cv-skills:status -- (--extractionId=<id> | --enrichmentId=<id>)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import {
  assertStatusCli,
  parseEnrichCliArgs,
} from '../../cv-skills-enrichment/cv-skills-enrichment.cli-args';

const TAG = '[CV Skills Enricher Status]';

async function main(): Promise<void> {
  const args = parseEnrichCliArgs(process.argv.slice(2));
  assertStatusCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const persistence = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistenceService);

    const summary = await persistence.statusSummary({
      extractionId: args.extractionId,
      enrichmentId: args.enrichmentId,
    });

    console.log(JSON.stringify(summary, null, 2));
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
