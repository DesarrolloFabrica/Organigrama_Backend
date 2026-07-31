/**
 * Pack TALENT_MANAGEMENT V1 — talent-management-mappings @ 1.0.0
 *
 * Corpus: Leidy Viviana Bernal León (1070007550 / person_id 1077).
 * Estructura semántica ChatGPT (sin scaffolds). Tools fuera de ejes.
 */

import { MC_TALENT_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_TALENT_MAPPING_RULES_VERSION_V100 = '1.0.0';

export const MC_TALENT_EXPECTED_DISTRIBUTION_V100: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 22,
  TRANSVERSAL_FUTURE: 0,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 4,
  CATALOG_GAP: 0,
  total: 26,
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
    rationale: 'MC1.10 TALENT_MANAGEMENT curación ChatGPT',
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
    rationale: `MC1.10 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // TM_TALENT
  {
    specialtyCode: 'TM_TALENT',
    skillKey: 'seleccion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Selección estratégica',
  },
  {
    specialtyCode: 'TM_TALENT',
    skillKey: 'contratacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Contratación',
  },
  {
    specialtyCode: 'TM_TALENT',
    skillKey: 'onboarding',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Onboarding',
  },
  {
    specialtyCode: 'TM_TALENT',
    skillKey: 'evaluacion_del_desempeno',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Evaluación del desempeño',
  },
  {
    specialtyCode: 'TM_TALENT',
    skillKey: 'gestion_por_competencias',
    skillType: 'METHODOLOGY',
    skillName: 'Gestión por competencias',
  },
  // TM_ORGANIZATIONAL_DEVELOPMENT
  {
    specialtyCode: 'TM_ORGANIZATIONAL_DEVELOPMENT',
    skillKey: 'desarrollo_organizacional',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Desarrollo organizacional',
  },
  {
    specialtyCode: 'TM_ORGANIZATIONAL_DEVELOPMENT',
    skillKey: 'planeacion_estrategica_del_talento',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planeación estratégica del talento',
  },
  {
    specialtyCode: 'TM_ORGANIZATIONAL_DEVELOPMENT',
    skillKey: 'holocracia',
    skillType: 'METHODOLOGY',
    skillName: 'Holocracia',
  },
  // TM_QUALITY_COMPLIANCE
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'sistema_de_gestion_de_calidad',
    skillType: 'METHODOLOGY',
    skillName: 'Sistema de Gestión de Calidad',
  },
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'iso_9001',
    skillType: 'METHODOLOGY',
    skillName: 'ISO 9001',
  },
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'sg-sst',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'SG-SST',
  },
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'auditoria_hseq',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Auditoría HSEQ',
  },
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'gestion_de_riesgos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de riesgos',
  },
  {
    specialtyCode: 'TM_QUALITY_COMPLIANCE',
    skillKey: 'cumplimiento_normativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Cumplimiento normativo',
  },
  // TM_PEOPLE_ANALYTICS
  {
    specialtyCode: 'TM_PEOPLE_ANALYTICS',
    skillKey: 'analitica_de_talento_humano',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Analítica de talento humano',
  },
  {
    specialtyCode: 'TM_PEOPLE_ANALYTICS',
    skillKey: 'indicadores_de_gestion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Indicadores de gestión',
  },
  {
    specialtyCode: 'TM_PEOPLE_ANALYTICS',
    skillKey: 'visualizacion_de_datos_para_talento_humano',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Visualización de datos para talento humano',
  },
  // TM_STRATEGIC_LEADERSHIP
  {
    specialtyCode: 'TM_STRATEGIC_LEADERSHIP',
    skillKey: 'liderazgo_operativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Liderazgo operativo',
  },
  {
    specialtyCode: 'TM_STRATEGIC_LEADERSHIP',
    skillKey: 'direccion_administrativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Dirección administrativa',
  },
  {
    specialtyCode: 'TM_STRATEGIC_LEADERSHIP',
    skillKey: 'optimizacion_organizacional',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Optimización organizacional',
  },
  {
    specialtyCode: 'TM_STRATEGIC_LEADERSHIP',
    skillKey: 'acompanamiento_a_alta_direccion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Acompañamiento a alta dirección',
  },
  {
    specialtyCode: 'TM_STRATEGIC_LEADERSHIP',
    skillKey: 'gestion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión estratégica',
  },
];

export const MC_TALENT_MAPPING_PACK_V100: McDomainMappingPack = {
  domainCode: MC_TALENT_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-leidy-1070007550-manual-curated-import.md',
  classifications: [
    ...specialtySkills.map((s) => ds(s.skillKey, s.skillType, s.skillName)),
    {
      skillKey: 'dashboards_analiticos',
      skillType: 'TOOL',
      skillName: 'Dashboards analíticos',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar TM.',
    },
    {
      skillKey: 'hr_tech',
      skillType: 'TOOL',
      skillName: 'HR Tech',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta / Sistemas HR Tech; fuera del radar.',
    },
    {
      skillKey: 'inteligencia_artificial_aplicada_a_rrhh',
      skillType: 'TECHNOLOGY',
      skillName: 'Inteligencia Artificial aplicada a RRHH',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tecnología/herramienta; fuera del radar.',
    },
    {
      skillKey: 'herramientas_ofimaticas',
      skillType: 'TOOL',
      skillName: 'Herramientas Ofimáticas',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Ofimática; fuera del radar.',
    },
  ],
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
