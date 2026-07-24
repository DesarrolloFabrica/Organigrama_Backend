/**
 * CLI: npm run enrich:cv-skills:deactivate -- --enrichmentId=<id> --i-confirm-deactivate
 *
 * Solo desactiva is_active en dominio enrichment. No llama Gemini. No toca inventario.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import {
  assertDeactivateCli,
  parseEnrichCliArgs,
} from '../../cv-skills-enrichment/cv-skills-enrichment.cli-args';

const TAG = '[CV Skills Enricher Deactivate]';

async function main(): Promise<void> {
  const args = parseEnrichCliArgs(process.argv.slice(2));
  assertDeactivateCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const persistence = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistenceService);

    const before = await persistence.loadRunWithItems(args.enrichmentId!);
    console.log(`${TAG} enrichmentId=${args.enrichmentId}`);
    console.log(`extractionId=${before.enrichment.extraction_id}`);
    console.log(`status=${before.enrichment.status}`);
    console.log(`wasActive=${before.enrichment.is_active}`);

    const result = await persistence.deactivateSucceededRun(args.enrichmentId!);

    console.log(`${TAG} deactivated=${result.deactivated}`);
    console.log(`${TAG} alreadyInactive=${result.alreadyInactive}`);
    console.log(`${TAG} status=${result.status}`);
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
