/**
 * Verificación manual MC1.3.4: lee evaluación PA2 persistida (extracción 206)
 * vía OrgChartCompetenciesService — sin recalcular.
 *
 * Uso: npx ts-node -r tsconfig-paths/register src/database/scripts/verify-mc134-camilo-explorer.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  const ds = app.get(DataSource);
  const service = app.get(OrgChartCompetenciesService);

  const rows = await ds.query(
    `SELECT p.id::text AS person_id, p.full_name, e.id::text AS evaluation_id,
            e.extraction_id::text, e.default_specialty_code,
            e.active_count, e.emergent_count, e.hidden_count, e.status
       FROM organigrama.mc_profile_evaluation e
       JOIN core.person p ON p.id = e.person_id
      WHERE e.extraction_id = 206
        AND e.domain_code = 'SOFTWARE'
        AND e.is_active = TRUE
      ORDER BY e.id DESC
      LIMIT 1`,
  );

  if (!rows[0]) {
    console.error('No hay evaluación activa para extraction_id=206');
    await app.close();
    process.exit(1);
  }

  const personId = rows[0].person_id as string;
  console.log('Persona:', personId, rows[0].full_name);
  console.log('Evaluación BD:', rows[0]);

  const viewer: OrgViewerContext = {
    personId,
    eduEmail: 'verify@local',
    permissions: ['ORG_READ_ALL'],
  };

  // versionId dummy: ORG_READ_ALL no consulta jerarquía
  const summary = await service.getExplorerSummary(viewer, personId, '0', {
    includeAudit: true,
  });
  const domain = await service.getDomainDetail(
    viewer,
    personId,
    'SOFTWARE',
    '0',
  );
  const frontend = await service.getSpecialtyDetail(
    viewer,
    personId,
    'SOFTWARE',
    'SOFTWARE_FRONTEND',
    '0',
    { includeAudit: true },
  );

  console.log('\n=== RESUMEN ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\n=== DOMINIO SOFTWARE (especialidades) ===');
  console.log(
    domain.specialties.map((s) => ({
      code: s.code,
      status: s.presentationStatus,
      rank: s.rank,
      isDefault: s.isDefault,
      metrics: s.metrics,
    })),
  );
  console.log('\n=== FRONTEND (detalle) ===');
  console.log({
    code: frontend.code,
    presentationStatus: frontend.presentationStatus,
    isDefault: frontend.isDefault,
    metrics: frontend.metrics,
    skillCount: frontend.skills.length,
    sampleSkills: frontend.skills.slice(0, 3).map((s) => ({
      code: s.code,
      role: s.mapping.role,
      level: s.evidence.level,
      evidenceItems: s.evidence.items.length,
    })),
  });

  const checks = [
    summary.availabilityStatus === 'AVAILABLE',
    summary.domains[0]?.defaultSpecialtyCode === 'SOFTWARE_FRONTEND',
    summary.domains[0]?.activeSpecialtyCount === 5,
    summary.domains[0]?.emergentSpecialtyCount === 2,
    domain.specialties.filter((s) => s.presentationStatus === 'HIDDEN')
      .length === 0,
    frontend.isDefault === true,
  ];
  console.log('\nChecks OK?', checks.every(Boolean), checks);

  await app.close();
  process.exit(checks.every(Boolean) ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
