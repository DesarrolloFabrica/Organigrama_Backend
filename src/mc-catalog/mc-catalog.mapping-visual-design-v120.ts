/**
 * Pack VISUAL_DESIGN V2.1 (MC1.11.0) — visual-design-mappings @ 1.2.0
 *
 * Extiende 1.1.0 con aliases de vocabulario CV (identidad/editorial/gráfico)
 * documentados en Domain Guide § aliases y MC1.6.1C.3 / MC1.11.0.
 *
 * No mapea VISUAL_UI. No reactiva DIGITAL como eje profesional.
 * No muta 1.1.0 in-place.
 */

import { MC_VISUAL_DESIGN_DOMAIN_CODE } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import type { McSkillClassificationStatus } from './mc-catalog.types';
import { MC_VISUAL_DESIGN_MAPPING_PACK_V110 } from './mc-catalog.mapping-visual-design-v110';

const GRAPHIC = 'VISUAL_GRAPHIC';
const IDENTITY = 'VISUAL_IDENTITY';
const EDITORIAL = 'VISUAL_EDITORIAL';
const DIGITAL = 'VISUAL_DIGITAL_ASSETS';

export const MC_VISUAL_DESIGN_MAPPING_RULES_VERSION_V120 = '1.2.0';

export const MC_VISUAL_DESIGN_EXPECTED_DISTRIBUTION_V120: Record<
  McSkillClassificationStatus,
  number
> & { total: number } = {
  DOMAIN_SPECIALTY: 31,
  TRANSVERSAL_FUTURE: 18,
  OUTSIDE_SOFTWARE_DOMAIN: 16,
  AMBIGUOUS: 0,
  CATALOG_GAP: 0,
  total: 65,
};

const V120_EXTRA_CLASSIFICATIONS: McDomainMappingPack['classifications'] = [
  // Identidad — aliases léxicos (P0)
  {
    skillKey: 'branding_y_diseno_de_identidad_corporativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding y Diseño de Identidad Corporativa',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias → identidad (Diego MODERATE).',
  },
  {
    skillKey: 'branding_e_identidad_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding e Identidad de Marca',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias → identidad (Laura Melisa).',
  },
  {
    skillKey: 'identidad_visual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad visual',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias → identidad (Danna, Daissy).',
  },
  {
    skillKey: 'identidad_visual_y_branding',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad Visual y Branding',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias compuesto identidad (Hari).',
  },
  {
    skillKey: 'identidad_corporativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad corporativa',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias identidad (Blanca WEAK).',
  },
  {
    skillKey: 'diseno_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de Marca',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 alias identidad (Molano STRONG).',
  },
  {
    skillKey: 'estrategia_de_comunicacion_visual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategia de Comunicación Visual',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 puente débil a identidad/comunicación (Diego WEAK).',
  },
  // Editorial — compuestos / maquetación
  {
    skillKey: 'diseno_editorial_y_diagramacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Diagramación',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 compuesto editorial (Danna MODERATE).',
  },
  {
    skillKey: 'diseno_editorial_y_publicitario',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Publicitario',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 híbrido editorial+gráfico (Hari).',
  },
  {
    skillKey: 'maquetacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Maquetación',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 maquetación genérica → editorial (Darío).',
  },
  {
    skillKey: 'diseno_de_catalogos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de Catálogos',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 entregable editorial (Hari listing).',
  },
  // Gráfico — ilustración / retoque / publicitario
  {
    skillKey: 'ilustracion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Ilustración',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 ilustración aplicada → gráfico.',
  },
  {
    skillKey: 'ilustracion_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Ilustración digital',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 ilustración digital → gráfico.',
  },
  {
    skillKey: 'retoque_fotografico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Retoque fotográfico',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 retoque → gráfico (Daniel WEAK).',
  },
  {
    skillKey: 'retoque_de_imagenes',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Retoque de imágenes',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 retoque → gráfico (Darío MODERATE).',
  },
  {
    skillKey: 'maquetacion_publicitaria',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Maquetación Publicitaria',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'MC1.11.0 maquetación publicitaria → gráfico (Daniel).',
  },
  {
    skillKey: 'indesign',
    skillType: 'TOOL',
    skillName: 'InDesign',
    classification: 'DOMAIN_SPECIALTY',
    rationale: 'Alias tool de adobe_indesign (Diego).',
  },
  // UI reserved — clasificar sin mapping
  {
    skillKey: 'diseno_ux/ui',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño UX/UI',
    classification: 'TRANSVERSAL_FUTURE',
    rationale: 'VISUAL_UI RESERVED: no mapping hasta corpus UI.',
  },
  {
    skillKey: 'prototipado_de_aplicaciones_e_interfaces_(ui/ux)',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Prototipado de aplicaciones e interfaces (UI/UX)',
    classification: 'TRANSVERSAL_FUTURE',
    rationale: 'VISUAL_UI RESERVED: mención WEAK no activa UI.',
  },
  {
    skillKey: 'adobe_creative_suite',
    skillType: 'TOOL',
    skillName: 'Adobe Creative Suite',
    classification: 'OUTSIDE_SOFTWARE_DOMAIN',
    rationale: 'Suite genérica: igual que suite_adobe / creative_cloud.',
  },
];

const V120_EXTRA_MAPPINGS: McDomainMappingPack['mappings'] = [
  // Identidad PRIMARY + aporte gráfico secundario (patrón 1.1.0)
  {
    skillKey: 'branding_y_diseno_de_identidad_corporativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding y Diseño de Identidad Corporativa',
    specialtyCode: IDENTITY,
    weight: 0.9,
    mappingType: 'PRIMARY',
    rationale: 'Alias identidad corporativa',
  },
  {
    skillKey: 'branding_y_diseno_de_identidad_corporativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding y Diseño de Identidad Corporativa',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario de identidad',
  },
  {
    skillKey: 'branding_e_identidad_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding e Identidad de Marca',
    specialtyCode: IDENTITY,
    weight: 0.9,
    mappingType: 'PRIMARY',
    rationale: 'Alias branding/marca',
  },
  {
    skillKey: 'branding_e_identidad_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Branding e Identidad de Marca',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario',
  },
  {
    skillKey: 'identidad_visual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad visual',
    specialtyCode: IDENTITY,
    weight: 0.9,
    mappingType: 'PRIMARY',
    rationale: 'Alias identidad visual',
  },
  {
    skillKey: 'identidad_visual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad visual',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario',
  },
  {
    skillKey: 'identidad_visual_y_branding',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad Visual y Branding',
    specialtyCode: IDENTITY,
    weight: 0.85,
    mappingType: 'PRIMARY',
    rationale: 'Compuesto identidad+branding',
  },
  {
    skillKey: 'identidad_visual_y_branding',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad Visual y Branding',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario',
  },
  {
    skillKey: 'identidad_corporativa',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Identidad corporativa',
    specialtyCode: IDENTITY,
    weight: 0.8,
    mappingType: 'PRIMARY',
    rationale: 'Alias identidad corporativa',
  },
  {
    skillKey: 'diseno_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de Marca',
    specialtyCode: IDENTITY,
    weight: 0.9,
    mappingType: 'PRIMARY',
    rationale: 'Diseño de marca ≈ identidad',
  },
  {
    skillKey: 'diseno_de_marca',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de Marca',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario',
  },
  {
    skillKey: 'estrategia_de_comunicacion_visual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategia de Comunicación Visual',
    specialtyCode: IDENTITY,
    weight: 0.55,
    mappingType: 'PRIMARY',
    rationale: 'Comunicación visual estratégica (peso moderado)',
  },
  // Editorial
  {
    skillKey: 'diseno_editorial_y_diagramacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Diagramación',
    specialtyCode: EDITORIAL,
    weight: 0.9,
    mappingType: 'PRIMARY',
    rationale: 'Compuesto editorial+diagramación',
  },
  {
    skillKey: 'diseno_editorial_y_diagramacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Diagramación',
    specialtyCode: GRAPHIC,
    weight: 0.1,
    mappingType: 'SECONDARY',
    rationale: 'Aporte gráfico secundario (no absorción)',
  },
  {
    skillKey: 'diseno_editorial_y_publicitario',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Publicitario',
    specialtyCode: EDITORIAL,
    weight: 0.55,
    mappingType: 'PRIMARY',
    rationale: 'Mitad editorial del compuesto',
  },
  {
    skillKey: 'diseno_editorial_y_publicitario',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Editorial y Publicitario',
    specialtyCode: GRAPHIC,
    weight: 0.4,
    mappingType: 'SECONDARY',
    rationale: 'Mitad publicitaria/gráfica del compuesto',
  },
  {
    skillKey: 'maquetacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Maquetación',
    specialtyCode: EDITORIAL,
    weight: 0.7,
    mappingType: 'PRIMARY',
    rationale: 'Maquetación genérica → editorial',
  },
  {
    skillKey: 'diseno_de_catalogos',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño de Catálogos',
    specialtyCode: EDITORIAL,
    weight: 0.75,
    mappingType: 'PRIMARY',
    rationale: 'Catálogo como entregable editorial',
  },
  // Gráfico
  {
    skillKey: 'ilustracion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Ilustración',
    specialtyCode: GRAPHIC,
    weight: 0.75,
    mappingType: 'PRIMARY',
    rationale: 'Ilustración aplicada → gráfico',
  },
  {
    skillKey: 'ilustracion_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Ilustración digital',
    specialtyCode: GRAPHIC,
    weight: 0.75,
    mappingType: 'PRIMARY',
    rationale: 'Ilustración digital → gráfico',
  },
  {
    skillKey: 'retoque_fotografico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Retoque fotográfico',
    specialtyCode: GRAPHIC,
    weight: 0.65,
    mappingType: 'PRIMARY',
    rationale: 'Retoque → gráfico',
  },
  {
    skillKey: 'retoque_de_imagenes',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Retoque de imágenes',
    specialtyCode: GRAPHIC,
    weight: 0.65,
    mappingType: 'PRIMARY',
    rationale: 'Retoque → gráfico',
  },
  {
    skillKey: 'maquetacion_publicitaria',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Maquetación Publicitaria',
    specialtyCode: GRAPHIC,
    weight: 0.8,
    mappingType: 'PRIMARY',
    rationale: 'Maquetación publicitaria ≠ editorial puro',
  },
  // InDesign bare alias (mismos pesos que adobe_indesign en 1.1.0)
  {
    skillKey: 'indesign',
    skillType: 'TOOL',
    skillName: 'InDesign',
    specialtyCode: EDITORIAL,
    weight: 0.2,
    mappingType: 'PRIMARY',
    rationale: 'Alias tool InDesign → editorial apoyo',
  },
  {
    skillKey: 'indesign',
    skillType: 'TOOL',
    skillName: 'InDesign',
    specialtyCode: DIGITAL,
    weight: 0.15,
    mappingType: 'SECONDARY',
    rationale: 'Alias tool InDesign → digital débil',
  },
];

export const MC_VISUAL_DESIGN_MAPPING_PACK_V120: McDomainMappingPack = {
  domainCode: MC_VISUAL_DESIGN_DOMAIN_CODE,
  sourceRef: 'docs/mc1.11.0-visual-domain-operational-audit.md',
  classifications: [
    ...MC_VISUAL_DESIGN_MAPPING_PACK_V110.classifications,
    ...V120_EXTRA_CLASSIFICATIONS,
  ],
  mappings: [
    ...MC_VISUAL_DESIGN_MAPPING_PACK_V110.mappings,
    ...V120_EXTRA_MAPPINGS,
  ],
};
