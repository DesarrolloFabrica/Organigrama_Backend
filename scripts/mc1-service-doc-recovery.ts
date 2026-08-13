/**
 * Recuperación documental EMPTY_DOCUMENT (patrón Leidy) — sin OCR, sin modificar P0.
 * Si el PDF activo es image-only y existe otro person_cv/drive_file con text layer
 * e identidad inequívoca, reasocia person_cv activo (Cloud+MDE) y borra EMPTY snaps.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import { extractText, getDocumentProxy } from 'unpdf';
import { downloadCvPdfBuffer } from '../src/database/scripts/utils/google-drive-cv-client';

export type DocRecoveryResult =
  | { status: 'RECOVERED'; driveFileId: string; totalChars: number; reportPath: string }
  | { status: 'NO_ALTERNATIVE'; reason: string }
  | { status: 'NOT_NEEDED' }
  | { status: 'FAILED'; reason: string };

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

async function analyzeDriveFile(fileId: string) {
  const buf = await downloadCvPdfBuffer(fileId);
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { totalPages, text } = await extractText(pdf, { mergePages: false });
  const pageTexts = Array.isArray(text) ? text : [String(text ?? '')];
  const fullText = pageTexts.join('\n');
  const raw = buf.toString('latin1');
  return {
    buf,
    totalPages,
    totalChars: fullText.length,
    fullText,
    imgMarkers: (raw.match(/\/Subtype\s*\/Image/g) || []).length,
    baseFonts: (raw.match(/\/BaseFont/g) || []).length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}

function identityMatches(fullText: string, fullName: string, document: string | null) {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  const textN = norm(fullText.slice(0, 800));
  const nameParts = norm(fullName).split(/\s+/).filter((p) => p.length > 2);
  const nameHits = nameParts.filter((p) => textN.includes(p)).length;
  const nameOk = nameParts.length >= 2 && nameHits >= Math.min(2, nameParts.length);
  const docOk = !document || fullText.includes(document) || textN.includes(document);
  return nameOk && (docOk || nameHits >= 3) && fullText.length > 400;
}

export async function tryRecoverEmptyDocument(args: {
  personId: number;
  personCvId: number;
  fullName: string;
  document: string | null;
  backendRoot: string;
  outDir: string;
}): Promise<DocRecoveryResult> {
  const cloud = loadEnv(join(args.backendRoot, '.env'));
  for (const [k, v] of Object.entries(cloud)) {
    if (!process.env[k]) process.env[k] = v;
  }
  const mdeEnv = loadEnv(join(args.backendRoot, 'secrets', 'mc1-mde.local.env'));
  mkdirSync(args.outDir, { recursive: true });

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

  type PersonCvRow = {
    id: string;
    drive_file_id: string | null;
    drive_file_name: string | null;
    mime_type?: string | null;
    is_active?: boolean;
    drive_file_size?: string | null;
  };

  const cvs = await cloudClient.query<PersonCvRow>(
    `SELECT id::text, drive_file_id, drive_file_name, mime_type, is_active,
            drive_file_size::text
       FROM organigrama.person_cv
      WHERE person_id = $1
      ORDER BY is_active DESC, id DESC`,
    [args.personId],
  );
  const active = cvs.rows.find((r) => Number(r.id) === args.personCvId) || cvs.rows[0];
  if (!active?.drive_file_id) {
    await cloudClient.end();
    return { status: 'FAILED', reason: 'NO_ACTIVE_DRIVE_FILE' };
  }

  let activeAnalysis;
  try {
    activeAnalysis = await analyzeDriveFile(active.drive_file_id);
  } catch (e) {
    await cloudClient.end();
    return {
      status: 'FAILED',
      reason: `ACTIVE_DOWNLOAD_FAILED:${e instanceof Error ? e.message : e}`,
    };
  }

  if (activeAnalysis.totalChars >= 200) {
    await cloudClient.end();
    return { status: 'NOT_NEEDED' };
  }

  const candidates = [
    ...new Map(
      cvs.rows
        .filter((r) => r.drive_file_id && r.drive_file_id !== active.drive_file_id)
        .map((r) => [r.drive_file_id, r]),
    ).values(),
  ];

  let chosen: {
    driveFileId: string;
    fileName: string;
    analysis: Awaited<ReturnType<typeof analyzeDriveFile>>;
  } | null = null;

  for (const cand of candidates) {
    try {
      const analysis = await analyzeDriveFile(cand.drive_file_id);
      if (analysis.totalChars < 400) continue;
      if (
        !identityMatches(
          analysis.fullText,
          args.fullName,
          args.document,
        )
      ) {
        continue;
      }
      chosen = {
        driveFileId: cand.drive_file_id,
        fileName: cand.drive_file_name || `${args.document || args.personId}.pdf`,
        analysis,
      };
      break;
    } catch {
      // try next
    }
  }

  if (!chosen) {
    await cloudClient.end();
    const report = {
      status: 'NO_ALTERNATIVE',
      personId: args.personId,
      personCvId: args.personCvId,
      active: {
        driveFileId: active.drive_file_id,
        totalChars: activeAnalysis.totalChars,
        pages: activeAnalysis.totalPages,
        imgMarkers: activeAnalysis.imgMarkers,
        imageOnly:
          activeAnalysis.totalChars === 0 && activeAnalysis.imgMarkers > 0,
      },
      candidatesTried: candidates.map((c) => c.drive_file_id),
    };
    const reportPath = join(
      args.outDir,
      `doc-recovery-${args.personId}.json`,
    );
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    return { status: 'NO_ALTERNATIVE', reason: 'NO_TEXT_LAYER_ALTERNATIVE' };
  }

  const webUrl = `https://drive.google.com/file/d/${chosen.driveFileId}/view?usp=drivesdk`;
  await cloudClient.query(
    `UPDATE organigrama.person_cv
        SET drive_file_id = $1,
            drive_file_name = $2,
            drive_web_url = $3,
            mime_type = 'application/pdf',
            drive_file_size = $4,
            synced_at = NOW()
      WHERE id = $5 AND person_id = $6`,
    [
      chosen.driveFileId,
      chosen.fileName,
      webUrl,
      String(chosen.analysis.buf.length),
      args.personCvId,
      args.personId,
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
  await mdeClient.query(
    `UPDATE organigrama.person_cv
        SET drive_file_id = $1,
            drive_file_name = $2,
            mime_type = 'application/pdf',
            drive_file_size = $3,
            is_active = true
      WHERE id = $4 AND person_id = $5`,
    [
      chosen.driveFileId,
      chosen.fileName,
      String(chosen.analysis.buf.length),
      args.personCvId,
      args.personId,
    ],
  );
  await mdeClient.query(
    `DELETE FROM organigrama.mc_cv_snapshot
      WHERE person_cv_id = $1
        AND parse_status IN ('EMPTY_DOCUMENT', 'SCANNED_OR_IMAGE_ONLY', 'FAILED')`,
    [args.personCvId],
  );
  await mdeClient.end();

  const report = {
    status: 'RECOVERED',
    personId: args.personId,
    personCvId: args.personCvId,
    from: active.drive_file_id,
    to: chosen.driveFileId,
    totalChars: chosen.analysis.totalChars,
    identityOk: true,
    sample: chosen.analysis.fullText.replace(/\s+/g, ' ').slice(0, 300),
  };
  const reportPath = join(args.outDir, `doc-recovery-${args.personId}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  return {
    status: 'RECOVERED',
    driveFileId: chosen.driveFileId,
    totalChars: chosen.analysis.totalChars,
    reportPath,
  };
}
