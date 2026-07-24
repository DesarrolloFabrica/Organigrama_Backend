/**
 * CLI: npm run evaluate:cv-evidence:inspect -- --evaluationId=<id>
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvEvidenceModule } from '../../cv-evidence/cv-evidence.module';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import {
  assertEvidenceInspectCli,
  parseEvidenceCliArgs,
} from '../../cv-evidence/cv-evidence.cli-args';

const TAG = '[CV Evidence Inspect]';

async function main(): Promise<void> {
  const args = parseEvidenceCliArgs(process.argv.slice(2));
  assertEvidenceInspectCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const persistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);
    const view = await persistence.inspect(args.evaluationId!);
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
