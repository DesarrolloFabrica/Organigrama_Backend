/**
 * CLI: npm run evaluate:cv-attributes:activate -- --attributeRunId=<id> --i-confirm-activate
 *
 * No recalcula: solo mueve el flag activo entre runs SUCCEEDED del mismo
 * evidence evaluation, bajo advisory lock.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvAttributesModule } from '../../cv-attributes/cv-attributes.module';
import { CvAttributePersistenceService } from '../../cv-attributes/cv-attributes-persistence.service';
import {
  assertAttributeActivateCli,
  parseAttributeCliArgs,
} from '../../cv-attributes/cv-attributes.cli-args';

const TAG = '[CV Attribute Activate]';

async function main(): Promise<void> {
  const args = parseAttributeCliArgs(process.argv.slice(2));
  assertAttributeActivateCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const persistence = app
      .select(CvAttributesModule)
      .get(CvAttributePersistenceService);

    const before = await persistence.statusSummary({
      attributeRunId: args.attributeRunId,
    });
    console.log(
      `status=${before.status} wasActive=${(before as { isActive: boolean }).isActive}`,
    );

    const act = await persistence.activateSucceeded(args.attributeRunId!);
    console.log(`${TAG} activated=${act.activated}`);
    console.log(`${TAG} previousActiveId=${act.previousActiveId ?? 'none'}`);
    console.log(`${TAG} newActiveId=${act.attributeRunId}`);
    console.log(`${TAG} alreadyActive=${act.alreadyActive}`);
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
