/**
 * Pack OPERATIONS_MANAGEMENT V1 (MC1.9 golden) — operations-management-mappings @ 1.0.0
 *
 * Corpus semilla: Ingrid Juliana Vargas Beltrán (1000019945 / person_id 1145).
 * Especialidad única scaffold: OPS_GENERAL (NO taxonomía definitiva).
 * No mutar tras publicación; correcciones → 1.0.1+.
 */

import { MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

const GENERAL = 'OPS_GENERAL';

export const MC_OPERATIONS_MAPPING_RULES_VERSION_V100 = '1.0.0';

export const MC_OPERATIONS_EXPECTED_DISTRIBUTION_V100: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 22,
  TRANSVERSAL_FUTURE: 1,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 1,
  CATALOG_GAP: 0,
  total: 24,
};

type ClassRow = McDomainMappingPack['classifications'][number];
type MapRow = McDomainMappingPack['mappings'][number];

function ds(
  skillKey: string,
  skillType: ClassRow['skillType'],
  skillName: string,
  rationale: string,
): ClassRow {
  return {
    skillKey,
    skillType,
    skillName,
    classification: 'DOMAIN_SPECIALTY',
    rationale,
  };
}

function primary(
  skillKey: string,
  skillType: MapRow['skillType'],
  skillName: string,
  weight = 1,
): MapRow {
  return {
    skillKey,
    skillType,
    skillName,
    specialtyCode: GENERAL,
    weight,
    mappingType: 'PRIMARY',
    rationale: 'MC1.9 golden OPS_GENERAL scaffold',
  };
}

const domainSpecialtySkills: Array<{
  skillKey: string;
  skillType: ClassRow['skillType'];
  skillName: string;
  weight?: number;
}> = [
  // —— Existentes (reuso) ——
  {
    skillKey: 'registro_y_control_academico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Registro y Control Académico',
  },
  {
    skillKey: 'gestion_de_requerimientos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de requerimientos',
  },
  {
    skillKey: 'sistema_sinu',
    skillType: 'TOOL',
    skillName: 'Sistema SINU',
    weight: 0.6,
  },
  {
    skillKey: 'automatizacion_de_procesos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Automatización de procesos',
  },
  {
    skillKey: 'mejora_continua',
    skillType: 'METHODOLOGY',
    skillName: 'Mejora Continua',
  },
  {
    skillKey: 'optimizacion_de_procesos',
    skillType: 'METHODOLOGY',
    skillName: 'Optimización de procesos',
  },
  {
    skillKey: 'zoho_crm',
    skillType: 'TOOL',
    skillName: 'Zoho CRM',
    weight: 0.6,
  },
  // —— Nuevas (golden Ingrid) ——
  {
    skillKey: 'gestion_de_operaciones_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de operaciones académicas',
  },
  {
    skillKey: 'homologaciones_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Homologaciones académicas',
  },
  {
    skillKey: 'equivalencias_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Equivalencias académicas',
  },
  {
    skillKey: 'gestion_de_casos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de casos académicos',
  },
  {
    skillKey: 'gestion_de_sla',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de SLA',
  },
  {
    skillKey: 'analisis_de_indicadores_de_gestion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Análisis de indicadores de gestión',
  },
  {
    skillKey: 'elaboracion_de_informes_de_gestion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Elaboración de informes de gestión',
  },
  {
    skillKey: 'gestion_de_certificaciones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de certificaciones',
  },
  {
    skillKey: 'cierre_de_periodos_academicos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Cierre de periodos académicos',
  },
  {
    skillKey: 'gestion_de_procesos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de procesos',
  },
  {
    skillKey: 'trazabilidad_de_casos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Trazabilidad de casos',
  },
  {
    skillKey: 'gestion_de_historias_academicas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de historias académicas',
  },
  {
    skillKey: 'gestion_de_notas',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de notas',
  },
  {
    skillKey: 'aplicacion_de_normatividad_academica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Aplicación de normatividad académica',
  },
  {
    skillKey: 'capacitacion_de_usuarios',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Capacitación de usuarios',
  },
];

export const MC_OPERATIONS_MAPPING_PACK_V100: McDomainMappingPack = {
  domainCode: MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
  sourceRef: 'docs/mc1-golden-profile-ingrid.md',
  classifications: [
    ...domainSpecialtySkills.map((s) =>
      ds(s.skillKey, s.skillType, s.skillName, 'MC1.9 golden OPS scaffold'),
    ),
    {
      skillKey: 'liderazgo_de_equipos',
      skillType: 'SOFT_SKILL',
      skillName: 'Liderazgo de equipos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2 / soft; no eje OPS_GENERAL.',
    },
    {
      skillKey: 'microsoft_office',
      skillType: 'TOOL',
      skillName: 'Microsoft Office',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Herramienta genérica; no núcleo del dominio.',
    },
  ],
  mappings: domainSpecialtySkills.map((s) =>
    primary(s.skillKey, s.skillType, s.skillName, s.weight ?? 1),
  ),
};
