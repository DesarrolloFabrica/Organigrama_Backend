import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const ds = app.get(DataSource);
  const rows = await ds.query(
    `SELECT p.id::text AS id, p.full_name
       FROM core.person p
      WHERE p.is_active = TRUE
        AND NOT EXISTS (
          SELECT 1 FROM organigrama.mc_profile_evaluation e
           WHERE e.person_id = p.id AND e.is_active = TRUE
        )
      ORDER BY p.id
      LIMIT 1`,
  );
  const pid = rows[0]?.id as string | undefined;
  console.log(JSON.stringify({ emptyPerson: rows[0] ?? null }, null, 2));
  if (pid) {
    const svc = app.get(OrgChartCompetenciesService);
    const summary = await svc.getExplorerSummary(
      { personId: pid, eduEmail: 'v@l', permissions: ['ORG_READ_ALL'] },
      pid,
      '0',
    );
    console.log(
      JSON.stringify(
        {
          availability: summary.availabilityStatus,
          domains: summary.domains.length,
          warnings: summary.warnings,
        },
        null,
        2,
      ),
    );
  }
  await app.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
