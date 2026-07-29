/**
 * MC1.5.2A — verificación post-persist (solo lectura + JSON local).
 * npx ts-node -r tsconfig-paths/register src/database/scripts/mc152a-verify.ts
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);

  const evals = await ds.query(
    `SELECT id::text, engine_rules_version, default_specialty_code, status,
            is_active, extraction_id::text
       FROM organigrama.mc_profile_evaluation
      WHERE person_id = 1 AND domain_code = 'SOFTWARE'
      ORDER BY id`,
  );

  const ranks = await ds.query(
    `SELECT profile_evaluation_id::text AS eid, specialty_code, rank, is_default,
            presentation_status,
            coverage::float8 AS coverage,
            strength::float8 AS strength,
            confidence::float8 AS confidence
       FROM organigrama.mc_profile_specialty_result
      WHERE profile_evaluation_id IN (1, 2)
      ORDER BY profile_evaluation_id, rank`,
  );

  const byEid: Record<string, typeof ranks> = {};
  for (const r of ranks) {
    (byEid[r.eid] ??= []).push(r);
  }
  const r1 = byEid['1'] ?? [];
  const r2 = byEid['2'] ?? [];
  const codes = [
    ...new Set([...r1, ...r2].map((x: { specialty_code: string }) => x.specialty_code)),
  ];

  const comparison = codes
    .map((code) => {
      const a = r1.find((x: { specialty_code: string }) => x.specialty_code === code);
      const b = r2.find((x: { specialty_code: string }) => x.specialty_code === code);
      return {
        specialty: code,
        rank_1_0_0: a?.rank ?? null,
        rank_1_1_0: b?.rank ?? null,
        change: a && b ? Number(a.rank) - Number(b.rank) : null,
        coverage_unchanged:
          a && b ? Number(a.coverage) === Number(b.coverage) : null,
        strength_unchanged:
          a && b ? Number(a.strength) === Number(b.strength) : null,
        confidence_unchanged:
          a && b ? Number(a.confidence) === Number(b.confidence) : null,
        status_1_0_0: a?.presentation_status,
        status_1_1_0: b?.presentation_status,
        isDefault_1_0_0: a?.is_default,
        isDefault_1_1_0: b?.is_default,
        coverage: a?.coverage,
        strength_1_0_0: a?.strength,
        strength_1_1_0: b?.strength,
      };
    })
    .sort(
      (x, y) =>
        (Number(x.rank_1_1_0) || 99) - (Number(y.rank_1_1_0) || 99),
    );

  const out = {
    meta: {
      phase: 'MC1.5.2A',
      generatedAt: new Date().toISOString(),
      strategyChosen: 'LEXICOGRAPHIC',
      alternativeDiscarded: 'NORMALIZED_SCORE',
      whyLexicographic:
        'Explicable sin mezclar escalas; primaryStrong solo desempata; Backend gana por Strength con Coverage y masa iguales.',
      narrativeNonCanonical: 'Perfil Full Stack con énfasis Backend',
    },
    evaluations: evals,
    comparison,
  };

  const dir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, 'mc1.5.2a-camilo-pa2-comparison.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(JSON.stringify(out, null, 2));
  console.log('[MC1.5.2A] wrote', path);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
