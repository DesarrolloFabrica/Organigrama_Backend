/**
 * Pack OPERATIONS_MANAGEMENT V1.1 — operations-management-mappings @ 1.1.0
 *
 * Corpus: Aura Marcela Royero Vergara (1042448655 / person_id 1297).
 * Cinco especialidades OPS_* (sin scaffold). Tools fuera de ejes.
 * V1.0.0 (OPS_GENERAL) se conserva en releases históricos.
 */

import { MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

export const MC_OPERATIONS_MAPPING_RULES_VERSION_V110 = '1.1.0';

export const MC_OPERATIONS_EXPECTED_DISTRIBUTION_V110: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 25,
  TRANSVERSAL_FUTURE: 0,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 9,
  CATALOG_GAP: 0,
  total: 34,
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
    rationale: 'MC1.13 OPERATIONS_MANAGEMENT curación ChatGPT',
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
    rationale: `MC1.13 ${specialtyCode}`,
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
    skillKey: 'planeacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planeación académica',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'gestion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión académica',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'programacion_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Programación académica',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'registro_de_notas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Registro de notas',
  },
  {
    specialtyCode: 'OPS_ACADEMIC',
    skillKey: 'gestion_de_syllabus',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de syllabus',
  },
  // OPS_QUALITY
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'aseguramiento_de_calidad_educativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Aseguramiento de calidad educativa',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'autoevaluacion_institucional',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Autoevaluación institucional',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'licenciamiento',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Licenciamiento',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'planes_de_mejoramiento',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Planes de mejoramiento',
  },
  {
    specialtyCode: 'OPS_QUALITY',
    skillKey: 'auditoria_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Auditoría académica',
  },
  // OPS_PROCESS
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'gestion_de_proyectos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de proyectos',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'seguimiento_de_proyectos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Seguimiento de proyectos',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'optimizacion_de_procesos',
    skillType: 'METHODOLOGY',
    skillName: 'Optimización de procesos',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'gestion_de_cronogramas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de cronogramas',
  },
  {
    specialtyCode: 'OPS_PROCESS',
    skillKey: 'gestion_de_riesgos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de riesgos',
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
    skillKey: 'consolidacion_de_bases_de_datos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Consolidación de bases de datos',
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
    skillKey: 'gestion_de_pqrs',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de PQRS',
  },
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'atencion_de_casos_criticos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Atención de casos críticos',
  },
  {
    specialtyCode: 'OPS_COORDINATION',
    skillKey: 'relacionamiento_institucional',
    skillType: 'SOFT_SKILL',
    skillName: 'Relacionamiento institucional',
  },
];

export const MC_OPERATIONS_MAPPING_PACK_V110: McDomainMappingPack = {
  domainCode: MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-aura-1042448655-manual-curated-import.md',
  classifications: [
    ...specialtySkills.map((s) => ds(s.skillKey, s.skillType, s.skillName)),
    {
      skillKey: 'excel',
      skillType: 'TOOL',
      skillName: 'Excel',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'microsoft_powerpoint',
      skillType: 'TOOL',
      skillName: 'PowerPoint',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta (Microsoft PowerPoint); fuera del radar.',
    },
    {
      skillKey: 'google_workspace',
      skillType: 'TOOL',
      skillName: 'Google Workspace',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'microsoft_teams',
      skillType: 'TOOL',
      skillName: 'Teams',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta (Microsoft Teams); fuera del radar.',
    },
    {
      skillKey: 'outlook',
      skillType: 'TOOL',
      skillName: 'Outlook',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'chatgpt',
      skillType: 'TOOL',
      skillName: 'ChatGPT',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'notebooklm',
      skillType: 'TOOL',
      skillName: 'NotebookLM',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'gemini',
      skillType: 'TOOL',
      skillName: 'Gemini',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
    {
      skillKey: 'claude',
      skillType: 'TOOL',
      skillName: 'Claude',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta; fuera del radar.',
    },
  ],
  mappings: specialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.specialtyCode),
  ),
};
