/**
 * Pack EDUCATION_MANAGEMENT V1.1 — education-management-mappings @ 1.1.0
 *
 * Corpus: Andrés Felipe Prieto Lizarazo (1020720408 / person_id 1079).
 * Cinco especialidades EM_* (programas/currículo/calidad/docencia/liderazgo).
 * V1.0.0 (Diana / EM_ACADEMIC_PROJECTS…) se conserva en releases históricos.
 */

import { MC_EDUCATION_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_EDUCATION_MAPPING_RULES_VERSION_V110 = '1.1.0';

export const MC_EDUCATION_EXPECTED_DISTRIBUTION_V110: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 25,
  TRANSVERSAL_FUTURE: 0,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 0,
  CATALOG_GAP: 0,
  total: 25,
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
    rationale: 'MC1.14 EDUCATION_MANAGEMENT curación ChatGPT (Andrés)',
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
    rationale: `MC1.14 ${specialtyCode}`,
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
    skillKey: 'direccion_de_programas_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Dirección de programas académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'gestion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión académica',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'coordinacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Coordinación académica',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'administracion_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Administración educativa',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROGRAMS',
    skillKey: 'gestion_de_escuelas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de escuelas',
  },
  // EM_CURRICULUM_DESIGN
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'diseno_curricular',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño curricular',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'actualizacion_de_syllabus',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Actualización de syllabus',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'innovacion_curricular',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Innovación curricular',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'diseno_por_competencias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño por competencias',
  },
  {
    specialtyCode: 'EM_CURRICULUM_DESIGN',
    skillKey: 'transformacion_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Transformación educativa',
  },
  // EM_ACADEMIC_QUALITY
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'registro_calificado',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Registro calificado',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'aseguramiento_de_la_calidad',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Aseguramiento de la calidad',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'cumplimiento_normativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Cumplimiento normativo',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'procesos_de_pares_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Procesos de pares académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_QUALITY',
    skillKey: 'gestion_documental_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión documental académica',
  },
  // EM_TEACHING_INNOVATION
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'docencia_virtual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Docencia virtual',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'evaluacion_por_competencias',
    skillType: 'METHODOLOGY',
    skillName: 'Evaluación por competencias',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'tecnologia_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Tecnología educativa',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'acompanamiento_pedagogico',
    skillType: 'SOFT_SKILL',
    skillName: 'Acompañamiento pedagógico',
  },
  {
    specialtyCode: 'EM_TEACHING_INNOVATION',
    skillKey: 'aprendizaje_remoto',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Aprendizaje remoto',
  },
  // EM_ACADEMIC_LEADERSHIP
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'liderazgo_estrategico',
    skillType: 'SOFT_SKILL',
    skillName: 'Liderazgo estratégico',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'gestion_de_equipos_docentes',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de equipos docentes',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'seguimiento_docente',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento docente',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'atencion_integral_al_estudiante',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Atención integral al estudiante',
  },
  {
    specialtyCode: 'EM_ACADEMIC_LEADERSHIP',
    skillKey: 'planeacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planeación académica',
  },
];

export const MC_EDUCATION_MAPPING_PACK_V110: McDomainMappingPack = {
  domainCode: MC_EDUCATION_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-andres-1020720408-manual-curated-import.md',
  classifications: specialtySkills.map((s) =>
    ds(s.skillKey, s.skillType, s.skillName),
  ),
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
