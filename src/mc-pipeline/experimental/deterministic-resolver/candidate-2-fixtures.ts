/**
 * Fixtures determinísticas SE↔DA para Candidate.2.
 * No usan packs reales ni Gemini.
 */
import { eu } from '../../shadow-resolver/gate-fixtures';
import type { ResolverEvidenceUnit } from './types';

/** Caso A — software con SQL/persistencia. No debe skip DA. */
export const SE_DA_CASE_A_SOFTWARE_SQL: ResolverEvidenceUnit[] = [
  eu('a1', 'ACTION', {
    normalizedActivity: 'desarrollo backend',
    object: 'aplicacion',
    result: 'servicios de servidor',
    startOffset: 0,
    endOffset: 40,
  }),
  eu('a2', 'ACTION', {
    normalizedActivity: 'implementar persistencia y consultas sql',
    object: 'bases de datos',
    toolOrMethod: 'PostgreSQL',
    startOffset: 400,
    endOffset: 460,
  }),
];

/** Caso B — práctica analítica real. DA eligible si fuentes + diferencial. */
export const SE_DA_CASE_B_ANALYTICS: ResolverEvidenceUnit[] = [
  eu('b1', 'ACTION', {
    normalizedActivity: 'analizar datos',
    object: 'informacion institucional',
    result: 'reporting para decision',
    startOffset: 0,
    endOffset: 40,
  }),
  eu('b2', 'ACTION', {
    normalizedActivity: 'construir dashboards ejecutivos y ciencia de datos',
    object: 'modelos predictivos',
    startOffset: 400,
    endOffset: 460,
  }),
];

/** Caso C — software fuerte + analítica fuerte. AMBIGUOUS salvo dominancia. */
export const SE_DA_CASE_C_MIXED: ResolverEvidenceUnit[] = [
  eu('c1', 'ACTION', {
    normalizedActivity: 'desarrollo frontend',
    object: 'interfaces',
    startOffset: 0,
    endOffset: 40,
  }),
  eu('c2', 'ACTION', {
    normalizedActivity: 'desarrollo backend',
    object: 'apis',
    startOffset: 400,
    endOffset: 460,
  }),
  eu('c3', 'ACTION', {
    normalizedActivity: 'analizar datos',
    object: 'indicadores',
    result: 'reporting',
    startOffset: 800,
    endOffset: 860,
  }),
  eu('c4', 'ACTION', {
    normalizedActivity: 'construir dashboards ejecutivos',
    object: 'ciencia de datos',
    startOffset: 1200,
    endOffset: 1260,
  }),
];

/** Caso D — tool only. No Field forzado. */
export const SE_DA_CASE_D_TOOL_ONLY: ResolverEvidenceUnit[] = [
  eu('d1', 'TOOL_USAGE', {
    toolOrMethod: 'SQL',
    startOffset: 0,
    endOffset: 20,
  }),
  eu('d2', 'TOOL_USAGE', {
    toolOrMethod: 'Python',
    startOffset: 80,
    endOffset: 100,
  }),
  eu('d3', 'TOOL_USAGE', {
    toolOrMethod: 'GCP',
    startOffset: 200,
    endOffset: 220,
  }),
];

/**
 * Caso E — data engineering dentro de identidad analítica
 * (ETL/pipelines al servicio de análisis, no persistencia de aplicación).
 */
export const SE_DA_CASE_E_DATA_ENGINEERING: ResolverEvidenceUnit[] = [
  eu('e1', 'ACTION', {
    normalizedActivity: 'automatizar pipelines de datos y ETL',
    object: 'repositorio analitico',
    result: 'disponibilidad para analisis',
    startOffset: 0,
    endOffset: 40,
  }),
  eu('e2', 'ACTION', {
    normalizedActivity: 'analizar datos',
    object: 'fuentes institucionales',
    result: 'reporting y modelos predictivos',
    startOffset: 400,
    endOffset: 460,
  }),
];

/** Fixture estructural derivado de S9 (no hardcode de persona). */
export const S9_STRUCTURAL_FIXTURE: ResolverEvidenceUnit[] = [
  eu('s9-se', 'ACTION', {
    normalizedActivity: 'Desarrollo de aplicaciones web',
    object: 'aplicaciones web',
    toolOrMethod: 'React, NestJS, TypeScript, PostgreSQL',
    startOffset: 0,
    endOffset: 50,
  }),
  eu('s9-models', 'ACTION', {
    normalizedActivity: 'Integración de modelos e IA y despliegue de microservicios',
    object: 'microservicios',
    startOffset: 200,
    endOffset: 260,
  }),
  eu('s9-ops', 'RESPONSIBILITY', {
    normalizedActivity: 'Análisis, validación y gestión de datos operativos',
    object: 'datos operativos',
    startOffset: 400,
    endOffset: 460,
  }),
];

export function s9WithDaDifferential(): ResolverEvidenceUnit[] {
  return [
    ...S9_STRUCTURAL_FIXTURE,
    eu('s9-da-diff', 'ACTION', {
      normalizedActivity: 'liderar ciencia de datos y dashboards ejecutivos',
      object: 'analitica',
      result: 'modelos predictivos',
      startOffset: 800,
      endOffset: 860,
    }),
  ];
}

export function s9WithoutSeDifferential(): ResolverEvidenceUnit[] {
  return S9_STRUCTURAL_FIXTURE.map((u) =>
    u.evidenceId === 's9-se'
      ? {
          ...u,
          normalizedActivity: 'utilizar tecnologias',
          object: 'stack',
          toolOrMethod: 'React, NestJS, TypeScript, PostgreSQL',
        }
      : u,
  );
}

export function s9WithStrongSeCompetitor(): ResolverEvidenceUnit[] {
  return [
    ...S9_STRUCTURAL_FIXTURE,
    eu('s9-se-2', 'ACTION', {
      normalizedActivity: 'desarrollo frontend',
      object: 'capa de presentacion',
      startOffset: 800,
      endOffset: 860,
    }),
    eu('s9-se-3', 'ACTION', {
      normalizedActivity: 'desarrollo backend',
      object: 'apis',
      startOffset: 1200,
      endOffset: 1260,
    }),
  ];
}

export function s9DifferentialAsToolOnly(): ResolverEvidenceUnit[] {
  return S9_STRUCTURAL_FIXTURE.map((u) => ({
    ...u,
    evidenceKind: 'TOOL_USAGE',
    normalizedActivity: null,
    object: null,
    result: null,
    toolOrMethod: u.toolOrMethod || 'SQL',
  }));
}
