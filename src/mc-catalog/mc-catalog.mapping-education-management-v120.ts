/**
 * Pack EDUCATION_MANAGEMENT V1.2 — education-management-mappings @ 1.2.0
 *
 * Corpus: José Orlando Oyola Chaves (79709251 / person_id 1200).
 * Cinco especialidades EM_* (diseño pedagógico / evaluación / docencia /
 * inclusión / gestión académica).
 * V1.1.0 (Andrés) y V1.0.0 (Diana) se conservan en releases históricos.
 */

import { MC_EDUCATION_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_EDUCATION_MAPPING_RULES_VERSION_V120 = '1.2.0';

export const MC_EDUCATION_EXPECTED_DISTRIBUTION_V120: Record<
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
    rationale: 'MC1.16 EDUCATION_MANAGEMENT curación ChatGPT (José)',
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
    rationale: `MC1.16 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // EM_PEDAGOGICAL_DESIGN
  {
    specialtyCode: 'EM_PEDAGOGICAL_DESIGN',
    skillKey: 'diseno_de_estrategias_pedagogicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de estrategias pedagógicas',
  },
  {
    specialtyCode: 'EM_PEDAGOGICAL_DESIGN',
    skillKey: 'diseno_de_material_educativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de material educativo',
  },
  {
    specialtyCode: 'EM_PEDAGOGICAL_DESIGN',
    skillKey: 'diseno_de_guias_de_estudio',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de guías de estudio',
  },
  {
    specialtyCode: 'EM_PEDAGOGICAL_DESIGN',
    skillKey: 'diseno_de_simulacros',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de simulacros',
  },
  // EM_ACADEMIC_EVALUATION
  {
    specialtyCode: 'EM_ACADEMIC_EVALUATION',
    skillKey: 'competencias_ciudadanas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Competencias ciudadanas',
  },
  {
    specialtyCode: 'EM_ACADEMIC_EVALUATION',
    skillKey: 'pruebas_saber_pro',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Pruebas Saber Pro',
  },
  {
    specialtyCode: 'EM_ACADEMIC_EVALUATION',
    skillKey: 'evaluacion_de_competencias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Evaluación de competencias',
  },
  {
    specialtyCode: 'EM_ACADEMIC_EVALUATION',
    skillKey: 'planes_de_fortalecimiento_academico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planes de fortalecimiento académico',
  },
  // EM_UNIVERSITY_TEACHING
  {
    specialtyCode: 'EM_UNIVERSITY_TEACHING',
    skillKey: 'docencia_universitaria',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Docencia universitaria',
  },
  {
    specialtyCode: 'EM_UNIVERSITY_TEACHING',
    skillKey: 'formacion_etica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Formación ética',
  },
  {
    specialtyCode: 'EM_UNIVERSITY_TEACHING',
    skillKey: 'formacion_ciudadana',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Formación ciudadana',
  },
  {
    specialtyCode: 'EM_UNIVERSITY_TEACHING',
    skillKey: 'orientacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Orientación académica',
  },
  // EM_EDUCATIONAL_INCLUSION
  {
    specialtyCode: 'EM_EDUCATIONAL_INCLUSION',
    skillKey: 'inclusion_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Inclusión educativa',
  },
  {
    specialtyCode: 'EM_EDUCATIONAL_INCLUSION',
    skillKey: 'interculturalidad',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Interculturalidad',
  },
  {
    specialtyCode: 'EM_EDUCATIONAL_INCLUSION',
    skillKey: 'resolucion_de_conflictos',
    skillType: 'SOFT_SKILL',
    skillName: 'Resolución de conflictos',
  },
  {
    specialtyCode: 'EM_EDUCATIONAL_INCLUSION',
    skillKey: 'pensamiento_critico',
    skillType: 'SOFT_SKILL',
    skillName: 'Pensamiento crítico',
  },
  // EM_ACADEMIC_MANAGEMENT
  {
    specialtyCode: 'EM_ACADEMIC_MANAGEMENT',
    skillKey: 'gestion_operativa_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión operativa educativa',
  },
  {
    specialtyCode: 'EM_ACADEMIC_MANAGEMENT',
    skillKey: 'gestion_de_informacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de información académica',
  },
  {
    specialtyCode: 'EM_ACADEMIC_MANAGEMENT',
    skillKey: 'coordinacion_de_procesos_educativos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Coordinación de procesos educativos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_MANAGEMENT',
    skillKey: 'gestion_institucional',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión institucional',
  },
];

export const MC_EDUCATION_MAPPING_PACK_V120: McDomainMappingPack = {
  domainCode: MC_EDUCATION_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-jose-79709251-manual-curated-import.md',
  classifications: specialtySkills.map((s) =>
    ds(s.skillKey, s.skillType, s.skillName),
  ),
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
