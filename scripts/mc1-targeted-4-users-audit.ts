/**
 * Targeted 4: Felipe 1303, Raul 1082, Leidy 1077, Sara 1268.
 * --audit   identity + recovery + cost (0 Gemini)
 * --confirm execute from first missing AI stage if HIGH USD <= 1.50
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { UnpdfCvDocumentTextExtractor } from '../src/mc-pipeline/p0/unpdf-text-extractor.adapter';
import { CvTextNormalizer } from '../src/mc-pipeline/p0/cv-text-normalizer';
import { CvSectionDetector } from '../src/mc-pipeline/p0/cv-section-detector';
import { DeterministicEvidenceCandidateSegmenter } from '../src/mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../src/mc-pipeline/p1/p1-evidence-batch-builder';
import { downloadCvPdfBuffer } from '../src/database/scripts/utils/google-drive-cv-client';
import { assertMdeTarget } from '../src/mc-pipeline/p0/mde-guard';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
  isShadowResolverEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';
import { isP2CanaryEnabled } from '../src/mc-pipeline/shadow-resolver/canary-design';

const ROOT = resolve(__dirname, '..');
const REPO = resolve(ROOT, '..');
const OUT = resolve(REPO, 'tmp', 'mc1-targeted-4-users-controlled-reprocessing');
const GUARDRAIL = 1.5;

const TARGETS = [
  {
    key: 'felipe',
    expectedName: 'FELIPE GUERRERO BUENAVENTURA',
    expectedDocument: '1013608570',
    expectedPersonId: '1303',
  },
  {
    key: 'raul',
    expectedName: 'RAUL VALENCIA CIFUENTES',
    expectedDocument: '80723984',
    expectedPersonId: '1082',
  },
  {
    key: 'leidy',
    expectedName: 'LEIDY VIVIANA BERNAL LEÓN',
    expectedDocument: '1070007550',
    expectedPersonId: '1077',
  },
  {
    key: 'sara',
    expectedName: 'SARA MURILLO FONSECA',
    expectedDocument: '1000810767',
    expectedPersonId: '1268',
  },
] as const;

const PRICING = { INPUT_PRICE: 0.75, OUTPUT_PRICE: 3.75, MODEL: 'gemini-3.6-flash' };
const P1_TOKENS_PER_BATCH = 6280.9;
const P234_TOKENS_EXP = 50320;
const P1_IN_RATIO = 0.446;

function loadEnvFile(path: string) {
  const out: Record<string, string> = {};
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i <= 0) continue;
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function writeJson(name: string, data: unknown) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2), 'utf8');
}

function usd(input: number, billed: number) {
  return (input * PRICING.INPUT_PRICE + billed * PRICING.OUTPUT_PRICE) / 1_000_000;
}

function estimateFromBatches(batches: number, needP1: boolean, nAiStages: number) {
  if (nAiStages === 0) {
    return { callsLow: 0, callsExp: 0, callsHigh: 0, tokensLow: 0, tokensExp: 0, tokensHigh: 0, usdLow: 0, usdExp: 0, usdHigh: 0 };
  }
  const p1Calls = needP1 ? batches : 0;
  const otherCalls = Math.max(0, nAiStages - (needP1 ? 1 : 0));
  const p1Tok = p1Calls * P1_TOKENS_PER_BATCH;
  const otherTok = otherCalls ? P234_TOKENS_EXP * (otherCalls / 3) : 0;
  const expTok = p1Tok + otherTok;
  const lowTok = expTok * 0.85;
  const highTok = expTok * 1.32;
  const split = (tok: number) => {
    const input = tok * P1_IN_RATIO;
    return { tokens: Math.round(tok), usd: Number(usd(input, tok - input).toFixed(6)) };
  };
  const L = split(lowTok);
  const E = split(expTok);
  const H = split(highTok);
  return {
    callsLow: p1Calls + Math.max(0, otherCalls - 1),
    callsExp: p1Calls + otherCalls,
    callsHigh: p1Calls + otherCalls,
    tokensLow: L.tokens,
    tokensExp: E.tokens,
    tokensHigh: H.tokens,
    usdLow: L.usd,
    usdExp: E.usd,
    usdHigh: H.usd,
  };
}

function walkFiles(dir: string, acc: string[], depth = 0) {
  if (depth > 8 || !existsSync(dir)) return;
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkFiles(p, acc, depth + 1);
    else if (/\.(json|jsonl|md)$/i.test(name) && st.size < 8_000_000) acc.push(p);
  }
}

function fileMentionsPerson(file: string, personId: string): boolean {
  try {
    const t = readFileSync(file, 'utf8');
    const re = new RegExp(`"personId"\\s*:\\s*"${personId}"|"person_id"\\s*:\\s*"?${personId}"?`);
    if (!re.test(t)) return false;
    if (/ceu_/.test(t) && !new RegExp(`"personId"\\s*:\\s*"${personId}"`).test(t)) return false;
    return true;
  } catch {
    return false;
  }
}

function classifyStage(args: {
  cloudPresentation: boolean;
  profilePack: boolean;
  p4: boolean;
  p3: boolean;
  p2: boolean;
  p1: boolean;
  p0: boolean;
}) {
  if (args.cloudPresentation) return { cls: 'A', first: 'NONE', firstAi: null as string | null };
  if (args.profilePack) return { cls: 'B', first: 'IMPORT', firstAi: null };
  if (args.p3 && args.p4) return { cls: 'C', first: 'PROFILE', firstAi: null };
  if (args.p3) return { cls: 'D', first: 'P4', firstAi: 'P4' };
  if (args.p2) return { cls: 'E', first: 'P3', firstAi: 'P3' };
  if (args.p1) return { cls: 'F', first: 'P2', firstAi: 'P2' };
  if (args.p0) return { cls: 'G', first: 'P1', firstAi: 'P1' };
  return { cls: 'H', first: 'P0', firstAi: 'P1' };
}

async function audit() {
  mkdirSync(OUT, { recursive: true });
  const driveEnv = loadEnvFile(resolve(ROOT, '.env'));
  for (const k of [
    'GOOGLE_DRIVE_CV_FOLDER_ID',
    'GOOGLE_DRIVE_CV_TOKEN_PATH',
    'GOOGLE_DRIVE_CV_AUTH_MODE',
    'GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH',
  ]) {
    if (driveEnv[k] && !process.env[k]?.trim()) process.env[k] = driveEnv[k];
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

  const cloud = new Client({
    host: driveEnv.DB_HOST,
    port: Number(driveEnv.DB_PORT || 5432),
    database: driveEnv.DB_NAME,
    user: driveEnv.DB_USERNAME,
    password: driveEnv.DB_PASSWORD,
    ssl: driveEnv.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await cloud.connect();
  await cloud.query('SET default_transaction_read_only = on');

  const versionId = (
    await cloud.query(
      `SELECT id::text AS id FROM organigrama.org_chart_version WHERE is_active = true ORDER BY id DESC LIMIT 1`,
    )
  ).rows[0]?.id;

  const identities: Record<string, unknown>[] = [];
  for (const t of TARGETS) {
    const byDoc = (
      await cloud.query(
        `SELECT p.id::text, p.full_name, p.document, p.edu_email, p.is_active,
                r.name AS job_title
           FROM core.person p
           LEFT JOIN organigrama.org_chart_person_override ovr
             ON ovr.person_id = p.id AND ovr.version_id = $2
           LEFT JOIN core.role r ON r.id = COALESCE(ovr.role_id_override, p.role_id)
          WHERE p.document = $1`,
        [t.expectedDocument, versionId],
      )
    ).rows;
    const byName = (
      await cloud.query(
        `SELECT p.id::text, p.full_name, p.document
           FROM core.person p
          WHERE upper(p.full_name) = upper($1)`,
        [t.expectedName],
      )
    ).rows;
    const fuzzy = (
      await cloud.query(
        `SELECT p.id::text, p.full_name, p.document
           FROM core.person p
          WHERE p.full_name ILIKE $1`,
        [`%${t.expectedName.split(' ')[0]}%${t.expectedName.split(' ').slice(-1)[0]}%`],
      )
    ).rows;
    const row = byDoc[0];
    const ambiguous =
      byDoc.length !== 1 ||
      !row ||
      String(row.id) !== t.expectedPersonId ||
      String(row.document) !== t.expectedDocument ||
      byName.some((n: { id: string }) => n.id !== t.expectedPersonId);
    identities.push({
      key: t.key,
      expected: t,
      resolved: row
        ? {
            personId: row.id,
            fullName: row.full_name,
            document: row.document,
            eduEmail: row.edu_email,
            jobTitle: row.job_title,
            isActive: row.is_active,
          }
        : null,
      byDocumentCount: byDoc.length,
      byExactName: byName,
      fuzzyNameHits: fuzzy,
      identityOk: !ambiguous,
      ambiguityReason: ambiguous
        ? `docHits=${byDoc.length} id=${row?.id} expected=${t.expectedPersonId}`
        : null,
    });
  }

  const ids = TARGETS.map((t) => t.expectedPersonId);
  const cloudRows = (
    await cloud.query(
      `SELECT p.id::text AS person_id, p.full_name, p.document,
              cv.id::text AS person_cv_id, cv.drive_file_id, cv.drive_file_name,
              cv.mime_type, cv.drive_file_size::bigint AS drive_file_size,
              cv.is_active AS cv_active,
              r.name AS job_title,
              parent.full_name AS parent_name,
              pr.name AS parent_role,
              (SELECT count(*)::int FROM organigrama.mc1_person_profile_presentation prs
                WHERE prs.person_id = p.id AND prs.is_active = true) AS mc1_active,
              (SELECT count(*)::int FROM organigrama.mc1_person_profile_presentation prs
                WHERE prs.person_id = p.id) AS mc1_any,
              EXISTS (
                SELECT 1 FROM organigrama.cv_extraction ce
                 WHERE ce.person_id = p.id AND ce.is_active = true AND ce.status = 'SUCCEEDED'
              ) AS extraction_active,
              COALESCE((
                SELECT ce.skills_count FROM organigrama.cv_extraction ce
                 WHERE ce.person_id = p.id AND ce.is_active = true
                 ORDER BY ce.id DESC LIMIT 1
              ), 0)::int AS extraction_skill_count,
              COALESCE((
                SELECT count(*)::int FROM organigrama.cv_evidence_evaluation ev
                 JOIN organigrama.cv_extraction ce ON ce.id = ev.extraction_id
                WHERE ce.person_id = p.id AND ev.is_active = true AND ev.status = 'SUCCEEDED'
              ), 0)::int AS pa2_active
         FROM core.person p
         LEFT JOIN organigrama.person_cv cv
           ON cv.person_id = p.id AND cv.is_active = true
         LEFT JOIN organigrama.org_chart_person_override ovr
           ON ovr.person_id = p.id AND ovr.version_id = $2
         LEFT JOIN core.role r ON r.id = COALESCE(ovr.role_id_override, p.role_id)
         LEFT JOIN organigrama.org_visual_relation rel
           ON rel.child_person_id = p.id AND rel.version_id = $2 AND rel.is_active = true
         LEFT JOIN core.person parent ON parent.id = rel.parent_person_id
         LEFT JOIN organigrama.org_chart_person_override povr
           ON povr.person_id = parent.id AND povr.version_id = $2
         LEFT JOIN core.role pr ON pr.id = COALESCE(povr.role_id_override, parent.role_id)
        WHERE p.id = ANY($1::bigint[])
        ORDER BY p.id`,
      [ids, versionId],
    )
  ).rows;
  await cloud.end();

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
              person_cv_id::text, drive_file_id, char_length(normalized_text) AS nlen
         FROM organigrama.mc_cv_snapshot
        WHERE person_id = ANY($1::bigint[])`,
      [ids],
    )
  ).rows;
  let mdeP1 = [];
  try {
    mdeP1 = (
      await mdeClient.query(
        `SELECT person_id::text, count(*)::int AS n
           FROM organigrama.mc_p1_run
          WHERE person_id = ANY($1::bigint[])
          GROUP BY person_id`,
        [ids],
      )
    ).rows;
  } catch {
    mdeP1 = [];
  }
  await mdeClient.end();

  const searchRoots = [
    join(REPO, 'tmp'),
    join(ROOT, 'tmp'),
    join(ROOT, 'docs'),
    join(REPO, 'docs'),
  ];
  const fsHits: Record<string, string[]> = { '1303': [], '1082': [], '1077': [], '1268': [] };
  for (const root of searchRoots) {
    const files: string[] = [];
    walkFiles(root, files);
    for (const f of files) {
      for (const id of ids) {
        if (fileMentionsPerson(f, id)) fsHits[id].push(f.replace(REPO + '\\', '').replace(REPO + '/', ''));
      }
    }
  }

  const extractor = new UnpdfCvDocumentTextExtractor();
  const normalizer = new CvTextNormalizer();
  const sectioner = new CvSectionDetector();
  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const batcher = new P1EvidenceBatchBuilder();

  const byId = new Map(cloudRows.map((r) => [String(r.person_id), r]));
  const people = [];
  for (const t of TARGETS) {
    const ident = identities.find((i) => i.key === t.key) as Record<string, unknown>;
    const c = byId.get(t.expectedPersonId);
    const p0 = p0Rows.filter((r) => r.person_id === t.expectedPersonId);
    const reusableP0 = p0.find((r) => r.parse_status === 'PARSED' && Number(r.nlen) > 100);
    let pageCount: number | null = null;
    let textLength: number | null = null;
    let predictedP1: number | null = null;
    let parseStatus: string | null = null;
    const errors: string[] = [];
    if (c?.drive_file_id) {
      try {
        const buffer = await downloadCvPdfBuffer(c.drive_file_id);
        const extracted = await extractor.extract({
          buffer,
          mimeType: c.mime_type || 'application/pdf',
          fileName: c.drive_file_name || `${t.expectedPersonId}.pdf`,
        });
        parseStatus = extracted.status;
        pageCount = extracted.pageCount;
        const norm = normalizer.normalize(extracted.rawText || '');
        textLength = norm.normalizedText.length;
        if (extracted.status === 'PARSED' && norm.normalizedText.length > 0) {
          const sections = sectioner.detect({
            normalizedText: norm.normalizedText,
            pages: extracted.pages,
          });
          const segmented = segmenter.segment({
            snapshotId: `audit-only-${t.expectedPersonId}`,
            normalizedText: norm.normalizedText,
            pages: extracted.pages,
            sectionedContent: sections,
          });
          predictedP1 = batcher.build(segmented.candidates).length;
        }
      } catch (e) {
        errors.push(String(e instanceof Error ? e.message : e).slice(0, 200));
      }
    }
    const fs = fsHits[t.expectedPersonId] ?? [];
    const hasP1Pack = fs.some((f) => /p1|validated-evidence|mc1-p1-prototype/i.test(f) && /personId/.test(f));
    const hasP2 = fs.some((f) => /[\\/]p2[\\/]|P2F-/i.test(f));
    const hasP3 = fs.some((f) => /[\\/]p3[\\/]|P3F-/i.test(f));
    const hasP4 = fs.some((f) => /[\\/]p4[\\/]|P4F-/i.test(f));
    const hasProfile = fs.some((f) => /profile-contract|PROF-8E/i.test(f));
    const classified = classifyStage({
      cloudPresentation: Number(c?.mc1_active ?? 0) > 0,
      profilePack: hasProfile,
      p4: hasP4,
      p3: hasP3,
      p2: hasP2,
      p1: hasP1Pack || Number((mdeP1 as Array<{ person_id: string; n: number }>).find((r) => r.person_id === t.expectedPersonId)?.n ?? 0) > 0,
      p0: Boolean(reusableP0),
    });
    const needP1 = classified.firstAi === 'P1';
    const nAi =
      classified.firstAi === null
        ? 0
        : classified.firstAi === 'P1'
          ? 4
          : classified.firstAi === 'P2'
            ? 3
            : classified.firstAi === 'P3'
              ? 2
              : 1;
    const est = estimateFromBatches(predictedP1 ?? 5, needP1, nAi);
    const ui =
      Number(c?.mc1_active ?? 0) > 0
        ? 'MC1_AVAILABLE'
        : Number(c?.pa2_active ?? 0) > 0
          ? 'LEGACY_PROFILE'
          : c?.extraction_active
            ? 'PARTIAL_CLASSIFICATION_SUMMARY'
            : 'NO_COMPETENCY_EVALUATION';
    people.push({
      key: t.key,
      personId: t.expectedPersonId,
      identityOk: ident.identityOk,
      identity: ident,
      cloud: {
        fullName: c?.full_name,
        document: c?.document,
        personCvId: c?.person_cv_id ?? null,
        driveFileId: c?.drive_file_id ?? null,
        driveFileName: c?.drive_file_name ?? null,
        fileSize: c?.drive_file_size != null ? Number(c.drive_file_size) : null,
        jobTitle: c?.job_title ?? null,
        parentName: c?.parent_name ?? null,
        parentRole: c?.parent_role ?? null,
        mc1Active: Number(c?.mc1_active ?? 0),
        mc1Any: Number(c?.mc1_any ?? 0),
        extractionActive: Boolean(c?.extraction_active),
        extractionSkillCount: Number(c?.extraction_skill_count ?? 0),
        pa2Active: Number(c?.pa2_active ?? 0),
        ui,
      },
      mde: {
        snapshots: p0,
        reusableP0: Boolean(reusableP0),
        p1Runs: (mdeP1 as Array<{ person_id: string; n: number }>).find((r) => r.person_id === t.expectedPersonId)?.n ?? 0,
      },
      filesystemHits: fs.slice(0, 40),
      filesystemHitCount: fs.length,
      packs: { p1: hasP1Pack, p2: hasP2, p3: hasP3, p4: hasP4, profile: hasProfile },
      cvMeasure: { parseStatus, pageCount, textLength, predictedP1Batches: predictedP1, errors },
      recoveryClass: classified.cls,
      firstRequiredStage: classified.first,
      firstRequiredAiStage: classified.firstAi,
      p0Reusable: Boolean(reusableP0),
      p1Required: classified.firstAi === 'P1',
      p2Required: classified.firstAi === 'P1' || classified.firstAi === 'P2',
      p3Required: ['P1', 'P2', 'P3'].includes(String(classified.firstAi)),
      p4Required: ['P1', 'P2', 'P3', 'P4'].includes(String(classified.firstAi)),
      estimate: est,
    });
    process.stderr.write(
      `${t.key} ${t.expectedPersonId} class=${classified.cls} first=${classified.first} pages=${pageCount} p1=${predictedP1} usdExp=${est.usdExp}\n`,
    );
  }

  const totals = people.reduce(
    (s, p) => ({
      usdExp: s.usdExp + (p.estimate.usdExp ?? 0),
      usdHigh: s.usdHigh + (p.estimate.usdHigh ?? 0),
      callsExp: s.callsExp + (p.estimate.callsExp ?? 0),
      tokensExp: s.tokensExp + (p.estimate.tokensExp ?? 0),
    }),
    { usdExp: 0, usdHigh: 0, callsExp: 0, tokensExp: 0 },
  );
  const identityFail = people.filter((p) => !p.identityOk);
  const order = [...people].sort((a, b) => (a.estimate.usdExp ?? 0) - (b.estimate.usdExp ?? 0));
  const experimental = {
    candidate2Authority: isP2DeterministicAuthorityEnabled(),
    deterministicP2Skip: isP2DeterministicSkipGeminiEnabled(),
    shadow: isShadowResolverEnabled(),
    camilo: isP2CanaryEnabled(),
  };
  const summary = {
    status:
      identityFail.length
        ? 'IDENTITY_AMBIGUOUS'
        : totals.usdHigh > GUARDRAIL
          ? 'BUDGET_APPROVAL_REQUIRED'
          : 'PREFLIGHT_OK',
    gemini: { calls: 0, tokens: 0, usd: 0 },
    experimental,
    guardrail: GUARDRAIL,
    TOTAL_EXPECTED_USD: Number(totals.usdExp.toFixed(6)),
    TOTAL_HIGH_USD: Number(totals.usdHigh.toFixed(6)),
    TOTAL_EXPECTED_CALLS: totals.callsExp,
    TOTAL_EXPECTED_TOKENS: totals.tokensExp,
    executionOrder: order.map((p) => p.personId),
    people,
  };
  writeJson('audit.json', summary);
  writeJson('preflight.json', {
    status: summary.status,
    TOTAL_EXPECTED_USD: summary.TOTAL_EXPECTED_USD,
    TOTAL_HIGH_USD: summary.TOTAL_HIGH_USD,
    guardrail: GUARDRAIL,
    table: people.map((p) => ({
      persona: p.cloud.fullName,
      personId: p.personId,
      recoveryClass: p.recoveryClass,
      p1Batches: p.cvMeasure.predictedP1Batches,
      firstAiStage: p.firstRequiredAiStage,
      callsExp: p.estimate.callsExp,
      tokensExp: p.estimate.tokensExp,
      usdExp: p.estimate.usdExp,
      usdHigh: p.estimate.usdHigh,
    })),
    executionOrder: summary.executionOrder,
  });
  console.log(JSON.stringify({ status: summary.status, preflight: summary.preflight ?? {
    TOTAL_EXPECTED_USD: summary.TOTAL_EXPECTED_USD,
    TOTAL_HIGH_USD: summary.TOTAL_HIGH_USD,
    table: people.map((p) => ({
      personId: p.personId,
      class: p.recoveryClass,
      first: p.firstRequiredStage,
      batches: p.cvMeasure.predictedP1Batches,
      usdExp: p.estimate.usdExp,
      usdHigh: p.estimate.usdHigh,
    })),
    order: summary.executionOrder,
  }, identityOk: people.map((p) => ({ key: p.key, ok: p.identityOk })) }, null, 2));
}

audit().catch((e) => {
  console.error(e);
  process.exit(1);
});
