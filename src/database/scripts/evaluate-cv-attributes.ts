/**
 * CLI: npm run evaluate:cv-attributes -- --evaluationId=2 (--dry-run | --persist ...)
 *
 * Determinista: no llama Gemini, no lee PDF y no escribe en capas previas.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvAttributesModule } from '../../cv-attributes/cv-attributes.module';
import { CvAttributeCatalogService } from '../../cv-attributes/cv-attributes-catalog.service';
import { CvAttributePersistenceService } from '../../cv-attributes/cv-attributes-persistence.service';
import { getDefaultAttributeEngineConfig } from '../../cv-attributes/cv-attributes.config';
import {
  assertAttributeMainCli,
  parseAttributeCliArgs,
} from '../../cv-attributes/cv-attributes.cli-args';
import type { AttributeEngineDryRunArtifact } from '../../cv-attributes/cv-attributes.types';

const TAG = '[CV Attribute Engine]';

/** `pa1-2026-07-24` → `evaluation-2-pa1-dry-run.json`. */
function artifactName(evaluationId: string, catalogVersion: string): string {
  const family = catalogVersion.split('-')[0];
  return `evaluation-${evaluationId}-${family}-dry-run.json`;
}

async function main(): Promise<void> {
  const args = parseAttributeCliArgs(process.argv.slice(2));
  assertAttributeMainCli(args);
  const config = getDefaultAttributeEngineConfig();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const scope = app.select(CvAttributesModule);
    const persistence = scope.get(CvAttributePersistenceService);
    const catalogService = scope.get(CvAttributeCatalogService);

    const catalog = await catalogService.loadCatalog(
      args.catalogVersion
        ? { catalogVersion: args.catalogVersion }
        : { activeOnly: false },
    );

    const evaluationId =
      args.evaluationId ??
      (await persistence.resolveActiveEvaluationId(args.enrichmentId!));

    if (args.dryRun) {
      console.log(
        `${TAG} dry-run evaluationId=${evaluationId} catalog=${catalog.catalogVersion}`,
      );
      const artifact = await persistence.runDry({
        evaluationId,
        catalog,
        config,
      });

      const outDir = resolve(args.outputDir);
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(
        outDir,
        artifactName(evaluationId, catalog.catalogVersion),
      );
      writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');

      printSummary(artifact);
      console.log(`${TAG} artifact=${outPath}`);
      return;
    }

    console.log(`${TAG} PERSIST evaluationId=${evaluationId}`);
    console.log(`catalog: ${catalog.catalogVersion} (status=${catalog.status})`);
    console.log(`activate: ${args.activate ? 'yes' : 'no'}`);

    const outcome = await persistence.runPersist({
      evaluationId,
      activate: args.activate,
      catalog,
      config,
    });

    console.log(`${TAG} outcome=${outcome.outcome}`);
    console.log(`${TAG} attributeRunId=${outcome.attributeRunId}`);
    console.log(`${TAG} status=${outcome.status} isActive=${outcome.isActive}`);
    console.log(`${TAG} skippedEngine=${outcome.skippedEngine}`);

    if (outcome.result) {
      const m = outcome.result.metrics;
      console.log(
        `${TAG} skills mapped/unmapped/contributing=` +
          `${m.mappedSkills}/${m.unmappedSkills}/${m.contributingSkills}`,
      );
      console.log(
        `${TAG} subattributes with support=${m.subattributesWithSupport}/${m.subattributesTotal} ` +
          `macroattributes=${m.macroattributesWithSupport}/${m.macroattributesTotal}`,
      );
      console.log(`${TAG} traces=${m.tracesCount}`);
    }
  } finally {
    await app.close();
  }
}

function printSummary(artifact: AttributeEngineDryRunArtifact): void {
  const m = artifact.result.metrics;
  console.log(
    `${TAG} skills input/mapped/unmapped/contributing=` +
      `${m.inputSkills}/${m.mappedSkills}/${m.unmappedSkills}/${m.contributingSkills}`,
  );
  console.log(
    `${TAG} subattributes with support=${m.subattributesWithSupport}/${m.subattributesTotal} ` +
      `macroattributes=${m.macroattributesWithSupport}/${m.macroattributesTotal}`,
  );

  console.log(`${TAG} macroattributes:`);
  for (const macro of [...artifact.result.macroattributes].sort(
    (a, b) => b.score - a.score,
  )) {
    console.log(
      `  ${macro.score.toFixed(2).padStart(6)} ${macro.level.padEnd(15)} ` +
        `conf=${macro.confidence.toFixed(2)} cov=${macro.coverage.toFixed(2)} ` +
        `${macro.macroattributeCode} [${macro.qualityFlags.join(',')}]`,
    );
  }

  console.log(`${TAG} subattributes with support:`);
  for (const sub of artifact.result.subattributes
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)) {
    console.log(
      `  ${sub.score.toFixed(2).padStart(6)} ${sub.level.padEnd(15)} ` +
        `conf=${sub.confidence.toFixed(2)} cov=${sub.coverage.toFixed(2)} ` +
        `n=${sub.contributingSkillsCount} ${sub.subattributeCode} ` +
        `[${sub.qualityFlags.slice(0, 5).join(',')}]`,
    );
  }

  if (artifact.result.unmappedSkills.length > 0) {
    console.log(
      `${TAG} unmapped skills: ` +
        artifact.result.unmappedSkills.map((s) => s.normalizedName).join(', '),
    );
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    if (err && typeof err === 'object' && 'issues' in err) {
      for (const issue of (err as { issues: string[] }).issues) {
        console.error(`  - ${issue}`);
      }
    }
    process.exit(1);
  });
}
