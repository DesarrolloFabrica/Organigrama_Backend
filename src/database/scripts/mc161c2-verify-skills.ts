/**
 * Verifica keys del pack Visual V1.1.0 en cv_skill.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

const KEYS = [
  'diseno_de_identidad_visual',
  'diagramacion_editorial',
  'manuales_de_identidad_corporativa',
  'maquetacion_y_preprensa',
  'maquetacion_editorial_digital',
  'diseno_grafico_institucional',
  'adobe_creative_cloud',
  'suite_adobe',
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  try {
    const ds = app.get(DataSource);
    const rows: { normalized_key: string; skill_type: string }[] =
      await ds.query(
        `SELECT normalized_key, skill_type FROM organigrama.cv_skill WHERE normalized_key = ANY($1)`,
        [KEYS],
      );
    const found = new Set(rows.map((r) => `${r.normalized_key}:${r.skill_type}`));
    let missing = 0;
    for (const k of KEYS) {
      const ok =
        found.has(`${k}:PROFESSIONAL_KNOWLEDGE`) || found.has(`${k}:TOOL`);
      console.log(`${k}: ${ok ? 'OK' : 'MISSING'}`);
      if (!ok) missing++;
    }
    if (missing > 0) process.exit(1);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
