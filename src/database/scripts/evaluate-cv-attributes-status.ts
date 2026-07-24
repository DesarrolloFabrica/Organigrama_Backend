/**
 * CLI: npm run evaluate:cv-attributes:status -- --attributeRunId=<id>
 *      npm run evaluate:cv-attributes:status -- --evaluationId=<id>
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvAttributesModule } from '../../cv-attributes/cv-attributes.module';
import { CvAttributePersistenceService } from '../../cv-attributes/cv-attributes-persistence.service';
import {
  assertAttributeStatusCli,
  parseAttributeCliArgs,
} from '../../cv-attributes/cv-attributes.cli-args';

const TAG = '[CV Attribute Status]';

async function main(): Promise<void> {
  const args = parseAttributeCliArgs(process.argv.slice(2));
  assertAttributeStatusCli(args);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const persistence = app
      .select(CvAttributesModule)
      .get(CvAttributePersistenceService);
    const summary = await persistence.statusSummary({
      attributeRunId: args.attributeRunId,
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
