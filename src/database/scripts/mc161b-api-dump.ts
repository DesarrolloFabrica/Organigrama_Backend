/**
 * MC1.6.1B — dump API summary Nidia + Camilo (ORG_READ_ALL).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';

async function dump(
  service: OrgChartCompetenciesService,
  personId: string,
) {
  const viewer: OrgViewerContext = {
    personId,
    eduEmail: 'verify@local',
    permissions: ['ORG_READ_ALL'],
  };
  return service.getExplorerSummary(viewer, personId, '0', {
    includeHidden: true,
    includeAudit: true,
  });
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const service = app.get(OrgChartCompetenciesService);
  const nidia = await dump(service, '1163');
  const camilo = await dump(service, '1');
  const empty = await dump(service, '999999').catch((e) => ({
    error: String(e?.message ?? e),
  }));

  const out = { phase: 'MC1.6.1B-api', nidia, camilo, empty };
  mkdirSync(resolve(process.cwd(), 'tmp'), { recursive: true });
  const path = resolve(process.cwd(), 'tmp/mc161b-api-summaries.json');
  writeFileSync(path, JSON.stringify(out, null, 2), 'utf8');
  console.log(
    JSON.stringify(
      {
        nidia: {
          availability: nidia.availabilityStatus,
          domain: nidia.domains?.[0]?.code,
          primary: nidia.domains?.[0]?.defaultSpecialtyCode,
          role: nidia.person?.role,
          specialties: nidia.domains?.[0]?.specialties?.map((s) => ({
            code: s.code,
            status: s.presentationStatus,
            isDefault: s.isDefault,
          })),
        },
        camilo: {
          availability: camilo.availabilityStatus,
          domain: camilo.domains?.[0]?.code,
          primary: camilo.domains?.[0]?.defaultSpecialtyCode,
          role: camilo.person?.role,
        },
        empty:
          'error' in empty
            ? empty
            : {
                availability: (empty as { availabilityStatus: string })
                  .availabilityStatus,
              },
      },
      null,
      2,
    ),
  );
  console.log(`[MC1.6.1B] wrote ${path}`);
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
