import { eu } from './gate-fixtures';
import type { ResolverEvidenceUnit } from '../experimental/deterministic-resolver/types';

function sePrimaryFour(): ResolverEvidenceUnit[] {
  return [
    eu('se1', 'ACTION', {
      normalizedActivity: 'desarrollo frontend',
      object: 'interfaces',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('se2', 'ACTION', {
      normalizedActivity: 'desarrollo backend',
      object: 'apis',
      startOffset: 400,
      endOffset: 460,
    }),
    eu('se3', 'ACTION', {
      normalizedActivity: 'desarrollar frontend',
      object: 'componentes',
      startOffset: 800,
      endOffset: 860,
    }),
    eu('se4', 'ACTION', {
      normalizedActivity: 'desarrollar backend',
      object: 'servicios',
      startOffset: 1200,
      endOffset: 1260,
    }),
  ];
}

export const CSET_FIXTURES: Record<string, ResolverEvidenceUnit[]> = {
  strongPrimaryLegitimateSecondary: [
    ...sePrimaryFour(),
    eu('it1', 'ACTION', {
      normalizedActivity: 'administrar servidores y redes',
      object: 'infraestructura',
      startOffset: 1600,
      endOffset: 1660,
    }),
    eu('it2', 'ACTION', {
      normalizedActivity: 'gestionar mesa de ayuda y sistemas',
      object: 'sistemas',
      startOffset: 2000,
      endOffset: 2060,
    }),
  ],
  strongPrimaryToolOnlySecondary: [
    eu('se1', 'ACTION', {
      normalizedActivity: 'desarrollo frontend',
      object: 'frontend',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('se2', 'ACTION', {
      normalizedActivity: 'desarrollo backend',
      object: 'backend',
      startOffset: 400,
      endOffset: 460,
    }),
    eu('vdtool', 'TOOL_USAGE', {
      toolOrMethod: 'Figma',
      startOffset: 800,
      endOffset: 820,
    }),
  ],
  twoStrongCompeting: [
    eu('se1', 'ACTION', {
      normalizedActivity: 'desarrollo frontend',
      object: 'aplicaciones web',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('se2', 'ACTION', {
      normalizedActivity: 'desarrollo backend',
      object: 'apis',
      startOffset: 400,
      endOffset: 460,
    }),
    eu('da1', 'ACTION', {
      normalizedActivity: 'analizar datos',
      object: 'informacion',
      result: 'reporting',
      startOffset: 800,
      endOffset: 860,
    }),
    eu('da2', 'ACTION', {
      normalizedActivity: 'construir dashboards ejecutivos y ciencia de datos',
      object: 'modelos predictivos',
      startOffset: 1200,
      endOffset: 1260,
    }),
  ],
  sharedPracticeOnly: [
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
  oneThinSecondary: [
    eu('se1', 'ACTION', {
      normalizedActivity: 'desarrollo frontend',
      object: 'frontend',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('se2', 'ACTION', {
      normalizedActivity: 'desarrollo backend',
      object: 'backend',
      startOffset: 400,
      endOffset: 460,
    }),
    eu('vd1', 'ACTION', {
      normalizedActivity: 'disenar identidad visual',
      object: 'identidad corporativa',
      startOffset: 800,
      endOffset: 860,
    }),
  ],
  multipleIndependentSecondary: [
    ...sePrimaryFour(),
    eu('it1', 'ACTION', {
      normalizedActivity: 'administrar servidores y redes',
      object: 'infraestructura',
      startOffset: 1600,
      endOffset: 1660,
    }),
    eu('it2', 'ACTION', {
      normalizedActivity: 'gestionar mesa de ayuda y sistemas',
      object: 'sistemas',
      startOffset: 2000,
      endOffset: 2060,
    }),
  ],
};

export function mutateRemoveSecondaryDifferential(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) =>
    u.evidenceId.startsWith('it')
      ? {
          ...u,
          evidenceKind: 'TOOL_USAGE',
          normalizedActivity: null,
          object: null,
          toolOrMethod: 'Linux',
        }
      : u,
  );
}

export function mutateSecondaryActionToKnowledge(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return units.map((u) =>
    u.evidenceId.startsWith('it')
      ? { ...u, evidenceKind: 'KNOWLEDGE_STATEMENT' }
      : u,
  );
}

export function mutateAddStrongCompetitor(
  units: ResolverEvidenceUnit[],
): ResolverEvidenceUnit[] {
  return [
    ...units,
    eu('da1', 'ACTION', {
      normalizedActivity: 'analizar datos',
      object: 'informacion',
      result: 'reporting',
      startOffset: 2000,
      endOffset: 2060,
    }),
    eu('da2', 'ACTION', {
      normalizedActivity: 'construir dashboards ejecutivos y ciencia de datos',
      object: 'modelos predictivos',
      startOffset: 2400,
      endOffset: 2460,
    }),
  ];
}
