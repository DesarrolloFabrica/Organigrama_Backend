/**
 * CLI: rollback de importación manual-curated.
 *
 * npm run mc:rollback-curated-profile -- --document=... [--extraction-id=...]
 * npm run mc:rollback-curated-profile -- --document=... --execute --confirm
 */

import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  assertRollbackWriteFlags,
  parseCuratedRollbackCliArgs,
  rollbackCuratedProfile,
} from '../../mc-catalog/curated-profile';

const TAG = '[MC Curated Profile Rollback]';

async function main(): Promise<void> {
  const args = parseCuratedRollbackCliArgs(process.argv.slice(2));
  assertRollbackWriteFlags(args);
  if (!args.document) {
    throw new Error('Requiere --document=...');
  }

  const mode = args.execute ? 'EXECUTE' : 'DRY-RUN';
  console.log(`${TAG} mode=${mode}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const result = await rollbackCuratedProfile({
      dataSource: app.get(DataSource),
      document: args.document,
      extractionId: args.extractionId,
      execute: args.execute,
    });

    console.log(`${TAG} outcome=${result.outcome}`);
    console.log(`${TAG} document=${result.documentMasked}`);
    console.log(
      `${TAG} target=${result.targetExtractionId ?? 'n/a'} ` +
        `previous=${result.previousExtractionId ?? 'n/a'} ` +
        `reactivated=${result.reactivatedExtractionId ?? 'n/a'}`,
    );
    for (const m of result.messages) {
      console.log(`${TAG} ${m}`);
    }

    if (args.out) {
      const outPath = resolve(process.cwd(), args.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
    }

    if (result.outcome === 'BLOCKED' || result.outcome === 'FAILED') {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    `${TAG} FATAL:`,
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
