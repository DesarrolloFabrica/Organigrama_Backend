/**
 * Selección de cohorte pequeña entre las 24 pendientes.
 * SOLO inventario determinístico. 0 Gemini. 0 writes Cloud/MDE. 0 pipeline.
 *
 *   npx ts-node --transpile-only scripts/mc1-small-cohort-candidate-selection.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { UnpdfCvDocumentTextExtractor } from '../src/mc-pipeline/p0/unpdf-text-extractor.adapter';
import { CvTextNormalizer } from '../src/mc-pipeline/p0/cv-text-normalizer';
import { CvSectionDetector } from '../src/mc-pipeline/p0/cv-section-detector';
import { DeterministicEvidenceCandidateSegmenter } from '../src/mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../src/mc-pipeline/p1/p1-evidence-batch-builder';
import { downloadCvPdfBuffer } from '../src/database/scripts/utils/google-drive-cv-client';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
  isShadowResolverEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';
import { isP2CanaryEnabled } from '../src/mc-pipeline/shadow-resolver/canary-design';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, '..', 'tmp', 'mc1-small-cohort-candidate-selection');
const JESSICA_ID = '1171';

const UNIVERSE_24 = [
  '1082',
  '1109',
  '1114',
  '1127',
  '1178',
  '1180',
  '1181',
  '1183',
  '1187',
  '1189',
  '1267',
  '1268',
  '1094',
  '1103',
  '1156',
  '1159',
  '1214',
  '1216',
  '1222',
  '1223',
  '1303',
  '1306',
  '1320',
  '1340',
] as const;

const HISTORICAL: Record<
  string,
  { cohort: string; domainHint: string; notes: string }
> = {
  '1178': {
    cohort: 'VD_12J',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE documentado 12J snap doc 26; packs ausentes',
  },
  '1180': {
    cohort: 'VD_12B',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE documentado 12B con Jesica; packs ausentes',
  },
  '1181': {
    cohort: 'VD_12J',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE 12J/12G/12I; packs ausentes',
  },
  '1183': {
    cohort: 'VD_12C',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE documentado 12C; packs ausentes',
  },
  '1187': {
    cohort: 'VD_12J',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE documentado 12J snap 28; packs ausentes',
  },
  '1189': {
    cohort: 'VD_12C',
    domainHint: 'VISUAL_DESIGN',
    notes: 'LIVE documentado 12C; packs ausentes',
  },
  '1303': {
    cohort: 'FELIPE_TEAM',
    domainHint: 'FELIPE_TEAM',
    notes: 'TAXONOMY_BLOCKED histórico; NO_EVAL',
  },
  '1306': {
    cohort: 'FELIPE_TEAM',
    domainHint: 'FELIPE_TEAM',
    notes: 'Equipo Felipe; NO_EVAL',
  },
};

const UI_FROM_AUDIT: Record<string, 'PARTIAL_CLASSIFICATION_SUMMARY' | 'NO_COMPETENCY_EVALUATION'> =
  {
    '1082': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1109': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1114': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1127': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1178': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1180': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1181': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1183': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1187': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1189': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1267': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1268': 'PARTIAL_CLASSIFICATION_SUMMARY',
    '1094': 'NO_COMPETENCY_EVALUATION',
    '1103': 'NO_COMPETENCY_EVALUATION',
    '1156': 'NO_COMPETENCY_EVALUATION',
    '1159': 'NO_COMPETENCY_EVALUATION',
    '1214': 'NO_COMPETENCY_EVALUATION',
    '1216': 'NO_COMPETENCY_EVALUATION',
    '1222': 'NO_COMPETENCY_EVALUATION',
    '1223': 'NO_COMPETENCY_EVALUATION',
    '1303': 'NO_COMPETENCY_EVALUATION',
    '1306': 'NO_COMPETENCY_EVALUATION',
    '1320': 'NO_COMPETENCY_EVALUATION',
    '1340': 'NO_COMPETENCY_EVALUATION',
  };

const JESSICA_BASELINE = {
  personId: JESSICA_ID,
  pages: 2,
  p1Calls: 5,
  p1Tokens: 30319,
  fixedCalls: 3,
  fixedTokens: 47665,
  totalCalls: 8,
  totalTokens: 77984,
  usd: 0.199692,
  inputTokens: 30916,
  outputTokens: 17085,
  thinkingTokens: 29983,
};

const PRICING = {
  MODEL: 'gemini-3.6-flash',
  INPUT_PRICE: 0.75,
  OUTPUT_PRICE: 3.75,
  SOURCE: 'https://ai.google.dev/gemini-api/docs/pricing#gemini-3.6-flash',
  DATE: '2026-08-20',
};

const P1_TOKENS_PER_BATCH = JESSICA_BASELINE.p1Tokens / JESSICA_BASELINE.p1Calls;
const P1_IN_RATIO = 11641 / 30319;
const FIXED_IN_RATIO = 19275 / 47665;

type LengthBand = 'SHORT' | 'MEDIUM' | 'LONG' | 'VERY_LONG';
type Complexity = 'LOW_COMPLEXITY' | 'MEDIUM_COMPLEXITY' | 'HIGH_COMPLEXITY';
type Slot = 'SHORT_LOW' | 'MEDIUM' | 'LONG' | 'STRUCTURALLY_COMPLEX';

type Row = {
  personId: string;
  nombre: string;
  document: string | null;
  cvActive: boolean;
  personCvId: string | null;
  driveFileId: string | null;
  driveFileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  driveAreaFolder: string | null;
  driveSubareaFolder: string | null;
  jobTitle: string | null;
  parentName: string | null;
  parentRole: string | null;
  currentUiState: 'PARTIAL_CLASSIFICATION_SUMMARY' | 'NO_COMPETENCY_EVALUATION' | 'UNKNOWN';
  apiAvailability: string | null;
  mc1PresentationActive: number;
  extractionActive: boolean;
  extractionSkillCount: number;
  existingP0: boolean;
  p0SnapshotIds: string[];
  parseStatus: string | null;
  pageCount: number | null;
  textLength: number | null;
  charsPerPage: number | null;
  sectionCount: number | null;
  headingCount: number | null;
  candidateCount: number | null;
  predictedP1Batches: number | null;
  documentLengthBand: LengthBand | 'UNKNOWN';
  structuralComplexity: Complexity | 'UNKNOWN';
  domainHint: string;
  historicalCohort: string | null;
  historicalNotes: string | null;
  lengthScore: number;
  complexityScore: number;
  selected: 'YES' | 'NO';
  selectionCategory: Slot | null;
  selectionReason: string | null;
  estimate: ReturnType<typeof estimateCost> | null;
  errors: string[];
};

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    out[k] = v;
  }
  return out;
}

function writeJson(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2), 'utf8');
}

function bandRank(b: LengthBand): number {
  return { SHORT: 0, MEDIUM: 1, LONG: 2, VERY_LONG: 3 }[b];
}

function maxBand(a: LengthBand, b: LengthBand): LengthBand {
  return bandRank(a) >= bandRank(b) ? a : b;
}

function documentLengthBand(pages: number, chars: number): LengthBand {
  const pageBand: LengthBand =
    pages <= 2 ? 'SHORT' : pages <= 4 ? 'MEDIUM' : pages <= 7 ? 'LONG' : 'VERY_LONG';
  const charBand: LengthBand =
    chars < 4000 ? 'SHORT' : chars < 8000 ? 'MEDIUM' : chars < 15000 ? 'LONG' : 'VERY_LONG';
  return maxBand(pageBand, charBand);
}

function structuralComplexity(
  batches: number,
  candidates: number,
  headings: number,
  pages: number,
  sections: number,
): Complexity {
  if (batches >= 8 || candidates > 80 || headings >= 12 || pages >= 6 || sections >= 8) {
    return 'HIGH_COMPLEXITY';
  }
  if (batches <= 4 && candidates < 40 && pages <= 3) return 'LOW_COMPLEXITY';
  return 'MEDIUM_COMPLEXITY';
}

function inferDomain(jobTitle: string | null, area: string | null, sub: string | null, historical?: string) {
  if (historical) return historical;
  const blob = `${jobTitle ?? ''} ${area ?? ''} ${sub ?? ''}`.toLowerCase();
  if (/diseñ|visual|gr[aá]fic|motion/.test(blob)) return 'DESIGN_METADATA';
  if (/audiovisual|video|cinem|animaci/.test(blob)) return 'AUDIOVISUAL_METADATA';
  if (/software|desarroll|program|ingenier/.test(blob)) return 'ENGINEERING_METADATA';
  if (/pedag|docen|educaci|saber/.test(blob)) return 'EDUCATION_METADATA';
  if (/contenido|f[aá]brica/.test(blob)) return 'CONTENT_FACTORY_METADATA';
  if (/negocio|comercial|b2b|ventas/.test(blob)) return 'BUSINESS_METADATA';
  if (area) return `FOLDER:${area}`;
  if (jobTitle) return `ROLE:${jobTitle}`;
  return 'UNKNOWN_METADATA';
}

function usdFromParts(input: number, billedOutput: number) {
  return (
    (input * PRICING.INPUT_PRICE) / 1_000_000 +
    (billedOutput * PRICING.OUTPUT_PRICE) / 1_000_000
  );
}

function estimateCost(predictedP1Batches: number | null, pageCount: number | null) {
  const batches = Math.max(1, predictedP1Batches ?? Math.max(2, pageCount ?? 5));
  const p1Exp = batches * P1_TOKENS_PER_BATCH;
  const p1Low = p1Exp * 0.85;
  const p1High = p1Exp * 1.32;
  const fixedLow = 33188;
  const fixedExp = JESSICA_BASELINE.fixedTokens;
  const fixedHigh = JESSICA_BASELINE.fixedTokens * 1.32;

  const split = (p1: number, fixed: number) => {
    const input = p1 * P1_IN_RATIO + fixed * FIXED_IN_RATIO;
    const billedOut = p1 + fixed - input;
    return {
      tokens: Math.round(p1 + fixed),
      input: Math.round(input),
      billedOutput: Math.round(billedOut),
      usd: Number(usdFromParts(input, billedOut).toFixed(6)),
    };
  };

  const low = split(p1Low, fixedLow);
  const exp = split(p1Exp, fixedExp);
  const high = split(p1High, fixedHigh);

  return {
    label: 'PRE_RUN_ESTIMATE',
    method:
      'P1 variable = predictedBatches × Jesica P1 tokens/batch (6064). P2/P3/P4 relatively fixed from Jesica (47665). LOW: −15% P1 + P4=0 (~P2+P3). HIGH: +32% thinking variance on both.',
    estimatedP1CallsRange: [batches, batches],
    estimatedTotalCallsRange: [batches + 2, batches + 3],
    estimatedTokensRange: [low.tokens, high.tokens],
    estimatedUsdRange: [low.usd, high.usd],
    expected: {
      p1Calls: batches,
      totalCalls: batches + 3,
      tokens: exp.tokens,
      usd: exp.usd,
    },
  };
}

function csvEscape(v: unknown) {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function pickCohort(rows: Row[]) {
  const ok = rows.filter(
    (r) => r.parseStatus === 'PARSED' && r.pageCount != null && r.pageCount > 0,
  );
  const lengthAsc = (a: Row, b: Row) =>
    (a.pageCount ?? 99) - (b.pageCount ?? 99) ||
    (a.textLength ?? 9e9) - (b.textLength ?? 9e9) ||
    (a.predictedP1Batches ?? 99) - (b.predictedP1Batches ?? 99);
  const lengthDesc = (a: Row, b: Row) => -lengthAsc(a, b);
  const cxDesc = (a: Row, b: Row) =>
    (b.complexityScore ?? 0) - (a.complexityScore ?? 0) || lengthDesc(a, b);
  const cxAsc = (a: Row, b: Row) => -cxDesc(a, b);

  const shortPool = ok.filter((r) => r.documentLengthBand === 'SHORT');
  const aPool = shortPool.length ? shortPool : [...ok].sort(lengthAsc).slice(0, 6);
  const A = [...aPool].sort(cxAsc)[0];

  const C = [...ok].sort(lengthDesc)[0];

  const byCx = [...ok].sort(cxDesc);
  const mostComplex = byCx[0];
  // Si LONG ya es el más complejo, D debe aportar dominio distinto (no el 2.º LITE).
  const longIsAlsoMostComplex = mostComplex.personId === C.personId;
  let D =
    byCx.find((x) => {
      if (x.personId === C.personId) return false;
      if (longIsAlsoMostComplex && x.domainHint === C.domainHint) return false;
      if (x.domainHint === C.domainHint && x.jobTitle === C.jobTitle) return false;
      return true;
    }) ??
    byCx.find((x) => x.personId !== C.personId) ??
    byCx[0];

  const taken = new Set([A.personId, C.personId, D.personId]);
  const remaining = ok.filter((r) => !taken.has(r.personId));
  const selectedUi = new Set([A, C, D].map((r) => r.currentUiState));
  const selectedDomain = new Set([A, C, D].map((r) => r.domainHint));
  const pages = ok.map((r) => r.pageCount ?? 0).sort((a, b) => a - b);
  const medianPages = pages[Math.floor(pages.length / 2)] ?? 3;
  const texts = ok.map((r) => r.textLength ?? 0).sort((a, b) => a - b);
  const medianText = texts[Math.floor(texts.length / 2)] ?? 5000;

  const needPartial = ![A, C, D].some((r) => r.currentUiState === 'PARTIAL_CLASSIFICATION_SUMMARY');
  const needNoEval = ![A, C, D].some((r) => r.currentUiState === 'NO_COMPETENCY_EVALUATION');

  function diversityScore(x: Row) {
    let s = 0;
    if (!selectedUi.has(x.currentUiState)) s += 120;
    if (!selectedDomain.has(x.domainHint)) s += 90;
    if (x.documentLengthBand === 'MEDIUM') s += 50;
    if (x.structuralComplexity === 'MEDIUM_COMPLEXITY') s += 20;
    s -= Math.abs((x.pageCount ?? 0) - medianPages) * 8;
    s -= Math.abs((x.textLength ?? 0) - medianText) / 400;
    if (x.historicalCohort === 'FELIPE_TEAM' && (C.historicalCohort === 'FELIPE_TEAM' || D.historicalCohort === 'FELIPE_TEAM')) {
      s -= 40;
    }
    return s;
  }

  let bPool = remaining;
  if (needPartial) {
    const p = remaining.filter((r) => r.currentUiState === 'PARTIAL_CLASSIFICATION_SUMMARY');
    if (p.length) bPool = p;
  } else if (needNoEval) {
    const p = remaining.filter((r) => r.currentUiState === 'NO_COMPETENCY_EVALUATION');
    if (p.length) bPool = p;
  }
  const B = [...bPool].sort((a, b) => diversityScore(b) - diversityScore(a))[0];

  A.selected = 'YES';
  A.selectionCategory = 'SHORT_LOW';
  A.selectionReason = `CV corto (band=${A.documentLengthBand}, ${A.pageCount} pág, ${A.textLength} chars). Complejidad ${A.structuralComplexity} (P1 previsto ${A.predictedP1Batches}). Contraste con baseline Jesica 2 pág / 5 batches.`;

  B.selected = 'YES';
  B.selectionCategory = 'MEDIUM';
  B.selectionReason = `Tamaño medio (band=${B.documentLengthBand}, ${B.pageCount} pág). Aporta diversidad UI=${B.currentUiState} / dominio=${B.domainHint}.`;

  C.selected = 'YES';
  C.selectionCategory = 'LONG';
  C.selectionReason = `Uno de los CV más largos del universo (${C.pageCount} pág, ${C.textLength} chars, band=${C.documentLengthBand}).`;

  D.selected = 'YES';
  D.selectionCategory = 'STRUCTURALLY_COMPLEX';
  D.selectionReason = `Mayor carga estructural prevista para P1: ${D.predictedP1Batches} batches, ${D.candidateCount} candidatos, ${D.headingCount} headings, ${D.sectionCount} secciones.`;

  return { A, B, C, D };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (process.argv.includes('--from-inventory')) {
    const inventory = JSON.parse(
      readFileSync(join(OUT, 'inventory.json'), 'utf8'),
    ) as Row[];
    for (const r of inventory) {
      r.selected = 'NO';
      r.selectionCategory = null;
      r.selectionReason = null;
    }
    const unexpectedP0 = inventory.filter((r) => r.existingP0);
    const { A, B, C, D } = pickCohort(inventory);
    const selected = [A, B, C, D];
    const lengthDist = { SHORT: 0, MEDIUM: 0, LONG: 0, VERY_LONG: 0, UNKNOWN: 0 };
    const uiDist = {
      PARTIAL_CLASSIFICATION_SUMMARY: 0,
      NO_COMPETENCY_EVALUATION: 0,
      UNKNOWN: 0,
    };
    for (const r of inventory) {
      lengthDist[r.documentLengthBand] += 1;
      uiDist[r.currentUiState] += 1;
    }
    const cohortUsdLow = selected.reduce((s, r) => s + (r.estimate?.estimatedUsdRange[0] ?? 0), 0);
    const cohortUsdHigh = selected.reduce((s, r) => s + (r.estimate?.estimatedUsdRange[1] ?? 0), 0);
    const cohortCallsLow = selected.reduce(
      (s, r) => s + (r.estimate?.estimatedTotalCallsRange[0] ?? 0),
      0,
    );
    const cohortCallsHigh = selected.reduce(
      (s, r) => s + (r.estimate?.estimatedTotalCallsRange[1] ?? 0),
      0,
    );
    const cohortTokLow = selected.reduce(
      (s, r) => s + (r.estimate?.estimatedTokensRange[0] ?? 0),
      0,
    );
    const cohortTokHigh = selected.reduce(
      (s, r) => s + (r.estimate?.estimatedTokensRange[1] ?? 0),
      0,
    );
    const summary = {
      status: 'COHORT_SELECTION_READY',
      universe: 24,
      jessicaExcluded: JESSICA_ID,
      gemini: { calls: 0, tokens: 0, usd: 0 },
      cloudWrites: 0,
      mdeWrites: 0,
      otherUsersProcessed: 0,
      unexpectedP0: unexpectedP0.map((r) => ({
        personId: r.personId,
        snapshotIds: r.p0SnapshotIds,
      })),
      documentDistribution: lengthDist,
      uiDistribution: uiDist,
      selected: selected.map((r) => ({
        slot: r.selectionCategory,
        personId: r.personId,
        nombre: r.nombre,
        pages: r.pageCount,
        textLength: r.textLength,
        predictedP1Batches: r.predictedP1Batches,
        candidateCount: r.candidateCount,
        headingCount: r.headingCount,
        documentLengthBand: r.documentLengthBand,
        structuralComplexity: r.structuralComplexity,
        currentUiState: r.currentUiState,
        jobTitle: r.jobTitle,
        parentName: r.parentName,
        parentRole: r.parentRole,
        driveAreaFolder: r.driveAreaFolder,
        domainHint: r.domainHint,
        historicalCohort: r.historicalCohort,
        reason: r.selectionReason,
        estimate: r.estimate,
      })),
      estimatedCohortCost: {
        label: 'PRE_RUN_ESTIMATE',
        callsRange: [cohortCallsLow, cohortCallsHigh],
        tokensRange: [cohortTokLow, cohortTokHigh],
        usdRange: [Number(cohortUsdLow.toFixed(6)), Number(cohortUsdHigh.toFixed(6))],
      },
      next: 'STOP — WAIT_FOR_HUMAN_APPROVAL',
    };
    writeJson('summary.json', summary);
    writeJson('inventory.json', inventory);
    writeJson('selected.json', summary.selected);
    const headers = [
      'personId',
      'nombre',
      'cvActive',
      'pageCount',
      'fileSize',
      'textLength',
      'currentUiState',
      'existingP0',
      'existingExtraction',
      'extractionSkillCount',
      'jobTitle',
      'parentName',
      'parentRole',
      'driveAreaFolder',
      'domainHint',
      'documentLengthBand',
      'structuralComplexity',
      'predictedP1Batches',
      'candidateCount',
      'headingCount',
      'sectionCount',
      'selectionCategory',
      'selected',
    ];
    const csv = [
      headers.join(','),
      ...inventory.map((r) =>
        [
          r.personId,
          r.nombre,
          r.cvActive,
          r.pageCount,
          r.fileSize,
          r.textLength,
          r.currentUiState,
          r.existingP0,
          r.extractionActive,
          r.extractionSkillCount,
          r.jobTitle,
          r.parentName,
          r.parentRole,
          r.driveAreaFolder,
          r.domainHint,
          r.documentLengthBand,
          r.structuralComplexity,
          r.predictedP1Batches,
          r.candidateCount,
          r.headingCount,
          r.sectionCount,
          r.selectionCategory,
          r.selected,
        ]
          .map(csvEscape)
          .join(','),
      ),
    ].join('\n');
    writeFileSync(join(OUT, 'inventory.csv'), csv, 'utf8');
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const driveAllow = [
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ];
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'));
  for (const k of driveAllow) {
    if (driveEnv[k] && !process.env[k]?.trim()) process.env[k] = driveEnv[k];
  }
  const cloudEnv = driveEnv;
  const mdeEnv = loadEnvFile(resolve(ROOT, 'secrets/mc1-mde.local.env'));

  const experimental = {
    candidate1: 'INACTIVE (module experimental/, not imported)',
    candidate2Authority: isP2DeterministicAuthorityEnabled(),
    deterministicP2Skip: isP2DeterministicSkipGeminiEnabled(),
    shadowResolver: isShadowResolverEnabled(),
    camiloCanary: isP2CanaryEnabled(),
    semanticReuse: 'INACTIVE',
    pipelineExecuted: false,
  };

  const { Client } = require('pg') as typeof import('pg');
  const cloud = new Client({
    host: cloudEnv.DB_HOST,
    port: Number(cloudEnv.DB_PORT || 5432),
    database: cloudEnv.DB_NAME,
    user: cloudEnv.DB_USERNAME,
    password: cloudEnv.DB_PASSWORD,
    ssl: cloudEnv.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await cloud.connect();
  await cloud.query('SET default_transaction_read_only = on');

  const versionRow = (
    await cloud.query(
      `SELECT id::text AS id FROM organigrama.org_chart_version
        WHERE is_active = true ORDER BY id DESC LIMIT 1`,
    )
  ).rows[0];
  const versionId = versionRow?.id ?? null;

  const cloudRows = (
    await cloud.query(
      `SELECT DISTINCT ON (p.id)
              p.id::text AS person_id, p.full_name, p.document,
              cv.id::text AS person_cv_id, cv.drive_file_id, cv.drive_file_name,
              cv.mime_type, cv.drive_file_size::bigint AS drive_file_size,
              cv.drive_area_folder, cv.drive_subarea_folder, cv.is_active AS cv_active,
              r.name AS job_title,
              parent.full_name AS parent_name,
              pr.name AS parent_role,
              (SELECT count(*)::int FROM organigrama.mc1_person_profile_presentation prs
                WHERE prs.person_id = p.id AND prs.is_active = true) AS mc1_active,
              EXISTS (
                SELECT 1 FROM organigrama.cv_extraction ce
                 WHERE ce.person_id = p.id AND ce.is_active = true AND ce.status = 'SUCCEEDED'
              ) AS extraction_active,
              COALESCE((
                SELECT ce.skills_count FROM organigrama.cv_extraction ce
                 WHERE ce.person_id = p.id AND ce.is_active = true
                 ORDER BY ce.id DESC LIMIT 1
              ), 0)::int AS extraction_skill_count
         FROM core.person p
         LEFT JOIN organigrama.person_cv cv
           ON cv.person_id = p.id AND cv.is_active = true
         LEFT JOIN organigrama.org_chart_person_override ovr
           ON ovr.person_id = p.id AND ovr.version_id = $2
         LEFT JOIN core.role r
           ON r.id = COALESCE(ovr.role_id_override, p.role_id)
         LEFT JOIN organigrama.org_visual_relation rel
           ON rel.child_person_id = p.id AND rel.version_id = $2 AND rel.is_active = true
         LEFT JOIN core.person parent ON parent.id = rel.parent_person_id
         LEFT JOIN organigrama.org_chart_person_override povr
           ON povr.person_id = parent.id AND povr.version_id = $2
         LEFT JOIN core.role pr
           ON pr.id = COALESCE(povr.role_id_override, parent.role_id)
        WHERE p.id = ANY($1::bigint[])
        ORDER BY p.id, rel.id NULLS LAST`,
      [UNIVERSE_24, versionId],
    )
  ).rows;

  await cloud.end();

  const mde = {
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    username: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  };
  assertMdeTarget(mde);
  const mdeClient = new Client({
    host: mde.host,
    port: mde.port,
    database: mde.database,
    user: mde.username,
    password: mde.password,
  });
  await mdeClient.connect();
  await mdeClient.query('SET default_transaction_read_only = on');
  const p0Rows = (
    await mdeClient.query(
      `SELECT person_id::text, id::text AS snapshot_id, parse_status, page_count,
              person_cv_id::text, drive_file_id
         FROM organigrama.mc_cv_snapshot
        WHERE person_id = ANY($1::bigint[])`,
      [UNIVERSE_24],
    )
  ).rows;
  await mdeClient.end();

  const p0ByPerson = new Map<string, string[]>();
  for (const r of p0Rows) {
    const list = p0ByPerson.get(r.person_id) ?? [];
    list.push(r.snapshot_id);
    p0ByPerson.set(r.person_id, list);
  }

  const extractor = new UnpdfCvDocumentTextExtractor();
  const normalizer = new CvTextNormalizer();
  const sectioner = new CvSectionDetector();
  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const batcher = new P1EvidenceBatchBuilder();

  const byId = new Map(cloudRows.map((r) => [String(r.person_id), r]));
  const inventory: Row[] = [];

  for (const personId of UNIVERSE_24) {
    const c = byId.get(personId);
    const hist = HISTORICAL[personId];
    const errors: string[] = [];
    const row: Row = {
      personId,
      nombre: c?.full_name ?? '(missing in Cloud)',
      document: c?.document ?? null,
      cvActive: Boolean(c?.cv_active),
      personCvId: c?.person_cv_id ?? null,
      driveFileId: c?.drive_file_id ?? null,
      driveFileName: c?.drive_file_name ?? null,
      mimeType: c?.mime_type ?? null,
      fileSize: c?.drive_file_size != null ? Number(c.drive_file_size) : null,
      driveAreaFolder: c?.drive_area_folder ?? null,
      driveSubareaFolder: c?.drive_subarea_folder ?? null,
      jobTitle: c?.job_title ?? null,
      parentName: c?.parent_name ?? null,
      parentRole: c?.parent_role ?? null,
      currentUiState: UI_FROM_AUDIT[personId] ?? 'UNKNOWN',
      apiAvailability: null,
      mc1PresentationActive: Number(c?.mc1_active ?? 0),
      extractionActive: Boolean(c?.extraction_active),
      extractionSkillCount: Number(c?.extraction_skill_count ?? 0),
      existingP0: (p0ByPerson.get(personId) ?? []).length > 0,
      p0SnapshotIds: p0ByPerson.get(personId) ?? [],
      parseStatus: null,
      pageCount: null,
      textLength: null,
      charsPerPage: null,
      sectionCount: null,
      headingCount: null,
      candidateCount: null,
      predictedP1Batches: null,
      documentLengthBand: 'UNKNOWN',
      structuralComplexity: 'UNKNOWN',
      domainHint: inferDomain(
        c?.job_title ?? null,
        c?.drive_area_folder ?? null,
        c?.drive_subarea_folder ?? null,
        hist?.domainHint,
      ),
      historicalCohort: hist?.cohort ?? null,
      historicalNotes: hist?.notes ?? null,
      lengthScore: 0,
      complexityScore: 0,
      selected: 'NO',
      selectionCategory: null,
      selectionReason: null,
      estimate: null,
      errors,
    };

    if (!c) errors.push('CLOUD_PERSON_MISSING');
    if (!row.driveFileId) errors.push('NO_ACTIVE_DRIVE_FILE');

    if (row.driveFileId) {
      try {
        const buffer = await downloadCvPdfBuffer(row.driveFileId);
        if (row.fileSize == null) row.fileSize = buffer.length;
        const extracted = await extractor.extract({
          buffer,
          mimeType: row.mimeType || 'application/pdf',
          fileName: row.driveFileName || `${personId}.pdf`,
        });
        row.parseStatus = extracted.status;
        row.pageCount = extracted.pageCount;
        const norm = normalizer.normalize(extracted.rawText || '');
        row.textLength = norm.normalizedText.length;
        row.charsPerPage =
          row.pageCount && row.pageCount > 0
            ? Math.round(row.textLength / row.pageCount)
            : row.textLength;
        if (extracted.status === 'PARSED' && norm.normalizedText.length > 0) {
          const sections = sectioner.detect({
            normalizedText: norm.normalizedText,
            pages: extracted.pages,
          });
          row.sectionCount = sections.sections.length;
          const segmented = segmenter.segment({
            snapshotId: `inventory-only-${personId}`,
            normalizedText: norm.normalizedText,
            pages: extracted.pages,
            sectionedContent: sections,
          });
          row.candidateCount = segmented.metrics.candidateCount;
          row.headingCount = segmented.metrics.headingCount;
          row.predictedP1Batches = batcher.build(segmented.candidates).length;
          row.documentLengthBand = documentLengthBand(row.pageCount ?? 0, row.textLength);
          row.structuralComplexity = structuralComplexity(
            row.predictedP1Batches,
            row.candidateCount,
            row.headingCount ?? 0,
            row.pageCount ?? 0,
            row.sectionCount ?? 0,
          );
        } else {
          errors.push(`PARSE_${extracted.status}`);
        }
      } catch (e) {
        errors.push(`DRIVE_OR_PARSE: ${String(e instanceof Error ? e.message : e).slice(0, 180)}`);
      }
    }

    row.lengthScore = (row.pageCount ?? 0) * 10000 + (row.textLength ?? 0);
    row.complexityScore =
      (row.predictedP1Batches ?? 0) * 1000 +
      (row.candidateCount ?? 0) +
      (row.headingCount ?? 0) * 10 +
      (row.sectionCount ?? 0) * 15 +
      Math.round((row.charsPerPage ?? 0) / 20);
    row.estimate = estimateCost(row.predictedP1Batches, row.pageCount);
    inventory.push(row);
    process.stderr.write(
      `${personId} ${row.nombre} pages=${row.pageCount} batches=${row.predictedP1Batches} ${row.documentLengthBand}/${row.structuralComplexity}\n`,
    );
  }

  const unexpectedP0 = inventory.filter((r) => r.existingP0);
  const { A, B, C, D } = pickCohort(inventory);
  const selected = [A, B, C, D];

  const lengthDist = { SHORT: 0, MEDIUM: 0, LONG: 0, VERY_LONG: 0, UNKNOWN: 0 };
  const uiDist = {
    PARTIAL_CLASSIFICATION_SUMMARY: 0,
    NO_COMPETENCY_EVALUATION: 0,
    UNKNOWN: 0,
  };
  for (const r of inventory) {
    lengthDist[r.documentLengthBand] += 1;
    uiDist[r.currentUiState] += 1;
  }

  const cohortUsdLow = selected.reduce((s, r) => s + (r.estimate?.estimatedUsdRange[0] ?? 0), 0);
  const cohortUsdHigh = selected.reduce((s, r) => s + (r.estimate?.estimatedUsdRange[1] ?? 0), 0);
  const cohortCallsLow = selected.reduce(
    (s, r) => s + (r.estimate?.estimatedTotalCallsRange[0] ?? 0),
    0,
  );
  const cohortCallsHigh = selected.reduce(
    (s, r) => s + (r.estimate?.estimatedTotalCallsRange[1] ?? 0),
    0,
  );
  const cohortTokLow = selected.reduce(
    (s, r) => s + (r.estimate?.estimatedTokensRange[0] ?? 0),
    0,
  );
  const cohortTokHigh = selected.reduce(
    (s, r) => s + (r.estimate?.estimatedTokensRange[1] ?? 0),
    0,
  );

  const summary = {
    status: 'COHORT_SELECTION_READY',
    universe: 24,
    jessicaExcluded: JESSICA_ID,
    gemini: { calls: 0, tokens: 0, usd: 0 },
    cloudWrites: 0,
    mdeWrites: 0,
    otherUsersProcessed: 0,
    experimental,
    unexpectedP0: unexpectedP0.map((r) => ({
      personId: r.personId,
      snapshotIds: r.p0SnapshotIds,
    })),
    documentDistribution: lengthDist,
    uiDistribution: uiDist,
    selected: selected.map((r) => ({
      slot: r.selectionCategory,
      personId: r.personId,
      nombre: r.nombre,
      pages: r.pageCount,
      textLength: r.textLength,
      predictedP1Batches: r.predictedP1Batches,
      documentLengthBand: r.documentLengthBand,
      structuralComplexity: r.structuralComplexity,
      currentUiState: r.currentUiState,
      jobTitle: r.jobTitle,
      parentName: r.parentName,
      parentRole: r.parentRole,
      domainHint: r.domainHint,
      reason: r.selectionReason,
      estimate: r.estimate,
    })),
    estimatedCohortCost: {
      label: 'PRE_RUN_ESTIMATE',
      callsRange: [cohortCallsLow, cohortCallsHigh],
      tokensRange: [cohortTokLow, cohortTokHigh],
      usdRange: [Number(cohortUsdLow.toFixed(6)), Number(cohortUsdHigh.toFixed(6))],
    },
    lengthBandPolicy: {
      SHORT: 'pages<=2 AND chars<4000; if conflict, max(pageBand,charBand)',
      MEDIUM: 'pages 3-4 or chars 4000-7999',
      LONG: 'pages 5-7 or chars 8000-14999',
      VERY_LONG: 'pages>=8 or chars>=15000',
    },
    complexityPolicy: {
      LOW_COMPLEXITY: 'P1 batches<=4 AND candidates<40 AND pages<=3',
      MEDIUM_COMPLEXITY: 'otherwise, typical 5-7 batches (Jesica=5 → MEDIUM)',
      HIGH_COMPLEXITY:
        'batches>=8 OR candidates>80 OR headings>=12 OR pages>=6 OR sections>=8',
    },
    jessicaBaseline: JESSICA_BASELINE,
    pricing: PRICING,
    next: 'STOP — WAIT_FOR_HUMAN_APPROVAL',
  };

  writeJson('summary.json', summary);
  writeJson('inventory.json', inventory);
  writeJson('selected.json', summary.selected);
  writeJson('unexpected-p0.json', summary.unexpectedP0);

  const headers = [
    'personId',
    'nombre',
    'cvActive',
    'pageCount',
    'fileSize',
    'textLength',
    'currentUiState',
    'existingP0',
    'existingExtraction',
    'extractionSkillCount',
    'jobTitle',
    'parentName',
    'parentRole',
    'driveAreaFolder',
    'domainHint',
    'documentLengthBand',
    'structuralComplexity',
    'predictedP1Batches',
    'candidateCount',
    'headingCount',
    'sectionCount',
    'selectionCategory',
    'selected',
  ];
  const csv = [
    headers.join(','),
    ...inventory.map((r) =>
      [
        r.personId,
        r.nombre,
        r.cvActive,
        r.pageCount,
        r.fileSize,
        r.textLength,
        r.currentUiState,
        r.existingP0,
        r.extractionActive,
        r.extractionSkillCount,
        r.jobTitle,
        r.parentName,
        r.parentRole,
        r.driveAreaFolder,
        r.domainHint,
        r.documentLengthBand,
        r.structuralComplexity,
        r.predictedP1Batches,
        r.candidateCount,
        r.headingCount,
        r.sectionCount,
        r.selectionCategory,
        r.selected,
      ]
        .map(csvEscape)
        .join(','),
    ),
  ].join('\n');
  writeFileSync(join(OUT, 'inventory.csv'), csv, 'utf8');

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
