/**
 * CLI: npm run evaluate:cv-evidence -- --enrichmentId=1 (--dry-run | --persist ...)
 * Opcional: --rulesVersion=er1|er2 (default er2)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { CvEvidenceModule } from '../../cv-evidence/cv-evidence.module';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import { getEvidenceEngineConfig } from '../../cv-evidence/cv-evidence.config';
import {
  assertEvidenceMainCli,
  parseEvidenceCliArgs,
} from '../../cv-evidence/cv-evidence.cli-args';

const TAG = '[CV Evidence Engine]';

function artifactName(
  enrichmentId: string,
  rulesVersion: string,
  now = new Date(),
): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `enrichment-${enrichmentId}-${rulesVersion}-${stamp}.json`;
}

async function main(): Promise<void> {
  const args = parseEvidenceCliArgs(process.argv.slice(2));
  assertEvidenceMainCli(args);
  const config = getEvidenceEngineConfig(args.rulesVersion);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const persistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);

    if (args.dryRun) {
      console.log(
        `${TAG} dry-run enrichmentId=${args.enrichmentId} rules=${args.rulesVersion}`,
      );
      const artifact = await persistence.runDry(args.enrichmentId!, config);
      const outDir = resolve(args.outputDir);
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(
        outDir,
        artifactName(args.enrichmentId!, args.rulesVersion),
      );
      writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');

      const ranked = [...artifact.result.skills].sort(
        (a, b) => b.evidenceStrength - a.evidenceStrength,
      );
      console.log(`${TAG} skills=${artifact.result.metrics.outputSkills}`);
      console.log(
        `${TAG} levels strong/mod/weak/none=` +
          `${artifact.result.metrics.strongSkills}/` +
          `${artifact.result.metrics.moderateSkills}/` +
          `${artifact.result.metrics.weakSkills}/` +
          `${artifact.result.metrics.noEvidenceSkills}`,
      );
      console.log(
        `${TAG} avgStrength=${artifact.result.metrics.averageStrength} ` +
          `avgConfidence=${artifact.result.metrics.averageConfidence}`,
      );
      console.log(`${TAG} ranked by strength:`);
      for (const s of ranked) {
        console.log(
          `  ${s.evidenceStrength.toFixed(1).padStart(5)} ` +
            `${s.evidenceLevel.padEnd(8)} ` +
            `conf=${s.evidenceConfidence.toFixed(2)} ` +
            `sub=${s.substantiveEvidenceCount} amb=${s.ambiguousEvidenceCount} ` +
            `${s.normalizedName} ` +
            `[${s.qualityFlags.slice(0, 4).join(',')}]`,
        );
      }
      console.log(`${TAG} artifact=${outPath}`);
      return;
    }

    console.log(`${TAG} PERSIST enrichmentId=${args.enrichmentId}`);
    console.log(`rulesVersion: ${args.rulesVersion}`);
    console.log(`activate: ${args.activate ? 'yes' : 'no'}`);
    const outcome = await persistence.runPersist({
      enrichmentId: args.enrichmentId!,
      activate: args.activate,
      config,
    });
    console.log(`${TAG} outcome=${outcome.outcome}`);
    console.log(`${TAG} evaluationId=${outcome.evaluationId}`);
    console.log(
      `${TAG} status=${outcome.status} isActive=${outcome.isActive}`,
    );
    console.log(`${TAG} skippedEngine=${outcome.skippedEngine}`);
    if (outcome.result) {
      const outDir = resolve(args.outputDir);
      mkdirSync(outDir, { recursive: true });
      const outPath = resolve(
        outDir,
        artifactName(args.enrichmentId!, args.rulesVersion),
      );
      writeFileSync(
        outPath,
        JSON.stringify(
          {
            outcome,
            metrics: outcome.result.metrics,
            skills: outcome.result.skills,
          },
          null,
          2,
        ),
        'utf8',
      );
      console.log(
        `${TAG} levels ${outcome.result.metrics.strongSkills}/` +
          `${outcome.result.metrics.moderateSkills}/` +
          `${outcome.result.metrics.weakSkills}/` +
          `${outcome.result.metrics.noEvidenceSkills}`,
      );
      console.log(`${TAG} artifact=${outPath}`);
    }
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
