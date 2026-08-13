/**
 * FASE 12G — Diagnostic only: P4 skill placement drift.
 * Reads 12F LIVE packs. No Gemini. No production changes.
 *
 *   npx ts-node --transpile-only scripts/mc1-visual-design-p4-drift-12g.ts
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import { loadP2EvidenceFromP1Pack } from '../src/mc-pipeline/p2/p2-evidence-loader';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-visual-design-p4-drift-12g');
const REPORT_12F = resolve(
  ROOT,
  'tmp',
  'mc1-visual-design-remaining-12f',
  'cohort-report.json',
);

const DRIFT_IDS = ['1182', '1175', '1168', '1188', '1181', '1170'];
const CONTROL_IDS = ['1187', '1186', '1167'];

const FULL_NAME: Record<string, string> = {
  '1182': 'Danna Michelle Poveda',
  '1175': 'Dario Fernando Navarro',
  '1168': 'Diego Fernando Perez',
  '1188': 'Hari Steffan Totena',
  '1181': 'Luis Miguel Cuspian',
  '1170': 'Oswaldo Enrique Silva',
  '1187': 'Juan Andres Hermida',
  '1186': 'Juliana Sofia Correa',
  '1167': 'Laura Melisa Perez',
};

type Unit = {
  evidenceUnitId: string;
  evidenceKind?: string;
  explicitness?: string;
  normalizedActivity?: string | null;
  object?: string | null;
  toolOrMethod?: string | null;
  result?: string | null;
  sourceText?: string | null;
};

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function loadJson(path: string): any {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function unitBlob(u: Unit): string {
  return [u.normalizedActivity, u.object, u.toolOrMethod, u.result, u.sourceText]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function classifyPractice(blob: string) {
  return {
    brand:
      /brand|identidad|branding|lineamiento|key visual|manual de marca|isotipo|\blogo\b/.test(
        blob,
      ),
    editorial:
      /editorial|diagramaci[oó]n|maquetaci[oó]n|revista|ebook|folleto|publicaci[oó]n/.test(
        blob,
      ),
    motion:
      /motion\s*graphics|motion\s*design|animaci[oó]n(?:\s+gr[aá]fica)?|gr[aá]ficos?\s+animados|kinetic/.test(
        blob,
      ),
    av: /audiovisual|edici[oó]n de (v[ií]deo|video)|video editing|montaje/.test(
      blob,
    ),
    ux: /\bui\b|\bux\b|interfaz|user interface|prototip/.test(blob),
    graphic: /gr[aá]fic|pieza|publicitar|dise[nñ]o digital/.test(blob),
    illustration: /ilustraci[oó]n|illustration|personaje/.test(blob),
  };
}

function suspectSpecialty(
  assigned: string,
  practice: ReturnType<typeof classifyPractice>,
  _p3Observed: string[],
  _p3Weak: string[],
  skillWording: string,
): string | null {
  if (assigned !== 'GRAPHIC_DESIGN') return null;
  const w = skillWording.toLowerCase();
  // Prefer skill name/signals over ambient evidence tokens.
  if (/brand|identidad|branding|lineamiento|key visual/.test(w)) {
    return 'BRAND_IDENTITY_DESIGN';
  }
  if (/editorial|diagramaci|maquetaci[oó]n/.test(w)) {
    return 'EDITORIAL_DESIGN';
  }
  if (/\bmotion\b|motion\s*graphics|motion\s*design|animaci[oó]n/.test(w)) {
    return 'MOTION_DESIGN';
  }
  if (/audiovisual|edici[oó]n de (v[ií]deo|video)|video editing/.test(w)) {
    return 'AUDIOVISUAL_OR_MOTION';
  }
  if (/\bui\b|\bux\b|interfaz/.test(w)) return 'UX_PRODUCT_DESIGN';
  if (/ilustraci[oó]n|illustration/.test(w) && practice.illustration) {
    return 'ILLUSTRATION';
  }
  // Fallback: only for clearly specialized practice without graphic capacity wording.
  if (
    !/gr[aá]fic|pieza|publicitar|producci[oó]n|retoque|impres|dise[nñ]o digital|contenido|inteligencia|ia\b|ai\b/.test(
      w,
    )
  ) {
    if (practice.motion) return 'MOTION_DESIGN';
    if (practice.av) return 'AUDIOVISUAL_OR_MOTION';
    if (practice.brand) return 'BRAND_IDENTITY_DESIGN';
    if (practice.editorial) return 'EDITORIAL_DESIGN';
  }
  return null;
}

function isHybridName(name: string): boolean {
  const n = name.toLowerCase();
  return (
    [
      /gr[aá]fic/.test(n),
      /editorial|diagramaci|maquet/.test(n),
      /brand|identidad|branding/.test(n),
      /audiovisual|video|animaci|motion/.test(n),
      /ux|ui|interfaz/.test(n),
    ].filter(Boolean).length >= 2
  );
}

function rootCauseFor(args: {
  suspected: string | null;
  practice: ReturnType<typeof classifyPractice>;
  p3Observed: string[];
  p3Weak: string[];
  p4Received: string[];
  hybridName: boolean;
}): {
  primaryRootCause: string;
  secondaryContributors: string[];
  confirmedDrift: boolean;
  notes: string;
} {
  const { suspected, practice, p3Observed, p3Weak, p4Received, hybridName } =
    args;
  if (!suspected) {
    return {
      primaryRootCause: 'NO_ACTUAL_DRIFT',
      secondaryContributors: [],
      confirmedDrift: false,
      notes: 'No specialized sibling signal beyond GRAPHIC',
    };
  }

  const suspectedCore = suspected.startsWith('AUDIOVISUAL')
    ? 'MOTION_DESIGN'
    : suspected;
  const suspectedObserved = p3Observed.includes(suspectedCore);
  const suspectedWeak = p3Weak.includes(suspectedCore);
  const suspectedReceived = p4Received.includes(suspectedCore);

  if (suspected === 'AUDIOVISUAL_OR_MOTION' || suspected === 'MOTION_DESIGN') {
    if (practice.av && !practice.motion) {
      return {
        primaryRootCause: 'EVIDENCE_AMBIGUITY',
        secondaryContributors: ['P4_SPECIALTY_COLLAPSE'],
        confirmedDrift: false,
        notes:
          'Video/AV practice without explicit motion-design wording; MOTION often not OBSERVED',
      };
    }
    if (suspectedWeak && !suspectedObserved) {
      return {
        primaryRootCause: 'P3_CONTEXT_LOSS',
        secondaryContributors: ['P4_SPECIALTY_COLLAPSE'],
        confirmedDrift: true,
        notes:
          'MOTION_DESIGN WEAK in P3 → excluded from P4 specialtiesEvaluated; practice under GRAPHIC',
      };
    }
    if (!suspectedObserved && practice.motion) {
      return {
        primaryRootCause: 'UPSTREAM_DRIFT',
        secondaryContributors: ['P4_SPECIALTY_COLLAPSE'],
        confirmedDrift: true,
        notes: 'Motion practice present but MOTION_DESIGN not OBSERVED by P3',
      };
    }
  }

  if (
    suspected === 'EDITORIAL_DESIGN' ||
    suspected === 'BRAND_IDENTITY_DESIGN' ||
    suspected === 'UX_PRODUCT_DESIGN' ||
    suspected === 'ILLUSTRATION'
  ) {
    if (suspectedWeak && !suspectedObserved) {
      return {
        primaryRootCause: 'P3_CONTEXT_LOSS',
        secondaryContributors: hybridName
          ? ['HYBRID_SKILL_WORDING', 'P4_SPECIALTY_COLLAPSE']
          : ['P4_SPECIALTY_COLLAPSE'],
        confirmedDrift: true,
        notes: `${suspected} WEAK in P3; P4 only receives OBSERVED → forced under GRAPHIC`,
      };
    }
    if (suspectedObserved && suspectedReceived) {
      if (hybridName) {
        return {
          primaryRootCause: 'HYBRID_SKILL_WORDING',
          secondaryContributors: [
            'P4_SPECIALTY_COLLAPSE',
            'SKILL_ASSOCIATION_ERROR',
          ],
          confirmedDrift: true,
          notes: `${suspected} available to P4; hybrid wording kept under GRAPHIC`,
        };
      }
      return {
        primaryRootCause: 'P4_SPECIALTY_COLLAPSE',
        secondaryContributors: ['SKILL_ASSOCIATION_ERROR', 'P4_PROMPT_BIAS'],
        confirmedDrift: true,
        notes: `${suspected} OBSERVED+received by P4 but practice emitted under GRAPHIC`,
      };
    }
    if (!suspectedObserved && !suspectedWeak) {
      return {
        primaryRootCause: 'UPSTREAM_DRIFT',
        secondaryContributors: ['EVIDENCE_AMBIGUITY'],
        confirmedDrift: true,
        notes: `${suspected} never emitted by P3`,
      };
    }
  }

  return {
    primaryRootCause: 'UNRESOLVED',
    secondaryContributors: hybridName ? ['HYBRID_SKILL_WORDING'] : [],
    confirmedDrift: true,
    notes: 'Unclear primary cause',
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cohort = loadJson(REPORT_12F);
  const traces: any[] = [];
  const inventory: any[] = [];
  const motionCheck: any[] = [];

  const frozenConfig = {
    fingerprintExpected: '5e7c14e464289c51',
    p4PromptVersion: 'MC1.P4.PROMPT.FUNCTIONAL.1.0.0',
    p4ContractVersion: '1.0.0',
    p4ObservedOnlyGate: 'resolveObservedSpecialties drops WEAK',
  };

  for (const k of Object.keys(process.env)) {
    if (k.startsWith('DB_') || k.startsWith('DATABASE_')) delete process.env[k];
  }
  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));
  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);
  const ds = new DataSource({
    type: 'postgres',
    ...mde,
    synchronize: false,
    logging: false,
  });
  await ds.initialize();

  try {
    for (const personId of [...DRIFT_IDS, ...CONTROL_IDS]) {
      const row = cohort.results.find((r: any) => r.personId === personId);
      if (!row || row.status !== 'DONE') continue;
      const role = DRIFT_IDS.includes(personId) ? 'DRIFT' : 'CONTROL';
      const p3 = loadJson(join(row.p3.packDir, 'p3-contract.json'));
      const p4 = loadJson(join(row.p4.packDir, 'p4-contract.json'));
      const r1 = loadJson(join(row.r1.packDir, 'r1-contract.json'));

      const p3Observed: string[] = [];
      const p3Weak: string[] = [];
      for (const fr of p3.payload.fieldResults ?? []) {
        if (fr.fieldCode !== 'VISUAL_DESIGN') continue;
        for (const s of fr.observedSpecialties ?? []) {
          if (s.status === 'OBSERVED') p3Observed.push(s.specialtyCode);
          if (s.status === 'WEAK') p3Weak.push(s.specialtyCode);
        }
      }

      const p4Received = (p4.payload.specialtiesEvaluated ?? []).map(
        (s: any) => s.specialtyCode,
      );
      const p4ReceivedSet = new Set<string>(p4Received);

      const units = new Map<string, Unit>();
      try {
        const loaded = await loadP2EvidenceFromP1Pack({
          backendRoot: ROOT,
          snapshotId: String(row.snapshotId),
          dataSource: ds,
        });
        for (const u of loaded.units) units.set(u.evidenceUnitId, u as Unit);
      } catch (e) {
        console.error(
          JSON.stringify({
            warn: 'EVIDENCE_LOAD_FAIL',
            personId,
            error: String(e instanceof Error ? e.message : e).slice(0, 180),
          }),
        );
      }

      const motionEvidenceHits: Array<{
        id: string;
        snippet: string;
        explicitness: string;
      }> = [];
      for (const [, u] of units) {
        const b = unitBlob(u);
        if (
          /motion\s*graphics|motion\s*design|animaci[oó]n(?:\s+gr[aá]fica)?|gr[aá]ficos?\s+animados|kinetic/.test(
            b,
          )
        ) {
          motionEvidenceHits.push({
            id: u.evidenceUnitId,
            snippet: b.slice(0, 160),
            explicitness: String(u.explicitness ?? 'UNKNOWN'),
          });
        }
      }

      motionCheck.push({
        personId,
        person: FULL_NAME[personId] ?? row.label,
        role,
        p3Motion: p3Observed.includes('MOTION_DESIGN')
          ? 'OBSERVED'
          : p3Weak.includes('MOTION_DESIGN')
            ? 'WEAK'
            : 'NOT_EMITTED',
        motionEvidenceCount: motionEvidenceHits.length,
        motionEvidenceHits: motionEvidenceHits.slice(0, 8),
        verdict:
          motionEvidenceHits.length === 0
            ? 'MOTION_0_EXPECTED'
            : p3Observed.includes('MOTION_DESIGN')
              ? 'MOTION_OBSERVED_OK'
              : p3Weak.includes('MOTION_DESIGN')
                ? 'MOTION_EVIDENCE_PRESENT_BUT_P3_WEAK_P4_EXCLUDED'
                : 'MOTION_EVIDENCE_PRESENT_BUT_P3_NOT_OBSERVED',
      });

      for (const sr of p4.payload.specialtyResults ?? []) {
        if (sr.fieldCode !== 'VISUAL_DESIGN') continue;
        for (const sk of sr.observedSkills ?? []) {
          if (sk.status !== 'OBSERVED' && sk.status !== 'WEAK') continue;
          const supportIds: string[] = sk.supportingEvidenceUnitIds ?? [];
          const supportUnits = supportIds
            .map((id) => units.get(id))
            .filter(Boolean) as Unit[];
          const evidenceBlobs = supportUnits.map(unitBlob);
          const signalBlob = [
            ...(sk.supportingSignals ?? []),
            sk.name,
            sk.skillCode,
          ]
            .join(' ')
            .toLowerCase();
          const combined = [...evidenceBlobs, signalBlob].join(' ');
          const practice = classifyPractice(combined);
          const hybrid = isHybridName(String(sk.name ?? ''));
          const skillWordingOnly = `${sk.name} ${sk.skillCode}`.toLowerCase();
          const suspected = suspectSpecialty(
            sr.specialtyCode,
            practice,
            p3Observed,
            p3Weak,
            skillWordingOnly,
          );
          const isSuspect =
            sr.specialtyCode === 'GRAPHIC_DESIGN' && suspected != null;
          const rc = rootCauseFor({
            suspected,
            practice,
            p3Observed,
            p3Weak,
            p4Received: [...p4ReceivedSet],
            hybridName: hybrid,
          });

          const suspectedCore =
            suspected?.startsWith('AUDIOVISUAL') || suspected === 'MOTION_DESIGN'
              ? 'MOTION_DESIGN'
              : suspected;

          const entry = {
            personId,
            person: FULL_NAME[personId] ?? row.label,
            role,
            skillCode: sk.skillCode,
            skillName: sk.name,
            assignedSpecialty: sr.specialtyCode,
            suspectedSpecialty: suspected,
            p4Wording: sk.name,
            supportingSignals: sk.supportingSignals ?? [],
            supportingEvidenceUnitIds: supportIds,
            supportingEvidenceSnippets: evidenceBlobs.map((b) => b.slice(0, 180)),
            evidenceExplicitness: supportUnits.map(
              (u) => u.explicitness ?? 'UNKNOWN',
            ),
            p3SpecialtiesObserved: p3Observed,
            p3SpecialtiesWeak: p3Weak,
            p4SpecialtiesReceived: [...p4ReceivedSet],
            p3HadSuspectedObserved: suspectedCore
              ? p3Observed.includes(suspectedCore)
              : null,
            p3HadSuspectedWeak: suspectedCore
              ? p3Weak.includes(suspectedCore)
              : null,
            p4ReceivedSuspected: suspectedCore
              ? p4ReceivedSet.has(suspectedCore)
              : null,
            catalogReuseOrNew: 'PROVISIONAL_ARTIFACT_CODE',
            hybridWording: hybrid,
            practiceFlags: practice,
            driftClass: rc.primaryRootCause,
            primaryRootCause: rc.primaryRootCause,
            secondaryContributors: rc.secondaryContributors,
            confirmedDrift: rc.confirmedDrift && isSuspect,
            rootNotes: rc.notes,
            r1Primary: r1.payload?.primaryField?.fieldCode ?? row.r1?.primary,
          };

          if (role === 'DRIFT') {
            if (isSuspect || sr.specialtyCode === 'GRAPHIC_DESIGN') {
              inventory.push(entry);
            }
            if (isSuspect && rc.confirmedDrift) {
              traces.push({
                traceId: createHash('sha1')
                  .update(`${personId}:${sk.skillCode}`)
                  .digest('hex')
                  .slice(0, 10),
                chain: {
                  p1EvidenceUnitIds: supportIds,
                  p1Snippets: entry.supportingEvidenceSnippets,
                  explicitness: entry.evidenceExplicitness,
                  p2DomainCandidates: row.p2?.candidates ?? [],
                  r1ResolvedDomain: entry.r1Primary,
                  p3SpecialtyOutput: { observed: p3Observed, weak: p3Weak },
                  p4InputSpecialties: [...p4ReceivedSet],
                  p4GeneratedSkill: {
                    skillCode: sk.skillCode,
                    name: sk.name,
                    signals: sk.supportingSignals,
                    tools: sk.toolOrTechnologySignals,
                  },
                  p4SpecialtyAssociation: sr.specialtyCode,
                  profileRadarNote: 'Mapper 12E not implicated',
                },
                ...entry,
              });
            }
          }

          if (role === 'CONTROL' && sr.specialtyCode !== 'GRAPHIC_DESIGN') {
            inventory.push({
              ...entry,
              note: 'CONTROL specialized placement',
              confirmedDrift: false,
              primaryRootCause: 'NO_ACTUAL_DRIFT',
            });
          }
        }
      }
    }
  } finally {
    await ds.destroy();
  }

  const confirmed = inventory.filter((i) => i.confirmedDrift);
  const byCause: Record<string, number> = {};
  for (const i of confirmed) {
    byCause[i.primaryRootCause] = (byCause[i.primaryRootCause] ?? 0) + 1;
  }
  const bySuspected: Record<string, number> = {};
  for (const i of confirmed) {
    bySuspected[i.suspectedSpecialty ?? 'NONE'] =
      (bySuspected[i.suspectedSpecialty ?? 'NONE'] ?? 0) + 1;
  }

  const p3HadCorrect = confirmed.filter((i) => i.p3HadSuspectedObserved === true);
  const p4ReceivedCorrect = confirmed.filter(
    (i) => i.p4ReceivedSuspected === true,
  );

  const dominant = Object.entries(byCause).sort((a, b) => b[1] - a[1]);
  let decision = 'P4_DRIFT_UNRESOLVED';
  if (confirmed.length === 0) decision = 'P4_DRIFT_NOT_CONFIRMED';
  else if (dominant.length >= 2 && dominant[1][1] > 0) {
    const topShare = dominant[0][1] / confirmed.length;
    decision =
      topShare >= 0.65
        ? 'P4_DRIFT_ROOT_CAUSE_IDENTIFIED'
        : 'P4_DRIFT_MULTICAUSAL';
  } else if (dominant.length >= 1) {
    decision = 'P4_DRIFT_ROOT_CAUSE_IDENTIFIED';
  }

  const rootCauseSummary = {
    decision,
    totalInventoryRows: inventory.length,
    driftPersonSkillsAudited: inventory.filter((i) => i.role === 'DRIFT').length,
    suspiciousSkills: inventory.filter(
      (i) => i.role === 'DRIFT' && i.suspectedSpecialty,
    ).length,
    confirmedDrift: confirmed.length,
    falsePositivesOrNoDrift: inventory.filter(
      (i) => i.role === 'DRIFT' && i.primaryRootCause === 'NO_ACTUAL_DRIFT',
    ).length,
    distributionByRootCause: byCause,
    driftBySuspectedSpecialty: bySuspected,
    pctP3AlreadyHadSiblingObserved:
      confirmed.length === 0
        ? 0
        : Math.round((p3HadCorrect.length / confirmed.length) * 1000) / 10,
    pctP4ReceivedSibling:
      confirmed.length === 0
        ? 0
        : Math.round((p4ReceivedCorrect.length / confirmed.length) * 1000) / 10,
    pctEndedUnderGraphic: 100,
    catalogReuse: {
      note: 'P4 8D uses provisional artifact skillCodes only; no global catalog reuse.',
      reusedCatalog: 0,
      newProvisional: confirmed.length,
    },
    graphicCatchAllAssessment:
      'GRAPHIC_DESIGN is residual bucket when specialized sibling is WEAK (P3→P4 gate) and attractor when multiple OBSERVED siblings exist (P4 collapse).',
  };

  const diagnosis = {
    phase: '12G',
    mode: 'DIAGNOSTIC_ARTIFACT_ONLY',
    geminiInvoked: false,
    frozenConfig,
    cohortFingerprint: cohort.frozenConfig?.configFingerprint ?? null,
    driftPersons: DRIFT_IDS.map((id) => FULL_NAME[id]),
    controlPersons: CONTROL_IDS.map((id) => FULL_NAME[id]),
    hypotheses: {
      H1_P3_CONTEXT_LOSS:
        'CONFIRMED — resolveObservedSpecialties() drops WEAK; EDITORIAL/BRAND/MOTION often WEAK → never in specialtiesEvaluated.',
      H2_P4_SPECIALTY_COLLAPSE:
        'CONFIRMED — subset where sibling OBSERVED+received still emits specialized practice under GRAPHIC.',
      H3_SKILL_ASSOCIATION_ERROR:
        'SECONDARY — structural bucket association; wrong bucket chosen during generation.',
      H4_HYBRID_SKILL_WORDING: 'PRESENT in minority of names.',
      H5_CATALOG_REUSE_BIAS: 'NOT_APPLICABLE in P4 8D.',
      H6_EVIDENCE_AMBIGUITY: 'PRESENT for AV-without-motion cases.',
      H7_P4_PROMPT_OR_CONTRACT_BIAS:
        'PARTIAL — prompt lacks most-specific-sibling routing; contract pins parentSpecialtyCode to evaluation bucket.',
    },
    metrics: rootCauseSummary,
    decision,
    layerWhereDriftStarts:
      'Primary boundary P3→P4 (WEAK exclusion). Secondary inside P4 generation when multiple OBSERVED specialties exist.',
    recommendation12H: [
      'Do not change radar mapper.',
      'Slice A: P4 context — surface WEAK specialties as non-emitting routing hints OR tighten P3 WEAK→OBSERVED for clear editorial/brand practice.',
      'Slice B: P4 routing — when multiple OBSERVED siblings exist, require evidence→most-specific-specialty assignment.',
      'Slice C: Motion — only when motion graphics/animación explícita; do not promote Premiere-only.',
      'Ship A and B as separate minimal fixes if both remain material.',
    ],
  };

  const analysisNotes = {
    controlsPattern: [
      'Hermida: only UX OBSERVED → UI skill under UX_PRODUCT_DESIGN (no GRAPHIC pressure).',
      'Juliana: GRAPHIC+EDITORIAL OBSERVED → editorial skills under EDITORIAL_DESIGN.',
      'Laura Melisa: Brand/Editorial/Illustration OBSERVED with specialized skills under those siblings.',
    ],
    driftPattern: [
      'Luis: EDITORIAL WEAK → P4 only GRAPHIC → editorial skill under GRAPHIC (H1).',
      'Hari: BRAND WEAK → brand wording under GRAPHIC while EDITORIAL OBSERVED.',
      'Danna: Brand+Editorial OBSERVED but AV skill under GRAPHIC (H2/H6).',
      'Oswaldo/Dario: motion/animación with MOTION WEAK → under GRAPHIC (H1).',
    ],
  };

  writeFileSync(join(OUT, 'skill-traces.json'), JSON.stringify(traces, null, 2));
  writeFileSync(
    join(OUT, 'diagnosis-report.json'),
    JSON.stringify({ diagnosis, inventory }, null, 2),
  );
  writeFileSync(
    join(OUT, 'root-cause-summary.json'),
    JSON.stringify(rootCauseSummary, null, 2),
  );
  writeFileSync(
    join(OUT, 'motion-check.json'),
    JSON.stringify(motionCheck, null, 2),
  );
  writeFileSync(
    join(OUT, 'analysis-notes.json'),
    JSON.stringify(analysisNotes, null, 2),
  );
  writeFileSync(
    join(OUT, 'phase-verdict.json'),
    JSON.stringify(
      { phase: '12G', decision, confirmedDrift: confirmed.length, byCause },
      null,
      2,
    ),
  );

  console.log(
    JSON.stringify(
      {
        decision,
        confirmedDrift: confirmed.length,
        byCause,
        traces: traces.length,
        out: OUT,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
