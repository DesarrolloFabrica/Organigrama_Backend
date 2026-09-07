import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEvidenceUnitsFromP1Pack } from './evidence';
import { resolveFields } from './field-resolver';
import { resolveSpecialties } from './specialty-resolver';
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
    >
  >,
): ResolverEvidenceUnit {
  return {
    evidenceId: id,
    candidateId: id,
    evidenceKind: kind,
    explicitness: slots.explicitness ?? 'EXPLICIT',
    decision: 'ACCEPTED',
    normalizedActivity: slots.normalizedActivity ?? null,
    object: slots.object ?? null,
    toolOrMethod: slots.toolOrMethod ?? null,
    result: slots.result ?? null,
    scope: slots.scope ?? null,
    temporalContext: null,
  };
}

function govOf(units: ResolverEvidenceUnit[]) {
  return resolveSpecialties({
    snapshotId: 'test',
    units,
    fieldCodes: ['DATA_ANALYTICS'],
  }).items.find((i) => i.specialtyCode === 'DATA_GOVERNANCE');
}

function deOf(units: ResolverEvidenceUnit[]) {
  return resolveSpecialties({
    snapshotId: 'test',
    units,
    fieldCodes: ['DATA_ANALYTICS'],
  }).items.find((i) => i.specialtyCode === 'DATA_ENGINEERING');
}

describe('MC1 experimental deterministic resolver', () => {
  const saraLike: ResolverEvidenceUnit[] = [
    eu('c-0022', 'ACTION', {
      normalizedActivity: 'Consolidar repositorio de datos',
      object: 'repositorio de datos operacional',
      toolOrMethod: 'GCP',
      result: 'garantizando trazabilidad',
      scope: 'operacional',
    }),
    eu('c-0040', 'ACTION', {
      normalizedActivity: 'implementar repositorio centralizado',
      object: 'repositorio centralizado',
      toolOrMethod: 'GCP',
      result: 'asegurando la calidad y',
    }),
    eu('c-0046', 'ACTION', {
      normalizedActivity: 'administrar esquema SQL Server',
      object: 'esquema',
      toolOrMethod: 'SQL Server',
      result: 'garantizando la gobernanza, integridad y',
    }),
    eu('c-0062', 'KNOWLEDGE_STATEMENT', {
      object: 'analítico y ETL, Gobierno de datos, Algoritmos de Machine Learning',
      explicitness: 'STRONGLY_SUPPORTED',
    }),
  ];

  it('Sara-like: Governance RESOLVED from ACTION outcomes, not from knowledge', () => {
    const g = govOf(saraLike)!;
    expect(g.decision).toBe('RESOLVED');
    expect(g.observedEquivalent).toBe(true);
    expect(g.originEvidenceIds).toEqual(
      expect.arrayContaining(['c-0022', 'c-0040', 'c-0046']),
    );
    expect(g.originEvidenceIds).not.toContain('c-0062');
    expect(g.reinforceEvidenceIds).toContain('c-0062');
    expect(g.reasonCodes).toContain('MULTI_ACTION_OUTCOME_MATCH');
  });

  it('Haider-like: ETL/SQL/cloud without outcome → Governance INSUFFICIENT', () => {
    const units = [
      eu('h-etl', 'ACTION', {
        normalizedActivity: 'Optimizar y automatizar pipelines de datos y procesos ETL',
      }),
      eu('h-arch', 'ACTION', {
        normalizedActivity: 'Diseñar arquitecturas de datos y automatizar procesos',
        toolOrMethod: 'GCP',
      }),
      eu('h-sql', 'ACTION', {
        normalizedActivity: 'consultar bases de datos',
        toolOrMethod: 'SQL',
      }),
      eu('h-bi', 'ACTION', {
        normalizedActivity: 'crear dashboards interactivos',
        toolOrMethod: 'Power BI',
      }),
    ];
    const g = govOf(units)!;
    expect(g.decision).toBe('INSUFFICIENT_EVIDENCE');
    expect(g.observedEquivalent).toBe(false);
    expect(g.originEvidenceIds).toHaveLength(0);
    expect(g.exclusionsTriggered).toEqual(
      expect.arrayContaining(['TECH_WITHOUT_GOVERNANCE_OUTCOME']),
    );
  });

  it('Knowledge-only Gobierno de datos cannot originate OBSERVED-equivalent', () => {
    const units = [
      eu('k-1', 'KNOWLEDGE_STATEMENT', {
        object: 'Gobierno de datos',
        explicitness: 'STRONGLY_SUPPORTED',
      }),
    ];
    const g = govOf(units)!;
    expect(g.decision).toBe('INSUFFICIENT_EVIDENCE');
    expect(g.originEvidenceIds).toHaveLength(0);
    expect(g.reasonCodes).toEqual(
      expect.arrayContaining(['KNOWLEDGE_CANNOT_ORIGINATE']),
    );
  });

  it('SQL-only tool does not produce Governance', () => {
    const units = [
      eu('sql-1', 'TOOL_USAGE', {
        toolOrMethod: 'SQL',
        normalizedActivity: null,
      }),
      eu('sql-2', 'ACTION', {
        normalizedActivity: 'usar SQL',
        toolOrMethod: 'SQL',
      }),
    ];
    const g = govOf(units)!;
    expect(g.decision).not.toBe('RESOLVED');
    expect(g.originEvidenceIds).toHaveLength(0);
  });

  it('ETL-only without governance outcome does not produce Governance', () => {
    const units = [
      eu('etl-1', 'ACTION', {
        normalizedActivity: 'implementar procesos ETL',
        object: 'pipelines de datos',
      }),
      eu('etl-2', 'ACTION', {
        normalizedActivity: 'automatizar pipelines de datos',
      }),
    ];
    const g = govOf(units)!;
    const de = deOf(units)!;
    expect(g.decision).toBe('INSUFFICIENT_EVIDENCE');
    expect(de.decision).toBe('RESOLVED');
  });

  it('same EU can support DATA_ENGINEERING and DATA_GOVERNANCE', () => {
    const units = [
      eu('m-1', 'ACTION', {
        normalizedActivity: 'administrar repositorio de datos',
        object: 'repositorio',
        result: 'garantizando gobernanza e integridad',
      }),
      eu('m-2', 'ACTION', {
        normalizedActivity: 'consolidar repositorio de datos',
        object: 'repositorio de datos',
        result: 'garantizando trazabilidad',
      }),
    ];
    const g = govOf(units)!;
    const de = deOf(units)!;
    expect(g.decision).toBe('RESOLVED');
    expect(de.decision).toBe('RESOLVED');
    expect(g.originEvidenceIds.sort()).toEqual(['m-1', 'm-2'].sort());
    expect(de.originEvidenceIds.sort()).toEqual(['m-1', 'm-2'].sort());
  });

  it('DM vs COMM with similar practice support stays AMBIGUOUS', () => {
    const units = [
      eu('c1', 'ACTION', {
        normalizedActivity: 'planear mensajes institucionales',
        object: 'comunicación institucional',
      }),
      eu('c2', 'ACTION', {
        normalizedActivity: 'gestionar comunicación corporativa',
        object: 'vocería de la organización',
      }),
      eu('d1', 'ACTION', {
        normalizedActivity: 'ejecutar campañas de marketing',
        object: 'campañas de publicidad',
      }),
      eu('d2', 'ACTION', {
        normalizedActivity: 'planear campañas de marketing',
        object: 'campañas de posicionamiento',
      }),
    ];
    const p2 = resolveFields({ snapshotId: 'test', units });
    expect(p2.decision).toBe('AMBIGUOUS');
    expect(p2.ambiguousFieldCodes).toEqual(
      expect.arrayContaining(['COMMUNICATIONS', 'DIGITAL_MARKETING']),
    );
    expect(p2.resolvedFieldCode).toBeNull();
  });

  it('same input produces byte-equivalent output', () => {
    const a = resolveFields({ snapshotId: '20', units: saraLike });
    const b = resolveFields({ snapshotId: '20', units: saraLike });
    expect(stableStringify(a)).toBe(stableStringify(b));
    const s1 = resolveSpecialties({
      snapshotId: '20',
      units: saraLike,
      fieldCodes: ['DATA_ANALYTICS'],
    });
    const s2 = resolveSpecialties({
      snapshotId: '20',
      units: saraLike,
      fieldCodes: ['DATA_ANALYTICS'],
    });
    expect(stableStringify(s1)).toBe(stableStringify(s2));
  });

  it('real Sara pack: Governance origin IDs include c-0022/c-0040/c-0046', () => {
    const pack = resolve(
      process.cwd(),
      'tmp/mc1-p1-prototype/P1P-V11-6I-S20-20260813155305-eba75374',
    );
    if (!existsSync(pack)) return;
    const units = loadEvidenceUnitsFromP1Pack(pack);
    const g = govOf(units)!;
    expect(g.decision).toBe('RESOLVED');
    expect(g.originEvidenceIds).toEqual(
      expect.arrayContaining(['c-0022', 'c-0040', 'c-0046']),
    );
    expect(g.originEvidenceIds).not.toContain('c-0062');
  });

  it('real Haider pack: Governance is not RESOLVED', () => {
    const pack = resolve(
      process.cwd(),
      'tmp/mc1-p1-prototype/P1P-DGFIX-S21-20260813172450-8ce82817',
    );
    if (!existsSync(pack)) return;
    const units = loadEvidenceUnitsFromP1Pack(pack);
    const g = govOf(units)!;
    expect(g.decision).not.toBe('RESOLVED');
    expect(g.originEvidenceIds).toHaveLength(0);
  });
});
