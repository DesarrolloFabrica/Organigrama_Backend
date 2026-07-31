/**
 * CLI RO: valida un JSON de perfil curado manual contra persona/CV/catálogo.
 *
 * npm run mc:validate-curated-profile -- --file=path/to.json
 * npm run mc:validate-curated-profile -- --file=... --document=123 --out=tmp/report.json
 *
 * Sin --confirm. Sin INSERT/UPDATE/DELETE.
 */

import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  createCuratedCatalogLookup,
  parseCuratedValidateCliArgs,
  validateCuratedProfile,
  type CuratedProfileValidationReport,
} from '../../mc-catalog/curated-profile';

const TAG = '[MC Curated Profile Validate]';

function printSummary(report: CuratedProfileValidationReport): void {
  console.log(`${TAG} valid=${report.valid}`);
  console.log(
    `${TAG} person found=${report.person.found} ` +
      `document=${report.person.documentMasked} ` +
      `personId=${report.person.personId ?? 'n/a'} ` +
      `personCvId=${report.person.personCvId ?? 'n/a'}`,
  );
  if (report.domain) {
    console.log(
      `${TAG} domain ${report.domain.inputCode} status=${report.domain.status} ` +
        `id=${report.domain.matchedDomainId ?? 'n/a'} ` +
        `catalog=${report.domain.catalogVersion ?? 'n/a'}`,
    );
  }
  for (const specialty of report.specialties) {
    console.log(
      `${TAG} specialty ${specialty.inputCode} status=${specialty.status} ` +
        `id=${specialty.matchedSpecialtyId ?? 'n/a'} ` +
        `mappings=${specialty.mappingSkillCount}`,
    );
  }
  console.log(
    `${TAG} skills existing=${report.summary.existingSkillCount} ` +
      `aliases=${report.summary.aliasSkillCount} ` +
      `proposed=${report.summary.proposedSkillCount} ` +
      `ambiguous=${report.summary.ambiguousSkillCount} ` +
      `invalid=${report.summary.invalidSkillCount}`,
  );
  console.log(
    `${TAG} errors=${report.summary.errorCount} warnings=${report.summary.warningCount}`,
  );
  for (const err of report.errors) {
    console.log(`${TAG} ERROR [${err.code}] ${err.path}: ${err.message}`);
  }
  for (const warn of report.warnings) {
    console.log(`${TAG} WARN  [${warn.code}] ${warn.path}: ${warn.message}`);
  }
}

async function main(): Promise<void> {
  const args = parseCuratedValidateCliArgs(process.argv.slice(2));
  if (!args.file) {
    throw new Error(
      'Requiere --file=ruta.json (opcional: --document=cedula --out=tmp/report.json)',
    );
  }

  const filePath = resolve(process.cwd(), args.file);
  const raw = JSON.parse(readFileSync(filePath, 'utf8')) as unknown;

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);
    const lookup = createCuratedCatalogLookup(ds);
    const report = await validateCuratedProfile(raw, lookup, {
      documentOverride: args.documentOverride,
    });

    printSummary(report);

    if (args.out) {
      const outPath = resolve(process.cwd(), args.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
      console.log(`${TAG} report written to ${outPath}`);
    }

    if (!report.valid) {
      process.exitCode = 1;
    }
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${TAG} FATAL: ${message}`);
  process.exitCode = 1;
});
