/**
 * CLI: npm run evaluate:cv-evidence:status -- (--enrichmentId=1 | --evaluationId=<id>)
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvEvidenceModule } from '../../cv-evidence/cv-evidence.module';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import {
  assertEvidenceStatusCli,
  parseEvidenceCliArgs,
} from '../../cv-evidence/cv-evidence.cli-args';

const TAG = '[CV Evidence Status]';

async function main(): Promise<void> {
  const args = parseEvidenceCliArgs(process.argv.slice(2));
  assertEvidenceStatusCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const persistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);
    const summary = await persistence.statusSummary({
      enrichmentId: args.enrichmentId,
      evaluationId: args.evaluationId,
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
