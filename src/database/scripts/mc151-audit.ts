/**
 * MC1.5.1 — Auditoría de solo lectura:
 * - Ranking default Camilo (personId=1, evaluation PA2)
 * - Simulaciones A/B/C sin persistir
 * - Perfil documento 1015482688
 *
 * npx ts-node -r tsconfig-paths/register src/database/scripts/mc151-audit.ts
 *
 * No escribe en BD. No modifica PA2 ni frontend.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDefaultMcPa2EngineConfig } from '../../mc-catalog/mc-pa2.config';

const TAG = '[MC1.5.1 Audit]';
const DIAG = {
  personId: '1',
  extractionId: '206',
  evaluationId: '1',
  domain: 'SOFTWARE',
  rulesVersion: 'pa2-software-1.0.0',
  newDocument: '1015482688',
};

type SkillBreakdown = {
  skillId: string;
  skillKey?: string;
  skillName: string;
  skillType?: string;
  mappingWeight: number;
  mappingType: 'PRIMARY' | 'SECONDARY' | string;
  evidenceLevel: string;
  evidenceStrength: number;
  evidenceConfidence: number;
  strengthContribution: number;
  confidenceContribution: number | null;
  evidenced: boolean;
};

type SpecialtyRow = {
  specialty_code: string;
  specialty_name: string;
  presentation_status: string;
  mapped_skill_count: number;
  evidenced_skill_count: number;
  coverage: number;
  confidence: number;
  strength: number;
  rank: number;
  is_default: boolean;
  ranking_score: number;
  skill_breakdown: SkillBreakdown[];
};

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function primaryStrongCount(breakdown: SkillBreakdown[]): number {
  return breakdown.filter(
    (b) => b.mappingType === 'PRIMARY' && b.evidenceLevel === 'STRONG',
  ).length;
}

function decomposeScore(s: {
  coverage: number;
  strength: number;
  confidence: number;
  evidencedSkillCount: number;
  mappedSkillCount: number;
  primaryStrongCount: number;
  weights?: ReturnType<typeof getDefaultMcPa2EngineConfig>['ranking'];
}) {
  const w = s.weights ?? getDefaultMcPa2EngineConfig().ranking;
  const coverageComponent = round4(s.coverage * w.coverageWeight);
  const strengthComponent = round4(s.strength * w.strengthWeight);
  const confidenceComponent = round4(s.confidence * w.confidenceWeight);
  const evidencedSkillCountComponent = round4(
    s.evidencedSkillCount * w.evidencedCountWeight,
  );
  const mappedSkillCountComponent = round4(
    s.mappedSkillCount * w.mappedCountWeight,
  );
  const primaryStrongCountComponent = round4(
    s.primaryStrongCount * w.primaryStrongCountWeight,
  );
  const scoreFinal = round4(
    coverageComponent +
      strengthComponent +
      confidenceComponent +
      evidencedSkillCountComponent +
      mappedSkillCountComponent +
      primaryStrongCountComponent,
  );
  return {
    coverageComponent,
    strengthComponent,
    confidenceComponent,
    evidencedSkillCountComponent,
    mappedSkillCountComponent,
    primaryStrongCountComponent,
    bonusOrPenalty: 0,
    scoreFinal,
    weights: w,
    inputs: {
      coverage: s.coverage,
      strength: s.strength,
      confidence: s.confidence,
      evidencedSkillCount: s.evidencedSkillCount,
      mappedSkillCount: s.mappedSkillCount,
      primaryStrongCount: s.primaryStrongCount,
    },
  };
}

function scoreWithWeights(
  s: {
    coverage: number;
    strength: number;
    confidence: number;
    evidencedSkillCount: number;
    mappedSkillCount: number;
    primaryStrongCount: number;
  },
  w: ReturnType<typeof getDefaultMcPa2EngineConfig>['ranking'],
): number {
  return (
    s.coverage * w.coverageWeight +
    s.strength * w.strengthWeight +
    s.confidence * w.confidenceWeight +
    s.evidencedSkillCount * w.evidencedCountWeight +
    s.mappedSkillCount * w.mappedCountWeight +
    s.primaryStrongCount * w.primaryStrongCountWeight
  );
}

type SpecMetric = {
  code: string;
  name: string;
  status: string;
  coverage: number;
  strength: number;
  confidence: number;
  evidencedSkillCount: number;
  mappedSkillCount: number;
  primaryStrongCount: number;
  rankingScore: number;
  isDefault: boolean;
  rank: number;
  breakdown: SkillBreakdown[];
};

function rankLexicographic(active: SpecMetric[]): SpecMetric[] {
  return [...active].sort((a, b) => {
    if (b.evidencedSkillCount !== a.evidencedSkillCount)
      return b.evidencedSkillCount - a.evidencedSkillCount;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    if (b.strength !== a.strength) return b.strength - a.strength;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    if (b.primaryStrongCount !== a.primaryStrongCount)
      return b.primaryStrongCount - a.primaryStrongCount;
    return a.code.localeCompare(b.code);
  });
}

function rankByScore(
  items: SpecMetric[],
  scoreFn: (s: SpecMetric) => number,
): SpecMetric[] {
  const statusOrder: Record<string, number> = {
    ACTIVE: 0,
    EMERGENT: 1,
    HIDDEN: 2,
  };
  return [...items]
    .map((s) => ({ ...s, rankingScore: round4(scoreFn(s)) }))
    .sort((a, b) => {
      const so =
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
      if (so !== 0) return so;
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return a.code.localeCompare(b.code);
    })
    .map((s, idx) => ({
      ...s,
      rank: idx + 1,
      isDefault: false,
    }));
}

function applyDefault(sorted: SpecMetric[]): {
  ranking: SpecMetric[];
  defaultCode: string | null;
} {
  const out = sorted.map((s) => ({ ...s, isDefault: false }));
  const firstActive = out.find((s) => s.status === 'ACTIVE');
  if (firstActive) firstActive.isDefault = true;
  return {
    ranking: out,
    defaultCode: firstActive?.code ?? null,
  };
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const ds = app.get(DataSource);
  const outDir = resolve(process.cwd(), 'tmp', 'cv-attributes');
  mkdirSync(outDir, { recursive: true });

  // ─── Parte A/B: Camilo ───────────────────────────────────────────
  const evalRows = await ds.query(
    `SELECT id::text, person_id::text, extraction_id::text, domain_code,
            engine_rules_version, default_specialty_code, status, is_active,
            completed_at, active_count, emergent_count
       FROM organigrama.mc_profile_evaluation
      WHERE id = $1 OR (person_id = $2 AND domain_code = $3 AND is_active = TRUE)
      ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END
      LIMIT 5`,
    [DIAG.evaluationId, DIAG.personId, DIAG.domain],
  );

  let specialtyRows: SpecialtyRow[] = await ds.query(
    `SELECT msr.specialty_code,
            COALESCE(ms.name, msr.specialty_code) AS specialty_name,
            msr.presentation_status,
            msr.mapped_skill_count,
            msr.evidenced_skill_count,
            msr.coverage::float8 AS coverage,
            msr.confidence::float8 AS confidence,
            msr.strength::float8 AS strength,
            msr.rank,
            msr.is_default,
            msr.ranking_score::float8 AS ranking_score,
            msr.skill_breakdown
       FROM organigrama.mc_profile_specialty_result msr
       LEFT JOIN organigrama.mc_specialty ms
         ON ms.code = msr.specialty_code
      WHERE msr.profile_evaluation_id = $1
      ORDER BY msr.rank`,
    [DIAG.evaluationId],
  );

  // Fallback artefacto dry-run si DB sin breakdown
  const artifactPath = resolve(
    outDir,
    'mc1.3.3-camilo-pa2-evaluation.json',
  );
  if (
    (!specialtyRows.length ||
      !specialtyRows[0]?.skill_breakdown?.length) &&
    existsSync(artifactPath)
  ) {
    const art = JSON.parse(readFileSync(artifactPath, 'utf8'));
    specialtyRows = (art.specialties ?? []).map(
      (s: Record<string, unknown>, idx: number) => ({
        specialty_code: String(s.specialtyCode),
        specialty_name: String(s.specialtyCode),
        presentation_status: String(s.presentationStatus),
        mapped_skill_count: Number(s.mappedSkillCount),
        evidenced_skill_count: Number(s.evidencedSkillCount),
        coverage: Number(s.coverage),
        confidence: Number(s.confidence),
        strength: Number(s.strength),
        rank: Number(s.rank ?? idx + 1),
        is_default: Boolean(s.isDefault),
        ranking_score: 0,
        skill_breakdown: (s.skillBreakdown as SkillBreakdown[]) ?? [],
      }),
    );
  }

  const specs: SpecMetric[] = specialtyRows.map((r) => {
    const breakdown = Array.isArray(r.skill_breakdown)
      ? r.skill_breakdown
      : typeof r.skill_breakdown === 'string'
        ? (JSON.parse(r.skill_breakdown) as SkillBreakdown[])
        : [];
    const psc = primaryStrongCount(breakdown);
    const decomp = decomposeScore({
      coverage: Number(r.coverage),
      strength: Number(r.strength),
      confidence: Number(r.confidence),
      evidencedSkillCount: Number(r.evidenced_skill_count),
      mappedSkillCount: Number(r.mapped_skill_count),
      primaryStrongCount: psc,
    });
    return {
      code: r.specialty_code,
      name: r.specialty_name,
      status: r.presentation_status,
      coverage: Number(r.coverage),
      strength: Number(r.strength),
      confidence: Number(r.confidence),
      evidencedSkillCount: Number(r.evidenced_skill_count),
      mappedSkillCount: Number(r.mapped_skill_count),
      primaryStrongCount: psc,
      rankingScore: decomp.scoreFinal,
      isDefault: Boolean(r.is_default),
      rank: Number(r.rank),
      breakdown,
    };
  });

  const fe = specs.find((s) => s.code === 'SOFTWARE_FRONTEND');
  const be = specs.find((s) => s.code === 'SOFTWARE_BACKEND');
  if (!fe || !be) {
    throw new Error('No se encontraron Frontend/Backend en la evaluación');
  }

  const feDecomp = decomposeScore({
    coverage: fe.coverage,
    strength: fe.strength,
    confidence: fe.confidence,
    evidencedSkillCount: fe.evidencedSkillCount,
    mappedSkillCount: fe.mappedSkillCount,
    primaryStrongCount: fe.primaryStrongCount,
  });
  const beDecomp = decomposeScore({
    coverage: be.coverage,
    strength: be.strength,
    confidence: be.confidence,
    evidencedSkillCount: be.evidencedSkillCount,
    mappedSkillCount: be.mappedSkillCount,
    primaryStrongCount: be.primaryStrongCount,
  });

  const componentTable = {
    Coverage: {
      Frontend: feDecomp.coverageComponent,
      Backend: beDecomp.coverageComponent,
      Diff: round4(feDecomp.coverageComponent - beDecomp.coverageComponent),
      rawFrontend: fe.coverage,
      rawBackend: be.coverage,
    },
    Strength: {
      Frontend: feDecomp.strengthComponent,
      Backend: beDecomp.strengthComponent,
      Diff: round4(feDecomp.strengthComponent - beDecomp.strengthComponent),
      rawFrontend: fe.strength,
      rawBackend: be.strength,
    },
    Confidence: {
      Frontend: feDecomp.confidenceComponent,
      Backend: beDecomp.confidenceComponent,
      Diff: round4(feDecomp.confidenceComponent - beDecomp.confidenceComponent),
      rawFrontend: fe.confidence,
      rawBackend: be.confidence,
    },
    EvidencedCardinality: {
      Frontend: feDecomp.evidencedSkillCountComponent,
      Backend: beDecomp.evidencedSkillCountComponent,
      Diff: round4(
        feDecomp.evidencedSkillCountComponent -
          beDecomp.evidencedSkillCountComponent,
      ),
      rawFrontend: fe.evidencedSkillCount,
      rawBackend: be.evidencedSkillCount,
    },
    MappedCardinality: {
      Frontend: feDecomp.mappedSkillCountComponent,
      Backend: beDecomp.mappedSkillCountComponent,
      Diff: round4(
        feDecomp.mappedSkillCountComponent - beDecomp.mappedSkillCountComponent,
      ),
      rawFrontend: fe.mappedSkillCount,
      rawBackend: be.mappedSkillCount,
    },
    PrimaryStrong: {
      Frontend: feDecomp.primaryStrongCountComponent,
      Backend: beDecomp.primaryStrongCountComponent,
      Diff: round4(
        feDecomp.primaryStrongCountComponent -
          beDecomp.primaryStrongCountComponent,
      ),
      rawFrontend: fe.primaryStrongCount,
      rawBackend: be.primaryStrongCount,
    },
    ScoreFinal: {
      Frontend: feDecomp.scoreFinal,
      Backend: beDecomp.scoreFinal,
      Diff: round4(feDecomp.scoreFinal - beDecomp.scoreFinal),
    },
  };

  const annotate = (b: SkillBreakdown) => ({
    skill: b.skillName,
    skillKey: b.skillKey ?? null,
    mappingRole: b.mappingType,
    mappingWeight: b.mappingWeight,
    evidenceLevel: b.evidenceLevel,
    evidenceStrength: b.evidenceStrength,
    evidenceConfidence: b.evidenceConfidence,
    strengthContribution: b.strengthContribution,
    countsForPrimaryStrong:
      b.mappingType === 'PRIMARY' && b.evidenceLevel === 'STRONG',
    evidenced: b.evidenced,
  });

  const feKeys = new Set(fe.breakdown.map((b) => b.skillName.toLowerCase()));
  const beKeys = new Set(be.breakdown.map((b) => b.skillName.toLowerCase()));
  const dualNames = [...feKeys].filter((k) => beKeys.has(k));
  const exclusiveFe = fe.breakdown.filter(
    (b) => !beKeys.has(b.skillName.toLowerCase()),
  );
  const exclusiveBe = be.breakdown.filter(
    (b) => !feKeys.has(b.skillName.toLowerCase()),
  );
  const dualSkills = dualNames.map((name) => {
    const f = fe.breakdown.find((b) => b.skillName.toLowerCase() === name)!;
    const b = be.breakdown.find((x) => x.skillName.toLowerCase() === name)!;
    return {
      skill: f.skillName,
      frontend: annotate(f),
      backend: annotate(b),
    };
  });

  // ─── Simulaciones ────────────────────────────────────────────────
  const baseW = getDefaultMcPa2EngineConfig().ranking;

  // Escenario actual
  const currentRanked = applyDefault(
    rankByScore(specs, (s) =>
      scoreWithWeights(
        {
          coverage: s.coverage,
          strength: s.strength,
          confidence: s.confidence,
          evidencedSkillCount: s.evidencedSkillCount,
          mappedSkillCount: s.mappedSkillCount,
          primaryStrongCount: s.primaryStrongCount,
        },
        baseW,
      ),
    ),
  );

  // Escenario A — lexicográfico entre ACTIVE, resto por status
  const activeSorted = rankLexicographic(
    specs.filter((s) => s.status === 'ACTIVE'),
  );
  const restA = specs
    .filter((s) => s.status !== 'ACTIVE')
    .sort((a, b) => {
      if (a.status !== b.status)
        return a.status === 'EMERGENT' ? -1 : 1;
      return a.code.localeCompare(b.code);
    });
  const scenarioAList = [...activeSorted, ...restA].map((s, idx) => ({
    ...s,
    rank: idx + 1,
    isDefault: false,
    rankingScore: s.rankingScore,
  }));
  const scenarioA = applyDefault(scenarioAList);

  // Escenario B — primaryStrong solo desempate (weight 0.5)
  const wB = { ...baseW, primaryStrongCountWeight: 0.5 };
  const scenarioB = applyDefault(
    rankByScore(specs, (s) =>
      scoreWithWeights(
        {
          coverage: s.coverage,
          strength: s.strength,
          confidence: s.confidence,
          evidencedSkillCount: s.evidencedSkillCount,
          mappedSkillCount: s.mappedSkillCount,
          primaryStrongCount: s.primaryStrongCount,
        },
        wB,
      ),
    ),
  );

  // Escenario C — score normalizado (sin nueva métrica de producto)
  // max strength among specs for normalization
  const maxStr = Math.max(...specs.map((s) => s.strength), 1);
  const maxEvid = Math.max(...specs.map((s) => s.evidencedSkillCount), 1);
  const maxPrimary = Math.max(...specs.map((s) => s.primaryStrongCount), 1);
  const scenarioC = applyDefault(
    rankByScore(specs, (s) => {
      const coverageN = s.coverage; // already 0-1
      const strengthN = s.strength / maxStr;
      const confidenceN = s.confidence;
      const evidenceMassN = s.evidencedSkillCount / maxEvid;
      const primaryN = s.primaryStrongCount / maxPrimary;
      // equal-ish weights for auditability; primary as light tie-break
      return (
        coverageN * 30 +
        strengthN * 30 +
        confidenceN * 20 +
        evidenceMassN * 15 +
        primaryN * 5
      );
    }),
  );

  const primaryStrongAnalysis = {
    definition:
      'mappingType === PRIMARY AND evidenceLevel === STRONG (hardcoded en motor)',
    thresholdSource: 'evidenceLevel STRONG proviene del Evidence Engine; el filtro PRIMARY+STRONG está hardcodeado en mc-pa2.engine.ts',
    weightInRanking: baseW.primaryStrongCountWeight,
    weightMeaning: `+${baseW.primaryStrongCountWeight} puntos por cada skill PRIMARY+STRONG`,
    frontendCount: fe.primaryStrongCount,
    backendCount: be.primaryStrongCount,
    frontendContribution: feDecomp.primaryStrongCountComponent,
    backendContribution: beDecomp.primaryStrongCountComponent,
    contributionDiff: round4(
      feDecomp.primaryStrongCountComponent - beDecomp.primaryStrongCountComponent,
    ),
    strengthAdvantageBackend: round4(
      beDecomp.strengthComponent - feDecomp.strengthComponent,
    ),
    confidenceAdvantageBackend: round4(
      beDecomp.confidenceComponent - feDecomp.confidenceComponent,
    ),
    netWithoutPrimaryStrong: round4(
      feDecomp.scoreFinal -
        feDecomp.primaryStrongCountComponent -
        (beDecomp.scoreFinal - beDecomp.primaryStrongCountComponent),
    ),
    classification:
      Math.abs(
        feDecomp.primaryStrongCountComponent -
          beDecomp.primaryStrongCountComponent,
      ) >
      Math.abs(
        beDecomp.strengthComponent -
          feDecomp.strengthComponent +
          (beDecomp.confidenceComponent - feDecomp.confidenceComponent),
      ) *
        2
        ? 'FACTOR_DOMINANTE'
        : 'DESEMPATE_MODERADO',
  };

  const camiloAudit = {
    meta: {
      phase: 'MC1.5.1',
      generatedAt: new Date().toISOString(),
      mode: 'READ_ONLY',
      diagnosticParams: DIAG,
      evaluationFromDb: evalRows[0] ?? null,
      engineRulesVersion: DIAG.rulesVersion,
      note: 'No se modificó PA2 ni se persistió ninguna evaluación nueva.',
    },
    formula: {
      expression:
        'coverage*40 + strength*0.25 + confidence*15 + evidenced*2 + mapped*1 + primaryStrong*12',
      weights: baseW,
      bonusesPenalties: 'ninguno',
    },
    componentTable,
    frontend: { ...fe, decomposition: feDecomp, skills: fe.breakdown.map(annotate) },
    backend: { ...be, decomposition: beDecomp, skills: be.breakdown.map(annotate) },
    skillPartition: {
      exclusiveFrontend: exclusiveFe.map(annotate),
      exclusiveBackend: exclusiveBe.map(annotate),
      dual: dualSkills,
    },
    primaryStrongAnalysis,
    whyFrontendWins:
      feDecomp.scoreFinal > beDecomp.scoreFinal
        ? `Frontend gana por ${round4(feDecomp.scoreFinal - beDecomp.scoreFinal)} puntos. ` +
          `Coverage y cardinalidad empatan. Backend aventaja en Strength (+${primaryStrongAnalysis.strengthAdvantageBackend}) ` +
          `y Confidence (+${primaryStrongAnalysis.confidenceAdvantageBackend}), pero Frontend aporta ` +
          `+${primaryStrongAnalysis.contributionDiff} vía primaryStrongCount ` +
          `(${fe.primaryStrongCount} vs ${be.primaryStrongCount}). ` +
          `Clasificación de la señal: ${primaryStrongAnalysis.classification}.`
        : 'Backend tendría score mayor (inesperado frente a evaluación activa).',
    simulations: {
      current_pa2_software_1_0_0: {
        default: currentRanked.defaultCode,
        ranking: currentRanked.ranking.map((s) => ({
          rank: s.rank,
          code: s.code,
          status: s.status,
          score: s.rankingScore,
          isDefault: s.isDefault,
          primaryStrong: s.primaryStrongCount,
          strength: s.strength,
          confidence: s.confidence,
        })),
      },
      scenarioA_lexicographic: {
        default: scenarioA.defaultCode,
        ranking: scenarioA.ranking.map((s) => ({
          rank: s.rank,
          code: s.code,
          status: s.status,
          isDefault: s.isDefault,
          evidenced: s.evidencedSkillCount,
          coverage: s.coverage,
          strength: s.strength,
          confidence: s.confidence,
          primaryStrong: s.primaryStrongCount,
        })),
        vsCurrent: {
          defaultChanged:
            scenarioA.defaultCode !== currentRanked.defaultCode,
          newDefault: scenarioA.defaultCode,
        },
      },
      scenarioB_primaryStrongAsTieBreak: {
        weights: wB,
        default: scenarioB.defaultCode,
        ranking: scenarioB.ranking.map((s) => ({
          rank: s.rank,
          code: s.code,
          status: s.status,
          score: s.rankingScore,
          isDefault: s.isDefault,
        })),
        vsCurrent: {
          defaultChanged:
            scenarioB.defaultCode !== currentRanked.defaultCode,
          newDefault: scenarioB.defaultCode,
        },
      },
      scenarioC_normalized: {
        default: scenarioC.defaultCode,
        ranking: scenarioC.ranking.map((s) => ({
          rank: s.rank,
          code: s.code,
          status: s.status,
          score: s.rankingScore,
          isDefault: s.isDefault,
        })),
        vsCurrent: {
          defaultChanged:
            scenarioC.defaultCode !== currentRanked.defaultCode,
          newDefault: scenarioC.defaultCode,
        },
      },
    },
    recommendation: {
      option: null as string | null,
      rationale: 'Se completa tras análisis del segundo perfil en el informe markdown.',
      pendingProductDecision: true,
      doNotApplyUntilApproved: true,
    },
  };

  // ─── Parte C–F: documento 1015482688 ─────────────────────────────
  const personHits = await ds.query(
    `SELECT p.id::text,
            p.full_name,
            p.edu_email,
            p.email,
            p.document,
            p.is_active,
            p.role_id::text,
            p.area_id::text,
            p.school_id::text,
            p.program_id::text,
            ro.name AS role_name,
            a.name AS area_name,
            sc.name AS school_name,
            pr.name AS program_name
       FROM core.person p
       LEFT JOIN core.role ro ON ro.id = p.role_id
       LEFT JOIN core.area a ON a.id = p.area_id
       LEFT JOIN core.school sc ON sc.id = p.school_id
       LEFT JOIN core.program pr ON pr.id = p.program_id
      WHERE p.document = $1`,
    [DIAG.newDocument],
  );

  let profileAudit: Record<string, unknown> = {
    meta: {
      phase: 'MC1.5.1',
      generatedAt: new Date().toISOString(),
      document: DIAG.newDocument,
      mode: 'READ_ONLY',
    },
    identity: {
      matchCount: personHits.length,
      unique: personHits.length === 1,
    },
  };

  if (personHits.length !== 1) {
    profileAudit.identity = {
      matchCount: personHits.length,
      unique: false,
      abort: true,
      reason:
        personHits.length === 0
          ? 'ZERO_MATCHES'
          : 'MULTIPLE_MATCHES',
      ids: personHits.map((p: { id: string }) => p.id),
    };
  } else {
    const p = personHits[0];
    const personId = p.id as string;

    const bossRows = await ds.query(
      `SELECT parent.full_name AS boss_name, parent.id::text AS boss_id,
              ro.name AS boss_role
         FROM organigrama.org_chart_version v
         JOIN organigrama.org_visual_relation r
           ON r.version_id = v.id AND r.is_active = TRUE
         JOIN core.person parent ON parent.id = r.parent_person_id
         LEFT JOIN core.role ro ON ro.id = parent.role_id
        WHERE v.is_active = TRUE
          AND r.child_person_id = $1
        LIMIT 3`,
      [personId],
    );

    const inOrg = await ds.query(
      `SELECT COUNT(*)::int AS cnt
         FROM organigrama.org_chart_version v
         JOIN organigrama.org_visual_relation r
           ON r.version_id = v.id AND r.is_active = TRUE
        WHERE v.is_active = TRUE
          AND (r.child_person_id = $1 OR r.parent_person_id = $1)`,
      [personId],
    );

    const cvs = await ds.query(
      `SELECT id::text, document, drive_file_name, drive_file_id, is_active,
              synced_at, created_at, mime_type, drive_modified_time
         FROM organigrama.person_cv
        WHERE person_id = $1
        ORDER BY is_active DESC, synced_at DESC NULLS LAST, created_at DESC`,
      [personId],
    );

    const extractions = await ds.query(
      `SELECT e.id::text, e.status, e.is_active, e.person_cv_id::text,
              e.started_at, e.finished_at, e.error_message,
              (SELECT COUNT(*)::int FROM organigrama.cv_extraction_skill s
                WHERE s.extraction_id = e.id) AS skill_count
         FROM organigrama.cv_extraction e
        WHERE e.person_id = $1
        ORDER BY e.started_at DESC`,
      [personId],
    );

    const enrichments = await ds.query(
      `SELECT en.id::text, en.status, en.is_active, en.extraction_id::text,
              en.created_at, en.completed_at
         FROM organigrama.cv_skill_enrichment en
         JOIN organigrama.cv_extraction e ON e.id = en.extraction_id
        WHERE e.person_id = $1
        ORDER BY en.created_at DESC`,
      [personId],
    );

    const evidences = await ds.query(
      `SELECT ev.id::text, ev.status, ev.is_active, ev.enrichment_id::text,
              ev.created_at, ev.completed_at
         FROM organigrama.cv_evidence_evaluation ev
         JOIN organigrama.cv_skill_enrichment en ON en.id = ev.enrichment_id
         JOIN organigrama.cv_extraction e ON e.id = en.extraction_id
        WHERE e.person_id = $1
        ORDER BY ev.created_at DESC`,
      [personId],
    );

    const pa2 = await ds.query(
      `SELECT id::text, status, is_active, domain_code, engine_rules_version,
              default_specialty_code, extraction_id::text, completed_at
         FROM organigrama.mc_profile_evaluation
        WHERE person_id = $1
        ORDER BY completed_at DESC NULLS LAST`,
      [personId],
    );

    // Skills from best SUCCEEDED active extraction if any
    const activeExt =
      extractions.find(
        (e: { status: string; is_active: boolean }) =>
          e.status === 'SUCCEEDED' && e.is_active,
      ) ??
      extractions.find((e: { status: string }) => e.status === 'SUCCEEDED');

    let skillsSummary: Record<string, unknown> | null = null;
    let skillNames: string[] = [];
    if (activeExt) {
      const skillRows = await ds.query(
        `SELECT ces.original_name AS name,
                ces.category,
                cs.normalized_name,
                cs.skill_type AS type,
                cs.normalized_key AS canonical_key
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.cv_skill cs ON cs.id = ces.skill_id
          WHERE ces.extraction_id = $1
          ORDER BY ces.original_name`,
        [activeExt.id],
      );
      skillNames = skillRows.map(
        (s: { name: string; normalized_name?: string }) =>
          s.normalized_name || s.name,
      );
      const byType: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      for (const s of skillRows) {
        const t = String(s.type ?? 'UNKNOWN');
        byType[t] = (byType[t] ?? 0) + 1;
        const c = String(s.category ?? 'UNKNOWN');
        byCategory[c] = (byCategory[c] ?? 0) + 1;
      }

      const mapHits = await ds.query(
        `SELECT COUNT(DISTINCT m.id)::int AS mapping_rows,
                COUNT(DISTINCT sp.code)::int AS specialty_codes,
                COUNT(DISTINCT ces.skill_id)::int AS catalog_skills_matched
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.mc_skill_specialty_mapping m
             ON m.skill_id = ces.skill_id AND m.is_active = TRUE
           JOIN organigrama.mc_specialty sp ON sp.id = m.specialty_id
           JOIN organigrama.mc_domain d
             ON d.id = sp.domain_id AND d.code = 'SOFTWARE'
          WHERE ces.extraction_id = $1`,
        [activeExt.id],
      );

      const classHits = await ds.query(
        `SELECT c.classification, COUNT(*)::int AS cnt
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.mc_skill_domain_classification c
             ON c.skill_id = ces.skill_id AND c.is_active = TRUE
           JOIN organigrama.mc_domain d
             ON d.id = c.domain_id AND d.code = 'SOFTWARE'
          WHERE ces.extraction_id = $1
          GROUP BY c.classification
          ORDER BY cnt DESC`,
        [activeExt.id],
      );

      const mappedSkillNames = await ds.query(
        `SELECT DISTINCT cs.normalized_name, sp.code AS specialty_code, m.mapping_type
           FROM organigrama.cv_extraction_skill ces
           JOIN organigrama.cv_skill cs ON cs.id = ces.skill_id
           JOIN organigrama.mc_skill_specialty_mapping m
             ON m.skill_id = ces.skill_id AND m.is_active = TRUE
           JOIN organigrama.mc_specialty sp ON sp.id = m.specialty_id
           JOIN organigrama.mc_domain d
             ON d.id = sp.domain_id AND d.code = 'SOFTWARE'
          WHERE ces.extraction_id = $1
          ORDER BY cs.normalized_name, sp.code`,
        [activeExt.id],
      );

      const langs = await ds.query(
        `SELECT name, level
           FROM organigrama.cv_extraction_language
          WHERE extraction_id = $1`,
        [activeExt.id],
      ).catch(() => []);

      const certs = await ds.query(
        `SELECT name
           FROM organigrama.cv_extraction_certification
          WHERE extraction_id = $1`,
        [activeExt.id],
      ).catch(() => []);

      skillsSummary = {
        extractionId: activeExt.id,
        totalSkills: skillRows.length,
        byType,
        byCategory,
        languages: langs,
        certifications: certs,
        softwareMappingProbe: {
          catalogJoin: mapHits[0] ?? null,
          classifications: classHits,
          mappedSkills: mappedSkillNames,
        },
        sampleSkills: skillNames.slice(0, 60),
        allSkills: skillNames,
      };
    }

    const activeCv = cvs.find((c: { is_active: boolean }) => c.is_active);
    const activeCvCount = cvs.filter(
      (c: { is_active: boolean }) => c.is_active,
    ).length;

    // Domain classification heuristic (skills-based, not role-based)
    const softKeywords = [
      'javascript',
      'typescript',
      'react',
      'angular',
      'node',
      'java',
      'python',
      'sql',
      'docker',
      'kubernetes',
      'api',
      'spring',
      'nestjs',
      'git',
      '.net',
      'aws',
      'azure',
      'frontend',
      'backend',
      'html',
      'css',
    ];
    const namesLower = skillNames.map((n) => n.toLowerCase());
    const softHits = softKeywords.filter((k) =>
      namesLower.some((n) => n.includes(k)),
    );
    const mapCount = Number(
      (skillsSummary as { softwareMappingProbe?: { catalogJoin?: { mapping_rows?: number } } })
        ?.softwareMappingProbe?.catalogJoin?.mapping_rows ?? 0,
    );
    const specialtyHits = Number(
      (skillsSummary as { softwareMappingProbe?: { catalogJoin?: { specialty_codes?: number } } })
        ?.softwareMappingProbe?.catalogJoin?.specialty_codes ?? 0,
    );
    const totalSkills = Number(
      (skillsSummary as { totalSkills?: number })?.totalSkills ?? 0,
    );

    let domainRelation:
      | 'SOFTWARE_APPLICABLE'
      | 'SOFTWARE_PARTIAL'
      | 'SOFTWARE_NOT_APPLICABLE'
      | 'DOMAIN_DISCOVERY_REQUIRED'
      | 'INSUFFICIENT_EVIDENCE' = 'INSUFFICIENT_EVIDENCE';

    if (!activeExt || totalSkills === 0) {
      domainRelation = 'INSUFFICIENT_EVIDENCE';
    } else if (specialtyHits >= 4 && mapCount >= 8) {
      domainRelation = 'SOFTWARE_APPLICABLE';
    } else if (specialtyHits >= 2 || softHits.length >= 3) {
      domainRelation = 'SOFTWARE_PARTIAL';
    } else if (softHits.length === 0 && mapCount === 0 && totalSkills >= 5) {
      domainRelation = 'DOMAIN_DISCOVERY_REQUIRED';
    } else if (softHits.length <= 1 && mapCount <= 2) {
      domainRelation =
        totalSkills >= 5
          ? 'DOMAIN_DISCOVERY_REQUIRED'
          : 'SOFTWARE_NOT_APPLICABLE';
    } else {
      domainRelation = 'SOFTWARE_PARTIAL';
    }

    profileAudit = {
      ...profileAudit,
      identity: {
        matchCount: 1,
        unique: true,
        personId,
        fullName: p.full_name,
        eduEmail: p.edu_email ?? null,
        // email personal omitted from summary unless needed
        document: p.document,
        isActive: p.is_active,
        role: p.role_name ?? null,
        area: p.area_name ?? null,
        school: p.school_name ?? null,
        program: p.program_name ?? null,
        immediateBoss: bossRows[0]
          ? {
              id: bossRows[0].boss_id,
              name: bossRows[0].boss_name,
              role: bossRows[0].boss_role,
            }
          : null,
        inActiveOrgChart: Number(inOrg[0]?.cnt ?? 0) > 0,
        orgRelationCount: Number(inOrg[0]?.cnt ?? 0),
      },
      personCv: {
        rows: cvs.map((c: Record<string, unknown>) => ({
          id: c.id,
          fileName: c.drive_file_name,
          driveFileId: c.drive_file_id ? '(present)' : null,
          isActive: c.is_active,
          syncedAt: c.synced_at,
          documentOnCv: c.document ?? null,
          mimeType: c.mime_type ?? null,
          driveModifiedTime: c.drive_modified_time ?? null,
        })),
        activeCount: activeCvCount,
        hasActiveCv: Boolean(activeCv),
        activePersonCvId: activeCv?.id ?? null,
        documentMatches:
          !activeCv?.document ||
          String(activeCv.document) === DIAG.newDocument ||
          String(activeCv.drive_file_name ?? '').includes(DIAG.newDocument),
      },
      pipeline: {
        cv: {
          exists: cvs.length > 0,
          status: activeCv ? 'ACTIVE_CV' : cvs.length ? 'INACTIVE_ONLY' : 'NONE',
          active: Boolean(activeCv),
          id: activeCv?.id ?? null,
        },
        extraction: {
          exists: extractions.length > 0,
          status: activeExt?.status ?? extractions[0]?.status ?? null,
          active: Boolean(activeExt?.is_active),
          id: activeExt?.id ?? null,
          all: extractions.map((e: Record<string, unknown>) => ({
            id: e.id,
            status: e.status,
            active: e.is_active,
            skillCount: e.skill_count,
            error: e.error_message ?? null,
          })),
        },
        enrichment: {
          exists: enrichments.length > 0,
          status: enrichments[0]?.status ?? null,
          active: Boolean(enrichments.find((e: { is_active: boolean }) => e.is_active)),
          id:
            enrichments.find((e: { is_active: boolean }) => e.is_active)?.id ??
            enrichments[0]?.id ??
            null,
          all: enrichments,
        },
        evidenceEvaluation: {
          exists: evidences.length > 0,
          status: evidences[0]?.status ?? null,
          active: Boolean(evidences.find((e: { is_active: boolean }) => e.is_active)),
          id:
            evidences.find((e: { is_active: boolean }) => e.is_active)?.id ??
            evidences[0]?.id ??
            null,
          all: evidences,
        },
        pa2: {
          exists: pa2.length > 0,
          status: pa2[0]?.status ?? null,
          active: Boolean(pa2.find((e: { is_active: boolean }) => e.is_active)),
          id: pa2.find((e: { is_active: boolean }) => e.is_active)?.id ?? pa2[0]?.id ?? null,
          all: pa2,
        },
      },
      skillsSummary,
      softwareKeywordHits: softHits,
      domainRelation,
      processingRecommendation: !activeExt
        ? activeCv
          ? 'NEEDS_EXTRACTION_CONFIRMATION'
          : 'NEEDS_CV_FIRST'
        : activeExt.status === 'FAILED'
          ? 'INVESTIGATE_FAILED_EXTRACTION'
          : 'REUSE_EXISTING_EXTRACTION',
      noWritePerformed: true,
    };
  }

  const camiloPath = resolve(outDir, 'mc1.5.1-camilo-ranking-audit.json');
  const profilePath = resolve(outDir, 'mc1.5.1-1015482688-profile-audit.json');
  writeFileSync(camiloPath, JSON.stringify(camiloAudit, null, 2), 'utf8');
  writeFileSync(profilePath, JSON.stringify(profileAudit, null, 2), 'utf8');

  console.log(TAG, 'Camilo score FE', feDecomp.scoreFinal, 'BE', beDecomp.scoreFinal);
  console.log(TAG, 'primaryStrong', primaryStrongAnalysis);
  console.log(TAG, 'sim defaults', {
    current: currentRanked.defaultCode,
    A: scenarioA.defaultCode,
    B: scenarioB.defaultCode,
    C: scenarioC.defaultCode,
  });
  console.log(TAG, 'profile', {
    matches: personHits.length,
    domainRelation: (profileAudit as { domainRelation?: string }).domainRelation,
    processing: (profileAudit as { processingRecommendation?: string })
      .processingRecommendation,
  });
  console.log(TAG, 'Wrote', camiloPath);
  console.log(TAG, 'Wrote', profilePath);

  await app.close();
}

main().catch((err) => {
  console.error(TAG, err);
  process.exit(1);
});
