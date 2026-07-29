/**
 * Pack de clasificación + mappings SOFTWARE (MC1.1 → MC1.3.2).
 *
 * Identidad: normalized_key + skill_type → cv_skill.id en seed.
 * No depende de person_id ni extraction_id.
 *
 * Fuente: docs/mc1.1-analisis-dominio-software-camilo.md
 */

import { MC_SOFTWARE_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';

const FE = 'SOFTWARE_FRONTEND';
const BE = 'SOFTWARE_BACKEND';
const DB = 'SOFTWARE_DATA';
const API = 'SOFTWARE_API_INTEGRATION';
const CLOUD = 'SOFTWARE_CLOUD_DEPLOY';
const ENG = 'SOFTWARE_ENGINEERING_QUALITY';
const IA = 'SOFTWARE_AI_APPLIED';

export const MC_SOFTWARE_MAPPING_RULES_VERSION = 'mc1.1-camilo-2026-07-27';

export const MC_SOFTWARE_MAPPING_PACK: McDomainMappingPack = {
  domainCode: MC_SOFTWARE_DOMAIN_CODE,
  sourceRef: 'docs/mc1.1-analisis-dominio-software-camilo.md',
  classifications: [
    // DOMAIN_SPECIALTY (42)
    { skillKey: 'react', skillType: 'TECHNOLOGY', skillName: 'React', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: stack UI con evidencia laboral STRONG.' },
    { skillKey: 'next.js', skillType: 'TECHNOLOGY', skillName: 'Next.js', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'angular', skillType: 'TECHNOLOGY', skillName: 'Angular', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'angularjs', skillType: 'TECHNOLOGY', skillName: 'AngularJS', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'angular_material', skillType: 'TECHNOLOGY', skillName: 'Angular Material', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'javascript', skillType: 'TECHNOLOGY', skillName: 'JavaScript', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual FE/BE justificado.' },
    { skillKey: 'typescript', skillType: 'TECHNOLOGY', skillName: 'TypeScript', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual FE/BE justificado.' },
    { skillKey: 'html5', skillType: 'TECHNOLOGY', skillName: 'HTML5', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'css3', skillType: 'TECHNOLOGY', skillName: 'CSS3', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'sass', skillType: 'TECHNOLOGY', skillName: 'Sass', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'tailwind_css', skillType: 'TECHNOLOGY', skillName: 'Tailwind CSS', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: frontend.' },
    { skillKey: 'node.js', skillType: 'TECHNOLOGY', skillName: 'Node.js', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'nestjs', skillType: 'TECHNOLOGY', skillName: 'NestJS', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'express.js', skillType: 'TECHNOLOGY', skillName: 'Express.js', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'asp.net', skillType: 'TECHNOLOGY', skillName: 'ASP.NET', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'c#', skillType: 'TECHNOLOGY', skillName: 'C#', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: '.net', skillType: 'TECHNOLOGY', skillName: '.NET', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'go', skillType: 'TECHNOLOGY', skillName: 'Go', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: backend.' },
    { skillKey: 'apis_rest', skillType: 'TECHNOLOGY', skillName: 'APIs REST', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual API/BE.' },
    { skillKey: 'postgresql', skillType: 'TECHNOLOGY', skillName: 'PostgreSQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'mysql', skillType: 'TECHNOLOGY', skillName: 'MySQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'mongodb', skillType: 'TECHNOLOGY', skillName: 'MongoDB', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'sql', skillType: 'TECHNOLOGY', skillName: 'SQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'pl/sql', skillType: 'TECHNOLOGY', skillName: 'PL/SQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'transact-sql', skillType: 'TECHNOLOGY', skillName: 'Transact-SQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: datos.' },
    { skillKey: 'typeorm', skillType: 'TOOL', skillName: 'TypeORM', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual DB/BE.' },
    { skillKey: 'google_cloud_platform', skillType: 'TECHNOLOGY', skillName: 'Google Cloud Platform', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'google_cloud_sql', skillType: 'TECHNOLOGY', skillName: 'Google Cloud SQL', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual CLOUD/DB.' },
    { skillKey: 'amazon_web_services', skillType: 'TECHNOLOGY', skillName: 'Amazon Web Services', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'amazon_s3', skillType: 'TECHNOLOGY', skillName: 'Amazon S3', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'amazon_cloudfront', skillType: 'TECHNOLOGY', skillName: 'Amazon CloudFront', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'microsoft_azure', skillType: 'TECHNOLOGY', skillName: 'Microsoft Azure', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'docker', skillType: 'TOOL', skillName: 'Docker', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: cloud.' },
    { skillKey: 'git', skillType: 'TOOL', skillName: 'Git', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: dual ENG/CLOUD.' },
    { skillKey: 'github', skillType: 'TOOL', skillName: 'GitHub', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: ingeniería.' },
    { skillKey: 'postman', skillType: 'TOOL', skillName: 'Postman', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: APIs.' },
    { skillKey: 'scrum', skillType: 'METHODOLOGY', skillName: 'Scrum', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: ingeniería.' },
    { skillKey: 'metodologias_agiles', skillType: 'METHODOLOGY', skillName: 'Metodologías Ágiles', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: ingeniería.' },
    { skillKey: 'pruebas_funcionales', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Pruebas funcionales', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: ingeniería/calidad.' },
    { skillKey: 'gestion_de_requerimientos', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Gestión de requerimientos', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: ingeniería.' },
    { skillKey: 'inteligencia_artificial', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Inteligencia Artificial', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: IA aplicada.' },
    { skillKey: 'prompting', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'prompting', classification: 'DOMAIN_SPECIALTY', rationale: 'MC1.1: IA aplicada.' },

    // AMBIGUOUS (3)
    { skillKey: 'desarrollo_full_stack', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Desarrollo Full Stack', classification: 'AMBIGUOUS', rationale: 'MC1.1: etiqueta de rol; no especialidad.' },
    { skillKey: 'arquitectura_de_software', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Arquitectura de software', classification: 'AMBIGUOUS', rationale: 'MC1.1: sin evidencia; no crear especialidad.' },
    { skillKey: 'automatizacion_de_procesos', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Automatización de procesos', classification: 'AMBIGUOUS', rationale: 'MC1.1: outcome de negocio sin especialidad inequívoca.' },

    // TRANSVERSAL_FUTURE (14)
    { skillKey: 'comunicacion_asertiva', skillType: 'SOFT_SKILL', skillName: 'Comunicación Asertiva', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'trabajo_en_equipo', skillType: 'SOFT_SKILL', skillName: 'Trabajo en equipo', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'liderazgo', skillType: 'SOFT_SKILL', skillName: 'Liderazgo', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'escucha_activa', skillType: 'SOFT_SKILL', skillName: 'Escucha activa', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'resolucion_de_conflictos', skillType: 'SOFT_SKILL', skillName: 'Resolución de conflictos', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'autonomia', skillType: 'SOFT_SKILL', skillName: 'Autonomía', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'adaptabilidad', skillType: 'SOFT_SKILL', skillName: 'Adaptabilidad', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'orientacion_a_resultados', skillType: 'SOFT_SKILL', skillName: 'Orientación a resultados', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'pensamiento_critico', skillType: 'SOFT_SKILL', skillName: 'Pensamiento crítico', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'gestion_del_tiempo', skillType: 'SOFT_SKILL', skillName: 'Gestión del tiempo', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'atencion_al_detalle', skillType: 'SOFT_SKILL', skillName: 'Atención al detalle', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'capacidad_analitica', skillType: 'SOFT_SKILL', skillName: 'Capacidad analítica', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'resolucion_de_problemas', skillType: 'SOFT_SKILL', skillName: 'Resolución de problemas', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
    { skillKey: 'aprendizaje_continuo', skillType: 'SOFT_SKILL', skillName: 'Aprendizaje continuo', classification: 'TRANSVERSAL_FUTURE', rationale: 'MC2.' },
  ],
  mappings: [
    { skillKey: 'react', skillType: 'TECHNOLOGY', skillName: 'React', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'next.js', skillType: 'TECHNOLOGY', skillName: 'Next.js', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'angular', skillType: 'TECHNOLOGY', skillName: 'Angular', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'angularjs', skillType: 'TECHNOLOGY', skillName: 'AngularJS', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'angular_material', skillType: 'TECHNOLOGY', skillName: 'Angular Material', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'javascript', skillType: 'TECHNOLOGY', skillName: 'JavaScript', specialtyCode: FE, weight: 0.8, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 0.80' },
    { skillKey: 'javascript', skillType: 'TECHNOLOGY', skillName: 'JavaScript', specialtyCode: BE, weight: 0.2, mappingType: 'SECONDARY', rationale: 'MC1.1 BE 0.20' },
    { skillKey: 'typescript', skillType: 'TECHNOLOGY', skillName: 'TypeScript', specialtyCode: FE, weight: 0.7, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 0.70' },
    { skillKey: 'typescript', skillType: 'TECHNOLOGY', skillName: 'TypeScript', specialtyCode: BE, weight: 0.3, mappingType: 'SECONDARY', rationale: 'MC1.1 BE 0.30' },
    { skillKey: 'html5', skillType: 'TECHNOLOGY', skillName: 'HTML5', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'css3', skillType: 'TECHNOLOGY', skillName: 'CSS3', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'sass', skillType: 'TECHNOLOGY', skillName: 'Sass', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'tailwind_css', skillType: 'TECHNOLOGY', skillName: 'Tailwind CSS', specialtyCode: FE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 FE 1.0' },
    { skillKey: 'node.js', skillType: 'TECHNOLOGY', skillName: 'Node.js', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'nestjs', skillType: 'TECHNOLOGY', skillName: 'NestJS', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'express.js', skillType: 'TECHNOLOGY', skillName: 'Express.js', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'asp.net', skillType: 'TECHNOLOGY', skillName: 'ASP.NET', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'c#', skillType: 'TECHNOLOGY', skillName: 'C#', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: '.net', skillType: 'TECHNOLOGY', skillName: '.NET', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'go', skillType: 'TECHNOLOGY', skillName: 'Go', specialtyCode: BE, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 BE 1.0' },
    { skillKey: 'apis_rest', skillType: 'TECHNOLOGY', skillName: 'APIs REST', specialtyCode: API, weight: 0.6, mappingType: 'PRIMARY', rationale: 'MC1.1 API 0.60' },
    { skillKey: 'apis_rest', skillType: 'TECHNOLOGY', skillName: 'APIs REST', specialtyCode: BE, weight: 0.4, mappingType: 'SECONDARY', rationale: 'MC1.1 BE 0.40' },
    { skillKey: 'postgresql', skillType: 'TECHNOLOGY', skillName: 'PostgreSQL', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'mysql', skillType: 'TECHNOLOGY', skillName: 'MySQL', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'mongodb', skillType: 'TECHNOLOGY', skillName: 'MongoDB', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'sql', skillType: 'TECHNOLOGY', skillName: 'SQL', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'pl/sql', skillType: 'TECHNOLOGY', skillName: 'PL/SQL', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'transact-sql', skillType: 'TECHNOLOGY', skillName: 'Transact-SQL', specialtyCode: DB, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 1.0' },
    { skillKey: 'typeorm', skillType: 'TOOL', skillName: 'TypeORM', specialtyCode: DB, weight: 0.65, mappingType: 'PRIMARY', rationale: 'MC1.1 DB 0.65' },
    { skillKey: 'typeorm', skillType: 'TOOL', skillName: 'TypeORM', specialtyCode: BE, weight: 0.35, mappingType: 'SECONDARY', rationale: 'MC1.1 BE 0.35' },
    { skillKey: 'google_cloud_platform', skillType: 'TECHNOLOGY', skillName: 'Google Cloud Platform', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'google_cloud_sql', skillType: 'TECHNOLOGY', skillName: 'Google Cloud SQL', specialtyCode: CLOUD, weight: 0.7, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 0.70' },
    { skillKey: 'google_cloud_sql', skillType: 'TECHNOLOGY', skillName: 'Google Cloud SQL', specialtyCode: DB, weight: 0.3, mappingType: 'SECONDARY', rationale: 'MC1.1 DB 0.30' },
    { skillKey: 'amazon_web_services', skillType: 'TECHNOLOGY', skillName: 'Amazon Web Services', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'amazon_s3', skillType: 'TECHNOLOGY', skillName: 'Amazon S3', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'amazon_cloudfront', skillType: 'TECHNOLOGY', skillName: 'Amazon CloudFront', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'microsoft_azure', skillType: 'TECHNOLOGY', skillName: 'Microsoft Azure', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'docker', skillType: 'TOOL', skillName: 'Docker', specialtyCode: CLOUD, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 CLOUD 1.0' },
    { skillKey: 'git', skillType: 'TOOL', skillName: 'Git', specialtyCode: ENG, weight: 0.75, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 0.75' },
    { skillKey: 'git', skillType: 'TOOL', skillName: 'Git', specialtyCode: CLOUD, weight: 0.25, mappingType: 'SECONDARY', rationale: 'MC1.1 CLOUD 0.25' },
    { skillKey: 'github', skillType: 'TOOL', skillName: 'GitHub', specialtyCode: ENG, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 1.0' },
    { skillKey: 'postman', skillType: 'TOOL', skillName: 'Postman', specialtyCode: API, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 API 1.0' },
    { skillKey: 'scrum', skillType: 'METHODOLOGY', skillName: 'Scrum', specialtyCode: ENG, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 1.0' },
    { skillKey: 'metodologias_agiles', skillType: 'METHODOLOGY', skillName: 'Metodologías Ágiles', specialtyCode: ENG, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 1.0' },
    { skillKey: 'pruebas_funcionales', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Pruebas funcionales', specialtyCode: ENG, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 1.0' },
    { skillKey: 'gestion_de_requerimientos', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Gestión de requerimientos', specialtyCode: ENG, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 ENG 1.0' },
    { skillKey: 'inteligencia_artificial', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'Inteligencia Artificial', specialtyCode: IA, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 IA 1.0' },
    { skillKey: 'prompting', skillType: 'PROFESSIONAL_KNOWLEDGE', skillName: 'prompting', specialtyCode: IA, weight: 1, mappingType: 'PRIMARY', rationale: 'MC1.1 IA 1.0' },
  ],
};

/** Distribución esperada MC1.1 para el pack SOFTWARE. */
export const MC_SOFTWARE_EXPECTED_DISTRIBUTION = {
  DOMAIN_SPECIALTY: 42,
  TRANSVERSAL_FUTURE: 14,
  AMBIGUOUS: 3,
  OUTSIDE_SOFTWARE_DOMAIN: 0,
  CATALOG_GAP: 0,
  total: 59,
} as const;
