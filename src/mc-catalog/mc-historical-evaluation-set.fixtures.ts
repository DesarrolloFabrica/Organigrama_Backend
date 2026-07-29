/**
 * Fixtures sintéticos 1C.3 — sin PII real.
 */
import type { McHistoricalProfileEvaluationRow } from './mc-historical-evaluation-set.types';

function base(
  partial: Partial<McHistoricalProfileEvaluationRow> &
    Pick<McHistoricalProfileEvaluationRow, 'id' | 'personId' | 'domainCode'>,
): McHistoricalProfileEvaluationRow {
  return {
    personCvId: '1',
    extractionId: '10',
    enrichmentId: '20',
    evidenceEvaluationId: '30',
    catalogVersionId: '2',
    engineRulesVersion: 'pa2-software-1.1.0',
    mappingPackCode: 'software-mappings',
    mappingPackVersion: '1.0.0',
    mappingHash: 'a'.repeat(64),
    sourceHash: 'c'.repeat(64),
    algorithmVersion: 'pa2-algo-lexico-v1',
    evaluationContextHash: 'd'.repeat(64),
    domainQualification: 'OUTSIDE',
    isActive: false,
    status: 'SUCCEEDED',
    createdAt: '2026-07-01T12:00:00.000Z',
    evaluationSetId: null,
    ...partial,
  };
}

/** 1. Moderno ya en set → EXACT / ALREADY_IN_SET */
export function fixtureAlreadyInSet(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '101',
      personId: '9001',
      domainCode: 'SOFTWARE',
      domainQualification: 'PRIMARY_MATCH',
      isActive: true,
      evaluationSetId: '500',
      engineRulesVersion: 'pa2-software-1.1.0',
      mappingPackCode: 'software-mappings',
    }),
    base({
      id: '102',
      personId: '9001',
      domainCode: 'VISUAL_DESIGN',
      domainQualification: 'OUTSIDE',
      evaluationSetId: '500',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
    base({
      id: '103',
      personId: '9001',
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      domainQualification: 'OUTSIDE',
      evaluationSetId: '500',
      engineRulesVersion: 'pa2-audiovisual-production-1.0.0',
      mappingPackCode: 'audiovisual-production-mappings',
    }),
  ];
}

/** 2. STRONG: cadena común única, 3 dominios, packs poblados */
export function fixtureStrongUnique(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '201',
      personId: '9002',
      domainCode: 'SOFTWARE',
      domainQualification: 'PRIMARY_MATCH',
      isActive: true,
      engineRulesVersion: 'pa2-software-1.1.0',
      mappingPackCode: 'software-mappings',
    }),
    base({
      id: '202',
      personId: '9002',
      domainCode: 'VISUAL_DESIGN',
      domainQualification: 'SECONDARY_SIGNAL',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
    base({
      id: '203',
      personId: '9002',
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      domainQualification: 'OUTSIDE',
      engineRulesVersion: 'pa2-audiovisual-production-1.0.0',
      mappingPackCode: 'audiovisual-production-mappings',
    }),
  ];
}

/** 3. AMBIGUOUS: dos buckets plausibles (extracciones distintas) */
export function fixtureTwoPlausibleGroups(): McHistoricalProfileEvaluationRow[] {
  return [
    ...fixtureStrongUnique().map((r) => ({ ...r, personId: '9003' })),
    base({
      id: '301',
      personId: '9003',
      extractionId: '99',
      enrichmentId: '98',
      evidenceEvaluationId: '97',
      domainCode: 'SOFTWARE',
      domainQualification: 'PRIMARY_MATCH',
      engineRulesVersion: 'pa2-software-1.1.0',
      mappingPackCode: 'software-mappings',
    }),
    base({
      id: '302',
      personId: '9003',
      extractionId: '99',
      enrichmentId: '98',
      evidenceEvaluationId: '97',
      domainCode: 'VISUAL_DESIGN',
      domainQualification: 'OUTSIDE',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
    base({
      id: '303',
      personId: '9003',
      extractionId: '99',
      enrichmentId: '98',
      evidenceEvaluationId: '97',
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      domainQualification: 'OUTSIDE',
      engineRulesVersion: 'pa2-audiovisual-production-1.0.0',
      mappingPackCode: 'audiovisual-production-mappings',
    }),
  ];
}

/** 4. Mixed extraction forzado en mismo intento de grupo (ids same person, different extraction sin key match → 2 buckets) */
export function fixtureMixedExtraction(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '401',
      personId: '9004',
      extractionId: '10',
      domainCode: 'SOFTWARE',
    }),
    base({
      id: '402',
      personId: '9004',
      extractionId: '11',
      domainCode: 'VISUAL_DESIGN',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
  ];
}

/** 5. Duplicate domain */
export function fixtureDuplicateDomain(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '501',
      personId: '9005',
      domainCode: 'SOFTWARE',
      domainQualification: 'PRIMARY_MATCH',
    }),
    base({
      id: '502',
      personId: '9005',
      domainCode: 'SOFTWARE',
      domainQualification: 'OUTSIDE',
      createdAt: '2026-07-01T12:01:00.000Z',
    }),
    base({
      id: '503',
      personId: '9005',
      domainCode: 'VISUAL_DESIGN',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
  ];
}

/** 6. Unknown candidate universe (solo 1 dominio vs era de 3) */
export function fixtureUnknownUniverse(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '601',
      personId: '9006',
      domainCode: 'SOFTWARE',
      domainQualification: 'PRIMARY_MATCH',
      isActive: true,
    }),
    base({
      id: '602',
      personId: '9006',
      domainCode: 'VISUAL_DESIGN',
      engineRulesVersion: 'pa2-visual-design-1.1.0',
      mappingPackCode: 'visual-design-mappings',
    }),
  ];
}

/** 7. Isolated */
export function fixtureIsolated(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '701',
      personId: '9007',
      domainCode: 'SOFTWARE',
      domainQualification: null,
    }),
  ];
}

/** 8. Qualification NULL */
export function fixtureQualificationNull(): McHistoricalProfileEvaluationRow[] {
  return fixtureStrongUnique().map((r) => ({
    ...r,
    personId: '9008',
    id: String(Number(r.id) + 600),
    domainQualification: null,
  }));
}

/** 9. Pre-multidomain: solo SOFTWARE, packs null */
export function fixturePreMultidomain(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '901',
      personId: '9009',
      domainCode: 'SOFTWARE',
      domainQualification: null,
      mappingPackCode: null,
      mappingPackVersion: null,
      sourceHash: null,
      algorithmVersion: null,
      evaluationContextHash: null,
      isActive: true,
    }),
  ];
}

/** 10. Missing chain → UNRECOVERABLE */
export function fixtureMissingChain(): McHistoricalProfileEvaluationRow[] {
  return [
    base({
      id: '1001',
      personId: '9010',
      extractionId: null,
      enrichmentId: null,
      evidenceEvaluationId: null,
      catalogVersionId: null,
      domainCode: 'SOFTWARE',
    }),
  ];
}

/** EXACT histórico no existe: placeholder documentando ausencia de run_id */
export function fixtureNoHistoricalRunId(): McHistoricalProfileEvaluationRow[] {
  return fixtureStrongUnique();
}
