/**
 * MC1.5.2C — Export read-only de skills de extracción 87.
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
  const skills = await ds.query(
    `SELECT id, name, category, skill_type, confidence, LEFT(evidence, 160) AS evidence_preview
     FROM core.cv_extracted_skills WHERE extraction_id = $1 ORDER BY id`,
    [87],
  );
  const out = resolve(
    process.cwd(),
    'tmp',
    'cv-attributes',
    'mc1.5.2c-ext87-skills.json',
  );
  mkdirSync(resolve(process.cwd(), 'tmp', 'cv-attributes'), { recursive: true });
  writeFileSync(out, JSON.stringify(skills, null, 2), 'utf8');
  console.log(JSON.stringify({ count: skills.length, path: out, skills }, null, 2));
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
