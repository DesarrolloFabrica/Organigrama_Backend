/**
 * Importador idempotente de presentaciones MC1 precomputadas → Cloud store.
 */
import type { DataSource, QueryRunner } from 'typeorm';
import {
  MC1_PRESENTATION_STORE_SOURCE,
  validateMc1PresentationPayload,
} from './mc1-person-profile-store';
import type { Mc1PersonCompetenciesPresentationDto } from './mc1-person-profile.types';

export type Mc1PresentationImportRecord = {
  personId: string | number;
  /** DTO de presentación (mc1Profile) o wrapper { presentation / mc1Profile / payload }. */
  payload: unknown;
  configFingerprint: string;
  producedAt?: string;
};

export type Mc1PresentationImportItemResult =
  | {
      personId: string;
      status: 'INSERTED' | 'UPDATED' | 'UNCHANGED';
      configFingerprint: string;
    }
  | {
      personId: string;
      status: 'REJECTED';
      reason: string;
    };

export type Mc1PresentationImportBatchResult = {
  results: Mc1PresentationImportItemResult[];
  inserted: number;
  updated: number;
  unchanged: number;
  rejected: number;
};

function unwrapPayload(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const o = raw as Record<string, unknown>;
  if (o.presentation != null) return o.presentation;
  if (o.mc1Profile != null) return o.mc1Profile;
  if (o.payload != null && typeof o.payload === 'object') {
    const p = o.payload as Record<string, unknown>;
    // Full ProfilePilotEnvelope is NOT accepted here — must be presentation DTO.
    if (p.status === 'AVAILABLE' && Array.isArray(p.fields)) return p;
  }
  return raw;
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

async function personExists(
  qr: QueryRunner,
  personId: string,
): Promise<boolean> {
  const rows = await qr.query(
    `SELECT 1 FROM core.person WHERE id = $1 LIMIT 1`,
    [personId],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function loadActive(
  qr: QueryRunner,
  personId: string,
): Promise<{
  id: string;
  payloadJson: unknown;
  configFingerprint: string;
} | null> {
  const rows = await qr.query(
    `
    SELECT id::text AS id, payload_json, config_fingerprint
      FROM organigrama.mc1_person_profile_presentation
     WHERE person_id = $1 AND is_active = TRUE
     LIMIT 1
    `,
    [personId],
  );
  const row = rows?.[0];
  if (!row) return null;
  return {
    id: String(row.id),
    payloadJson: row.payload_json,
    configFingerprint: String(row.config_fingerprint ?? ''),
  };
}

/**
 * Upsert de un perfil. Idempotente si fingerprint + payload normalizado coinciden.
 */
export async function importMc1PresentationRecord(
  dataSource: DataSource,
  record: Mc1PresentationImportRecord,
): Promise<Mc1PresentationImportItemResult> {
  const personId = String(record.personId).trim();
  if (!personId || !/^\d+$/.test(personId)) {
    return {
      personId: personId || '?',
      status: 'REJECTED',
      reason: 'PERSON_ID_INVALID',
    };
  }
  const fingerprint = String(record.configFingerprint ?? '').trim();
  if (!fingerprint) {
    return {
      personId,
      status: 'REJECTED',
      reason: 'FINGERPRINT_MISSING',
    };
  }

  const validated = validateMc1PresentationPayload(unwrapPayload(record.payload));
  if (!validated.ok) {
    return { personId, status: 'REJECTED', reason: validated.reason };
  }

  const presentation: Mc1PersonCompetenciesPresentationDto = {
    ...validated.presentation,
    source: MC1_PRESENTATION_STORE_SOURCE,
  };
  const producedAt = record.producedAt
    ? new Date(record.producedAt)
    : new Date();
  if (Number.isNaN(producedAt.getTime())) {
    return { personId, status: 'REJECTED', reason: 'PRODUCED_AT_INVALID' };
  }

  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    if (!(await personExists(qr, personId))) {
      await qr.rollbackTransaction();
      return { personId, status: 'REJECTED', reason: 'PERSON_NOT_FOUND' };
    }

    const active = await loadActive(qr, personId);
    const nextJson = stableJson(presentation);
    if (active) {
      const prev = validateMc1PresentationPayload(active.payloadJson);
      if (
        prev.ok &&
        active.configFingerprint === fingerprint &&
        stableJson({
          ...prev.presentation,
          source: MC1_PRESENTATION_STORE_SOURCE,
        }) === nextJson
      ) {
        await qr.commitTransaction();
        return {
          personId,
          status: 'UNCHANGED',
          configFingerprint: fingerprint,
        };
      }
      await qr.query(
        `
        UPDATE organigrama.mc1_person_profile_presentation
           SET is_active = FALSE
         WHERE person_id = $1 AND is_active = TRUE
        `,
        [personId],
      );
    }

    await qr.query(
      `
      INSERT INTO organigrama.mc1_person_profile_presentation
        (person_id, payload_json, config_fingerprint, produced_at, is_active, imported_at)
      VALUES
        ($1, $2::jsonb, $3, $4, TRUE, NOW())
      `,
      [personId, nextJson, fingerprint, producedAt.toISOString()],
    );

    await qr.commitTransaction();
    return {
      personId,
      status: active ? 'UPDATED' : 'INSERTED',
      configFingerprint: fingerprint,
    };
  } catch (e) {
    await qr.rollbackTransaction();
    return {
      personId,
      status: 'REJECTED',
      reason: String(e instanceof Error ? e.message : e).slice(0, 240),
    };
  } finally {
    await qr.release();
  }
}

/**
 * Import batch. Cada registro en su propia transacción (falla aislada).
 * Si `atomicBatch=true`, todo el lote en una sola transacción (all-or-nothing
 * solo para registros que pasan validación previa; rechazos de validación
 * no abortan el batch).
 */
export async function importMc1PresentationBatch(
  dataSource: DataSource,
  records: Mc1PresentationImportRecord[],
  options?: { atomicBatch?: boolean },
): Promise<Mc1PresentationImportBatchResult> {
  if (!options?.atomicBatch) {
    const results: Mc1PresentationImportItemResult[] = [];
    for (const r of records) {
      results.push(await importMc1PresentationRecord(dataSource, r));
    }
    return summarize(results);
  }

  // Pre-validate all; reject invalid without touching DB.
  const prepared: Array<{
    personId: string;
    fingerprint: string;
    presentation: Mc1PersonCompetenciesPresentationDto;
    producedAt: Date;
    record: Mc1PresentationImportRecord;
  }> = [];
  const results: Mc1PresentationImportItemResult[] = [];

  for (const record of records) {
    const personId = String(record.personId).trim();
    if (!personId || !/^\d+$/.test(personId)) {
      results.push({
        personId: personId || '?',
        status: 'REJECTED',
        reason: 'PERSON_ID_INVALID',
      });
      continue;
    }
    const fingerprint = String(record.configFingerprint ?? '').trim();
    if (!fingerprint) {
      results.push({
        personId,
        status: 'REJECTED',
        reason: 'FINGERPRINT_MISSING',
      });
      continue;
    }
    const validated = validateMc1PresentationPayload(
      unwrapPayload(record.payload),
    );
    if (!validated.ok) {
      results.push({ personId, status: 'REJECTED', reason: validated.reason });
      continue;
    }
    const producedAt = record.producedAt
      ? new Date(record.producedAt)
      : new Date();
    if (Number.isNaN(producedAt.getTime())) {
      results.push({
        personId,
        status: 'REJECTED',
        reason: 'PRODUCED_AT_INVALID',
      });
      continue;
    }
    prepared.push({
      personId,
      fingerprint,
      presentation: {
        ...validated.presentation,
        source: MC1_PRESENTATION_STORE_SOURCE,
      },
      producedAt,
      record,
    });
  }

  if (!prepared.length) return summarize(results);

  const qr = dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    for (const item of prepared) {
      if (!(await personExists(qr, item.personId))) {
        results.push({
          personId: item.personId,
          status: 'REJECTED',
          reason: 'PERSON_NOT_FOUND',
        });
        continue;
      }
      const active = await loadActive(qr, item.personId);
      const nextJson = stableJson(item.presentation);
      if (active) {
        const prev = validateMc1PresentationPayload(active.payloadJson);
        if (
          prev.ok &&
          active.configFingerprint === item.fingerprint &&
          stableJson({
            ...prev.presentation,
            source: MC1_PRESENTATION_STORE_SOURCE,
          }) === nextJson
        ) {
          results.push({
            personId: item.personId,
            status: 'UNCHANGED',
            configFingerprint: item.fingerprint,
          });
          continue;
        }
        await qr.query(
          `
          UPDATE organigrama.mc1_person_profile_presentation
             SET is_active = FALSE
           WHERE person_id = $1 AND is_active = TRUE
          `,
          [item.personId],
        );
      }
      await qr.query(
        `
        INSERT INTO organigrama.mc1_person_profile_presentation
          (person_id, payload_json, config_fingerprint, produced_at, is_active, imported_at)
        VALUES
          ($1, $2::jsonb, $3, $4, TRUE, NOW())
        `,
        [
          item.personId,
          nextJson,
          item.fingerprint,
          item.producedAt.toISOString(),
        ],
      );
      results.push({
        personId: item.personId,
        status: active ? 'UPDATED' : 'INSERTED',
        configFingerprint: item.fingerprint,
      });
    }
    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }

  return summarize(results);
}

function summarize(
  results: Mc1PresentationImportItemResult[],
): Mc1PresentationImportBatchResult {
  return {
    results,
    inserted: results.filter((r) => r.status === 'INSERTED').length,
    updated: results.filter((r) => r.status === 'UPDATED').length,
    unchanged: results.filter((r) => r.status === 'UNCHANGED').length,
    rejected: results.filter((r) => r.status === 'REJECTED').length,
  };
}
