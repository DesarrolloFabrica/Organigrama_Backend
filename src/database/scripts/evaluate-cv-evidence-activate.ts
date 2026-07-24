/**
 * CLI: npm run evaluate:cv-evidence:activate -- --evaluationId=<id> --i-confirm-activate
 * Reactiva una evaluation SUCCEEDED (rollback er1↔er2). No recalcula.
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvEvidenceModule } from '../../cv-evidence/cv-evidence.module';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import {
  assertEvidenceActivateCli,
  parseEvidenceCliArgs,
} from '../../cv-evidence/cv-evidence.cli-args';

const TAG = '[CV Evidence Activate]';

async function main(): Promise<void> {
  const args = parseEvidenceCliArgs(process.argv.slice(2));
  assertEvidenceActivateCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const persistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);

    const before = await persistence.statusSummary({
      evaluationId: args.evaluationId,
    });
    console.log(`${TAG} evaluationId=${args.evaluationId}`);
    console.log(`enrichmentId=${before.enrichmentId}`);
    console.log(`status=${before.status} wasActive=${before.isActive}`);

    const result = await persistence.activateSucceeded(args.evaluationId!);
    console.log(`${TAG} activated=${result.activated}`);
    console.log(`${TAG} alreadyActive=${result.alreadyActive}`);
    console.log(
      `${TAG} previousActiveId=${result.previousActiveId ?? '(none)'}`,
    );
    console.log(`${TAG} newActiveId=${result.evaluationId}`);
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
