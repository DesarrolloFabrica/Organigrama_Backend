/**
 * EXPERIMENTAL_RESOLVER_POLICY 0.2.0
 * Overlay de hardening. NO es catalogVersion productiva.
 * Compilado a mano desde fronteras observadas + positiveSignals del catálogo,
 * no desde outputs Gemini.
 */
export const EXPERIMENTAL_POLICY_CODE = 'MC1.EXPERIMENTAL.RESOLVER_POLICY' as const;
export const EXPERIMENTAL_POLICY_VERSION = '0.2.0' as const;

export type CompetitorPair = {
  fieldA: string;
  fieldB: string;
  sharedPractices: string[];
  differentialA: string[];
  differentialB: string[];
};

export type ExperimentalResolverPolicy = {
  policyCode: typeof EXPERIMENTAL_POLICY_CODE;
  policyVersion: string;
  productionCatalogUntouched: true;
  adjacentSpanGap: number;
  minIndependentSources: number;
  competitorFields: CompetitorPair[];
  specialtyPracticeAliases: Record<string, string[]>;
  fieldPracticeAliases: Record<string, string[]>;
};

export const EXPERIMENTAL_RESOLVER_POLICY: ExperimentalResolverPolicy = {
  policyCode: EXPERIMENTAL_POLICY_CODE,
  policyVersion: EXPERIMENTAL_POLICY_VERSION,
  productionCatalogUntouched: true,
  adjacentSpanGap: 16,
  minIndependentSources: 2,
  competitorFields: [
    {
      fieldA: 'DIGITAL_MARKETING',
      fieldB: 'COMMUNICATIONS',
      sharedPractices: [
        'redes sociales',
        'contenido digital',
        'canales digitales',
      ],
      differentialA: [
        'campanas de marketing',
        'campanas de publicidad',
        'conversion',
        'embudo',
        'adquisicion',
      ],
      differentialB: [
        'comunicacion institucional',
        'comunicacion corporativa',
        'voceria',
        'comunicacion interna',
      ],
    },
    {
      fieldA: 'VISUAL_DESIGN',
      fieldB: 'AUDIOVISUAL_PRODUCTION',
      sharedPractices: [
        'motion graphics',
        'motion',
        'animacion',
        'piezas audiovisuales',
        'contenido multimedia',
      ],
      differentialA: [
        'identidad corporativa',
        'identidad visual',
        'maquetacion',
        'mockups',
        'piezas impresas',
        'diagramacion',
        'diseno grafico',
      ],
      differentialB: [
        'rodaje',
        'captura',
        'edicion de video',
        'postproduccion',
        'fotografia',
        'produccion de video',
        'material audiovisual',
      ],
    },
    {
      fieldA: 'SOFTWARE_ENGINEERING',
      fieldB: 'VISUAL_DESIGN',
      sharedPractices: ['prototipos', 'interfaces', 'figma'],
      differentialA: [
        'desarrollo frontend',
        'desarrollo backend',
        'construir software',
        'apis',
      ],
      differentialB: [
        'diseno de interfaces',
        'sistemas de diseno',
        'usabilidad',
        'identidad visual',
      ],
    },
  ],
  specialtyPracticeAliases: {
    FRONTEND_ENGINEERING: [
      'desarrollo frontend',
      'desarrollar frontend',
      'construir interfaz',
      'implementar componentes',
      'interfaces digitales',
      'capa de presentacion',
      'aplicacion web',
    ],
    BACKEND_ENGINEERING: [
      'desarrollo backend',
      'desarrollar backend',
      'servicios de servidor',
      'apis rest',
    ],
    PLATFORM_DEVOPS_ENGINEERING: [
      'ci/cd',
      'cicd',
      'contenedorizar',
      'contenedores',
      'infra as code',
    ],
  },
  fieldPracticeAliases: {
    SOFTWARE_ENGINEERING: [
      'desarrollo frontend',
      'desarrollar frontend',
      'desarrollo backend',
      'desarrollar backend',
    ],
    VISUAL_DESIGN: [
      'identidad corporativa',
      'maquetacion',
      'mockups',
      'piezas impresas',
    ],
    AUDIOVISUAL_PRODUCTION: [
      'material audiovisual',
      'produccion audiovisual',
      'fotografia',
    ],
  },
};

export function competitorOf(
  fieldCode: string,
  policy: ExperimentalResolverPolicy = EXPERIMENTAL_RESOLVER_POLICY,
): CompetitorPair[] {
  return policy.competitorFields.filter(
    (p) => p.fieldA === fieldCode || p.fieldB === fieldCode,
  );
}

export function otherField(pair: CompetitorPair, fieldCode: string): string {
  return pair.fieldA === fieldCode ? pair.fieldB : pair.fieldA;
}

export function differentialFor(pair: CompetitorPair, fieldCode: string): string[] {
  return pair.fieldA === fieldCode ? pair.differentialA : pair.differentialB;
}
