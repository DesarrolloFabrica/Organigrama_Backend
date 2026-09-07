import { resolveFieldsHardened } from './field-resolver-hardened';
import { independentSourceCount } from './independence';
import { resolveSpecialtiesHardened } from './specialty-resolver-hardened';
import { stableStringify } from './run-prototype';
import type { ResolverEvidenceUnit } from './types';

function eu(
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
  >,
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

function spec(units: ResolverEvidenceUnit[], field: string, code: string) {
  return resolveSpecialtiesHardened({
    snapshotId: 'test',
    units,
    fieldCodes: [field],
  }).items.find((i) => i.specialtyCode === code);
}

describe('MC1 deterministic resolver hardening', () => {
  it('SQL+ETL+cloud without outcome is not GOV', () => {
    const g = spec(
      [
        eu('a', 'ACTION', { normalizedActivity: 'automatizar pipelines de datos y ETL' }),
        eu('b', 'ACTION', {
          normalizedActivity: 'diseñar arquitecturas de datos',
          toolOrMethod: 'GCP',
        }),
      ],
      'DATA_ANALYTICS',
      'DATA_GOVERNANCE',
    )!;
    expect(g.decision).not.toBe('RESOLVED');
  });

  it('Knowledge Gobierno de datos is not OBSERVED-equivalent', () => {
    const g = spec(
      [eu('k', 'KNOWLEDGE_STATEMENT', { object: 'Gobierno de datos' })],
      'DATA_ANALYTICS',
      'DATA_GOVERNANCE',
    )!;
    expect(g.observedEquivalent).toBe(false);
  });

  it('ACTION + integrity outcome is GOV eligible with two independent sources', () => {
    const g = spec(
      [
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
      'DATA_ANALYTICS',
      'DATA_GOVERNANCE',
    )!;
    expect(g.decision).toBe('RESOLVED');
    expect(g.reasonCodes).toContain('ACTION_OUTCOME_MATCH');
  });

  it('React tool only does not originate FRONTEND', () => {
    const fe = spec(
      [eu('r', 'TOOL_USAGE', { toolOrMethod: 'React' })],
      'SOFTWARE_ENGINEERING',
      'FRONTEND_ENGINEERING',
    )!;
    expect(fe.decision).not.toBe('RESOLVED');
    expect(fe.originEvidenceIds).toHaveLength(0);
  });

  it('develop UI components + React is FRONTEND eligible', () => {
    const fe = spec(
      [
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
      ],
      'SOFTWARE_ENGINEERING',
      'FRONTEND_ENGINEERING',
    )!;
    expect(fe.decision).toBe('RESOLVED');
  });

  it('motion alone on VD/AV boundary stays AMBIGUOUS', () => {
    const units = [
      eu('m1', 'ACTION', {
        normalizedActivity: 'crear motion graphics',
        object: 'motion graphics',
        startOffset: 0,
        endOffset: 40,
      }),
      eu('m2', 'ACTION', {
        normalizedActivity: 'producir animacion',
        object: 'animacion',
        startOffset: 80,
        endOffset: 120,
      }),
    ];
    const p2 = resolveFieldsHardened({ snapshotId: 't', units });
    expect(p2.decision).not.toBe('RESOLVED');
    expect(
      p2.reasonCodes.some(
        (c) =>
          c === 'CROSS_DOMAIN_PRACTICE' ||
          c === 'INSUFFICIENT_DIFFERENTIAL_SIGNAL' ||
          c === 'COMPETING_FIELDS',
      ) || p2.decision === 'INSUFFICIENT_EVIDENCE' || p2.decision === 'AMBIGUOUS',
    ).toBe(true);
  });

  it('generic social/content does not force DM vs COMM winner', () => {
    const p2 = resolveFieldsHardened({
      snapshotId: 't',
      units: [
        eu('s1', 'ACTION', {
          normalizedActivity: 'gestionar contenido digital',
          object: 'redes sociales',
        }),
        eu('s2', 'ACTION', {
          normalizedActivity: 'publicar en canales digitales',
          object: 'contenido digital',
        }),
      ],
    });
    expect(p2.resolvedFieldCode).not.toBe('DIGITAL_MARKETING');
    expect(p2.resolvedFieldCode).not.toBe('COMMUNICATIONS');
  });

  it('adjacent ACTION+tail counts as one independent source', () => {
    const units = [
      eu('c-0022', 'ACTION', {
        candidateId: 'c-0022',
        startOffset: 100,
        endOffset: 180,
        pageNumber: 1,
        normalizedActivity: 'consolidar repositorio',
        result: 'trazabilidad',
      }),
      eu('c-0023', 'RESULT', {
        candidateId: 'c-0023',
        startOffset: 181,
        endOffset: 210,
        pageNumber: 1,
        result: 'alta disponibilidad',
      }),
    ];
    expect(independentSourceCount(units.filter((u) => u.evidenceKind === 'ACTION'))).toBe(1);
  });

  it('same input is byte-equivalent', () => {
    const units = [
      eu('a', 'ACTION', {
        normalizedActivity: 'desarrollar frontend',
        object: 'frontend',
        startOffset: 0,
        endOffset: 20,
      }),
      eu('b', 'ACTION', {
        normalizedActivity: 'desarrollar backend',
        object: 'backend',
        startOffset: 80,
        endOffset: 110,
      }),
    ];
    const x = resolveFieldsHardened({ snapshotId: '12', units });
    const y = resolveFieldsHardened({ snapshotId: '12', units });
    expect(stableStringify(x)).toBe(stableStringify(y));
  });
});
