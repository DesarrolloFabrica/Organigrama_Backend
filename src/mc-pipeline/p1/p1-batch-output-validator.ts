/**
 * Validador determinístico de salida IA P1 prototipo.
 */
import type {
  EvidenceCandidate,
  P1CandidateDecision,
  P1EvidenceKind,
  P1Explicitness,
} from './p1.types';

const DECISIONS = new Set<P1CandidateDecision>([
  'ACCEPTED',
  'REJECTED_NON_PROFESSIONAL',
  'REJECTED_CONTEXT_ONLY',
  'AMBIGUOUS',
  'REVIEW_REQUIRED',
]);

const KINDS = new Set<P1EvidenceKind>([
  'ACTION',
  'RESPONSIBILITY',
  'PROJECT',
  'DELIVERABLE',
  'RESULT',
  'TOOL_USAGE',
  'METHODOLOGY',
  'CERTIFICATION',
  'KNOWLEDGE_STATEMENT',
  'LANGUAGE',
  'EDUCATION_SIGNAL',
  'OTHER_PROFESSIONAL_EVIDENCE',
]);

const EXPLICITNESS = new Set<P1Explicitness>([
  'EXPLICIT',
  'STRONGLY_SUPPORTED',
  'INFERRED',
]);

const FORBIDDEN_KEYS = [
  'domain',
  'domainCode',
  'specialty',
  'specialtyCode',
  'skill',
  'skillCode',
  'canonicalSkill',
  'level',
  'professionalLevel',
  'cargo',
  'area',
  'jefe',
  'hierarchy',
  'organigrama',
];

export type ValidatedEvidenceUnit = {
  evidencePrototypeId: string;
  candidateId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  sourceText: string;
  normalizedActivity: string | null;
  object: string | null;
  toolOrMethod: string | null;
  result: string | null;
  scope: string | null;
  temporalContext: string | null;
  evidenceKind: P1EvidenceKind;
  explicitness: P1Explicitness;
  decision: P1CandidateDecision;
  reviewRequired: boolean;
  provenance: Record<string, unknown>;
};

export type BatchValidationResult = {
  ok: boolean;
  status: 'OK' | 'VALIDATION_FAILED';
  errors: string[];
  decisions: Map<string, P1CandidateDecision>;
  units: ValidatedEvidenceUnit[];
  unsupportedSpanCount: number;
  forbiddenTaxonomyHits: number;
};

function walkForbidden(obj: unknown, hits: string[]): void {
  if (obj == null || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkForbidden(x, hits);
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.includes(k)) hits.push(k);
    walkForbidden(v, hits);
  }
}

export function validateP1BatchOutput(params: {
  batchId: string;
  expectedCandidateIds: string[];
  candidatesById: Map<string, EvidenceCandidate>;
  normalizedText: string;
  raw: unknown;
  prototypeId: string;
  promptVersion: string;
  modelVersion: string;
  segmenterVersion: string;
}): BatchValidationResult {
  const errors: string[] = [];
  const decisions = new Map<string, P1CandidateDecision>();
  const units: ValidatedEvidenceUnit[] = [];
  let unsupportedSpanCount = 0;
  const forbiddenHits: string[] = [];
  walkForbidden(params.raw, forbiddenHits);

  if (typeof params.raw !== 'object' || params.raw == null) {
    return {
      ok: false,
      status: 'VALIDATION_FAILED',
      errors: ['raw_not_object'],
      decisions,
      units,
      unsupportedSpanCount: 0,
      forbiddenTaxonomyHits: forbiddenHits.length,
    };
  }

  const root = params.raw as Record<string, unknown>;
  if (root.batchId != null && root.batchId !== params.batchId) {
    errors.push('batchId_mismatch');
  }

  const results = root.candidateResults;
  if (!Array.isArray(results)) {
    errors.push('candidateResults_missing');
    return {
      ok: false,
      status: 'VALIDATION_FAILED',
      errors,
      decisions,
      units,
      unsupportedSpanCount: 0,
      forbiddenTaxonomyHits: forbiddenHits.length,
    };
  }

  const seen = new Set<string>();
  let unitSeq = 0;

  for (const row of results) {
    if (typeof row !== 'object' || row == null) {
      errors.push('row_invalid');
      continue;
    }
    const r = row as Record<string, unknown>;
    const cid = String(r.candidateId ?? '');
    const decision = String(r.decision ?? '') as P1CandidateDecision;
    if (!params.expectedCandidateIds.includes(cid)) {
      errors.push(`unknown_candidate:${cid}`);
      continue;
    }
    if (seen.has(cid)) {
      errors.push(`duplicate_decision:${cid}`);
      continue;
    }
    seen.add(cid);
    if (!DECISIONS.has(decision)) {
      errors.push(`bad_decision:${cid}`);
      continue;
    }
    decisions.set(cid, decision);

    const cand = params.candidatesById.get(cid);
    if (!cand) {
      errors.push(`missing_cand_meta:${cid}`);
      continue;
    }

    const items = Array.isArray(r.evidenceItems) ? r.evidenceItems : [];
    if (decision === 'ACCEPTED' && items.length === 0) {
      errors.push(`accepted_without_items:${cid}`);
    }

    let hasInferred = false;
    for (const item of items) {
      if (typeof item !== 'object' || item == null) {
        errors.push(`item_invalid:${cid}`);
        unsupportedSpanCount += 1;
        continue;
      }
      const it = item as Record<string, unknown>;
      const rs = Number(it.relativeStart);
      const re = Number(it.relativeEnd);
      const kind = String(it.evidenceKind) as P1EvidenceKind;
      const expl = String(it.explicitness) as P1Explicitness;
      const cc = it.confidenceComponents as Record<string, number> | undefined;

      if (!Number.isInteger(rs) || !Number.isInteger(re) || re <= rs) {
        errors.push(`bad_offsets:${cid}`);
        unsupportedSpanCount += 1;
        continue;
      }
      const localLen = cand.endOffset - cand.startOffset;
      if (rs < 0 || re > localLen) {
        errors.push(`offsets_oob:${cid}`);
        unsupportedSpanCount += 1;
        continue;
      }
      if (!KINDS.has(kind)) {
        errors.push(`bad_kind:${cid}`);
        continue;
      }
      if (!EXPLICITNESS.has(expl)) {
        errors.push(`bad_explicitness:${cid}`);
        continue;
      }
      if (expl === 'INFERRED') hasInferred = true;

      if (
        !cc ||
        typeof cc.extractionCertainty !== 'number' ||
        typeof cc.spanIntegrity !== 'number' ||
        cc.extractionCertainty < 0 ||
        cc.extractionCertainty > 1 ||
        cc.spanIntegrity < 0 ||
        cc.spanIntegrity > 1
      ) {
        errors.push(`bad_confidence:${cid}`);
        continue;
      }

      const absStart = cand.startOffset + rs;
      const absEnd = cand.startOffset + re;
      const sourceText = params.normalizedText.slice(absStart, absEnd);
      if (!sourceText) {
        errors.push(`empty_source:${cid}`);
        unsupportedSpanCount += 1;
        continue;
      }

      unitSeq += 1;
      const reviewRequired =
        decision === 'REVIEW_REQUIRED' ||
        decision === 'AMBIGUOUS' ||
        expl === 'INFERRED';

      units.push({
        evidencePrototypeId: `${params.prototypeId}-e${String(unitSeq).padStart(4, '0')}`,
        candidateId: cid,
        pageNumber: cand.pageNumber,
        startOffset: absStart,
        endOffset: absEnd,
        sourceText,
        normalizedActivity:
          typeof it.normalizedActivity === 'string'
            ? it.normalizedActivity
            : null,
        object: typeof it.object === 'string' ? it.object : null,
        toolOrMethod: typeof it.toolOrMethod === 'string' ? it.toolOrMethod : null,
        result: typeof it.result === 'string' ? it.result : null,
        scope: typeof it.scope === 'string' ? it.scope : null,
        temporalContext:
          typeof it.temporalContext === 'string' ? it.temporalContext : null,
        evidenceKind: kind,
        explicitness: expl,
        decision: expl === 'INFERRED' ? 'REVIEW_REQUIRED' : decision,
        reviewRequired,
        provenance: {
          snapshotId: cand.snapshotId,
          pageNumber: cand.pageNumber,
          startOffset: absStart,
          endOffset: absEnd,
          candidateId: cid,
          batchId: params.batchId,
          promptVersion: params.promptVersion,
          modelVersion: params.modelVersion,
          contractVersion: '2.0.0',
          segmenterVersion: params.segmenterVersion,
          origin: 'MODEL_CLASSIFY',
          prototypeId: params.prototypeId,
          humanEdited: false,
        },
      });
    }

    if (hasInferred && decision === 'ACCEPTED') {
      // política prototipo: forzar revisión
      decisions.set(cid, 'REVIEW_REQUIRED');
    }
  }

  for (const id of params.expectedCandidateIds) {
    if (!seen.has(id)) errors.push(`omitted_candidate:${id}`);
  }

  if (forbiddenHits.length > 0) {
    errors.push(`forbidden_taxonomy:${[...new Set(forbiddenHits)].join(',')}`);
  }

  const ok = errors.length === 0;
  return {
    ok,
    status: ok ? 'OK' : 'VALIDATION_FAILED',
    errors,
    decisions,
    units,
    unsupportedSpanCount,
    forbiddenTaxonomyHits: forbiddenHits.length,
  };
}
