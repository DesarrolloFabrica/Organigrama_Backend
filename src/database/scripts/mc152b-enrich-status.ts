import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const ds = app.get(DataSource);
  const rows = await ds.query(
    `SELECT id::text, status, is_active, extraction_id::text, pdf_sha256,
            error_message, error_code, created_at, completed_at
       FROM organigrama.cv_skill_enrichment
      WHERE extraction_id = 87 OR id >= 1
      ORDER BY id DESC LIMIT 10`,
  );
  console.log('enrichments', JSON.stringify(rows, null, 2));
  const ext = await ds.query(
    `SELECT id::text, pdf_sha256, status, is_active, person_cv_id::text
       FROM organigrama.cv_extraction WHERE id = 87`,
  );
  console.log('extraction', JSON.stringify(ext, null, 2));
  const items = await ds.query(
    `SELECT COUNT(*)::int AS n FROM organigrama.cv_skill_enrichment_item
      WHERE enrichment_id = 3`,
  ).catch(() => [{ n: -1 }]);
  console.log('items for id=3', items);
  await app.close();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
