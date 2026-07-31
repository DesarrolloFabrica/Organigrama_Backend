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
export const MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE = 'OPERATIONS_MANAGEMENT';
export const MC_TALENT_MANAGEMENT_DOMAIN_CODE = 'TALENT_MANAGEMENT';
export const MC_EDUCATION_MANAGEMENT_DOMAIN_CODE = 'EDUCATION_MANAGEMENT';
export const MC_MARKETING_MANAGEMENT_DOMAIN_CODE = 'MARKETING_MANAGEMENT';

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
    {
      code: MC_OPERATIONS_MANAGEMENT_DOMAIN_CODE,
      name: 'Gestión de Operaciones',
      description:
        'Práctica profesional de operar, mejorar y controlar servicios y ' +
        'procesos (incl. operación académica). Taxonomía de 5 especialidades ' +
        'OPS_* (curación ChatGPT; sin scaffold OPS_GENERAL).',
      sortOrder: 4,
      specialties: [
        {
          code: 'OPS_ACADEMIC',
          name: 'Operaciones Académicas',
          purpose:
            'Planificar y ejecutar la operación académica del ciclo lectivo.',
          description:
            'Planeación, gestión y programación académica, registro de notas y syllabus.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'OPS_QUALITY',
          name: 'Calidad Académica',
          purpose:
            'Asegurar calidad académica, normativa y cumplimiento institucional.',
          description:
            'Control de calidad académica, normativa educativa, aseguramiento de ' +
            'la calidad y cumplimiento institucional.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'OPS_PROCESS',
          name: 'Procesos e Innovación',
          purpose:
            'Transformar y automatizar procesos con proyectos y mejora continua.',
          description:
            'Transformación digital, automatización de procesos, gestión de ' +
            'proyectos y mejora continua.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'OPS_ANALYTICS',
          name: 'Analítica Operativa',
          purpose:
            'Medir operación con indicadores, datos y decisiones basadas en evidencia.',
          description:
            'Indicadores, KPIs, análisis de datos y decisión data-driven.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'OPS_COORDINATION',
          name: 'Liderazgo Operativo',
          purpose:
            'Liderar equipos y coordinar la operación con foco en permanencia.',
          description:
            'Liderazgo de equipos, coordinación operativa, gestión estratégica y ' +
            'permanencia estudiantil.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
        },
      ],
    },
    {
      code: MC_TALENT_MANAGEMENT_DOMAIN_CODE,
      name: 'Gestión del Talento',
      description:
        'Práctica profesional orientada a planificar, desarrollar, administrar ' +
        'y optimizar el talento humano mediante procesos estratégicos de ' +
        'selección, desarrollo organizacional, desempeño, cumplimiento, ' +
        'calidad y analítica. Estructura semántica entregada por curaduría ' +
        'manual (ChatGPT); sin scaffolds.',
      sortOrder: 5,
      specialties: [
        {
          code: 'TM_TALENT',
          name: 'Gestión del Talento',
          purpose:
            'Seleccionar, incorporar, evaluar y desarrollar personas mediante ' +
            'procesos de talento.',
          description:
            'Especialidad nuclear de ciclo de talento (selección, contratación, ' +
            'onboarding, desempeño, competencias).',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'TM_ORGANIZATIONAL_DEVELOPMENT',
          name: 'Desarrollo Organizacional',
          purpose:
            'Diseñar y evolucionar la organización y el sistema de talento.',
          description:
            'Desarrollo organizacional, planeación estratégica del talento y ' +
            'modelos como holocracia.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'TM_QUALITY_COMPLIANCE',
          name: 'Calidad y Cumplimiento',
          purpose:
            'Asegurar calidad, SST, auditoría y cumplimiento normativo en TH.',
          description:
            'SGC, ISO 9001, SG-SST, HSEQ, riesgos y cumplimiento.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'TM_PEOPLE_ANALYTICS',
          name: 'Analítica del Talento',
          purpose:
            'Medir y visualizar el talento con indicadores y analítica.',
          description:
            'Analítica de talento, indicadores y visualización de datos de TH. ' +
            'Herramientas/tech listadas aparte no son ejes.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'TM_STRATEGIC_LEADERSHIP',
          name: 'Dirección Estratégica',
          purpose:
            'Dirigir y acompañar la estrategia administrativa y de talento.',
          description:
            'Liderazgo operativo, dirección administrativa, optimización ' +
            'organizacional y acompañamiento a alta dirección.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
        },
      ],
    },
    {
      code: MC_EDUCATION_MANAGEMENT_DOMAIN_CODE,
      name: 'Gestión Educativa',
      description:
        'Práctica profesional orientada a planificar, coordinar, evaluar y ' +
        'mejorar procesos educativos. Taxonomía de 5 especialidades (programas, ' +
        'currículo, calidad, docencia/innovación y liderazgo académico). ' +
        'Curación ChatGPT; sin scaffolds.',
      sortOrder: 6,
      specialties: [
        {
          code: 'EM_ACADEMIC_PROGRAMS',
          name: 'Gestión de Programas Académicos',
          purpose:
            'Dirigir y administrar programas, escuelas y gestión académica.',
          description:
            'Dirección de programas, gestión/coordinación académica, ' +
            'administración educativa y gestión de escuelas.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'EM_CURRICULUM_DESIGN',
          name: 'Diseño Curricular',
          purpose:
            'Diseñar, actualizar e innovar el currículo y la transformación educativa.',
          description:
            'Diseño curricular, syllabus, innovación curricular, diseño por ' +
            'competencias y transformación educativa.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'EM_ACADEMIC_QUALITY',
          name: 'Calidad Académica',
          purpose:
            'Asegurar calidad, registro calificado y cumplimiento normativo.',
          description:
            'Registro calificado, aseguramiento de calidad, cumplimiento, ' +
            'pares académicos y gestión documental académica.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'EM_TEACHING_INNOVATION',
          name: 'Docencia e Innovación',
          purpose:
            'Impulsar docencia virtual, evaluación y tecnología educativa.',
          description:
            'Docencia virtual, evaluación por competencias, tecnología educativa, ' +
            'acompañamiento pedagógico y aprendizaje remoto.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'EM_ACADEMIC_LEADERSHIP',
          name: 'Liderazgo Académico',
          purpose:
            'Liderar equipos docentes, seguimiento y atención al estudiante.',
          description:
            'Liderazgo estratégico, equipos docentes, seguimiento docente, ' +
            'atención integral al estudiante y planeación académica.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
        },
      ],
    },
    {
      code: MC_MARKETING_MANAGEMENT_DOMAIN_CODE,
      name: 'Marketing Estratégico',
      description:
        'Dirección y optimización de estrategias de mercado, posicionamiento, ' +
        'crecimiento, audiencias y canales mediante marketing digital, ' +
        'campañas omnicanal y analítica. Estructura semántica entregada por ' +
        'curaduría manual (ChatGPT); sin scaffolds.',
      sortOrder: 7,
      specialties: [
        {
          code: 'MM_MARKETING_STRATEGY',
          name: 'Estrategia de Marketing',
          purpose:
            'Planificar y dirigir la estrategia de marketing y posicionamiento.',
          description:
            'Planeación estratégica, dirección de marketing, estrategia de ' +
            'mercado, posicionamiento y orientación a resultados.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 1,
        },
        {
          code: 'MM_DIGITAL_OMNICHANNEL',
          name: 'Marketing Digital y Omnicanal',
          purpose:
            'Ejecutar marketing digital, omnicanal y publicidad en canales.',
          description:
            'Marketing digital/omnicanal, campañas, SEO, SEM y publicidad digital.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 2,
        },
        {
          code: 'MM_GROWTH_AUDIENCE',
          name: 'Crecimiento y Gestión de Audiencias',
          purpose:
            'Hacer crecer tráfico, audiencias, suscripciones y conversión.',
          description:
            'Tráfico web, audiencias, suscripciones, conversión y UX.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 3,
        },
        {
          code: 'MM_MARKETING_ANALYTICS',
          name: 'Analítica de Marketing',
          purpose:
            'Medir y analizar resultados de marketing y canales digitales.',
          description:
            'Analítica de marketing, seguimiento de campañas, medición de ' +
            'audiencias y análisis de canales.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 4,
        },
        {
          code: 'MM_INNOVATION_EXPERIENCE',
          name: 'Innovación y Experiencias de Marca',
          purpose:
            'Diseñar experiencias inmersivas e innovación de marca.',
          description:
            'Experiencias inmersivas, educación entretenida, creatividad y UX.',
          lifecycleStatus: 'ACTIVE',
          sortOrder: 5,
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

/** Taxonomía OPS_* (5 ejes) — reemplaza scaffold OPS_GENERAL. */
export const MC_OPERATIONS_MANAGEMENT_SPECIALTY_CODES = [
  'OPS_ACADEMIC',
  'OPS_QUALITY',
  'OPS_PROCESS',
  'OPS_ANALYTICS',
  'OPS_COORDINATION',
] as const;

export type McOperationsManagementSpecialtyCode =
  (typeof MC_OPERATIONS_MANAGEMENT_SPECIALTY_CODES)[number];

export const MC_TALENT_MANAGEMENT_SPECIALTY_CODES = [
  'TM_TALENT',
  'TM_ORGANIZATIONAL_DEVELOPMENT',
  'TM_QUALITY_COMPLIANCE',
  'TM_PEOPLE_ANALYTICS',
  'TM_STRATEGIC_LEADERSHIP',
] as const;

export type McTalentManagementSpecialtyCode =
  (typeof MC_TALENT_MANAGEMENT_SPECIALTY_CODES)[number];

export const MC_EDUCATION_MANAGEMENT_SPECIALTY_CODES = [
  'EM_ACADEMIC_PROGRAMS',
  'EM_CURRICULUM_DESIGN',
  'EM_ACADEMIC_QUALITY',
  'EM_TEACHING_INNOVATION',
  'EM_ACADEMIC_LEADERSHIP',
] as const;

export type McEducationManagementSpecialtyCode =
  (typeof MC_EDUCATION_MANAGEMENT_SPECIALTY_CODES)[number];

export const MC_MARKETING_MANAGEMENT_SPECIALTY_CODES = [
  'MM_MARKETING_STRATEGY',
  'MM_DIGITAL_OMNICHANNEL',
  'MM_GROWTH_AUDIENCE',
  'MM_MARKETING_ANALYTICS',
  'MM_INNOVATION_EXPERIENCE',
] as const;

export type McMarketingManagementSpecialtyCode =
  (typeof MC_MARKETING_MANAGEMENT_SPECIALTY_CODES)[number];

/** Orden canónico de ejes del radar por dominio (FE / metadatos). */
export const MC_DOMAIN_RADAR_AXIS_ORDER: Record<string, readonly string[]> = {
  SOFTWARE: MC_SOFTWARE_SPECIALTY_CODES,
  VISUAL_DESIGN: MC_VISUAL_DESIGN_SPECIALTY_CODES,
  AUDIOVISUAL_PRODUCTION: MC_AUDIOVISUAL_PRODUCTION_SPECIALTY_CODES,
  OPERATIONS_MANAGEMENT: MC_OPERATIONS_MANAGEMENT_SPECIALTY_CODES,
  TALENT_MANAGEMENT: MC_TALENT_MANAGEMENT_SPECIALTY_CODES,
  EDUCATION_MANAGEMENT: MC_EDUCATION_MANAGEMENT_SPECIALTY_CODES,
  MARKETING_MANAGEMENT: MC_MARKETING_MANAGEMENT_SPECIALTY_CODES,
};
