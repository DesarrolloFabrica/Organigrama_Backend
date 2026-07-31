/**
 * Pack EDUCATION_MANAGEMENT V1.3 — education-management-mappings @ 1.3.0
 *
 * Corpus: Alex Roviro Navia Díaz (1030665518 / person_id 1202).
 * Reutiliza especialidades EM_* (Andrés). Skills de radar ChatGPT.
 * V1.2.0 (José) y anteriores se conservan en releases históricos.
 */

import { MC_EDUCATION_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_EDUCATION_MAPPING_RULES_VERSION_V130 = '1.3.0';

export const MC_EDUCATION_EXPECTED_DISTRIBUTION_V130: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 21,
  TRANSVERSAL_FUTURE: 0,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 0,
  CATALOG_GAP: 0,
  total: 21,
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
    rationale: 'MC1.17 EDUCATION_MANAGEMENT curación ChatGPT (Alex)',
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
    rationale: `MC1.17 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // EM_ACADEMIC_PROGRAMS
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'gestion_saber_pro',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión Saber Pro',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'razonamiento_cuantitativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Razonamiento cuantitativo',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'bancos_de_preguntas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Bancos de preguntas',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'planeacion_de_pruebas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planeación de pruebas',
  },
  // EM_CURRICULUM_DESIGN
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'diseno_de_evaluaciones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de evaluaciones',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'estrategias_pedagogicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategias pedagógicas',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'diseno_de_actividades_de_aprendizaje',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de actividades de aprendizaje',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'planes_de_estudio',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planes de estudio',
  },
  // EM_ACADEMIC_QUALITY
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'indicadores_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Indicadores académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'informes_institucionales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Informes institucionales',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'valor_agregado_icfes',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Valor agregado ICFES',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'seguimiento_academico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento académico',
  },
  // EM_TEACHING_INNOVATION
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'analitica_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Analítica educativa',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'power_bi',
    skillType: 'TOOL',
    skillName: 'Power BI',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'python',
    skillType: 'TECHNOLOGY',
    skillName: 'Python',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'rstudio',
    skillType: 'TOOL',
    skillName: 'RStudio',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'automatizacion_con_ia',
    skillType: 'TECHNOLOGY',
    skillName: 'Automatización con IA',
  },
  // EM_ACADEMIC_LEADERSHIP
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'liderazgo_tecnico',
    skillType: 'SOFT_SKILL',
    skillName: 'Liderazgo técnico',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'resolucion_de_problemas',
    skillType: 'SOFT_SKILL',
    skillName: 'Resolución de problemas',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'toma_de_decisiones_basada_en_datos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Toma de decisiones basada en datos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'visualizacion_de_informacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Visualización de información',
  },
];

export const MC_EDUCATION_MAPPING_PACK_V130: McDomainMappingPack = {
  domainCode: MC_EDUCATION_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-alex-1030665518-manual-curated-import.md',
  classifications: specialtySkills.map((s) =>
    ds(s.skillKey, s.skillType, s.skillName),
  ),
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
