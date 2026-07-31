/**
 * Activación / desactivación de extracciones para importer y rollback.
 * Respeta unique parcial (person_id) WHERE is_active.
 */

import type { DataSource, EntityManager } from 'typeorm';

export async function findActiveExtractionId(
  dataSource: DataSource,
  personId: string,
): Promise<string | null> {
  const rows = (await dataSource.query(
    `SELECT id::text AS id
     FROM organigrama.cv_extraction
     WHERE person_id = $1::bigint AND is_active = TRUE
     LIMIT 1`,
    [personId],
  )) as Array<{ id: string }>;
  return rows[0]?.id ?? null;
}

export async function activateSucceededExtraction(params: {
  dataSource: DataSource;
  personId: string;
  extractionId: string;
}): Promise<void> {
  const qr = params.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const manager = qr.manager;
    await manager.query(`SELECT pg_advisory_xact_lock($1)`, [
      Number(params.personId),
    ]);
    const rows = (await manager.query(
      `SELECT id::text AS id, status, is_active
       FROM organigrama.cv_extraction
       WHERE id = $1::bigint
       FOR UPDATE`,
      [params.extractionId],
    )) as Array<{ id: string; status: string; is_active: boolean }>;
    const row = rows[0];
    if (!row) {
      throw new Error(`Extracción ${params.extractionId} no encontrada.`);
    }
    if (row.status !== 'SUCCEEDED') {
      throw new Error(
        `Solo se puede activar SUCCEEDED (status=${row.status}).`,
      );
    }
    await manager.query(
      `UPDATE organigrama.cv_extraction
       SET is_active = FALSE, updated_at = NOW()
       WHERE person_id = $1::bigint AND is_active = TRUE AND id <> $2::bigint`,
      [params.personId, params.extractionId],
    );
    await manager.query(
      `UPDATE organigrama.cv_extraction
       SET is_active = TRUE, updated_at = NOW()
       WHERE id = $1::bigint`,
      [params.extractionId],
    );
    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

export async function deactivateExtraction(
  dataSource: DataSource,
  extractionId: string,
): Promise<void> {
  await dataSource.query(
    `UPDATE organigrama.cv_extraction
     SET is_active = FALSE, updated_at = NOW()
     WHERE id = $1::bigint AND is_active = TRUE`,
    [extractionId],
  );
}

export async function deactivateProfileEvaluationsForExtraction(
  dataSource: DataSource,
  extractionId: string,
): Promise<number> {
  const result = await dataSource.query(
    `UPDATE organigrama.mc_profile_evaluation
     SET is_active = FALSE, updated_at = NOW()
     WHERE extraction_id = $1::bigint AND is_active = TRUE`,
    [extractionId],
  );
  return Array.isArray(result) ? 0 : Number(result?.rowCount ?? 0);
}

export async function readExtractionMeta(
  dataSource: DataSource,
  extractionId: string,
): Promise<{
  id: string;
  personId: string;
  model: string;
  isActive: boolean;
  status: string;
  rawResult: Record<string, unknown> | null;
} | null> {
  const rows = (await dataSource.query(
    `SELECT id::text AS id,
            person_id::text AS "personId",
            model,
            is_active AS "isActive",
            status,
            raw_result AS "rawResult"
     FROM organigrama.cv_extraction
     WHERE id = $1::bigint`,
    [extractionId],
  )) as Array<{
    id: string;
    personId: string;
    model: string;
    isActive: boolean;
    status: string;
    rawResult: Record<string, unknown> | null;
  }>;
  return rows[0] ?? null;
}

/** Inserta mapping skill→specialty si no existe (catálogo activo). */
export async function ensureSpecialtyMapping(params: {
  manager: EntityManager;
  catalogVersionId: string;
  skillId: string;
  specialtyId: string;
  weight?: number;
  rationale: string;
}): Promise<'CREATED' | 'EXISTS'> {
  const existing = (await params.manager.query(
    `SELECT id::text AS id
     FROM organigrama.mc_skill_specialty_mapping
     WHERE catalog_version_id = $1::bigint
       AND skill_id = $2::bigint
       AND specialty_id = $3::bigint
     LIMIT 1`,
    [params.catalogVersionId, params.skillId, params.specialtyId],
  )) as Array<{ id: string }>;
  if (existing[0]) return 'EXISTS';

  await params.manager.query(
    `INSERT INTO organigrama.mc_skill_specialty_mapping
       (catalog_version_id, skill_id, specialty_id, weight, mapping_type, rationale, is_active)
     VALUES ($1::bigint, $2::bigint, $3::bigint, $4, 'PRIMARY', $5, TRUE)`,
    [
      params.catalogVersionId,
      params.skillId,
      params.specialtyId,
      params.weight ?? 1.0,
      params.rationale,
    ],
  );
  return 'CREATED';
}

/** Inserta clasificación DOMAIN_SPECIALTY si no existe para (domain, skill). */
export async function ensureDomainSpecialtyClassification(params: {
  manager: EntityManager;
  catalogVersionId: string;
  domainId: string;
  skillId: string;
  rationale: string;
}): Promise<'CREATED' | 'EXISTS'> {
  const existing = (await params.manager.query(
    `SELECT id::text AS id
     FROM organigrama.mc_skill_domain_classification
     WHERE catalog_version_id = $1::bigint
       AND domain_id = $2::bigint
       AND skill_id = $3::bigint
     LIMIT 1`,
    [params.catalogVersionId, params.domainId, params.skillId],
  )) as Array<{ id: string }>;
  if (existing[0]) {
    await params.manager.query(
      `UPDATE organigrama.mc_skill_domain_classification
       SET classification = 'DOMAIN_SPECIALTY',
           rationale = $2,
           is_active = TRUE,
           updated_at = NOW()
       WHERE id = $1::bigint`,
      [existing[0].id, params.rationale],
    );
    return 'EXISTS';
  }

  await params.manager.query(
    `INSERT INTO organigrama.mc_skill_domain_classification
       (catalog_version_id, domain_id, skill_id, classification, rationale, is_active)
     VALUES ($1::bigint, $2::bigint, $3::bigint, 'DOMAIN_SPECIALTY', $4, TRUE)`,
    [
      params.catalogVersionId,
      params.domainId,
      params.skillId,
      params.rationale,
    ],
  );
  return 'CREATED';
}

export async function ensureCvSkill(params: {
  manager: EntityManager;
  normalizedName: string;
  normalizedKey: string;
  skillType: string;
}): Promise<{ skillId: string; created: boolean }> {
  const found = (await params.manager.query(
    `SELECT id::text AS id
     FROM organigrama.cv_skill
     WHERE normalized_key = $1 AND skill_type = $2
     LIMIT 1`,
    [params.normalizedKey, params.skillType],
  )) as Array<{ id: string }>;
  if (found[0]) {
    return { skillId: found[0].id, created: false };
  }
  const inserted = (await params.manager.query(
    `INSERT INTO organigrama.cv_skill
       (normalized_name, normalized_key, skill_type, is_active)
     VALUES ($1, $2, $3, TRUE)
     RETURNING id::text AS id`,
    [params.normalizedName, params.normalizedKey, params.skillType],
  )) as Array<{ id: string }>;
  return { skillId: inserted[0].id, created: true };
}
