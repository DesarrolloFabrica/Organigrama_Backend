/**
 * Fixtures sintéticas para adversarial + mutation.
 * No tocan packs reales.
 */
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';

export function eu(
  id: string,
  kind: string,
  slots: Partial<
    Pick<
      ResolverEvidenceUnit,
      | 'normalizedActivity'
      | 'object'
      | 'toolOrMethod'
      | 'result'
      | 'scope'
      | 'explicitness'
      | 'startOffset'
      | 'endOffset'
      | 'pageNumber'
      | 'candidateId'
    >
  > = {},
): ResolverEvidenceUnit {
  return {
    evidenceId: id,
    candidateId: slots.candidateId ?? id,
    evidenceKind: kind,
    explicitness: slots.explicitness ?? 'EXPLICIT',
    decision: 'ACCEPTED',
    normalizedActivity: slots.normalizedActivity ?? null,
    object: slots.object ?? null,
    toolOrMethod: slots.toolOrMethod ?? null,
    result: slots.result ?? null,
    scope: slots.scope ?? null,
    temporalContext: null,
    startOffset: slots.startOffset ?? null,
    endOffset: slots.endOffset ?? null,
    pageNumber: slots.pageNumber ?? 1,
  };
}

export const ADVERSARIAL_FIXTURES: Record<string, ResolverEvidenceUnit[]> = {
  toolRichShallow: [
    eu('t1', 'TOOL_USAGE', { toolOrMethod: 'SQL', startOffset: 0, endOffset: 20 }),
    eu('t2', 'TOOL_USAGE', { toolOrMethod: 'Power BI', startOffset: 80, endOffset: 110 }),
    eu('t3', 'TOOL_USAGE', { toolOrMethod: 'GCP', startOffset: 200, endOffset: 220 }),
  ],
  knowledgeRichActionPoor: [
    eu('k1', 'KNOWLEDGE_STATEMENT', {
      object: 'gobierno de datos, SQL, Power BI, machine learning',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('k2', 'KNOWLEDGE_STATEMENT', {
      object: 'arquitectura de datos y calidad',
      startOffset: 200,
      endOffset: 240,
    }),
  ],
  multiDomainCv: [
    eu('d1', 'ACTION', {
      normalizedActivity: 'administrar esquema',
      object: 'esquema de datos',
      result: 'garantizando integridad',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('d2', 'ACTION', {
      normalizedActivity: 'consolidar repositorio de datos',
      object: 'repositorio',
      result: 'garantizando trazabilidad',
      startOffset: 400,
      endOffset: 480,
    }),
    eu('v1', 'ACTION', {
      normalizedActivity: 'disenar identidad visual',
      object: 'identidad corporativa',
      startOffset: 800,
      endOffset: 860,
    }),
    eu('v2', 'ACTION', {
      normalizedActivity: 'crear mockups y maquetacion',
      object: 'piezas impresas',
      startOffset: 1200,
      endOffset: 1260,
    }),
  ],
  oneStrongSentence: [
    eu('s1', 'ACTION', {
      candidateId: 'same',
      normalizedActivity: 'administrar esquema de datos garantizando integridad',
      object: 'esquema',
      result: 'garantizando integridad',
      startOffset: 0,
      endOffset: 50,
    }),
    eu('s2', 'ACTION', {
      candidateId: 'same',
      normalizedActivity: 'administrar esquema de datos garantizando integridad',
      object: 'esquema',
      result: 'garantizando integridad',
      startOffset: 8,
      endOffset: 58,
    }),
    eu('s3', 'ACTION', {
      candidateId: 'same',
      normalizedActivity: 'administrar esquema de datos garantizando integridad',
      object: 'esquema',
      result: 'garantizando integridad',
      startOffset: 16,
      endOffset: 66,
    }),
  ],
  sharedPracticeMotion: [
    eu('m1', 'ACTION', {
      normalizedActivity: 'crear motion graphics',
      object: 'motion graphics',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('m2', 'ACTION', {
      normalizedActivity: 'producir animacion',
      object: 'contenido multimedia',
      startOffset: 80,
      endOffset: 120,
    }),
  ],
  singleSource: [
    eu('one', 'ACTION', {
      normalizedActivity: 'administrar esquema',
      object: 'esquema',
      result: 'garantizando integridad',
      startOffset: 0,
      endOffset: 40,
    }),
  ],
  strongCompetitorPair: [
    eu('d1', 'ACTION', {
      normalizedActivity: 'administrar esquema',
      object: 'esquema de datos',
      result: 'garantizando integridad',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('d2', 'ACTION', {
      normalizedActivity: 'consolidar repositorio de datos',
      object: 'repositorio',
      result: 'garantizando trazabilidad',
      startOffset: 400,
      endOffset: 480,
    }),
    eu('i1', 'ACTION', {
      normalizedActivity: 'administrar servidores y redes',
      object: 'infraestructura',
      startOffset: 800,
      endOffset: 860,
    }),
    eu('i2', 'ACTION', {
      normalizedActivity: 'gestionar mesa de ayuda y sistemas',
      object: 'sistemas',
      startOffset: 1200,
      endOffset: 1260,
    }),
  ],
  outcomeRich: [
    eu('g1', 'ACTION', {
      normalizedActivity: 'administrar esquema',
      object: 'esquema',
      result: 'garantizando integridad',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('g2', 'ACTION', {
      normalizedActivity: 'consolidar repositorio de datos',
      object: 'repositorio',
      result: 'garantizando trazabilidad',
      startOffset: 400,
      endOffset: 480,
    }),
  ],
  duplicateSpans: [
    eu('s1', 'ACTION', {
      candidateId: 'dup',
      normalizedActivity: 'desarrollar frontend',
      object: 'frontend',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('s2', 'ACTION', {
      candidateId: 'dup',
      normalizedActivity: 'desarrollar frontend',
      object: 'frontend',
      startOffset: 10,
      endOffset: 50,
    }),
  ],
};

export const GOV_RESOLVED_FIXTURE: ResolverEvidenceUnit[] = [
  eu('g1', 'ACTION', {
    normalizedActivity: 'administrar esquema',
    object: 'esquema',
    result: 'garantizando integridad',
    startOffset: 0,
    endOffset: 40,
  }),
  eu('g2', 'ACTION', {
    normalizedActivity: 'consolidar repositorio de datos',
    object: 'repositorio',
    result: 'garantizando trazabilidad',
    startOffset: 400,
    endOffset: 480,
  }),
];

export const FRONTEND_RESOLVED_FIXTURE: ResolverEvidenceUnit[] = [
  eu('f1', 'ACTION', {
    normalizedActivity: 'implementar componentes',
    object: 'interfaces digitales',
    toolOrMethod: 'React',
    startOffset: 0,
    endOffset: 50,
  }),
  eu('f2', 'ACTION', {
    normalizedActivity: 'desarrollar frontend',
    object: 'frontend',
    toolOrMethod: 'React',
    startOffset: 200,
    endOffset: 260,
  }),
];

export function mutateRemoveOutcome(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) => ({ ...u, result: null }));
}

export function mutateCollapseIndependent(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u, i) => ({
    ...u,
    candidateId: 'collapsed',
    startOffset: i * 4,
    endOffset: i * 4 + 20,
  }));
}

export function mutateActionToKnowledge(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) => ({
    ...u,
    evidenceKind: 'KNOWLEDGE_STATEMENT',
  }));
}

export function mutateAddCompetitor(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return [
    ...units,
    eu('c1', 'ACTION', {
      normalizedActivity: 'disenar identidad visual',
      object: 'identidad corporativa',
      startOffset: 2000,
      endOffset: 2060,
    }),
    eu('c2', 'ACTION', {
      normalizedActivity: 'crear mockups y maquetacion',
      object: 'piezas impresas',
      startOffset: 2400,
      endOffset: 2460,
    }),
  ];
}

export function mutateRemoveDifferential(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) => ({
    ...u,
    normalizedActivity: 'crear motion graphics',
    object: 'motion graphics',
    result: null,
  }));
}
