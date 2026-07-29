/**
 * MC1.3.5 — Conteos e integridad post-activación (solo lectura).
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OrgChartCompetenciesService } from '../../org-chart/org-chart-competencies.service';
import { OrgChartVisibilityService } from '../../org-chart/org-chart-visibility.service';
import type { OrgViewerContext } from '../../org-chart/org-viewer-context';

const TAG = '[MC1.3.5 Postcheck]';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const competencies = app.get(OrgChartCompetenciesService);
  const visibility = app.get(OrgChartVisibilityService);

  try {
    const counts = {
      activeCatalogVersions: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_catalog_version WHERE is_active = TRUE`,
        )
      )[0].n,
      softwareDomains: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_domain WHERE code = 'SOFTWARE'`,
        )
      )[0].n,
      softwareSpecialties: (
        await ds.query(
          `SELECT COUNT(*)::int AS n
             FROM organigrama.mc_specialty s
             JOIN organigrama.mc_domain d ON d.id = s.domain_id
            WHERE d.code = 'SOFTWARE'`,
        )
      )[0].n,
      classifications: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_skill_domain_classification WHERE is_active = TRUE`,
        )
      )[0].n,
      byClass: await ds.query(
        `SELECT classification, COUNT(*)::int AS n
           FROM organigrama.mc_skill_domain_classification
          WHERE is_active = TRUE
          GROUP BY classification
          ORDER BY classification`,
      ),
      mappings: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_skill_specialty_mapping WHERE is_active = TRUE`,
        )
      )[0].n,
      dualMappings: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_skill_specialty_mapping
            WHERE is_active = TRUE AND mapping_type = 'SECONDARY'`,
        )
      )[0].n,
      camiloEval: await ds.query(
        `SELECT id::text, status, is_active, extraction_id::text, default_specialty_code,
                active_count, emergent_count, hidden_count, engine_rules_version,
                person_id::text
           FROM organigrama.mc_profile_evaluation
          WHERE extraction_id = 206 AND is_active = TRUE`,
      ),
      specialtyResults: await ds.query(
        `SELECT specialty_code, presentation_status, is_default, rank,
                mapped_skill_count, evidenced_skill_count,
                coverage::float8 AS coverage, confidence::float8 AS confidence,
                strength::float8 AS strength
           FROM organigrama.mc_profile_specialty_result r
           JOIN organigrama.mc_profile_evaluation e ON e.id = r.profile_evaluation_id
          WHERE e.extraction_id = 206 AND e.is_active = TRUE
          ORDER BY r.rank`,
      ),
    };

    const anomalies = {
      brokenFkClassSkill: (
        await ds.query(
          `SELECT COUNT(*)::int AS n
             FROM organigrama.mc_skill_domain_classification c
             LEFT JOIN organigrama.cv_skill s ON s.id = c.skill_id
            WHERE s.id IS NULL`,
        )
      )[0].n,
      invalidWeights: (
        await ds.query(
          `SELECT COUNT(*)::int AS n
             FROM organigrama.mc_skill_specialty_mapping
            WHERE weight <= 0 OR weight > 1`,
        )
      )[0].n,
      duplicateClassifications: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM (
             SELECT catalog_version_id, domain_id, skill_id, COUNT(*)
               FROM organigrama.mc_skill_domain_classification
              GROUP BY 1,2,3 HAVING COUNT(*) > 1
           ) t`,
        )
      )[0].n,
      softSkillMappings: (
        await ds.query(
          `SELECT COUNT(*)::int AS n
             FROM organigrama.mc_skill_specialty_mapping m
             JOIN organigrama.cv_skill s ON s.id = m.skill_id
            WHERE s.skill_type = 'SOFT_SKILL' AND m.is_active = TRUE`,
        )
      )[0].n,
      duplicateActiveEvals: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM (
             SELECT person_id, domain_code, COUNT(*)
               FROM organigrama.mc_profile_evaluation
              WHERE is_active = TRUE
              GROUP BY 1,2 HAVING COUNT(*) > 1
           ) t`,
        )
      )[0].n,
      architectureSpecialty: (
        await ds.query(
          `SELECT COUNT(*)::int AS n FROM organigrama.mc_specialty
            WHERE code ILIKE '%ARCHITECT%' OR name ILIKE '%Arquitectura%'`,
        )
      )[0].n,
    };

    const personId = counts.camiloEval[0]?.person_id ?? '1';
    const selfViewer: OrgViewerContext = {
      personId,
      eduEmail: 'camilo@cun.edu.co',
      permissions: [],
    };
    const adminViewer: OrgViewerContext = {
      personId: '999999',
      eduEmail: 'admin@cun.edu.co',
      permissions: ['ORG_READ_ALL'],
    };
    const strangerViewer: OrgViewerContext = {
      personId: '999998',
      eduEmail: 'stranger@cun.edu.co',
      permissions: [],
    };

    const summary = await competencies.getExplorerSummary(
      selfViewer,
      personId,
      '0',
    );
    const domain = await competencies.getDomainDetail(
      adminViewer,
      personId,
      'SOFTWARE',
      '0',
    );
    const frontend = await competencies.getSpecialtyDetail(
      adminViewer,
      personId,
      'SOFTWARE',
      'SOFTWARE_FRONTEND',
      '0',
      { includeAudit: true },
    );

    let strangerDenied = false;
    try {
      await competencies.getExplorerSummary(strangerViewer, personId, '0', {
        includeAudit: true,
        includeHidden: true,
      });
    } catch (e: unknown) {
      const code =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { code?: string } }).response?.code
          : undefined;
      strangerDenied = code === 'COMPETENCY_ACCESS_DENIED';
    }

    const canSelf = await visibility.canViewFullProfile(
      selfViewer,
      personId,
      '0',
    );
    const canStranger = await visibility.canViewFullProfile(
      strangerViewer,
      personId,
      '0',
    );

    const evidenceTexts = frontend.skills.flatMap((s) =>
      s.evidence.items.map((i) => i.text),
    );
    const evidenceOk = evidenceTexts.every((t) => t.length <= 401);

    const report = {
      phase: 'MC1.3.5',
      step: 'postcheck',
      at: new Date().toISOString(),
      counts,
      anomalies,
      api: {
        personId,
        summary: {
          availabilityStatus: summary.availabilityStatus,
          defaultSpecialtyCode: summary.domains[0]?.defaultSpecialtyCode,
          activeSpecialtyCount: summary.domains[0]?.activeSpecialtyCount,
          emergentSpecialtyCount: summary.domains[0]?.emergentSpecialtyCount,
          specialtyStatuses: summary.domains[0]?.specialties.map((s) => ({
            code: s.code,
            status: s.presentationStatus,
            rank: s.rank,
            isDefault: s.isDefault,
          })),
          hasEvidenceInSummary: JSON.stringify(summary).includes('"evidence"'),
      hasEvidenceItemsInSummary: JSON.stringify(summary).includes(
        'evidence.items',
      ),
        },
        domain: {
          specialtyCount: domain.specialties.length,
          ranks: domain.specialties.map((s) => s.rank),
        },
        frontend: {
          code: frontend.code,
          presentationStatus: frontend.presentationStatus,
          isDefault: frontend.isDefault,
          rank: frontend.rank,
          metrics: frontend.metrics,
          skillCount: frontend.skills.length,
          sampleEvidenceLen: evidenceTexts[0]?.length ?? 0,
          evidenceTruncatedOk: evidenceOk,
          auditExtractionId: frontend.evaluation.audit?.extractionId,
        },
      },
      security: {
        canSelf,
        canStranger,
        strangerDenied,
        includeAuditHiddenStillDenied: strangerDenied,
      },
      checks: {
        countsMatch:
          counts.activeCatalogVersions === 1 &&
          counts.softwareDomains === 1 &&
          counts.softwareSpecialties === 7 &&
          counts.classifications === 59 &&
          counts.camiloEval.length === 1 &&
          counts.specialtyResults.length === 7 &&
          counts.specialtyResults.filter(
            (r: { presentation_status: string }) =>
              r.presentation_status === 'ACTIVE',
          ).length === 5 &&
          counts.specialtyResults.filter(
            (r: { presentation_status: string }) =>
              r.presentation_status === 'EMERGENT',
          ).length === 2 &&
          counts.specialtyResults.filter(
            (r: { is_default: boolean }) => r.is_default,
          ).length === 1,
        anomaliesClean: Object.values(anomalies).every((n) => n === 0),
        apiAvailable: summary.availabilityStatus === 'AVAILABLE',
        frontendDefault:
          frontend.isDefault &&
          frontend.presentationStatus === 'ACTIVE' &&
          frontend.rank === 1,
        securityOk: canSelf && !canStranger && strangerDenied,
      },
    };

    const out = resolve(
      process.cwd(),
      'tmp/cv-attributes/mc1.3.5-cloud-verification.json',
    );
    writeFileSync(out, JSON.stringify(report, null, 2), 'utf8');
    console.log(TAG, JSON.stringify(report, null, 2));
    console.log(TAG, 'written', out);

    const allOk = Object.values(report.checks).every(Boolean);
    process.exit(allOk ? 0 : 5);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  console.error(TAG, e);
  process.exit(1);
});
