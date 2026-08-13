/**
 * Diagnóstico Leidy Marcela (personId 1197 / personCvId 195).
 * Cloud RO + Drive download + unpdf extract. Sin writes Cloud.
 *
 *   npx ts-node --transpile-only scripts/mc1-leidy-cv-diagnose.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { extractText, getDocumentProxy } from 'unpdf';
import {
  downloadCvPdfBuffer,
  inventoryCvPdfFiles,
} from '../src/database/scripts/utils/google-drive-cv-client';

function loadEnv(p: string): Record<string, string> {
  const o: Record<string, string> = {};
  if (!existsSync(p)) return o;
  for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('=');
    if (i <= 0) continue;
    o[l.slice(0, i).trim()] = l
      .slice(i + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
  }
  return o;
}

const ROOT = resolve(__dirname, '..');
const OUT_DIR = resolve(ROOT, 'tmp', 'mc1-leidy-cv-recovery');
const PERSON_ID = 1197;
const PERSON_CV_ID = 195;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Load dotenv for Drive OAuth
  const cloud = loadEnv(join(ROOT, '.env'));
  for (const [k, v] of Object.entries(cloud)) {
    if (!process.env[k]) process.env[k] = v;
  }
  const mdeEnv = loadEnv(join(ROOT, 'secrets', 'mc1-mde.local.env'));

  const cloudClient = new Client({
    host: cloud.DB_HOST,
    port: Number(cloud.DB_PORT || 5432),
    database: cloud.DB_NAME,
    user: cloud.DB_USERNAME,
    password: cloud.DB_PASSWORD,
    ssl:
      String(cloud.DB_SSL).toLowerCase() === 'true'
        ? { rejectUnauthorized: false }
        : undefined,
  });
  await cloudClient.connect();

  const person = await cloudClient.query(
    `SELECT id::text, full_name, document, COALESCE(is_active,true) AS is_active
       FROM core.person WHERE id = $1`,
    [PERSON_ID],
  );

  const allCvs = await cloudClient.query(
    `SELECT id::text, person_id::text, drive_file_id, drive_file_name,
            drive_web_url, mime_type, drive_file_size::text,
            drive_modified_time, is_active, synced_at, created_at
       FROM organigrama.person_cv
      WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [PERSON_ID],
  );

  const activeCv = await cloudClient.query(
    `SELECT id::text, person_id::text, drive_file_id, drive_file_name,
            drive_web_url, mime_type, drive_file_size::text,
            drive_modified_time, is_active, synced_at
       FROM organigrama.person_cv WHERE id = $1`,
    [PERSON_CV_ID],
  );

  await cloudClient.end();

  const mdeClient = new Client({
    host: mdeEnv.MDE_DB_HOST,
    port: Number(mdeEnv.MDE_DB_PORT),
    database: mdeEnv.MDE_DB_NAME,
    user: mdeEnv.MDE_DB_USERNAME,
    password: mdeEnv.MDE_DB_PASSWORD,
  });
  await mdeClient.connect();
  const mdeSnaps = await mdeClient.query(
    `SELECT id::text, person_cv_id::text, parse_status, page_count,
            length(COALESCE(raw_text,'')) AS raw_len,
            length(COALESCE(normalized_text,'')) AS norm_len,
            left(COALESCE(normalized_text,''), 300) AS sample,
            extractor_name, extractor_version, created_at
       FROM organigrama.mc_cv_snapshot
      WHERE person_cv_id = $1
      ORDER BY id DESC`,
    [PERSON_CV_ID],
  );
  const mdeCv = await mdeClient.query(
    `SELECT id::text, person_id::text, drive_file_id, drive_file_name,
            mime_type, drive_file_size::text, is_active
       FROM organigrama.person_cv WHERE id = $1 OR person_id = $2
      ORDER BY id`,
    [PERSON_CV_ID, PERSON_ID],
  );
  await mdeClient.end();

  let download: Record<string, unknown> | null = null;
  let extraction: Record<string, unknown> | null = null;
  const cvRow = activeCv.rows[0] as
    | {
        drive_file_id: string;
        mime_type: string;
        drive_file_name: string;
      }
    | undefined;

  if (cvRow?.drive_file_id) {
    try {
      const buf = await downloadCvPdfBuffer(cvRow.drive_file_id);
      const magic = buf.subarray(0, 8).toString('utf8');
      const pdfPath = join(OUT_DIR, `leidy-cv-${PERSON_CV_ID}.pdf`);
      writeFileSync(pdfPath, buf);
      download = {
        ok: true,
        byteLength: buf.length,
        magic,
        looksLikePdf: magic.startsWith('%PDF'),
        savedTo: pdfPath,
      };

      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { totalPages, text } = await extractText(pdf, {
        mergePages: false,
      });
      const pageTexts = Array.isArray(text) ? text : [String(text ?? '')];
      const pages = pageTexts.map((t, i) => ({
        pageNumber: i + 1,
        characterCount: String(t ?? '').length,
        sample: String(t ?? '')
          .replace(/\s+/g, ' ')
          .slice(0, 160),
      }));
      const totalChars = pages.reduce((s, p) => s + p.characterCount, 0);
      extraction = {
        via: 'unpdf-direct-same-as-P0',
        totalPages,
        totalChars,
        pages,
        statusGuess:
          totalChars === 0
            ? 'EMPTY_DOCUMENT'
            : totalPages >= 2 && totalChars < Math.max(30, totalPages * 12)
              ? 'SCANNED_OR_IMAGE_ONLY'
              : totalChars < 8
                ? 'SCANNED_OR_IMAGE_ONLY'
                : 'PARSED',
      };
    } catch (e) {
      download = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  let driveMatches: Record<string, unknown> | null = null;
  try {
    const inv = await inventoryCvPdfFiles();
    const files = inv.files || [];
    const doc = (person.rows[0] as { document?: string } | undefined)?.document || '';
    const nameRe =
      /leidy|gonz[aá]lez\s*olaya|olaya\s*gonz|marcela.*gonz|gonz.*marcela/i;
    driveMatches = {
      inventoryCount: inv.pdfCount ?? files.length,
      matched: files
        .filter((f) => {
          const n = f.driveFileName || '';
          return nameRe.test(n) || (!!doc && n.includes(doc));
        })
        .map((f) => ({
          id: f.driveFileId,
          name: f.driveFileName,
          mimeType: f.mimeType,
          size: f.fileSize,
          modifiedTime: f.modifiedTime,
          path: f.relativePath || null,
        })),
    };
  } catch (e) {
    driveMatches = {
      error: e instanceof Error ? e.message : String(e),
    };
  }

  const report = {
    cloudWrites: 0,
    person: person.rows[0] || null,
    targetPersonCvId: PERSON_CV_ID,
    activeCv: activeCv.rows[0] || null,
    allPersonCvs: allCvs.rows,
    mdePersonCvs: mdeCv.rows,
    mdeSnapshots: mdeSnaps.rows,
    download,
    extraction,
    driveMatches,
  };

  writeFileSync(
    join(OUT_DIR, 'diagnosis.json'),
    JSON.stringify(report, null, 2),
  );
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
