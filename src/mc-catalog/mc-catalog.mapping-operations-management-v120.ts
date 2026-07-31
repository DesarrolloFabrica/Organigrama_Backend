/**
 * Pack OPERATIONS_MANAGEMENT V1.2 — operations-management-mappings @ 1.2.0
 *
 * Corpus: Maira Alejandra Doncel Largo (1023935373 / person_id 1078).
 * Reutiliza códigos OPS_* (mc1.13). Skills de radar ChatGPT (4 por eje).
 * Sin tools en pack (módulos → próximas actualizaciones).
 * V1.1.0 (Aura) se conserva en releases históricos.
 */

import { MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_OPERATIONS_MAPPING_RULES_VERSION_V120 = '1.2.0';

export const MC_OPERATIONS_EXPECTED_DISTRIBUTION_V120: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 20,
  TRANSVERSAL_FUTURE: 0,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 0,
  CATALOG_GAP: 0,
  total: 20,
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
    rationale: 'MC1.15 OPERATIONS_MANAGEMENT curación ChatGPT (Maira)',
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
    rationale: `MC1.15 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // OPS_ACADEMIC
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'gestion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión académica',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'planificacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planificación académica',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'gestion_de_procesos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de procesos académicos',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'registro_y_control_academico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Registro y control académico',
  },
  // OPS_QUALITY
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'control_de_calidad_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Control de calidad académica',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'normativa_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Normativa educativa',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'aseguramiento_de_la_calidad',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Aseguramiento de la calidad',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'cumplimiento_institucional',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Cumplimiento institucional',
  },
  // OPS_PROCESS
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'transformacion_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Transformación digital',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'automatizacion_de_procesos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Automatización de procesos',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'gestion_de_proyectos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de proyectos',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'mejora_continua',
    skillType: 'METHODOLOGY',
    skillName: 'Mejora continua',
  },
  // OPS_ANALYTICS
  {
    specialtyCode: 'OPS_ANALYTICS',
    skillKey: 'indicadores_de_gestion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Indicadores de gestión',
  },
  {
    specialtyCode: 'OPS_ANALYTICS',
    skillKey: 'kpis',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'KPIs',
  },
  {
    specialtyCode: 'OPS_ANALYTICS',
    skillKey: 'analisis_de_datos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Análisis de datos',
  },
  {
    specialtyCode: 'OPS_ANALYTICS',
    skillKey: 'toma_de_decisiones_basada_en_datos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Toma de decisiones basada en datos',
  },
  // OPS_COORDINATION
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'liderazgo_de_equipos',
    skillType: 'SOFT_SKILL',
    skillName: 'Liderazgo de equipos',
  },
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'coordinacion_operativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Coordinación operativa',
  },
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'gestion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión estratégica',
  },
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'permanencia_estudiantil',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Permanencia estudiantil',
  },
];

export const MC_OPERATIONS_MAPPING_PACK_V120: McDomainMappingPack = {
  domainCode: MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-maira-1023935373-manual-curated-import.md',
  classifications: specialtySkills.map((s) =>
    ds(s.skillKey, s.skillType, s.skillName),
  ),
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
