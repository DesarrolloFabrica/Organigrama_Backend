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

function sePrimaryTwo(): ResolverEvidenceUnit[] {
  return [
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
  ];
}

export const CSET_V2_FIXTURES: Record<string, ResolverEvidenceUnit[]> = {
  primaryPlusLegitimateContext: [
    ...sePrimaryTwo(),
    eu('vd1', 'ACTION', {
      normalizedActivity: 'crear piezas graficas',
      object: 'piezas graficas especializadas',
      startOffset: 800,
      endOffset: 860,
    }),
  ],
  primaryPlusToolOnly: [
    ...sePrimaryTwo(),
    eu('vdtool', 'TOOL_USAGE', {
      toolOrMethod: 'Figma',
      startOffset: 800,
      endOffset: 820,
    }),
  ],
  primaryPlusKnowledgeOnly: [
    ...sePrimaryTwo(),
    eu('vdknow', 'KNOWLEDGE_STATEMENT', {
      normalizedActivity: 'conocimiento de usabilidad',
      object: 'sistemas de diseno',
      startOffset: 800,
      endOffset: 860,
    }),
  ],
  primaryPlusSecondaryIt: [
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
  strongCompetitorPair: [
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
  commPlusAvContext: [
    eu('c1', 'ACTION', {
      normalizedActivity: 'comunicar comunicacion interna',
      object: 'mensaje institucional',
      startOffset: 0,
      endOffset: 40,
    }),
    eu('c2', 'ACTION', {
      normalizedActivity: 'comunicar comunicacion corporativa',
      object: 'voceria institucional',
      startOffset: 400,
      endOffset: 460,
    }),
    eu('av1', 'ACTION', {
      normalizedActivity: 'editar material audiovisual',
      object: 'material audiovisual',
      startOffset: 800,
      endOffset: 860,
    }),
  ],
};

export function mutateRemoveContextAction(
  units: ResolverEvidenceUnit[],
  evidenceId: string,
): ResolverEvidenceUnit[] {
  return units.filter((u) => u.evidenceId !== evidenceId);
}

export function mutateContextActionToKnowledge(
  units: ResolverEvidenceUnit[],
  evidenceId: string,
): ResolverEvidenceUnit[] {
  return units.map((u) =>
    u.evidenceId === evidenceId ? { ...u, evidenceKind: 'KNOWLEDGE_STATEMENT' } : u,
  );
}
