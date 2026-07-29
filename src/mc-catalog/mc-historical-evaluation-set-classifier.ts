/**
 * Dry-run: clasifica evaluaciones históricas en candidatos de Evaluation Set.
 * Determinístico. Sin escrituras. Sin inferir NULL como igualdad.
 */

import { createHash } from 'node:crypto';
import { MC_OPERATIVE_DOMAIN_RULES } from './mc-operative-domains';
import {
  MC_HISTORICAL_AUDIT_SCHEMA_VERSION,
  type HistoricalEvaluationSetCandidate,
  type McHistoricalAuditSummary,
  type McHistoricalConflictCode,
  type McHistoricalGroupingConflict,
  type McHistoricalGroupingEvidence,
  type McHistoricalProfileEvaluationRow,
  type McKnownValue,
} from './mc-historical-evaluation-set.types';

function known<T>(value: T): McKnownValue<T> {
  return { kind: 'known', value };
}

function unknown<T = string>(): McKnownValue<T> {
  return { kind: 'unknown' };
}

function conflict(
  code: McHistoricalConflictCode,
  detail: string,
): McHistoricalGroupingConflict {
  return { code, detail };
}

function evidence(
  code: string,
  strength: McHistoricalGroupingEvidence['strength'],
  detail: string,
): McHistoricalGroupingEvidence {
  return { code, strength, detail };
}

function sameKnown(
  values: Array<string | null | undefined>,
): McKnownValue<string> {
  const present = values.filter((v): v is string => !!v && String(v).trim() !== '');
  if (present.length === 0) return unknown();
  const uniq = new Set(present.map(String));
  if (uniq.size !== 1) return unknown();
  if (present.length !== values.length) {
    // Algunos null → no afirmar igualdad total
    return unknown();
  }
  return known(present[0]);
}

function fingerprint(payload: Record<string, unknown>): string {
  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function buildHistoricalFingerprint(
  personId: string,
  rows: McHistoricalProfileEvaluationRow[],
  ctx: HistoricalEvaluationSetCandidate['inferredContext'],
): string {
  const serialize = (v: McKnownValue<unknown>) => {
    if (v.kind === 'known') return { k: 'known', v: v.value };
    if (v.kind === 'inferred')
      return { k: 'inferred', v: v.value, s: v.source };
    return { k: 'unknown' };
  };
  return fingerprint({
    schema: MC_HISTORICAL_AUDIT_SCHEMA_VERSION,
    personId,
    evaluationIds: [...rows.map((r) => r.id)].sort(),
    extractionId: serialize(ctx.extractionId),
    enrichmentId: serialize(ctx.enrichmentId),
    evidenceEvaluationId: serialize(ctx.evidenceEvaluationId),
    catalogVersionId: serialize(ctx.catalogVersionId),
    sourceHash: serialize(ctx.sourceHash),
    candidateUniverse: serialize(ctx.candidateUniverse),
    // Explicitly mark incomplete modern-hash incompatibility
    modernSetContextHashCompatible: false,
  });
}

const DEFAULT_OPERATIVE = MC_OPERATIVE_DOMAIN_RULES.map((r) => r.domainCode);

/**
 * Excluye filas ya en set. Agrupa por persona + claves fuertes conocidas.
 */
export function classifyHistoricalEvaluationSetCandidates(
  rows: McHistoricalProfileEvaluationRow[],
  options?: {
    /** Universo candidato conocido para la época; si null → unknown. */
    eraCandidateUniverse?: string[] | null;
  },
): HistoricalEvaluationSetCandidate[] {
  const eraUniverse = options?.eraCandidateUniverse ?? null;
  const withoutSet = rows.filter((r) => !r.evaluationSetId);
  const byPerson = new Map<string, McHistoricalProfileEvaluationRow[]>();
  for (const row of withoutSet) {
    const list = byPerson.get(row.personId) ?? [];
    list.push(row);
    byPerson.set(row.personId, list);
  }

  const results: HistoricalEvaluationSetCandidate[] = [];

  for (const [personId, personRows] of [...byPerson.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    // Particionar por extraction+evidence+enrichment+catalog cuando todos known
    const buckets = new Map<string, McHistoricalProfileEvaluationRow[]>();
    const orphans: McHistoricalProfileEvaluationRow[] = [];

    for (const row of personRows) {
      if (
        !row.extractionId ||
        !row.evidenceEvaluationId ||
        !row.enrichmentId ||
        !row.catalogVersionId
      ) {
        orphans.push(row);
        continue;
      }
      const key = [
        row.extractionId,
        row.enrichmentId,
        row.evidenceEvaluationId,
        row.catalogVersionId,
        row.sourceHash ?? '∅',
      ].join('|');
      const list = buckets.get(key) ?? [];
      list.push(row);
      buckets.set(key, list);
    }

    for (const row of orphans) {
      results.push(
        buildUnrecoverable(personId, [row], [
          conflict(
            'MISSING_CHAIN_CONTEXT',
            'Falta extraction/enrichment/evidence/catalog',
          ),
          conflict('ISOLATED_EVALUATION', `eval=${row.id}`),
        ]),
      );
    }

    const bucketEntries = [...buckets.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );

    // OVERLAPPING: misma persona con varios buckets STRONG-plausibles
    const multiBucket = bucketEntries.length > 1;

    for (const [, group] of bucketEntries) {
      results.push(
        classifyGroup(personId, group, {
          eraUniverse,
          alternativeBuckets: multiBucket,
        }),
      );
    }
  }

  // Filas ya en set: reportar como ALREADY_IN_SET (no candidato de backfill)
  const linked = rows.filter((r) => r.evaluationSetId);
  const linkedBySet = new Map<string, McHistoricalProfileEvaluationRow[]>();
  for (const row of linked) {
    const k = row.evaluationSetId!;
    const list = linkedBySet.get(k) ?? [];
    list.push(row);
    linkedBySet.set(k, list);
  }
  for (const [setId, group] of [...linkedBySet.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    const ctx = {
      extractionId: sameKnown(sorted.map((r) => r.extractionId)),
      enrichmentId: sameKnown(sorted.map((r) => r.enrichmentId)),
      evidenceEvaluationId: sameKnown(
        sorted.map((r) => r.evidenceEvaluationId),
      ),
      catalogVersionId: sameKnown(sorted.map((r) => r.catalogVersionId)),
      sourceHash: sameKnown(sorted.map((r) => r.sourceHash)),
      candidateUniverse: known(
        [...new Set(sorted.map((r) => r.domainCode))].sort(),
      ),
      qualificationPolicyVersion: unknown<string>(),
    };
    results.push({
      personId: sorted[0].personId,
      profileEvaluationIds: sorted.map((r) => r.id),
      domainCodes: [...new Set(sorted.map((r) => r.domainCode))].sort(),
      inferredContext: ctx,
      eligibility: 'EXACT',
      evidence: [
        evidence(
          'MODERN_EVALUATION_SET',
          'FUERTE',
          `evaluation_set_id=${setId}`,
        ),
      ],
      conflicts: [
        conflict('ALREADY_LINKED_TO_SET', `set=${setId}`),
      ],
      missingFields: [],
      recommendedAction: 'ALREADY_IN_SET',
      historicalContextFingerprint: buildHistoricalFingerprint(
        sorted[0].personId,
        sorted,
        ctx,
      ),
    });
  }

  return results.sort((a, b) => {
    const p = a.personId.localeCompare(b.personId);
    if (p !== 0) return p;
    return a.historicalContextFingerprint.localeCompare(
      b.historicalContextFingerprint,
    );
  });
}

function classifyGroup(
  personId: string,
  group: McHistoricalProfileEvaluationRow[],
  opts: { eraUniverse: string[] | null; alternativeBuckets: boolean },
): HistoricalEvaluationSetCandidate {
  const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
  const conflicts: McHistoricalGroupingConflict[] = [];
  const evid: McHistoricalGroupingEvidence[] = [];
  const missing: string[] = [];

  const byDomain = new Map<string, McHistoricalProfileEvaluationRow[]>();
  for (const row of sorted) {
    const list = byDomain.get(row.domainCode) ?? [];
    list.push(row);
    byDomain.set(row.domainCode, list);
  }
  for (const [domain, list] of byDomain) {
    if (list.length > 1) {
      conflicts.push(
        conflict(
          'MULTIPLE_DOMAIN_EVALUATIONS',
          `${domain} count=${list.length}`,
        ),
      );
    }
  }

  const extractionId = sameKnown(sorted.map((r) => r.extractionId));
  const enrichmentId = sameKnown(sorted.map((r) => r.enrichmentId));
  const evidenceEvaluationId = sameKnown(
    sorted.map((r) => r.evidenceEvaluationId),
  );
  const catalogVersionId = sameKnown(sorted.map((r) => r.catalogVersionId));
  const sourceHash = sameKnown(sorted.map((r) => r.sourceHash));

  if (extractionId.kind !== 'known') {
    conflicts.push(conflict('MIXED_EXTRACTION', 'extraction no única/known'));
    missing.push('extractionId');
  } else {
    evid.push(
      evidence('SHARED_EXTRACTION', 'FUERTE', extractionId.value),
    );
  }
  if (enrichmentId.kind !== 'known') {
    conflicts.push(conflict('MIXED_ENRICHMENT', 'enrichment no única/known'));
    missing.push('enrichmentId');
  } else {
    evid.push(evidence('SHARED_ENRICHMENT', 'FUERTE', enrichmentId.value));
  }
  if (evidenceEvaluationId.kind !== 'known') {
    conflicts.push(
      conflict('MIXED_EVIDENCE_CONTEXT', 'evidence no única/known'),
    );
    missing.push('evidenceEvaluationId');
  } else {
    evid.push(
      evidence('SHARED_EVIDENCE', 'FUERTE', evidenceEvaluationId.value),
    );
  }
  if (catalogVersionId.kind !== 'known') {
    conflicts.push(conflict('MIXED_CATALOG', 'catalog no única/known'));
    missing.push('catalogVersionId');
  } else {
    evid.push(evidence('SHARED_CATALOG', 'FUERTE', catalogVersionId.value));
  }
  if (sourceHash.kind === 'unknown') {
    missing.push('sourceHash');
  } else if (sourceHash.kind === 'known') {
    evid.push(evidence('SHARED_SOURCE_HASH', 'MEDIA', sourceHash.value));
  }

  const domainCodes = [...byDomain.keys()].sort();
  let candidateUniverse: McKnownValue<string[]>;
  if (opts.eraUniverse && opts.eraUniverse.length > 0) {
    const era = [...opts.eraUniverse].sort();
    const missingDomains = era.filter((d) => !domainCodes.includes(d));
    const extra = domainCodes.filter((d) => !era.includes(d));
    if (missingDomains.length || extra.length) {
      candidateUniverse = unknown();
      conflicts.push(
        conflict(
          'UNKNOWN_CANDIDATE_UNIVERSE',
          `era≠domains missing=${missingDomains.join(',')} extra=${extra.join(',')}`,
        ),
      );
    } else {
      candidateUniverse = {
        kind: 'inferred',
        value: era,
        source: 'eraCandidateUniverse',
      };
      evid.push(
        evidence(
          'ERA_CANDIDATE_UNIVERSE',
          'MEDIA',
          era.join(','),
        ),
      );
    }
  } else {
    candidateUniverse = unknown();
    conflicts.push(
      conflict(
        'UNKNOWN_CANDIDATE_UNIVERSE',
        'Sin universo candidato de época persistido',
      ),
    );
    missing.push('candidateUniverse');
  }

  if (opts.alternativeBuckets) {
    conflicts.push(
      conflict(
        'ALTERNATIVE_GROUPING_EXISTS',
        'Otras particiones plausibles para la misma persona',
      ),
    );
    conflicts.push(
      conflict('OVERLAPPING_GROUPS', 'Múltiples buckets context-key'),
    );
  }

  // Señales débiles explícitamente NO usadas como clave (solo detección)
  const ids = sorted.map((r) => Number(r.id)).filter((n) => !Number.isNaN(n));
  if (ids.length >= 2) {
    const consecutive = ids.every(
      (id, i) => i === 0 || id === ids[i - 1] + 1,
    );
    if (consecutive) {
      evid.push(
        evidence(
          'CONSECUTIVE_IDS_IGNORED',
          'NO_UTILIZABLE',
          'IDs consecutivos no son prueba de run',
        ),
      );
    }
  }

  const ctx = {
    extractionId,
    enrichmentId,
    evidenceEvaluationId,
    catalogVersionId,
    sourceHash,
    candidateUniverse,
    qualificationPolicyVersion: unknown<string>(),
  };

  const hardBlock = conflicts.some((c) =>
    [
      'MULTIPLE_DOMAIN_EVALUATIONS',
      'MIXED_EXTRACTION',
      'MIXED_ENRICHMENT',
      'MIXED_EVIDENCE_CONTEXT',
      'MIXED_CATALOG',
    ].includes(c.code),
  );

  if (sorted.length === 1) {
    conflicts.push(
      conflict('ISOLATED_EVALUATION', 'Una sola evaluación en el bucket'),
    );
    return {
      personId,
      profileEvaluationIds: sorted.map((r) => r.id),
      domainCodes,
      inferredContext: ctx,
      eligibility: 'UNRECOVERABLE',
      evidence: evid,
      conflicts,
      missingFields: missing,
      recommendedAction: 'REEVALUATE',
      historicalContextFingerprint: buildHistoricalFingerprint(
        personId,
        sorted,
        ctx,
      ),
    };
  }

  if (hardBlock) {
    return {
      personId,
      profileEvaluationIds: sorted.map((r) => r.id),
      domainCodes,
      inferredContext: ctx,
      eligibility: 'AMBIGUOUS',
      evidence: evid,
      conflicts,
      missingFields: missing,
      recommendedAction: 'LEAVE_LEGACY',
      historicalContextFingerprint: buildHistoricalFingerprint(
        personId,
        sorted,
        ctx,
      ),
    };
  }

  if (opts.alternativeBuckets || candidateUniverse.kind === 'unknown') {
    return {
      personId,
      profileEvaluationIds: sorted.map((r) => r.id),
      domainCodes,
      inferredContext: ctx,
      eligibility: 'AMBIGUOUS',
      evidence: evid,
      conflicts,
      missingFields: missing,
      recommendedAction:
        candidateUniverse.kind === 'unknown' ? 'REEVALUATE' : 'REVIEW_REQUIRED',
      historicalContextFingerprint: buildHistoricalFingerprint(
        personId,
        sorted,
        ctx,
      ),
    };
  }

  // STRONG: cadena known única, 1 eval/dominio, universo era exacto, sin alternativas
  const packsOk = sorted.every(
    (r) => r.mappingPackCode && r.mappingPackVersion && r.engineRulesVersion,
  );
  if (!packsOk) {
    missing.push('mappingPack/engineRulesVersion');
    conflicts.push(
      conflict('MISSING_VERSION_CONTEXT', 'Pack o PA2 version null en filas'),
    );
    return {
      personId,
      profileEvaluationIds: sorted.map((r) => r.id),
      domainCodes,
      inferredContext: ctx,
      eligibility: 'AMBIGUOUS',
      evidence: evid,
      conflicts,
      missingFields: missing,
      recommendedAction: 'REEVALUATE',
      historicalContextFingerprint: buildHistoricalFingerprint(
        personId,
        sorted,
        ctx,
      ),
    };
  }

  evid.push(
    evidence(
      'UNIQUE_DOMAIN_ROWS',
      'FUERTE',
      'Una evaluación por dominio en el bucket',
    ),
  );

  return {
    personId,
    profileEvaluationIds: sorted.map((r) => r.id),
    domainCodes,
    inferredContext: ctx,
    eligibility: 'STRONG',
    evidence: evid,
    conflicts,
    missingFields: missing,
    recommendedAction: 'REVIEW_REQUIRED',
    historicalContextFingerprint: buildHistoricalFingerprint(
      personId,
      sorted,
      ctx,
    ),
  };
}

function buildUnrecoverable(
  personId: string,
  rows: McHistoricalProfileEvaluationRow[],
  conflicts: McHistoricalGroupingConflict[],
): HistoricalEvaluationSetCandidate {
  const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
  const ctx = {
    extractionId: unknown<string>(),
    enrichmentId: unknown<string>(),
    evidenceEvaluationId: unknown<string>(),
    catalogVersionId: unknown<string>(),
    sourceHash: unknown<string>(),
    candidateUniverse: unknown<string[]>(),
    qualificationPolicyVersion: unknown<string>(),
  };
  return {
    personId,
    profileEvaluationIds: sorted.map((r) => r.id),
    domainCodes: [...new Set(sorted.map((r) => r.domainCode))].sort(),
    inferredContext: ctx,
    eligibility: 'UNRECOVERABLE',
    evidence: [
      evidence(
        'INSUFFICIENT_PERSISTED_CONTEXT',
        'NO_UTILIZABLE',
        'Sin identidad de run ni cadena completa',
      ),
    ],
    conflicts,
    missingFields: [
      'extractionId',
      'enrichmentId',
      'evidenceEvaluationId',
      'catalogVersionId',
      'candidateUniverse',
      'runId',
    ],
    recommendedAction: 'REEVALUATE',
    historicalContextFingerprint: buildHistoricalFingerprint(
      personId,
      sorted,
      ctx,
    ),
  };
}

export function summarizeHistoricalCandidates(
  candidates: HistoricalEvaluationSetCandidate[],
  allRows: McHistoricalProfileEvaluationRow[],
): McHistoricalAuditSummary {
  const already = allRows.filter((r) => r.evaluationSetId).length;
  return {
    schemaVersion: MC_HISTORICAL_AUDIT_SCHEMA_VERSION,
    totalEvaluations: allRows.length,
    alreadyInSet: already,
    withoutSet: allRows.length - already,
    candidatesExact: candidates.filter((c) => c.eligibility === 'EXACT')
      .length,
    candidatesStrong: candidates.filter((c) => c.eligibility === 'STRONG')
      .length,
    candidatesAmbiguous: candidates.filter(
      (c) => c.eligibility === 'AMBIGUOUS',
    ).length,
    candidatesUnrecoverable: candidates.filter(
      (c) => c.eligibility === 'UNRECOVERABLE',
    ).length,
    personsTouched: new Set(candidates.map((c) => c.personId)).size,
    note:
      'Métricas sobre fixture/entrada; sin PostgreSQL real no representan cobertura productiva.',
  };
}

/** Universo operativo actual (solo referencia; no usar como backfill automático). */
export function currentOperativeUniverseSnapshot(): string[] {
  return DEFAULT_OPERATIVE.slice();
}

/**
 * Rechaza agrupación por señales prohibidas (API de prueba / documentación).
 */
export function isProhibitedPrimaryGroupingKey(signal: string): boolean {
  const prohibited = new Set([
    'person_id',
    'created_at_window',
    'consecutive_ids',
    'latest_per_domain',
    'is_active',
    'specialty_count',
  ]);
  return prohibited.has(signal);
}
