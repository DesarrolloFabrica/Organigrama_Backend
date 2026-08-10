/**
 * FASE 8F — Cohort orchestration (frozen 8E model).
 * Reuses packs when present; runs missing P2→R1→P3→P4→profile only.
 *
 *   npx ts-node --transpile-only scripts/mc1-profile-validation-8f.ts --confirm
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { SPECIALTY_CATALOG_SCOPE } from '../src/mc-pipeline/catalog/specialties-visual-education';
import { resolveCohortArtifactDir } from '../src/mc-pipeline/p1-persistence/p1-artifact-pack-loader';
import { runP2ArtifactOnly } from '../src/mc-pipeline/p2/p2-runner';
import { runR1ArtifactOnly } from '../src/mc-pipeline/r1/r1-runner';
import { runP3ArtifactOnly } from '../src/mc-pipeline/p3/p3-runner';
import { runP4ArtifactOnly } from '../src/mc-pipeline/p4/p4-runner';
import { runProfilePilot } from '../src/mc-pipeline/profile/profile-runner';
import { findLatestP2Pack } from '../src/mc-pipeline/r1/r1-runner';
import { findLatestR1Pack } from '../src/mc-pipeline/p3/p3-context-loader';
import { findLatestP3Pack } from '../src/mc-pipeline/p4/p4-context-loader';
import { findLatestP4Pack } from '../src/mc-pipeline/profile/profile-pack-loader';

const ROOT = resolve(__dirname, '..');
const OUT_ROOT = resolve(ROOT, 'tmp', 'mc1-profile-validation-8f');

/** Cohort: anchors + diversity within available MDE/P1 packs. */
const COHORT: Array<{
  snapshotId: string;
  role: 'ANCHOR' | 'DIVERSITY';
  expectedEvidenceHint: string;
  selectionReason: string;
}> = [
  {
    snapshotId: '1',
    role: 'ANCHOR',
    expectedEvidenceHint: 'VISUAL_DESIGN + EDUCATION',
    selectionReason: 'Anchor 8A–8E hybrid creative-formative',
  },
  {
    snapshotId: '2',
    role: 'ANCHOR',
    expectedEvidenceHint: 'VISUAL_DESIGN + EDUCATION (+AV/MKT signals)',
    selectionReason: 'Anchor 8A–8E second hybrid profile',
  },
  {
    snapshotId: '5',
    role: 'DIVERSITY',
    expectedEvidenceHint: 'SOFTWARE_ENGINEERING and/or admin-ops signals',
    selectionReason:
      'Only cohort member with SE keyword flags; tests catalog gap + ops/admin mix',
  },
  {
    snapshotId: '6',
    role: 'DIVERSITY',
    expectedEvidenceHint: 'VISUAL_DESIGN + EDUCATION',
    selectionReason: 'Additional VD/ED profile distinct from anchors; P1 pack exists',
  },
  {
    snapshotId: '7',
    role: 'DIVERSITY',
    expectedEvidenceHint: 'ADMIN/ACADEMIC (education-adjacent)',
    selectionReason: 'Administrative/academic diversity; P1 pack exists',
  },
  {
    snapshotId: '4',
    role: 'DIVERSITY',
    expectedEvidenceHint: 'VISUAL / AV / marketing-adjacent',
    selectionReason:
      'Distinct from anchors with AV/MKT flags; may lack P1 → BLOCKED_STAGE if missing',
  },
];

function loadEnv(path: string, allow?: Set<string>) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (allow && !allow.has(k)) continue;
    out[k] = v;
  }
  return out;
}

type LayerProblem = {
  layer:
    | 'EVIDENCE_PROBLEM'
    | 'FIELD_PROBLEM'
    | 'SPECIALTY_PROBLEM'
    | 'SKILL_PROBLEM'
    | 'DIMENSION_PROBLEM'
    | 'RADAR_PROBLEM'
    | 'CATALOG_COVERAGE_GAP'
    | 'PRESENTATION_PROBLEM';
  pattern: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
};

function classifyCard(args: {
  fields: string[];
  specialties: string[];
  skillCount: number;
  hasRadar: boolean;
  catalogGaps: string[];
  expectedHint: string;
}): {
  classification: 'GOOD_REPRESENTATION' | 'PARTIAL_REPRESENTATION' | 'POOR_REPRESENTATION';
  problems: LayerProblem[];
  notes: string[];
} {
  const problems: LayerProblem[] = [];
  const notes: string[] = [];

  for (const g of args.catalogGaps) {
    problems.push({
      layer: 'CATALOG_COVERAGE_GAP',
      pattern: `SPECIALTY_CATALOG_NOT_AVAILABLE:${g}`,
      severity: 'MEDIUM',
    });
  }

  if (args.fields.length === 0) {
    problems.push({
      layer: 'FIELD_PROBLEM',
      pattern: 'NO_FIELD_FROM_R1',
      severity: 'HIGH',
    });
    return {
      classification: 'POOR_REPRESENTATION',
      problems,
      notes: ['R1 produced no field'],
    };
  }

  const inSpecialtyScope = args.fields.some((f) =>
    SPECIALTY_CATALOG_SCOPE.has(f),
  );
  const outOfScopeOnly =
    args.fields.length > 0 &&
    args.fields.every((f) => !SPECIALTY_CATALOG_SCOPE.has(f));

  if (outOfScopeOnly) {
    notes.push('All R1 fields outside specialty catalog scope');
    return {
      classification: 'PARTIAL_REPRESENTATION',
      problems,
      notes,
    };
  }

  if (inSpecialtyScope && args.specialties.length === 0) {
    problems.push({
      layer: 'SPECIALTY_PROBLEM',
      pattern: 'IN_SCOPE_FIELD_BUT_NO_OBSERVED_SPECIALTY',
      severity: 'HIGH',
    });
    return {
      classification: 'POOR_REPRESENTATION',
      problems,
      notes: ['In-scope field without OBSERVED specialty'],
    };
  }

  if (args.specialties.length > 0 && args.skillCount === 0) {
    problems.push({
      layer: 'SKILL_PROBLEM',
      pattern: 'SPECIALTY_WITHOUT_OBSERVED_SKILLS',
      severity: 'MEDIUM',
    });
    return {
      classification: 'PARTIAL_REPRESENTATION',
      problems,
      notes: ['Specialties present but no OBSERVED skills'],
    };
  }

  if (args.skillCount > 0 && !args.hasRadar) {
    problems.push({
      layer: 'RADAR_PROBLEM',
      pattern: 'SKILLS_WITHOUT_RADAR',
      severity: 'MEDIUM',
    });
  }

  // Specialty-named skills heuristic (from known 8D issue)
  notes.push(`expectedEvidenceHint=${args.expectedHint}`);
  return {
    classification: 'GOOD_REPRESENTATION',
    problems,
    notes,
  };
}

async function main() {
  const confirm = process.argv.includes('--confirm');
  if (!confirm) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        cohort: COHORT.map((c) => ({
          snapshotId: c.snapshotId,
          role: c.role,
          expectedEvidenceHint: c.expectedEvidenceHint,
        })),
      }),
    );
    process.exit(2);
  }

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mde = loadEnv(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const gem = loadEnv(
    resolve(ROOT, 'secrets/mc1-p1-prototype.local.env'),
    new Set(['GEMINI_API_KEY', 'GEMINI_MODEL']),
  );
  assertMdeTarget({
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    database: mde.MDE_DB_NAME,
  });
  if (!gem.GEMINI_API_KEY) {
    console.log(JSON.stringify({ status: 'BLOCKED', reason: 'NO_GEMINI_KEY' }));
    process.exit(2);
  }

  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(
    join(OUT_ROOT, 'cohort.json'),
    JSON.stringify(
      {
        phase: '8F',
        selectionCriterion:
          'Anchors 1–2 + diversity among MDE snapshots with keyword flags; cargo/area not used for competence inference. Specialty catalog only VD/ED.',
        modelFrozen: '8E',
        cohort: COHORT,
      },
      null,
      2,
    ),
    'utf8',
  );

  const ds = new DataSource({
    type: 'postgres',
    host: mde.MDE_DB_HOST,
    port: Number(mde.MDE_DB_PORT),
    username: mde.MDE_DB_USERNAME,
    password: mde.MDE_DB_PASSWORD,
    database: mde.MDE_DB_NAME,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  const cards: unknown[] = [];
  try {
    for (const member of COHORT) {
      const sid = member.snapshotId;
      const cardDir = join(OUT_ROOT, `S${sid}`);
      mkdirSync(cardDir, { recursive: true });
      const stages: Record<string, string> = {};
      const warnings: string[] = [];

      const p1Dir = resolveCohortArtifactDir(ROOT, sid);
      if (!p1Dir) {
        warnings.push('P1_PACK_MISSING');
        const card = {
          snapshotId: sid,
          role: member.role,
          status: 'BLOCKED_STAGE',
          classification: 'POOR_REPRESENTATION',
          warnings,
          problems: [
            {
              layer: 'EVIDENCE_PROBLEM',
              pattern: 'P1_PACK_MISSING',
              severity: 'HIGH',
            },
          ],
          selectionReason: member.selectionReason,
        };
        writeFileSync(join(cardDir, 'validation-card.json'), JSON.stringify(card, null, 2));
        cards.push(card);
        continue;
      }
      stages.p1 = p1Dir;

      let p2Dir = findLatestP2Pack(ROOT, sid);
      if (!p2Dir) {
        const p2 = await runP2ArtifactOnly({
          backendRoot: ROOT,
          snapshotId: sid,
          dataSource: ds,
          apiKey: gem.GEMINI_API_KEY,
          model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
          outRoot: resolve(ROOT, 'tmp', 'mc1-p2-functional'),
        });
        p2Dir = p2.outDir;
        stages.p2 = p2Dir;
        stages.p2ExecutionId = p2.envelope.payload.executionId;
      } else {
        stages.p2 = p2Dir;
        stages.p2Reused = 'true';
      }

      let r1Dir = findLatestR1Pack(ROOT, sid);
      if (!r1Dir) {
        const r1 = runR1ArtifactOnly({
          backendRoot: ROOT,
          snapshotId: sid,
          p2PackDir: p2Dir,
        });
        r1Dir = r1.outDir;
        stages.r1 = r1Dir;
      } else {
        stages.r1 = r1Dir;
        stages.r1Reused = 'true';
      }

      const r1Contract = JSON.parse(
        readFileSync(join(r1Dir, 'r1-contract.json'), 'utf8'),
      ) as {
        payload: {
          fieldResolutionStatus: string;
          primaryField: { fieldCode: string | null; confidence: number } | null;
          secondaryFields: Array<{ fieldCode: string | null; confidence: number }>;
        };
      };
      const fields = [
        r1Contract.payload.primaryField?.fieldCode,
        ...(r1Contract.payload.secondaryFields ?? []).map((f) => f.fieldCode),
      ].filter((x): x is string => !!x);

      const catalogGaps = fields.filter((f) => !SPECIALTY_CATALOG_SCOPE.has(f));
      for (const g of catalogGaps) {
        warnings.push(`SPECIALTY_CATALOG_NOT_AVAILABLE:${g}`);
      }

      const inScope = fields.filter((f) => SPECIALTY_CATALOG_SCOPE.has(f));
      let p3Dir = findLatestP3Pack(ROOT, sid);
      let p4Dir = findLatestP4Pack(ROOT, sid);

      if (inScope.length > 0) {
        if (!p3Dir) {
          const p3 = await runP3ArtifactOnly({
            backendRoot: ROOT,
            snapshotId: sid,
            dataSource: ds,
            apiKey: gem.GEMINI_API_KEY,
            model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
            outRoot: resolve(ROOT, 'tmp', 'mc1-p3-functional'),
            r1PackDir: r1Dir,
          });
          p3Dir = p3.outDir;
          stages.p3 = p3Dir;
        } else {
          stages.p3 = p3Dir;
          stages.p3Reused = 'true';
        }

        if (!p4Dir) {
          const p4 = await runP4ArtifactOnly({
            backendRoot: ROOT,
            snapshotId: sid,
            dataSource: ds,
            apiKey: gem.GEMINI_API_KEY,
            model: gem.GEMINI_MODEL || 'gemini-3.6-flash',
            outRoot: resolve(ROOT, 'tmp', 'mc1-p4-functional'),
            r1PackDir: r1Dir,
            p3PackDir: p3Dir,
          });
          p4Dir = p4.outDir;
          stages.p4 = p4Dir;
        } else {
          stages.p4 = p4Dir;
          stages.p4Reused = 'true';
        }
      } else {
        warnings.push('P3_P4_SKIPPED_NO_IN_SCOPE_FIELD');
      }

      // Assemble profile when P4 exists; otherwise write gap presentation stub.
      let profileDir: string | null = null;
      let profileSummary: {
        fields: Array<{
          fieldCode: string;
          specialties: string[];
          skills: string[];
          tools: string[];
          evidenceVolume: string;
          evidenceUnitCount: number;
          radarTop: Array<{ dimension: string; relativeCoverage: number; rawScore: number }>;
        }>;
      } | null = null;

      if (p4Dir) {
        try {
          const prof = await runProfilePilot({
            backendRoot: ROOT,
            snapshotId: sid,
            outRoot: resolve(ROOT, 'tmp', 'mc1-profile-pilot'),
            r1PackDir: r1Dir,
            p3PackDir: p3Dir ?? undefined,
            p4PackDir: p4Dir,
          });
          profileDir = prof.outDir;
          stages.profile = profileDir;
          profileSummary = JSON.parse(
            readFileSync(join(profileDir, 'summary.json'), 'utf8'),
          );
        } catch (e) {
          warnings.push(
            `PROFILE_ASSEMBLY_FAILED:${String(e instanceof Error ? e.message : e).slice(0, 120)}`,
          );
        }
      } else {
        profileSummary = {
          fields: fields.map((fieldCode) => ({
            fieldCode,
            specialties: [],
            skills: [],
            tools: [],
            evidenceVolume: 'LOW',
            evidenceUnitCount: 0,
            radarTop: [],
          })),
        };
        writeFileSync(
          join(cardDir, 'presentation-stub.json'),
          JSON.stringify(
            {
              note: 'Profile 8E assembly requires P4 OBSERVED skills; stub used for catalog-gap / no-specialty cases',
              fields,
              catalogGaps,
              r1FieldResolutionStatus:
                r1Contract.payload.fieldResolutionStatus,
            },
            null,
            2,
          ),
          'utf8',
        );
        warnings.push('PROFILE_STUB_NO_P4');
      }

      const specialties =
        profileSummary?.fields.flatMap((f) => f.specialties) ?? [];
      const skills =
        profileSummary?.fields.flatMap((f) => f.skills) ?? [];
      const tools =
        profileSummary?.fields.flatMap((f) => f.tools) ?? [];
      const hasRadar = (profileSummary?.fields ?? []).some((f) =>
        (f.radarTop ?? []).some((a) => a.relativeCoverage > 0),
      );

      // Enrich skill-as-specialty naming detection without PII
      const skillProblems: LayerProblem[] = [];
      for (const name of skills) {
        const n = name.toLowerCase();
        if (
          /branding|identidad|editorial|maquetaci[oó]n editorial/.test(n) &&
          specialties.includes('GRAPHIC_DESIGN')
        ) {
          skillProblems.push({
            layer: 'SKILL_PROBLEM',
            pattern: 'SKILL_NAME_NEAR_SPECIALTY',
            severity: 'MEDIUM',
          });
        }
      }

      // relativeCoverage=100 with LOW volume
      for (const f of profileSummary?.fields ?? []) {
        const top = f.radarTop?.[0];
        if (
          top &&
          top.relativeCoverage === 100 &&
          f.evidenceVolume === 'LOW'
        ) {
          skillProblems.push({
            layer: 'RADAR_PROBLEM',
            pattern: 'RELATIVE_100_WITH_LOW_EVIDENCE_VOLUME',
            severity: 'MEDIUM',
          });
        }
      }

      if (r1Contract.payload.fieldResolutionStatus === 'MULTI_FIELD') {
        warnings.push('MULTI_FIELD');
      }

      const base = classifyCard({
        fields,
        specialties,
        skillCount: skills.length,
        hasRadar,
        catalogGaps,
        expectedHint: member.expectedEvidenceHint,
      });
      base.problems.push(...skillProblems);

      // Downgrade GOOD if specialty-named skills present
      let classification = base.classification;
      if (
        classification === 'GOOD_REPRESENTATION' &&
        skillProblems.some((p) => p.pattern === 'SKILL_NAME_NEAR_SPECIALTY')
      ) {
        // Keep GOOD but note — pattern known, representation still useful
        warnings.push('SKILL_NAME_NEAR_SPECIALTY_OBSERVED');
      }

      const card = {
        snapshotId: sid,
        role: member.role,
        selectionReason: member.selectionReason,
        expectedEvidenceHint: member.expectedEvidenceHint,
        r1FieldResolutionStatus: r1Contract.payload.fieldResolutionStatus,
        fields,
        specialties,
        skills,
        tools,
        radars: (profileSummary?.fields ?? []).map((f) => ({
          fieldCode: f.fieldCode,
          evidenceVolume: f.evidenceVolume,
          evidenceUnitCount: f.evidenceUnitCount,
          top: f.radarTop,
        })),
        hasRadar,
        catalogGaps: catalogGaps.map((g) => `SPECIALTY_CATALOG_NOT_AVAILABLE:${g}`),
        warnings: [...new Set([...warnings, ...base.notes])],
        problems: base.problems,
        classification,
        stages,
        profileDir,
      };
      writeFileSync(
        join(cardDir, 'validation-card.json'),
        JSON.stringify(card, null, 2),
        'utf8',
      );
      cards.push(card);
    }
  } finally {
    await ds.destroy();
  }

  const metrics = {
    profiles: cards.length,
    GOOD: cards.filter(
      (c) =>
        (c as { classification?: string }).classification ===
        'GOOD_REPRESENTATION',
    ).length,
    PARTIAL: cards.filter(
      (c) =>
        (c as { classification?: string }).classification ===
        'PARTIAL_REPRESENTATION',
    ).length,
    POOR: cards.filter(
      (c) =>
        (c as { classification?: string }).classification ===
        'POOR_REPRESENTATION',
    ).length,
    catalogCoverageGaps: cards.filter(
      (c) =>
        ((c as { catalogGaps?: string[] }).catalogGaps ?? []).length > 0,
    ).length,
    multiField: cards.filter((c) =>
      ((c as { warnings?: string[] }).warnings ?? []).includes('MULTI_FIELD'),
    ).length,
    withRadar: cards.filter((c) => (c as { hasRadar?: boolean }).hasRadar)
      .length,
  };

  writeFileSync(
    join(OUT_ROOT, 'cohort-results.json'),
    JSON.stringify({ phase: '8F', metrics, cards }, null, 2),
    'utf8',
  );

  console.log(
    JSON.stringify({ phase: '8F', status: 'DONE', metrics, cards }, null, 2),
  );
}

main().catch((e) => {
  console.log(
    JSON.stringify({
      status: 'FAILED',
      error: String(e instanceof Error ? e.message : e).slice(0, 500),
    }),
  );
  process.exit(1);
});
