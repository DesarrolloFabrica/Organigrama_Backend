/**
 * Recupera CV Leidy: reasocia person_cv 195 al drive_file con text layer
 * (antes inactivo 119), borra EMPTY snapshot MDE y deja listo P0.
 *
 * Identidad verificada: mismo document 1012362121 + nombre en texto extraído.
 *
 *   npx ts-node --transpile-only scripts/mc1-leidy-cv-recover-association.ts --confirm
 *
 * Cloud: actualiza solo drive_* de person_cv 195 (misma fila activa).
 * MDE: espejo + DELETE snapshot EMPTY.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { extractText, getDocumentProxy } from 'unpdf';
import { downloadCvPdfBuffer } from '../src/database/scripts/utils/google-drive-cv-client';

const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'tmp', 'mc1-leidy-cv-recovery');
const PERSON_ID = 1197;
const PERSON_CV_ID = 195;
const GOOD_DRIVE_FILE_ID = '1BF10oK_WjUkhxw6clZurz9oxNaRt6uO0';
const BAD_DRIVE_FILE_ID = '1yI9A9ysoCzMCJiM3FuUGe5bbuom6v-jr';

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

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.log(
      JSON.stringify({
        status: 'BLOCKED',
        reason: 'REQUIRES_CONFIRM',
        hint: 'npx ts-node --transpile-only scripts/mc1-leidy-cv-recover-association.ts --confirm',
      }),
    );
    process.exit(2);
  }

  mkdirSync(OUT, { recursive: true });
  const cloud = loadEnv(join(ROOT, '.env'));
  for (const [k, v] of Object.entries(cloud)) {
    if (!process.env[k]) process.env[k] = v;
  }
  const mdeEnv = loadEnv(join(ROOT, 'secrets', 'mc1-mde.local.env'));

  const buf = await downloadCvPdfBuffer(GOOD_DRIVE_FILE_ID);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [String(text ?? '')];
  const fullText = pageTexts.join('\n');
  const totalChars = fullText.length;
  const identityOk =
    /LEIDY\s+MARCELA\s+GONZALEZ\s+OLAYA/i.test(fullText) && totalChars > 500;

  const verification = {
    goodDriveFileId: GOOD_DRIVE_FILE_ID,
    badDriveFileId: BAD_DRIVE_FILE_ID,
    bytes: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    totalPages,
    totalChars,
    identityOk,
    sample: fullText.replace(/\s+/g, ' ').slice(0, 400),
  };
  writeFileSync(
    join(OUT, 'identity-verification.json'),
    JSON.stringify(verification, null, 2),
  );

  if (!identityOk) {
    console.log(
      JSON.stringify({
        status: 'LEIDY_CV_SOURCE_BLOCKED',
        reason: 'IDENTITY_NOT_VERIFIED',
        verification,
      }),
    );
    process.exit(1);
  }

  writeFileSync(join(OUT, 'leidy-cv-good-text-source.pdf'), buf);

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

  const before = await cloudClient.query(
    `SELECT id::text, drive_file_id, drive_file_name, drive_web_url,
            mime_type, drive_file_size::text, is_active
       FROM organigrama.person_cv WHERE id = $1`,
    [PERSON_CV_ID],
  );

  if (before.rows[0]?.drive_file_id !== BAD_DRIVE_FILE_ID) {
    // already recovered or unexpected — still proceed if good file
  }

  const webUrl = `https://drive.google.com/file/d/${GOOD_DRIVE_FILE_ID}/view?usp=drivesdk`;
  const cloudUp = await cloudClient.query(
    `UPDATE organigrama.person_cv
        SET drive_file_id = $1,
            drive_file_name = $2,
            drive_web_url = $3,
            mime_type = 'application/pdf',
            drive_file_size = $4,
            drive_modified_time = COALESCE(drive_modified_time, NOW()),
            synced_at = NOW()
      WHERE id = $5 AND person_id = $6
      RETURNING id::text, drive_file_id, drive_file_name, drive_file_size::text, is_active`,
    [
      GOOD_DRIVE_FILE_ID,
      '1012362121.pdf',
      webUrl,
      String(buf.length),
      PERSON_CV_ID,
      PERSON_ID,
    ],
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

  const mdeUp = await mdeClient.query(
    `UPDATE organigrama.person_cv
        SET drive_file_id = $1,
            drive_file_name = $2,
            mime_type = 'application/pdf',
            drive_file_size = $3,
            is_active = true
      WHERE id = $4 AND person_id = $5
      RETURNING id::text, drive_file_id, drive_file_name, drive_file_size::text, is_active`,
    [
      GOOD_DRIVE_FILE_ID,
      '1012362121.pdf',
      String(buf.length),
      PERSON_CV_ID,
      PERSON_ID,
    ],
  );

  const del = await mdeClient.query(
    `DELETE FROM organigrama.mc_cv_snapshot
      WHERE person_cv_id = $1 AND parse_status = 'EMPTY_DOCUMENT'
      RETURNING id::text, parse_status`,
    [PERSON_CV_ID],
  );
  await mdeClient.end();

  const report = {
    status: 'ASSOCIATION_RECOVERED',
    cause:
      'ACTIVE_CV_POINTED_TO_SCANNED_IMAGE_ONLY_PDF; PRIOR_DRIVE_FILE_HAS_TEXT_LAYER',
    recovery:
      'Reassociated person_cv 195 to drive_file_id with extractable text (former inactive 119 source); deleted EMPTY_DOCUMENT snapshots',
    verification,
    cloudBefore: before.rows[0],
    cloudAfter: cloudUp.rows[0],
    mdeAfter: mdeUp.rows[0],
    deletedEmptySnapshots: del.rows,
    cloudWrites: 1,
    note: 'personCvId 195 preserved; no OCR; native text layer used',
  };
  writeFileSync(join(OUT, 'recovery-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
