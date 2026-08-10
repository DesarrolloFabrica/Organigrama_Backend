/**
 * Carga pool de candidatos desde MDE (solo metadatos documentales / legacy).
 * No descarga PDFs. No pasa signals a P1.
 */
import type { Client } from 'pg';
import type { AnchorInfo } from './cohort-spec-builder';
import type { CandidatePoolRow } from './observatory.types';
import { DeterministicEvidenceCandidateSegmenter } from '../mc-pipeline/p1/deterministic-evidence-candidate-segmenter';
import { P1EvidenceBatchBuilder } from '../mc-pipeline/p1/p1-evidence-batch-builder';

export async function loadCandidatePool(client: Client): Promise<CandidatePoolRow[]> {
  const sql = `
    SELECT
      pc.id AS person_cv_id,
      pc.person_id,
      pc.mime_type,
      pc.drive_file_size AS file_size_bytes,
      pc.is_active,
      (pc.drive_file_id IS NOT NULL AND length(trim(pc.drive_file_id)) > 0) AS drive_present,
      s.id::text AS snapshot_id,
      s.parse_status,
      s.page_count,
      CASE WHEN s.normalized_text IS NULL THEN NULL ELSE length(s.normalized_text) END AS char_count,
      s.parse_warnings::text AS warnings_json,
      COALESCE((
        SELECT COUNT(*)::int FROM organigrama.cv_skill cs
        WHERE cs.person_cv_id = pc.id
      ), 0) AS legacy_skill_count,
      COALESCE((
        SELECT COUNT(*)::int FROM organigrama.cv_evidence ce
        WHERE ce.person_cv_id = pc.id
      ), 0) AS legacy_evidence_count,
      (
        SELECT CASE
          WHEN cx.id IS NULL THEN NULL
          WHEN cx.status IN ('SUCCESS','COMPLETED','OK') THEN TRUE
          WHEN cx.status IN ('FAILED','ERROR') THEN FALSE
          ELSE NULL
        END
        FROM organigrama.cv_extraction cx
        WHERE cx.person_cv_id = pc.id
        ORDER BY cx.id DESC
        LIMIT 1
      ) AS legacy_extraction_ok
    FROM organigrama.person_cv pc
    LEFT JOIN LATERAL (
      SELECT *
      FROM organigrama.mc_cv_snapshot ms
      WHERE ms.person_cv_id = pc.id
      ORDER BY ms.id DESC
      LIMIT 1
    ) s ON TRUE
    WHERE pc.is_active = TRUE
    ORDER BY pc.id ASC
  `;

  // Algunas instalaciones pueden no tener cv_skill/cv_evidence/cv_extraction —
  // fallback a query mínima.
  try {
    const res = await client.query(sql);
    return res.rows.map(mapRow);
  } catch {
    const fallback = await client.query(`
      SELECT
        pc.id AS person_cv_id,
        pc.person_id,
        pc.mime_type,
        pc.drive_file_size AS file_size_bytes,
        pc.is_active,
        (pc.drive_file_id IS NOT NULL AND length(trim(pc.drive_file_id)) > 0) AS drive_present,
        s.id::text AS snapshot_id,
        s.parse_status,
        s.page_count,
        CASE WHEN s.normalized_text IS NULL THEN NULL ELSE length(s.normalized_text) END AS char_count,
        s.parse_warnings::text AS warnings_json,
        0 AS legacy_skill_count,
        0 AS legacy_evidence_count,
        NULL::boolean AS legacy_extraction_ok
      FROM organigrama.person_cv pc
      LEFT JOIN LATERAL (
        SELECT *
        FROM organigrama.mc_cv_snapshot ms
        WHERE ms.person_cv_id = pc.id
        ORDER BY ms.id DESC
        LIMIT 1
      ) s ON TRUE
      WHERE pc.is_active = TRUE
      ORDER BY pc.id ASC
    `);
    return fallback.rows.map(mapRow);
  }
}

function mapRow(r: Record<string, unknown>): CandidatePoolRow {
  return {
    personCvId: Number(r.person_cv_id),
    personId: Number(r.person_id),
    mimeType: (r.mime_type as string) ?? null,
    fileSizeBytes: r.file_size_bytes == null ? null : Number(r.file_size_bytes),
    isActive: Boolean(r.is_active),
    driveFileIdPresent: Boolean(r.drive_present),
    existingSnapshotId: (r.snapshot_id as string) ?? null,
    existingParseStatus: (r.parse_status as string) ?? null,
    existingPageCount: r.page_count == null ? null : Number(r.page_count),
    existingCharCount: r.char_count == null ? null : Number(r.char_count),
    existingWarningsJson: (r.warnings_json as string) ?? null,
    legacySkillCount: Number(r.legacy_skill_count ?? 0),
    legacyEvidenceCount: Number(r.legacy_evidence_count ?? 0),
    legacyExtractionOk:
      r.legacy_extraction_ok == null ? null : Boolean(r.legacy_extraction_ok),
  };
}

export async function loadAnchors(
  client: Client,
  snapshotIds: string[],
): Promise<AnchorInfo[]> {
  const res = await client.query(
    `SELECT id::text AS snapshot_id,
            person_cv_id,
            parse_status,
            page_count,
            CASE WHEN normalized_text IS NULL THEN NULL ELSE length(normalized_text) END AS char_count,
            normalized_text,
            pages,
            sectioned_content,
            parse_warnings AS warnings
       FROM organigrama.mc_cv_snapshot
      WHERE id = ANY($1::bigint[])
      ORDER BY id ASC`,
    [snapshotIds.map((id) => Number(id))],
  );

  if (res.rows.length !== snapshotIds.length) {
    throw new Error('ANCHOR_SNAPSHOTS_NOT_FOUND');
  }

  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const out: AnchorInfo[] = [];

  for (const row of res.rows) {
    const normalizedText: string = row.normalized_text ?? '';
    const pages =
      typeof row.pages === 'string' ? JSON.parse(row.pages) : row.pages;
    const sectioned =
      typeof row.sectioned_content === 'string'
        ? JSON.parse(row.sectioned_content)
        : row.sectioned_content;
    const seg = segmenter.segment({
      snapshotId: String(row.snapshot_id),
      normalizedText,
      pages,
      sectionedContent: sectioned,
    });
    const warnings = Array.isArray(row.warnings)
      ? row.warnings
      : typeof row.warnings === 'string'
        ? JSON.parse(row.warnings || '[]')
        : [];
    const lineCount = normalizedText.split(/\n/).length || 1;
    const bulletLines = (normalizedText.match(/^\s*[-*•]\s+/gm) || []).length;
    const meanCand =
      seg.candidates.length > 0
        ? seg.candidates.reduce((a, c) => a + c.characterCount, 0) /
          seg.candidates.length
        : 0;

    out.push({
      snapshotId: String(row.snapshot_id),
      personCvId: Number(row.person_cv_id),
      parseStatus: String(row.parse_status),
      pageCount: Number(row.page_count ?? 0),
      characterCount: Number(row.char_count ?? normalizedText.length),
      warningCount: Array.isArray(warnings) ? warnings.length : 0,
      headingCountEstimated: seg.metrics.headingCount,
      candidateCountEstimated: seg.metrics.candidateCount,
      lineDensity: Number((lineCount / Math.max(Number(row.page_count) || 1, 1)).toFixed(4)),
      listDensity: Number((bulletLines / Math.max(lineCount, 1)).toFixed(4)),
      meanCandidateLength: Number(meanCand.toFixed(2)),
    });
  }
  return out;
}

/** Estima candidatos/batches sin IA para dry-run (solo si hay snapshot con texto). */
export async function estimateSegmentationForSnapshot(
  client: Client,
  snapshotId: string,
): Promise<{ candidateCount: number; batchCount: number; headingCount: number } | null> {
  const res = await client.query(
    `SELECT id::text, normalized_text, pages, sectioned_content
       FROM organigrama.mc_cv_snapshot WHERE id = $1`,
    [Number(snapshotId)],
  );
  if (!res.rows[0]?.normalized_text) return null;
  const row = res.rows[0];
  const pages =
    typeof row.pages === 'string' ? JSON.parse(row.pages) : row.pages;
  const sectioned =
    typeof row.sectioned_content === 'string'
      ? JSON.parse(row.sectioned_content)
      : row.sectioned_content;
  const segmenter = new DeterministicEvidenceCandidateSegmenter();
  const seg = segmenter.segment({
    snapshotId: String(row.id),
    normalizedText: row.normalized_text,
    pages,
    sectionedContent: sectioned,
  });
  const batches = new P1EvidenceBatchBuilder().build(seg.candidates);
  return {
    candidateCount: seg.metrics.candidateCount,
    batchCount: batches.length,
    headingCount: seg.metrics.headingCount,
  };
}
