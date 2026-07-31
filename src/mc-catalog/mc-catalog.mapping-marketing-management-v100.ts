/**
 * Pack MARKETING_MANAGEMENT V1 — marketing-management-mappings @ 1.0.0
 *
 * Corpus: Carlos Andrés Rodríguez Sanabria (1010174410 / person_id 1080).
 * Estructura semántica ChatGPT (sin scaffolds). Tools fuera de ejes.
 */

import { MC_MARKETING_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_MARKETING_MAPPING_RULES_VERSION_V100 = '1.0.0';

export const MC_MARKETING_EXPECTED_DISTRIBUTION_V100: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 25,
  TRANSVERSAL_FUTURE: 9,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 4,
  CATALOG_GAP: 0,
  total: 38,
};

type ClassRow = McDomainMappingPack['classifications'][number];
type MapRow = McDomainMappingPack['mappings'][number];

function ds(
  skillKey: string,
  skillType: ClassRow['skillType'],
  skillName: string,
): ClassRow {
  return {
    skillKey,
    skillType,
    skillName,
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.12 MARKETING_MANAGEMENT curación ChatGPT',
  };
}

function primary(
  skillKey: string,
  skillType: MapRow['skillType'],
  skillName: string,
  specialtyCode: string,
): MapRow {
  return {
    skillKey,
    skillType,
    skillName,
    specialtyCode,
    weight: 1,
    mappingType: 'PRIMARY',
    rationale: `MC1.12 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // MM_MARKETING_STRATEGY
  {
    specialtyCode: 'MM_MARKETING_STRATEGY',
    skillKey: 'planeacion_estrategica_de_marketing',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planeación estratégica de marketing',
  },
  {
    specialtyCode: 'MM_MARKETING_STRATEGY',
    skillKey: 'direccion_de_marketing',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Dirección de marketing',
  },
  {
    specialtyCode: 'MM_MARKETING_STRATEGY',
    skillKey: 'estrategia_de_mercado',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategia de mercado',
  },
  {
    specialtyCode: 'MM_MARKETING_STRATEGY',
    skillKey: 'posicionamiento',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Posicionamiento',
  },
  {
    specialtyCode: 'MM_MARKETING_STRATEGY',
    skillKey: 'orientacion_a_resultados',
    skillType: 'SOFT_SKILL',
    skillName: 'Orientación a resultados',
  },
  // MM_DIGITAL_OMNICHANNEL
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'marketing_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Marketing digital',
  },
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'marketing_omnicanal',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Marketing omnicanal',
  },
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'gestion_de_campanas_digitales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de campañas digitales',
  },
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'seo',
    skillType: 'METHODOLOGY',
    skillName: 'SEO',
  },
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'sem',
    skillType: 'METHODOLOGY',
    skillName: 'SEM',
  },
  {
    specialtyCode: 'MM_DIGITAL_OMNICHANNEL',
    skillKey: 'publicidad_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Publicidad digital',
  },
  // MM_GROWTH_AUDIENCE
  {
    specialtyCode: 'MM_GROWTH_AUDIENCE',
    skillKey: 'crecimiento_de_trafico_web',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Crecimiento de tráfico web',
  },
  {
    specialtyCode: 'MM_GROWTH_AUDIENCE',
    skillKey: 'gestion_de_audiencias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de audiencias',
  },
  {
    specialtyCode: 'MM_GROWTH_AUDIENCE',
    skillKey: 'incremento_de_suscripciones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Incremento de suscripciones',
  },
  {
    specialtyCode: 'MM_GROWTH_AUDIENCE',
    skillKey: 'conversion_en_canales_digitales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Conversión en canales digitales',
  },
  {
    specialtyCode: 'MM_GROWTH_AUDIENCE',
    skillKey: 'experiencia_del_usuario',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Experiencia del usuario',
  },
  // MM_MARKETING_ANALYTICS
  {
    specialtyCode: 'MM_MARKETING_ANALYTICS',
    skillKey: 'analitica_de_datos_de_marketing',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Analítica de datos de marketing',
  },
  {
    specialtyCode: 'MM_MARKETING_ANALYTICS',
    skillKey: 'seguimiento_de_resultados_de_campanas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento de resultados de campañas',
  },
  {
    specialtyCode: 'MM_MARKETING_ANALYTICS',
    skillKey: 'medicion_de_audiencias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Medición de audiencias',
  },
  {
    specialtyCode: 'MM_MARKETING_ANALYTICS',
    skillKey: 'analisis_de_canales_digitales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Análisis de canales digitales',
  },
  // MM_INNOVATION_EXPERIENCE
  {
    specialtyCode: 'MM_INNOVATION_EXPERIENCE',
    skillKey: 'diseno_de_experiencias_inmersivas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de experiencias inmersivas',
  },
  {
    specialtyCode: 'MM_INNOVATION_EXPERIENCE',
    skillKey: 'innovacion_aplicada_a_experiencias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Innovación aplicada a experiencias',
  },
  {
    specialtyCode: 'MM_INNOVATION_EXPERIENCE',
    skillKey: 'educacion_entretenida',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Educación entretenida',
  },
  {
    specialtyCode: 'MM_INNOVATION_EXPERIENCE',
    skillKey: 'integracion_de_creatividad_y_estrategia',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Integración de creatividad y estrategia',
  },
  {
    specialtyCode: 'MM_INNOVATION_EXPERIENCE',
    skillKey: 'diseno_de_experiencias_de_usuario',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de experiencias de usuario',
  },
];

export const MC_MARKETING_MAPPING_PACK_V100: McDomainMappingPack = {
  domainCode: MC_MARKETING_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-carlos-1010174410-manual-curated-import.md',
  classifications: [
    ...specialtySkills.map((s) => ds(s.skillKey, s.skillType, s.skillName)),
    // Complementarias (fuera del radar)
    {
      skillKey: 'liderazgo_estrategico_de_equipos',
      skillType: 'SOFT_SKILL',
      skillName: 'Liderazgo estratégico de equipos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Complementaria; no eje MARKETING.',
    },
    {
      skillKey: 'comunicacion_asertiva',
      skillType: 'SOFT_SKILL',
      skillName: 'Comunicación asertiva',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Complementaria; no eje MARKETING.',
    },
    {
      skillKey: 'negociacion',
      skillType: 'SOFT_SKILL',
      skillName: 'Negociación',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Complementaria; no eje MARKETING.',
    },
    {
      skillKey: 'pensamiento_critico',
      skillType: 'SOFT_SKILL',
      skillName: 'Pensamiento crítico',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Complementaria; no eje MARKETING.',
    },
    {
      skillKey: 'adaptabilidad',
      skillType: 'SOFT_SKILL',
      skillName: 'Adaptabilidad',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Complementaria; no eje MARKETING.',
    },
    // Trayectoria académica complementaria (no otro dominio)
    {
      skillKey: 'direccion_de_programas_academicos',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Dirección de programas académicos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Trayectoria complementaria; no dominio adicional en esta ejecución.',
    },
    {
      skillKey: 'gestion_por_ciclos_propedeuticos',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Gestión por ciclos propedéuticos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Trayectoria complementaria; no dominio adicional.',
    },
    {
      skillKey: 'innovacion_educativa',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Innovación educativa',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Trayectoria complementaria; no dominio adicional.',
    },
    {
      skillKey: 'procesos_pedagogicos',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Procesos pedagógicos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Trayectoria complementaria; no dominio adicional.',
    },
    // Tools OUTSIDE
    {
      skillKey: 'google_ads',
      skillType: 'TOOL',
      skillName: 'Google Ads',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'meta_ads',
      skillType: 'TOOL',
      skillName: 'Meta Ads',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'plataformas_lms',
      skillType: 'TOOL',
      skillName: 'Plataformas LMS',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'herramientas_de_inteligencia_artificial_aplicadas_a_marketing',
      skillType: 'TECHNOLOGY',
      skillName: 'Herramientas de inteligencia artificial aplicadas a marketing',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tecnología/herramienta; fuera del radar.',
    },
  ],
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
