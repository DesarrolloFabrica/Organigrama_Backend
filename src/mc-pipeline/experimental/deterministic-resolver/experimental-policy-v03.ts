/**
 * EXPERIMENTAL_RESOLVER_POLICY 0.3.0 — Candidate.2
 * Overlay de frontera SE↔DA. NO es catalogVersion productiva.
 * Candidate.1 / policy 0.2.0 permanece congelado en experimental-policy.ts.
 *
 * Cambio vs 0.2.0:
 * - par competidor SOFTWARE_ENGINEERING ↔ DATA_ANALYTICS
 * - shared practices de datos-dentro-de-software (no originan skip solos)
 * - diferenciales SE de construcción de software
 * - diferenciales DA de práctica analítica (no tools, no "análisis … datos" genérico)
 * - aliases de Field SE para "desarrollo de aplicaciones / aplicaciones web"
 */
import {
  EXPERIMENTAL_POLICY_CODE,
  EXPERIMENTAL_RESOLVER_POLICY,
  type ExperimentalResolverPolicy,
} from './experimental-policy';

export const EXPERIMENTAL_POLICY_VERSION_V03 = '0.3.0' as const;
export const SKIP_CANDIDATE_2_CODE = 'MC1.DETERMINISTIC.RESOLVER.CANDIDATE.2' as const;

const SE_DA_PAIR = {
  fieldA: 'SOFTWARE_ENGINEERING',
  fieldB: 'DATA_ANALYTICS',
  sharedPractices: [
    'datos operativos',
    'integracion de modelos',
    'integracion modelos',
    'despliegue de modelos',
    'despliegue modelos',
    'microservicios',
    'bases de datos',
    'persistencia',
    'consultas sql',
    'etl',
    'pipelines de datos',
  ],
  differentialA: [
    'desarrollo de aplicaciones',
    'desarrollar aplicaciones',
    'aplicaciones web',
    'desarrollo frontend',
    'desarrollo backend',
    'construir software',
    'apis',
    'servicios de servidor',
  ],
  differentialB: [
    'ciencia de datos',
    'analitica',
    'business intelligence',
    'inteligencia de negocio',
    'dashboards ejecutivos',
    'tableros dinamicos',
    'gobierno de datos',
    'modelos predictivos',
    'analitica predictiva',
    'integridad',
    'trazabilidad',
    'calidad de datos',
    'reporting',
    'analizar datos',
    'mineria de datos',
  ],
};

export const EXPERIMENTAL_RESOLVER_POLICY_V03: ExperimentalResolverPolicy = {
  policyCode: EXPERIMENTAL_POLICY_CODE,
  policyVersion: EXPERIMENTAL_POLICY_VERSION_V03,
  productionCatalogUntouched: true,
  adjacentSpanGap: EXPERIMENTAL_RESOLVER_POLICY.adjacentSpanGap,
  minIndependentSources: EXPERIMENTAL_RESOLVER_POLICY.minIndependentSources,
  competitorFields: [...EXPERIMENTAL_RESOLVER_POLICY.competitorFields, SE_DA_PAIR],
  specialtyPracticeAliases: EXPERIMENTAL_RESOLVER_POLICY.specialtyPracticeAliases,
  fieldPracticeAliases: {
    ...EXPERIMENTAL_RESOLVER_POLICY.fieldPracticeAliases,
    SOFTWARE_ENGINEERING: [
      ...EXPERIMENTAL_RESOLVER_POLICY.fieldPracticeAliases.SOFTWARE_ENGINEERING,
      'desarrollo de aplicaciones',
      'desarrollar aplicaciones',
      'aplicaciones web',
      'construir software',
      'servicios de servidor',
    ],
  },
};

export const POLICY_V03_DIFF = {
  from: '0.2.0',
  to: '0.3.0',
  productionCatalogChanged: false,
  addedCompetitorPairs: [SE_DA_PAIR],
  addedFieldPracticeAliases: {
    SOFTWARE_ENGINEERING: [
      'desarrollo de aplicaciones',
      'desarrollar aplicaciones',
      'aplicaciones web',
      'construir software',
      'servicios de servidor',
    ],
  },
  unchanged: [
    'minIndependentSources',
    'adjacentSpanGap',
    'specialtyPracticeAliases',
    'DIGITAL_MARKETING↔COMMUNICATIONS',
    'VISUAL_DESIGN↔AUDIOVISUAL_PRODUCTION',
    'SOFTWARE_ENGINEERING↔VISUAL_DESIGN',
  ],
};
