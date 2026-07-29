/**
 * Pack AUDIOVISUAL_PRODUCTION V1 (MC1.8.1) — audiovisual-production-mappings @ 1.0.0
 *
 * Corpus: Santiago 1000944247 (ext 216), Juan Pablo 1022445625 (ext 208).
 * Solo especialidades núcleo: AV_EDITING, AV_MOTION, AV_POST.
 * No mutar tras publicación; correcciones → 1.0.1+.
 */

import { MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';

const EDITING = 'AV_EDITING';
const MOTION = 'AV_MOTION';
const POST = 'AV_POST';

export const MC_AUDIOVISUAL_MAPPING_RULES_VERSION_V100 = '1.0.0';

export const MC_AUDIOVISUAL_EXPECTED_DISTRIBUTION_V100: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 10,
  TRANSVERSAL_FUTURE: 6,
  AMBIGUOUS: 0,
  OUTSIDE_SOFTWARE_DOMAIN: 20,
  CATALOG_GAP: 0,
  total: 36,
};

export const MC_AUDIOVISUAL_MAPPING_PACK_V100: McDomainMappingPack = {
  domainCode: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
  sourceRef: 'docs/mc1.8.1-audiovisual-prototype-plan.md',
  classifications: [
    // —— DOMAIN_SPECIALTY (profesionales) ——
    {
      skillKey: 'edicion_de_video',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Edición de video',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Núcleo AV_EDITING; ambos perfiles (Santiago MODERATE, Juan Pablo listing débil).',
    },
    {
      skillKey: 'motion_graphics',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Motion Graphics',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Núcleo AV_MOTION (Santiago MODERATE).',
    },
    {
      skillKey: 'animacion_2d',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Animación 2D',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Núcleo AV_MOTION (Santiago MODERATE 64.5).',
    },
    {
      skillKey: 'animacion_2d/3d',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Animación 2D/3D',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Variante léxica AV_MOTION (Juan Pablo MODERATE).',
    },
    {
      skillKey: 'ajuste_de_color',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Ajuste de color',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Núcleo AV_POST (Santiago MODERATE).',
    },
    // —— DOMAIN_SPECIALTY (tools) ——
    {
      skillKey: 'adobe_premiere',
      skillType: 'TOOL',
      skillName: 'Adobe Premiere',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'NLE edición (Santiago).',
    },
    {
      skillKey: 'adobe_premiere_pro',
      skillType: 'TOOL',
      skillName: 'Adobe Premiere Pro',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'NLE edición (Juan Pablo MODERATE).',
    },
    {
      skillKey: 'davinci_resolve',
      skillType: 'TOOL',
      skillName: 'DaVinci Resolve',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Edición y color (Santiago MODERATE).',
    },
    {
      skillKey: 'capcut',
      skillType: 'TOOL',
      skillName: 'CapCut',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Edición ágil (Juan Pablo MODERATE).',
    },
    {
      skillKey: 'adobe_after_effects',
      skillType: 'TOOL',
      skillName: 'Adobe After Effects',
      classification: 'DOMAIN_SPECIALTY',
      rationale: 'Motion (Juan Pablo MODERATE); peso bajo.',
    },

    // —— TRANSVERSAL_FUTURE ——
    {
      skillKey: 'comunicacion',
      skillType: 'SOFT_SKILL',
      skillName: 'Comunicación',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'MC2; no especialidad AV.',
    },
    {
      skillKey: 'comunicacion_asertiva',
      skillType: 'SOFT_SKILL',
      skillName: 'Comunicación Asertiva',
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
      skillKey: 'analisis_de_datos',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Análisis de datos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Operaciones; no núcleo AV.',
    },
    {
      skillKey: 'capacidad_para_liderar_equipos_creativos',
      skillType: 'SOFT_SKILL',
      skillName: 'capacidad para liderar equipos creativos',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Transversal; NONE en Juan Pablo.',
    },
    {
      skillKey: 'e-mail_marketing',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'E-mail marketing',
      classification: 'TRANSVERSAL_FUTURE',
      rationale: 'Marketing; frontera comunicación.',
    },

    // —— OUTSIDE ——
    {
      skillKey: 'adobe_suite',
      skillType: 'TOOL',
      skillName: 'Adobe Suite',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Genérico; no equivale a apps específicas.',
    },
    {
      skillKey: 'suite_de_office',
      skillType: 'TOOL',
      skillName: 'Suite de Office',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Office genérico.',
    },
    {
      skillKey: 'programacion_de_software',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Programación de software',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Dominio SOFTWARE.',
    },
    {
      skillKey: 'fotografia',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Fotografía',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Listing WEAK; AV_PHOTOGRAPHY reservada.',
    },
    {
      skillKey: 'iluminacion',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Iluminación',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Producción integral reservada (AV_PRODUCTION); no post.',
    },
    {
      skillKey: 'adobe_indesign',
      skillType: 'TOOL',
      skillName: 'Adobe InDesign',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Diseño Visual / editorial.',
    },
    {
      skillKey: 'manuales_de_identidad_corporativa',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Manuales de identidad corporativa',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'VISUAL_IDENTITY.',
    },
    {
      skillKey: 'mockups_publicitarios',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Mockups publicitarios',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Diseño gráfico.',
    },
    {
      skillKey: 'retoque_fotografico',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Retoque fotográfico',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Frontera Visual / foto reservada.',
    },
    {
      skillKey: 'fotografia_comercial',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Fotografía comercial',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'AV_PHOTOGRAPHY reservada; 1 perfil.',
    },
    {
      skillKey: 'ispring',
      skillType: 'TOOL',
      skillName: 'iSpring',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Diseño instruccional.',
    },
    {
      skillKey: 'masterizacion_de_audio',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Masterización de audio',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'AV_SOUND reservada.',
    },
    {
      skillKey: 'streaming',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Streaming',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'AV_STREAMING reservada.',
    },
    {
      skillKey: 'obs_studio',
      skillType: 'TOOL',
      skillName: 'OBS Studio',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Streaming técnico reservado.',
    },
    {
      skillKey: 'protools',
      skillType: 'TOOL',
      skillName: 'Protools',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Audio listing.',
    },
    {
      skillKey: 'fl_studio',
      skillType: 'TOOL',
      skillName: 'FL Studio',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Audio listing.',
    },
    {
      skillKey: 'ableton_live',
      skillType: 'TOOL',
      skillName: 'Ableton Live',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Audio listing.',
    },
    {
      skillKey: 'traktor',
      skillType: 'TOOL',
      skillName: 'Traktor',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Audio listing.',
    },
    {
      skillKey: 'blender',
      skillType: 'TOOL',
      skillName: 'Blender',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: '3D listing WEAK.',
    },
    {
      skillKey: 'animate',
      skillType: 'TOOL',
      skillName: 'Animate',
      classification: 'OUTSIDE_SOFTWARE_DOMAIN',
      rationale: 'Tool listing sin práctica 3D.',
    },
  ],
  mappings: [
    {
      skillKey: 'edicion_de_video',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Edición de video',
      specialtyCode: EDITING,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'PRIMARY profesional AV_EDITING',
    },
    {
      skillKey: 'adobe_premiere',
      skillType: 'TOOL',
      skillName: 'Adobe Premiere',
      specialtyCode: EDITING,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Tool edición',
    },
    {
      skillKey: 'adobe_premiere_pro',
      skillType: 'TOOL',
      skillName: 'Adobe Premiere Pro',
      specialtyCode: EDITING,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Tool edición',
    },
    {
      skillKey: 'davinci_resolve',
      skillType: 'TOOL',
      skillName: 'DaVinci Resolve',
      specialtyCode: EDITING,
      weight: 0.2,
      mappingType: 'PRIMARY',
      rationale: 'NLE principal Santiago',
    },
    {
      skillKey: 'davinci_resolve',
      skillType: 'TOOL',
      skillName: 'DaVinci Resolve',
      specialtyCode: POST,
      weight: 0.15,
      mappingType: 'SECONDARY',
      rationale: 'Color grading tool → POST secundario',
    },
    {
      skillKey: 'capcut',
      skillType: 'TOOL',
      skillName: 'CapCut',
      specialtyCode: EDITING,
      weight: 0.2,
      mappingType: 'PRIMARY',
      rationale: 'Edición ágil',
    },
    {
      skillKey: 'motion_graphics',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Motion Graphics',
      specialtyCode: MOTION,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'PRIMARY motion',
    },
    {
      skillKey: 'animacion_2d',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Animación 2D',
      specialtyCode: MOTION,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'PRIMARY animación',
    },
    {
      skillKey: 'animacion_2d/3d',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Animación 2D/3D',
      specialtyCode: MOTION,
      weight: 0.95,
      mappingType: 'PRIMARY',
      rationale: 'Alias léxico animación',
    },
    {
      skillKey: 'adobe_after_effects',
      skillType: 'TOOL',
      skillName: 'Adobe After Effects',
      specialtyCode: MOTION,
      weight: 0.25,
      mappingType: 'PRIMARY',
      rationale: 'Tool motion',
    },
    {
      skillKey: 'ajuste_de_color',
      skillType: 'PROFESSIONAL_KNOWLEDGE',
      skillName: 'Ajuste de color',
      specialtyCode: POST,
      weight: 1,
      mappingType: 'PRIMARY',
      rationale: 'PRIMARY postproducción',
    },
  ],
};
