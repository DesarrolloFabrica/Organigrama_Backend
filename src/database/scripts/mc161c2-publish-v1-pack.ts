/**
 * Publica release PUBLISHED del pack Visual V1 (sin reseed).
 * MC1.6.1C.2 — preservar inmutabilidad histórica mc1.6-visual-nidia-2026-07-27
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { McCatalogModule } from '../../mc-catalog/mc-catalog.module';
import { McMappingService } from '../../mc-catalog/mc-catalog.mapping.service';
import {
  MC_VISUAL_DESIGN_MAPPING_PACK,
  MC_VISUAL_DESIGN_MAPPING_RULES_VERSION,
} from '../../mc-catalog/mc-catalog.mapping-visual-design-mc16';
import { MC_VISUAL_DESIGN_MAPPING_PACK_CODE } from '../../mc-catalog/mc-catalog.mapping-registry';
import { computeMcMappingPackHash } from '../../mc-catalog/mc-catalog.mapping-hash';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  try {
    const service = app.select(McCatalogModule).get(McMappingService);
    const hash = computeMcMappingPackHash(MC_VISUAL_DESIGN_MAPPING_PACK);
    const row = await service.publishOrAssertPackRelease({
      packCode: MC_VISUAL_DESIGN_MAPPING_PACK_CODE,
      packVersion: MC_VISUAL_DESIGN_MAPPING_RULES_VERSION,
      domainCode: 'VISUAL_DESIGN',
      contentHash: hash,
      sourceRef: MC_VISUAL_DESIGN_MAPPING_PACK.sourceRef ?? null,
    });
    console.log(
      JSON.stringify(
        {
          packCode: row.pack_code,
          packVersion: row.pack_version,
          contentHash: row.content_hash,
          status: row.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
