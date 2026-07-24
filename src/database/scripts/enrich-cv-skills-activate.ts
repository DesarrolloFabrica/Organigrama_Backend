/**
 * CLI: npm run enrich:cv-skills:activate -- --enrichmentId=<id> --i-confirm-activate
 *
 * Reactiva un SUCCEEDED anterior (rollback de activo). No llama Gemini.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvSkillsEnrichmentModule } from '../../cv-skills-enrichment/cv-skills-enrichment.module';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import {
  assertActivateCli,
  parseEnrichCliArgs,
} from '../../cv-skills-enrichment/cv-skills-enrichment.cli-args';

const TAG = '[CV Skills Enricher Activate]';

async function main(): Promise<void> {
  const args = parseEnrichCliArgs(process.argv.slice(2));
  assertActivateCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const persistence = app
      .select(CvSkillsEnrichmentModule)
      .get(CvSkillsEnrichmentPersistenceService);

    const before = await persistence.loadRunWithItems(args.enrichmentId!);
    const previousActive = await persistence.findActiveForExtraction(
      before.enrichment.extraction_id,
    );

    console.log(`${TAG} enrichmentId=${args.enrichmentId}`);
    console.log(`extractionId=${before.enrichment.extraction_id}`);
    console.log(`status=${before.enrichment.status}`);
    console.log(
      `previousActive=${previousActive ? previousActive.id : '(none)'}`,
    );

    const result = await persistence.activateSucceededRun(args.enrichmentId!);

    console.log(`${TAG} activated=${result.activated}`);
    console.log(`${TAG} alreadyActive=${result.alreadyActive}`);
    console.log(`${TAG} previousActiveId=${result.previousActiveId ?? '(none)'}`);
    console.log(`${TAG} newActiveId=${result.enrichmentId}`);
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
