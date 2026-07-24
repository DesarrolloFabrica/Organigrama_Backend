/**
 * Compara er1 vs er2 en dry-run puro (sin persistir).
 * npm run evaluate:cv-evidence:compare -- --enrichmentId=1
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
import { parseEvidenceCliArgs } from '../../cv-evidence/cv-evidence.cli-args';

const TAG = '[CV Evidence Compare]';

function reasonForChange(
  er1: {
    evidenceStrength: number;
    evidenceLevel: string;
    qualityFlags: string[];
  },
  er2: {
    evidenceStrength: number;
    evidenceLevel: string;
    qualityFlags: string[];
    substantiveEvidenceCount: number;
    ambiguousEvidenceCount: number;
  },
): string {
  const reasons: string[] = [];
  if (er1.evidenceStrength !== er2.evidenceStrength) {
    reasons.push(
      `strength ${er1.evidenceStrength}→${er2.evidenceStrength}`,
    );
  }
  if (er1.evidenceLevel !== er2.evidenceLevel) {
    reasons.push(`level ${er1.evidenceLevel}→${er2.evidenceLevel}`);
  }
  if (
    er2.qualityFlags.includes('ONLY_AMBIGUOUS_EVIDENCE') &&
    !er1.qualityFlags.includes('ONLY_AMBIGUOUS_EVIDENCE')
  ) {
    reasons.push('new ONLY_AMBIGUOUS_EVIDENCE');
  }
  if (er2.ambiguousEvidenceCount > 0) {
    reasons.push(`ambiguous=${er2.ambiguousEvidenceCount}`);
  }
  if (er2.substantiveEvidenceCount > 0) {
    reasons.push(`substantive=${er2.substantiveEvidenceCount}`);
  }
  if (
    er1.qualityFlags.includes('ONLY_SKILLS_SECTION') &&
    er2.evidenceStrength > er1.evidenceStrength
  ) {
    reasons.push('onlySkills penalty reduced + no floor');
  }
  return reasons.join('; ') || 'no material change';
}

async function main(): Promise<void> {
  const args = parseEvidenceCliArgs(process.argv.slice(2));
  if (!args.enrichmentId) {
    throw new Error('Requiere --enrichmentId=<id>.');
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const persistence = app
      .select(CvEvidenceModule)
      .get(CvEvidencePersistenceService);

    const er1 = await persistence.runDry(
      args.enrichmentId,
      getEvidenceEngineConfig('er1'),
    );
    const er2 = await persistence.runDry(
      args.enrichmentId,
      getEvidenceEngineConfig('er2'),
    );

    const byId1 = new Map(
      er1.result.skills.map((s) => [s.extractionSkillId, s]),
    );
    const rows = er2.result.skills.map((s2) => {
      const s1 = byId1.get(s2.extractionSkillId)!;
      return {
        extractionSkillId: s2.extractionSkillId,
        normalizedName: s2.normalizedName,
        er1: {
          strength: s1.evidenceStrength,
          confidence: s1.evidenceConfidence,
          level: s1.evidenceLevel,
          flags: s1.qualityFlags,
        },
        er2: {
          strength: s2.evidenceStrength,
          confidence: s2.evidenceConfidence,
          level: s2.evidenceLevel,
          flags: s2.qualityFlags,
          substantiveEvidenceCount: s2.substantiveEvidenceCount,
          listingEvidenceCount: s2.listingEvidenceCount,
          ambiguousEvidenceCount: s2.ambiguousEvidenceCount,
          explanation: s2.explanation,
        },
        deltaStrength: +(s2.evidenceStrength - s1.evidenceStrength).toFixed(2),
        deltaConfidence: +(s2.evidenceConfidence - s1.evidenceConfidence).toFixed(
          4,
        ),
        reasonForChange: reasonForChange(s1, s2),
      };
    });

    rows.sort((a, b) => b.er2.strength - a.er2.strength);

    const report = {
      enrichmentId: args.enrichmentId,
      generatedAt: new Date().toISOString(),
      er1Meta: er1.meta,
      er2Meta: er2.meta,
      er1Metrics: er1.result.metrics,
      er2Metrics: er2.result.metrics,
      skills: rows,
    };

    const outDir = resolve(args.outputDir);
    mkdirSync(outDir, { recursive: true });
    const outPath = resolve(outDir, 'evaluation-1-er1-vs-er2.json');
    writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

    console.log(`${TAG} er1 levels ${er1.result.metrics.strongSkills}/${er1.result.metrics.moderateSkills}/${er1.result.metrics.weakSkills}/${er1.result.metrics.noEvidenceSkills}`);
    console.log(`${TAG} er2 levels ${er2.result.metrics.strongSkills}/${er2.result.metrics.moderateSkills}/${er2.result.metrics.weakSkills}/${er2.result.metrics.noEvidenceSkills}`);
    console.log(`${TAG} report=${outPath}`);
    for (const r of rows.slice(0, 12)) {
      console.log(
        `  ${r.er2.strength.toFixed(1).padStart(5)} (${r.er1.strength.toFixed(1)}) ` +
          `${r.er2.level.padEnd(8)} ${r.normalizedName} Δ=${r.deltaStrength} ` +
          `[${r.reasonForChange}]`,
      );
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
