/**
 * Pack de clasificación + mappings VISUAL_DESIGN (MC1.6.1B).
 *
 * Identidad: normalized_key + skill_type → cv_skill.id
 * Fuente: evidencia Nidia extracción 207 / evidence 5 (hash 467d…).
 * No depende de person_id; no inventa skills UX/UI.
 */

import { MC_VISUAL_DESIGN_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

const GRAPHIC = 'VISUAL_GRAPHIC';
const IDENTITY = 'VISUAL_IDENTITY';
const EDITORIAL = 'VISUAL_EDITORIAL';
const DIGITAL = 'VISUAL_DIGITAL_ASSETS';
// VISUAL_UI: especialidad en catálogo sin mappings V1 (sin evidencia en semilla).

export const MC_VISUAL_DESIGN_MAPPING_RULES_VERSION =
  'mc1.6-visual-nidia-2026-07-27';

export const MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 9,
  TRANSVERSAL_FUTURE: 15,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 13,
  CATALOG_GAP: 0,
  total: 37,
};

export const MC_VISUAL_DESIGN_MAPPING_PACK: McDomainMappingPack = {
  domainCode: MC_VISUAL_DESIGN_DOMAIN_CODE,
  sourceRef: 'docs/mc1.6.0-visual-design-domain-audit.md',
  classifications: [
    // DOMAIN_SPECIALTY (9)
    {
      skillKey: 'diseno_grafico',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Diseño Gráfico',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Núcleo disciplinar; Evidence MODERATE en semilla.',
    },
    {
      skillKey: 'adobe_illustrator',
      skillType: 'TOOL',
      skillName: 'Adobe Illustrator',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Herramienta gráfica; peso bajo (WEAK).',
    },
    {
      skillKey: 'adobe_photoshop',
      skillType: 'TOOL',
      skillName: 'Adobe Photoshop',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Herramienta gráfica; peso bajo (WEAK).',
    },
    {
      skillKey: 'adobe_indesign',
      skillType: 'TOOL',
      skillName: 'Adobe InDesign',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Maquetación / assets digitales; peso controlado.',
    },
    {
      skillKey: 'diseno_editorial',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Diseño editorial',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Eje editorial; evidencia débil → umbral estricto PA2.',
    },
    {
      skillKey: 'comunicacion_visual',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Comunicación Visual',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Identidad/comunicación; listing NONE en semilla.',
    },
    {
      skillKey: 'canva',
      skillType: 'TOOL',
      skillName: 'Canva',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Herramienta de assets digitales; listing NONE.',
    },
    {
      skillKey: 'genially',
      skillType: 'TOOL',
      skillName: 'Genially',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Asset digital interactivo (no pedagogía SCORM).',
    },
    {
      skillKey: 'control_de_calidad_(qa)',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Control de Calidad (QA)',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'QA pedagógico/visual con Evidence MODERATE.',
    },

    // TRANSVERSAL_FUTURE (15)
    {
      skillKey: 'inteligencia_artificial',
      skillType: 'TECHNOLOGY',
      skillName: 'Inteligencia Artificial',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Soporte al flujo; no especialidad V1.',
    },
    {
      skillKey: 'prompting',
      skillType: 'METHODOLOGY',
      skillName: 'Prompting',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Metodología de soporte.',
    },
    {
      skillKey: 'gestion_de_proyectos',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Gestión de proyectos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Transversal; no eje visual.',
    },
    {
      skillKey: 'comunicacion_asertiva',
      skillType: 'SOFT_SKILL',
      skillName: 'Comunicación Asertiva',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'trabajo_en_equipo',
      skillType: 'SOFT_SKILL',
      skillName: 'Trabajo en equipo',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'empatia',
      skillType: 'SOFT_SKILL',
      skillName: 'Empatía',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'liderazgo_de_equipos',
      skillType: 'SOFT_SKILL',
      skillName: 'Liderazgo de equipos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'escucha_activa',
      skillType: 'SOFT_SKILL',
      skillName: 'Escucha activa',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'resolucion_de_conflictos',
      skillType: 'SOFT_SKILL',
      skillName: 'Resolución de conflictos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'adaptabilidad',
      skillType: 'SOFT_SKILL',
      skillName: 'Adaptabilidad',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'orientacion_a_resultados',
      skillType: 'SOFT_SKILL',
      skillName: 'Orientación a resultados',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'pensamiento_critico',
      skillType: 'SOFT_SKILL',
      skillName: 'Pensamiento crítico',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'gestion_del_tiempo',
      skillType: 'SOFT_SKILL',
      skillName: 'Gestión del tiempo',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'atencion_al_detalle',
      skillType: 'SOFT_SKILL',
      skillName: 'Atención al detalle',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },
    {
      skillKey: 'capacidad_analitica',
      skillType: 'SOFT_SKILL',
      skillName: 'Capacidad analítica',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2.',
    },

    // OUTSIDE_SOFTWARE_DOMAIN (13) — enum legacy; fuera de Diseño Visual V1
    {
      skillKey: 'diseno_instruccional',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Diseño instruccional',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Otro dominio / frontera pedagógica.',
    },
    {
      skillKey: 'scorm',
      skillType: 'TECHNOLOGY',
      skillName: 'SCORM',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'E-learning; no núcleo visual V1.',
    },
    {
      skillKey: 'lms',
      skillType: 'TECHNOLOGY',
      skillName: 'LMS',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'E-learning; no núcleo visual V1.',
    },
    {
      skillKey: 'moodle',
      skillType: 'TOOL',
      skillName: 'Moodle',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'LMS tool.',
    },
    {
      skillKey: 'ispring',
      skillType: 'TOOL',
      skillName: 'iSpring',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Autoría e-learning.',
    },
    {
      skillKey: 'iseazy',
      skillType: 'TOOL',
      skillName: 'isEAZY',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Autoría e-learning.',
    },
    {
      skillKey: 'microaprendizaje',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Microaprendizaje',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Pedagogía.',
    },
    {
      skillKey: 'adobe_premiere_pro',
      skillType: 'TOOL',
      skillName: 'Adobe Premiere Pro',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Producción audiovisual.',
    },
    {
      skillKey: 'adobe_after_effects',
      skillType: 'TOOL',
      skillName: 'Adobe After Effects',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Producción audiovisual / motion.',
    },
    {
      skillKey: 'capcut',
      skillType: 'TOOL',
      skillName: 'CapCut',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Edición de video.',
    },
    {
      skillKey: 'midjourney',
      skillType: 'TOOL',
      skillName: 'Midjourney',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tool IA listing; no especialidad.',
    },
    {
      skillKey: 'runway',
      skillType: 'TOOL',
      skillName: 'Runway',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tool IA listing.',
    },
    {
      skillKey: 'grok',
      skillType: 'TOOL',
      skillName: 'Grok',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tool IA listing.',
    },
  ],
  mappings: [
    // Profesional primero; herramientas con peso bajo.
    {
      skillKey: 'diseno_grafico',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Diseño Gráfico',
      specialtyCode: GRAPHIC,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'PRIMARY profesional 1.0',
    },
    {
      skillKey: 'adobe_illustrator',
      skillType: 'TOOL',
      skillName: 'Adobe Illustrator',
      specialtyCode: GRAPHIC,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Herramienta especializada peso bajo',
    },
    {
      skillKey: 'adobe_photoshop',
      skillType: 'TOOL',
      skillName: 'Adobe Photoshop',
      specialtyCode: GRAPHIC,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Herramienta especializada peso bajo',
    },
    {
      skillKey: 'control_de_calidad_(qa)',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Control de Calidad (QA)',
      specialtyCode: GRAPHIC,
      weight: 0.45,
      mappingType: 'PRIMARY',
      rationale: 'QA visual/pedagógico → gráfico',
    },
    {
      skillKey: 'diseno_editorial',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Diseño editorial',
      specialtyCode: EDITORIAL,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'Única skill editorial (cardinalidad baja → EMERGENT)',
    },
    {
      skillKey: 'comunicacion_visual',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Comunicación Visual',
      specialtyCode: IDENTITY,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'Identidad; sin evidencia → HIDDEN en PA2',
    },
    {
      skillKey: 'adobe_indesign',
      skillType: 'TOOL',
      skillName: 'Adobe InDesign',
      specialtyCode: DIGITAL,
      weight: 0.55,
      mappingType: 'PRIMARY',
      rationale: 'Assets/maquetación digital',
    },
    {
      skillKey: 'adobe_indesign',
      skillType: 'TOOL',
      skillName: 'Adobe InDesign',
      specialtyCode: EDITORIAL,
      weight: 0.2,
      mappingType: 'SECONDARY',
      rationale: 'Aporte editorial secundario',
    },
    {
      skillKey: 'canva',
      skillType: 'TOOL',
      skillName: 'Canva',
      specialtyCode: DIGITAL,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Asset digital genérico peso mínimo',
    },
    {
      skillKey: 'canva',
      skillType: 'TOOL',
      skillName: 'Canva',
      specialtyCode: GRAPHIC,
      weight: 0.1,
      mappingType: 'SECONDARY',
      rationale: 'Aporte gráfico mínimo',
    },
    {
      skillKey: 'genially',
      skillType: 'TOOL',
      skillName: 'Genially',
      specialtyCode: DIGITAL,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Recurso visual digital',
    },
  ],
};
