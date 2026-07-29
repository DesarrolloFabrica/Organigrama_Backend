/**
 * CLI: npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --dry-run
 *      npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --rules-version=pa2-software-1.1.0 --dry-run
 *      npm run mc:evaluate -- --extraction-id=206 --domain=SOFTWARE --rules-version=pa2-software-1.1.0 --i-confirm-evaluate
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McPa2Service } from '../../mc-catalog/mc-pa2.service';

const TAG = '[MC PA2 Evaluate]';

function parseArgs(argv: string[]): {
  extractionId?: string;
  domain: string;
  evidenceEvaluationId?: string;
  catalogVersion?: string;
  rulesVersion?: string;
  dryRun: boolean;
  confirm: boolean;
  out?: string;
} {
  const out = {
    extractionId: undefined as string | undefined,
    domain: 'SOFTWARE',
    evidenceEvaluationId: undefined as string | undefined,
    catalogVersion: undefined as string | undefined,
    rulesVersion: undefined as string | undefined,
    dryRun: false,
    confirm: false,
    out: undefined as string | undefined,
  };
  for (const arg of argv) {
    if (arg.startsWith('--extraction-id=')) {
      out.extractionId = arg.slice('--extraction-id='.length);
    } else if (arg.startsWith('--domain=')) {
      out.domain = arg.slice('--domain='.length);
    } else if (arg.startsWith('--evidence-evaluation-id=')) {
      out.evidenceEvaluationId = arg.slice(
        '--evidence-evaluation-id='.length,
      );
    } else if (arg.startsWith('--catalogVersion=')) {
      out.catalogVersion = arg.slice('--catalogVersion='.length);
    } else if (arg.startsWith('--rules-version=')) {
      out.rulesVersion = arg.slice('--rules-version='.length);
    } else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--i-confirm-evaluate') out.confirm = true;
    else if (arg.startsWith('--out=')) out.out = arg.slice('--out='.length);
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.extractionId) {
    throw new Error('Requiere --extraction-id=');
  }
  if (!args.dryRun && !args.confirm) {
    throw new Error(
      'Persistencia requiere --i-confirm-evaluate (o use --dry-run).',
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const service = app.select(McCatalogModule).get(McPa2Service);
    const outcome = await service.evaluateProfileDomain({
      extractionId: args.extractionId,
      domainCode: args.domain,
      evidenceEvaluationId: args.evidenceEvaluationId,
      catalogVersion: args.catalogVersion,
      rulesVersion: args.rulesVersion,
      persist: !args.dryRun,
    });

    console.log(`${TAG} outcome=${outcome.outcome} dryRun=${outcome.dryRun}`);
    console.log(`${TAG} evaluationId=${outcome.evaluationId ?? 'n/a'}`);
    console.log(
      `${TAG} default=${outcome.result.defaultSpecialtyCode} ` +
        `ACTIVE=${outcome.result.activeCount} EMERGENT=${outcome.result.emergentCount} ` +
        `HIDDEN=${outcome.result.hiddenCount}`,
    );

    const artifact = {
      meta: {
        phase: 'MC1.3.3',
        generatedAt: new Date().toISOString(),
        ...outcome.meta,
        engineRulesVersion: outcome.result.engineRulesVersion,
        configHash: outcome.result.configHash,
        outcome: outcome.outcome,
        dryRun: outcome.dryRun,
        evaluationId: outcome.evaluationId,
      },
      summary: {
        defaultSpecialtyCode: outcome.result.defaultSpecialtyCode,
        activeCount: outcome.result.activeCount,
        emergentCount: outcome.result.emergentCount,
        hiddenCount: outcome.result.hiddenCount,
        warnings: outcome.result.warnings,
      },
      specialties: outcome.result.specialtyResults.map((r) => ({
        specialtyCode: r.specialtyCode,
        presentationStatus: r.presentationStatus,
        lifecycleStatus: r.lifecycleStatus,
        mappedSkillCount: r.mappedSkillCount,
        evidencedSkillCount: r.evidencedSkillCount,
        coverage: r.coverage,
        confidence: r.confidence,
        strength: r.strength,
        rank: r.rank,
        isDefault: r.isDefault,
        overrideApplied: r.overrideApplied,
        reasons: r.reasons,
        warnings: r.warnings,
        skillBreakdown: r.skillBreakdown,
      })),
    };

    const outPath =
      args.out ??
      resolve(
        process.cwd(),
        'tmp/cv-attributes/mc1.3.3-camilo-pa2-evaluation.json',
      );
    writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(`${TAG} artifact=${outPath}`);
    console.log(JSON.stringify(artifact.summary, null, 2));
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
