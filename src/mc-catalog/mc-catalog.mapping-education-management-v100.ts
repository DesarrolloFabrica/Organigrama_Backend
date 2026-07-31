/**
 * Pack EDUCATION_MANAGEMENT V1 — education-management-mappings @ 1.0.0
 *
 * Corpus: Diana Paola Gómez González (50935341 / person_id 1192).
 * Estructura semántica ChatGPT (sin scaffolds). Tools fuera de ejes.
 */

import { MC_EDUCATION_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_EDUCATION_MAPPING_RULES_VERSION_V100 = '1.0.0';

export const MC_EDUCATION_EXPECTED_DISTRIBUTION_V100: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 28,
  TRANSVERSAL_FUTURE: 8,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 5,
  CATALOG_GAP: 0,
  total: 41,
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
    rationale: 'MC1.11 EDUCATION_MANAGEMENT curación ChatGPT',
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
    rationale: `MC1.11 ${specialtyCode}`,
  };
}

const specialtySkills: Array<{
  specialtyCode: string;
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
}> = [
  // EM_ACADEMIC_PROJECTS
  {
    specialtyCode: 'EM_ACADEMIC_PROJECTS',
    skillKey: 'planificacion_de_proyectos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planificación de proyectos académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROJECTS',
    skillKey: 'gestion_de_saber_pro_y_saber_tyt',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de Saber Pro y Saber TyT',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROJECTS',
    skillKey: 'diseno_de_cronogramas_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de cronogramas académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROJECTS',
    skillKey: 'seguimiento_de_hitos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento de hitos académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_PROJECTS',
    skillKey: 'coordinacion_de_equipos_multidisciplinarios',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Coordinación de equipos multidisciplinarios',
  },
  // EM_CURRICULUM_PEDAGOGY
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'diseno_curricular',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño curricular',
  },
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'ajuste_de_syllabus',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Ajuste de syllabus',
  },
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'diseno_de_estrategias_pedagogicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de estrategias pedagógicas',
  },
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'aprendizaje_activo',
    skillType: 'METHODOLOGY',
    skillName: 'Aprendizaje activo',
  },
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'diseno_de_cursos_de_razonamiento_cuantitativo',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de cursos de razonamiento cuantitativo',
  },
  {
    specialtyCode: 'EM_CURRICULUM_PEDAGOGY',
    skillKey: 'investigacion_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Investigación educativa',
  },
  // EM_FACULTY_QUALITY
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'seleccion_docente',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Selección docente',
  },
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'asignacion_de_carga_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Asignación de carga académica',
  },
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'seguimiento_al_cumplimiento_docente',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento al cumplimiento docente',
  },
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'coevaluacion_docente',
    skillType: 'METHODOLOGY',
    skillName: 'Coevaluación docente',
  },
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'control_de_planes_de_estudio',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Control de planes de estudio',
  },
  {
    specialtyCode: 'EM_FACULTY_QUALITY',
    skillKey: 'gestion_de_tutorias_y_monitorias',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de tutorías y monitorias',
  },
  // EM_ACADEMIC_ANALYTICS
  {
    specialtyCode: 'EM_ACADEMIC_ANALYTICS',
    skillKey: 'analisis_estadistico_de_resultados_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Análisis estadístico de resultados académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_ANALYTICS',
    skillKey: 'analisis_de_datos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Análisis de datos académicos',
  },
  {
    specialtyCode: 'EM_ACADEMIC_ANALYTICS',
    skillKey: 'diseno_de_planes_de_refuerzo_academico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de planes de refuerzo académico',
  },
  {
    specialtyCode: 'EM_ACADEMIC_ANALYTICS',
    skillKey: 'evaluacion_de_competencias_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Evaluación de competencias académicas',
  },
  {
    specialtyCode: 'EM_ACADEMIC_ANALYTICS',
    skillKey: 'seguimiento_de_evaluaciones_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento de evaluaciones académicas',
  },
  // EM_DIGITAL_EDUCATION
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'diseno_de_cursos_virtuales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de cursos virtuales',
  },
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'gestion_de_aulas_virtuales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de aulas virtuales',
  },
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'desarrollo_de_recursos_educativos_digitales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Desarrollo de recursos educativos digitales',
  },
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'diseno_de_ovas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de OVAS',
  },
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'innovacion_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Innovación educativa',
  },
  {
    specialtyCode: 'EM_DIGITAL_EDUCATION',
    skillKey: 'gestion_de_inscripciones_en_plataformas_educativas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de inscripciones en plataformas educativas',
  },
];

const transversalSoft: Array<{
  skillKey: string;
  skillName: string;
}> = [
  { skillKey: 'liderazgo_de_equipos', skillName: 'Liderazgo de equipos' },
  { skillKey: 'comunicacion_asertiva', skillName: 'Comunicación asertiva' },
  { skillKey: 'trabajo_en_equipo', skillName: 'Trabajo en equipo' },
  { skillKey: 'pensamiento_critico', skillName: 'Pensamiento crítico' },
  { skillKey: 'gestion_del_tiempo', skillName: 'Gestión del tiempo' },
  { skillKey: 'orientacion_a_resultados', skillName: 'Orientación a resultados' },
  { skillKey: 'pensamiento_estrategico', skillName: 'Pensamiento estratégico' },
  { skillKey: 'adaptabilidad', skillName: 'Adaptabilidad' },
];

export const MC_EDUCATION_MAPPING_PACK_V100: McDomainMappingPack = {
  domainCode: MC_EDUCATION_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-diana-50935341-manual-curated-import.md',
  classifications: [
    ...specialtySkills.map((s) => ds(s.skillKey, s.skillType, s.skillName)),
    ...transversalSoft.map((s) => ({
      skillKey: s.skillKey,
      skillType: 'SOFT_SKILL' as const,
      skillName: s.skillName,
      classification: 'TRANSVERSAL_FUTURE' as const,
      rationale: 'Complementaria; no eje del radar EDUCATION_MANAGEMENT.',
    })),
    {
      skillKey: 'moodle',
      skillType: 'TOOL',
      skillName: 'Moodle',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta LMS; fuera del radar.',
    },
    {
      skillKey: 'sistema_sinu',
      skillType: 'TOOL',
      skillName: 'Sistema SINU',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'aulas_virtuales_lms',
      skillType: 'TOOL',
      skillName: 'Aulas virtuales LMS',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta LMS genérica; fuera del radar.',
    },
    {
      skillKey: 'google_workspace',
      skillType: 'TOOL',
      skillName: 'Google Workspace',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'excel_avanzado',
      skillType: 'TOOL',
      skillName: 'Excel avanzado',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
  ],
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
