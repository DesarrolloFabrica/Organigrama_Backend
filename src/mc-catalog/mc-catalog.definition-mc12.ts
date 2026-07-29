/**
 * Definición declarativa del catálogo MC1 v1.0 (contrato MC1.2).
 *
 * Es la fuente de datos para el seed. El runtime lee dominios/especialidades
 * desde BD (data-driven), no desde este archivo en caliente.
 *
 * No agregar / eliminar / renombrar códigos sin nueva versión de contrato.
 */

import {
  MC_CATALOG_CODE,
  MC_CATALOG_DESCRIPTION,
  MC_CATALOG_NAME,
  MC_CATALOG_VERSION,
} from './mc-catalog.constants';
import type { McCatalogDefinition } from './mc-catalog.types';

export const MC_SOFTWARE_DOMAIN_CODE = 'SOFTWARE';
export const MC_VISUAL_DESIGN_DOMAIN_CODE = 'VISUAL_DESIGN';
export const MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE = 'AUDIOVISUAL_PRODUCTION';

export const MC1_CATALOG_DEFINITION: McCatalogDefinition = {
  catalogCode: MC_CATALOG_CODE,
  catalogVersion: MC_CATALOG_VERSION,
  catalogName: MC_CATALOG_NAME,
  catalogDescription: MC_CATALOG_DESCRIPTION,
  domains: [
    {
      code: MC_SOFTWARE_DOMAIN_CODE,
      name: 'Desarrollo de Software',
      description:
        'Área de experiencia profesional: diseñar, construir, integrar, ' +
        'probar, desplegar y mejorar sistemas de software. No representa ' +
        'tecnologías individuales ni competencias transversales (MC2).',
      sortOrder: 1,
      specialties: [
        {
          code: 'SOFTWARE_FRONTEND',
          name: 'Desarrollo frontend',
          purpose:
            'Representar la capacidad de construir interfaces y experiencias ' +
            'de usuario en software.',
          description:
            'Agrupa frameworks, lenguajes y estilos usados para UI/producto ' +
            'digital. Criterio de pertenencia: la skill se usa para construir ' +
            'o estilizar interfaces; la evidencia habla de frontend, UI, ' +
            'interfaces o experiencia de usuario.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'SOFTWARE_BACKEND',
          name: 'Desarrollo backend',
          purpose:
            'Representar la construcción de lógica de servidor, servicios y ' +
            'aplicaciones del lado servidor.',
          description:
            'Agrupa runtimes, frameworks y lenguajes de servicios. Criterio ' +
            'de pertenencia: evidencia de servicios backend, APIs como parte ' +
            'de servicios o lógica de servidor.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'SOFTWARE_DATA',
          name: 'Bases de datos',
          purpose:
            'Representar modelado, consulta, administración y persistencia de datos.',
          description:
            'Agrupa motores, lenguajes de consulta y ORMs. Criterio de ' +
            'pertenencia: la skill describe almacenamiento, consulta, ' +
            'modelado u ORM de datos.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'SOFTWARE_API_INTEGRATION',
          name: 'Integración de APIs',
          purpose:
            'Representar diseño, consumo e integración de interfaces entre sistemas.',
          description:
            'Distingue la práctica de integrar/validar información vía APIs ' +
            'respecto del backend genérico. Puede presentarse como Emergente ' +
            'en perfiles con baja masa de skills (MC1.2 §5).',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'SOFTWARE_CLOUD_DEPLOY',
          name: 'Cloud y despliegue',
          purpose:
            'Representar despliegue, hospedaje y operación de software en ' +
            'entornos cloud.',
          description:
            'Agrupa proveedores cloud, servicios de entrega y contenedores ' +
            'ligados al despliegue dentro del desarrollo de software. No es ' +
            'el área futura de Infraestructura.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
        },
        {
          code: 'SOFTWARE_ENGINEERING_QUALITY',
          name: 'Ingeniería y calidad de software',
          purpose:
            'Representar prácticas de entrega, control de versiones, agilidad ' +
            'y aseguramiento de calidad.',
          description:
            'Fusiona ingeniería de entrega y calidad. Criterio de pertenencia: ' +
            'prácticas que sostienen cómo se entrega y se valida el software. ' +
            'No es DevOps completo ni QA aislado.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 6,
        },
        {
          code: 'SOFTWARE_AI_APPLIED',
          name: 'IA aplicada al desarrollo',
          purpose:
            'Representar el uso de inteligencia artificial como parte del ' +
            'trabajo de software.',
          description:
            'Agrupa conocimientos y prácticas de IA ligados a análisis, ' +
            'automatización, reportes o calidad del software. No es ' +
            'competencia transversal MC2.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 7,
        },
      ],
    },
    {
      code: MC_VISUAL_DESIGN_DOMAIN_CODE,
      name: 'Diseño Visual',
      description:
        'Disciplina orientada a la concepción, composición y producción de ' +
        'soluciones visuales para comunicar información, identidad y mensajes ' +
        'mediante piezas gráficas, interfaces y recursos digitales. No ' +
        'representa un cargo, área organizacional ni producción audiovisual ' +
        'o diseño instruccional como núcleo.',
      sortOrder: 2,
      specialties: [
        {
          code: 'VISUAL_GRAPHIC',
          name: 'Diseño gráfico',
          purpose:
            'Crear y estructurar piezas gráficas mediante composición, ' +
            'tipografía, color, jerarquía y recursos visuales.',
          description:
            'Especialidad nuclear del diseño visual. Criterio: evidencia de ' +
            'diseño gráfico, piezas visuales o herramientas gráficas aplicadas.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'VISUAL_IDENTITY',
          name: 'Identidad visual',
          purpose:
            'Crear y aplicar sistemas visuales, lineamientos gráficos, estilos ' +
            'y elementos de marca de forma coherente.',
          description:
            'Sistemas de marca e identidad. Sin evidencia suficiente permanece ' +
            'oculta o emergente; no se infiere por cargo.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'VISUAL_EDITORIAL',
          name: 'Diseño editorial',
          purpose:
            'Maquetar y organizar visualmente documentos, publicaciones, ' +
            'presentaciones y contenidos estructurados.',
          description:
            'Umbral estricto por baja evidencia típica. Criterio: diseño ' +
            'editorial o diagramación profesional.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'VISUAL_DIGITAL_ASSETS',
          name: 'Recursos visuales digitales',
          purpose:
            'Diseñar y producir assets digitales, piezas para entornos ' +
            'virtuales y recursos visuales para plataformas.',
          description:
            'Excluye pedagogía, LMS y SCORM como núcleo. Criterio: producción ' +
            'de assets visuales digitales.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'VISUAL_UI',
          name: 'Diseño de interfaces',
          purpose:
            'Crear la capa visual de interfaces digitales (composición de ' +
            'pantallas, jerarquía, prototipado visual, sistemas de diseño).',
          description:
            'Especialidad de transición. V1 sin mappings de semilla si no hay ' +
            'evidencia CV. No incluye UX Research ni service design. No ' +
            'aumenta score por cargo UX/UI.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
        },
      ],
    },
    {
      code: MC_AUDIOVISUAL_PRODUCTION_DOMAIN_CODE,
      name: 'Producción Audiovisual',
      description:
        'Disciplina de planificar, capturar, editar, animar y finalizar ' +
        'contenidos en soporte temporal (video, motion, postproducción). No ' +
        'representa diseño gráfico estático, diseño instruccional ni marketing ' +
        'como núcleo. MC1.8.1: prototipo núcleo EDITING/MOTION/POST.',
      sortOrder: 3,
      specialties: [
        {
          code: 'AV_EDITING',
          name: 'Edición de video',
          purpose:
            'Seleccionar, organizar y estructurar material audiovisual para ' +
            'construir una pieza narrativa o comunicativa coherente.',
          description:
            'Madurez metodológica inicial: EMERGENT. Diferenciada de motion, ' +
            'postproducción/color, grabación y uso aislado de NLE.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'AV_MOTION',
          name: 'Motion graphics y animación',
          purpose:
            'Animación gráfica, composición animada y elementos visuales en movimiento.',
          description:
            'Madurez metodológica inicial: EMERGENT. Diferenciada de edición ' +
            'narrativa, diseño gráfico estático y listing de After Effects sin práctica.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'AV_POST',
          name: 'Postproducción',
          purpose:
            'Corrección de color, finishing y preparación técnica final de piezas audiovisuales.',
          description:
            'Madurez metodológica inicial: EMERGENT. Diferenciada de edición ' +
            'narrativa e iluminación de rodaje.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
      ],
    },
  ],
};

/** Códigos canónicos congelados del dominio SOFTWARE (MC1.2 §3). */
export const MC_SOFTWARE_SPECIALTY_CODES = [
  'SOFTWARE_FRONTEND',
  'SOFTWARE_BACKEND',
  'SOFTWARE_DATA',
  'SOFTWARE_API_INTEGRATION',
  'SOFTWARE_CLOUD_DEPLOY',
  'SOFTWARE_ENGINEERING_QUALITY',
  'SOFTWARE_AI_APPLIED',
] as const;

export type McSoftwareSpecialtyCode =
  (typeof MC_SOFTWARE_SPECIALTY_CODES)[number];

export const MC_VISUAL_DESIGN_SPECIALTY_CODES = [
  'VISUAL_GRAPHIC',
  'VISUAL_IDENTITY',
  'VISUAL_EDITORIAL',
  'VISUAL_DIGITAL_ASSETS',
  'VISUAL_UI',
] as const;

export type McVisualDesignSpecialtyCode =
  (typeof MC_VISUAL_DESIGN_SPECIALTY_CODES)[number];

export const MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES = [
  'AV_EDITING',
  'AV_MOTION',
  'AV_POST',
] as const;

export type McAudiovisualProductionSpecialtyCode =
  (typeof MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES)[number];

/** Orden canónico de ejes del radar por dominio (FE / metadatos). */
export const MC_DOMAIN_RADAR_AXIS_ORDER: Record<string, readonly string[]> = {
  SOFTWARE: MC_SOFTWARE_SPECIALTY_CODES,
  VISUAL_DESIGN: MC_VISUAL_DESIGN_SPECIALTY_CODES,
  AUDIOVISUAL_PRODUCTION: MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES,
};
