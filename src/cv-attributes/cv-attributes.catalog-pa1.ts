import {
  CV_ATTRIBUTE_CATALOG_CODE,
  CV_ATTRIBUTE_CATALOG_VERSION,
  DEFAULT_TARGET_SUPPORTING_SKILLS,
} from './cv-attributes.constants';
import type { AttributeMappingType } from './cv-attributes.types';

export interface Pa1MacroDefinition {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
}

export interface Pa1SubDefinition {
  code: string;
  macroCode: string;
  name: string;
  description: string;
  sortOrder: number;
  minimumSupportingSkills?: number;
}

/**
 * Mapping declarado por clave estable de skill del catálogo cv_skill.
 * `skillKey` + `skillType` identifican la skill (uq_cv_skill_key_type);
 * el seed resuelve el skill_id real y falla si no existe.
 */
export interface Pa1MappingDefinition {
  skillKey: string;
  skillType: string;
  skillName: string;
  subCode: string;
  weight: number;
  mappingType: AttributeMappingType;
  rationale: string;
}

export const PA1_CATALOG_CODE = CV_ATTRIBUTE_CATALOG_CODE;
export const PA1_CATALOG_VERSION = CV_ATTRIBUTE_CATALOG_VERSION;
export const PA1_CATALOG_NAME = 'Atributos profesionales';
export const PA1_CATALOG_DESCRIPTION =
  'Catálogo inicial de macroatributos y subatributos profesionales para el ' +
  'Attribute Engine determinista (Fase E6). Los resultados describen respaldo ' +
  'de evidencia observada, no dominio ni nivel profesional.';

export const PA1_MACROS: Pa1MacroDefinition[] = [
  {
    code: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Capacidad técnica y digital',
    description:
      'Respaldo de evidencia en construcción, operación y uso de herramientas ' +
      'técnicas y digitales.',
    sortOrder: 1,
  },
  {
    code: 'MANAGEMENT_EXECUTION',
    name: 'Gestión y ejecución',
    description:
      'Respaldo de evidencia en planificación, gestión de procesos, cambio y ' +
      'ejecución orientada a resultados.',
    sortOrder: 2,
  },
  {
    code: 'COMMUNICATION_INFLUENCE',
    name: 'Comunicación e influencia',
    description:
      'Respaldo de evidencia en comunicación escrita, oral, audiovisual y ' +
      'relación con audiencias.',
    sortOrder: 3,
  },
  {
    code: 'COLLABORATION_LEADERSHIP',
    name: 'Colaboración y liderazgo',
    description:
      'Respaldo de evidencia en trabajo con otros, coordinación, facilitación ' +
      'y manejo de conflictos.',
    sortOrder: 4,
  },
  {
    code: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Conocimiento funcional',
    description:
      'Respaldo de evidencia en dominios funcionales concretos del negocio.',
    sortOrder: 5,
  },
];

export const PA1_SUBS: Pa1SubDefinition[] = [
  // TECHNICAL_DIGITAL_CAPABILITY
  {
    code: 'SOFTWARE_DEVELOPMENT',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Desarrollo de software',
    description: 'Construcción de software, lenguajes y frameworks.',
    sortOrder: 1,
  },
  {
    code: 'DATA_DATABASES',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Datos y bases de datos',
    description: 'Modelado, consulta y análisis de datos.',
    sortOrder: 2,
  },
  {
    code: 'INFRASTRUCTURE_DEPLOYMENT',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Infraestructura y despliegue',
    description: 'Infraestructura, entornos y despliegue de soluciones.',
    sortOrder: 3,
  },
  {
    code: 'DIGITAL_TOOLS',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Herramientas digitales',
    description: 'Uso de plataformas y herramientas digitales de trabajo.',
    sortOrder: 4,
  },
  {
    code: 'AUDIOVISUAL_PRODUCTION',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Producción audiovisual',
    description: 'Grabación, edición y postproducción de material audiovisual.',
    sortOrder: 5,
  },
  {
    code: 'CONTENT_CREATION_DESIGN',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Creación de contenido y diseño',
    description: 'Concepción y diseño de piezas de contenido.',
    sortOrder: 6,
  },
  {
    code: 'AUTOMATION_QUALITY',
    macroCode: 'TECHNICAL_DIGITAL_CAPABILITY',
    name: 'Automatización y calidad',
    description: 'Automatización de tareas y aseguramiento de calidad.',
    sortOrder: 7,
  },

  // MANAGEMENT_EXECUTION
  {
    code: 'PROJECT_MANAGEMENT',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Gestión de proyectos',
    description: 'Planificación y seguimiento de proyectos.',
    sortOrder: 1,
  },
  {
    code: 'PROCESS_MANAGEMENT',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Gestión de procesos',
    description: 'Diseño, operación y mejora de procesos.',
    sortOrder: 2,
  },
  {
    code: 'ORGANIZATION_PLANNING',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Organización y planificación',
    description: 'Organización del trabajo y planificación de actividades.',
    sortOrder: 3,
  },
  {
    code: 'CHANGE_MANAGEMENT',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Gestión del cambio',
    description: 'Acompañamiento de cambios organizacionales.',
    sortOrder: 4,
  },
  {
    code: 'RESULTS_ORIENTATION',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Orientación a resultados',
    description: 'Ejecución orientada a metas y resultados medibles.',
    sortOrder: 5,
  },
  {
    code: 'PROBLEM_SOLVING',
    macroCode: 'MANAGEMENT_EXECUTION',
    name: 'Resolución de problemas',
    description: 'Análisis y resolución de problemas de trabajo.',
    sortOrder: 6,
  },

  // COMMUNICATION_INFLUENCE
  {
    code: 'WRITTEN_COMMUNICATION',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Comunicación escrita',
    description: 'Producción de textos, guiones y piezas escritas.',
    sortOrder: 1,
  },
  {
    code: 'ORAL_COMMUNICATION',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Comunicación oral',
    description: 'Expresión oral, locución y conducción de conversaciones.',
    sortOrder: 2,
  },
  {
    code: 'PRESENTATION_SPOKESPERSONSHIP',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Presentación y vocería',
    description: 'Presentación ante audiencias y representación pública.',
    sortOrder: 3,
  },
  {
    code: 'AUDIOVISUAL_COMMUNICATION',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Comunicación audiovisual',
    description: 'Comunicación mediante formatos audiovisuales.',
    sortOrder: 4,
  },
  {
    code: 'AUDIENCE_RELATIONSHIP',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Relación con audiencias',
    description: 'Interacción y construcción de relación con audiencias.',
    sortOrder: 5,
  },
  {
    code: 'NEGOTIATION_PERSUASION',
    macroCode: 'COMMUNICATION_INFLUENCE',
    name: 'Negociación y persuasión',
    description: 'Negociación de acuerdos e influencia argumentada.',
    sortOrder: 6,
  },

  // COLLABORATION_LEADERSHIP
  {
    code: 'TEAMWORK',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Trabajo en equipo',
    description: 'Colaboración efectiva dentro de equipos de trabajo.',
    sortOrder: 1,
  },
  {
    code: 'LEADERSHIP',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Liderazgo',
    description: 'Conducción de personas y equipos.',
    sortOrder: 2,
  },
  {
    code: 'TEAM_COORDINATION',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Coordinación de equipos',
    description: 'Coordinación operativa entre personas y áreas.',
    sortOrder: 3,
  },
  {
    code: 'ADAPTABILITY',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Adaptabilidad',
    description: 'Ajuste a contextos y condiciones cambiantes.',
    sortOrder: 4,
  },
  {
    code: 'FACILITATION',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Facilitación',
    description: 'Facilitación de espacios de trabajo colectivo.',
    sortOrder: 5,
  },
  {
    code: 'CONFLICT_MANAGEMENT',
    macroCode: 'COLLABORATION_LEADERSHIP',
    name: 'Manejo de conflictos',
    description: 'Abordaje y resolución de conflictos interpersonales.',
    sortOrder: 6,
  },

  // FUNCTIONAL_DOMAIN_KNOWLEDGE
  {
    code: 'MARKETING_SOCIAL_MEDIA',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Marketing y redes sociales',
    description: 'Marketing, estrategia digital y gestión de redes sociales.',
    sortOrder: 1,
  },
  {
    code: 'ACADEMIC_MANAGEMENT',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Gestión académica',
    description: 'Procesos académicos y docentes.',
    sortOrder: 2,
  },
  {
    code: 'OPERATIONS',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Operaciones',
    description: 'Operación de servicios y logística.',
    sortOrder: 3,
  },
  {
    code: 'CUSTOMER_SERVICE',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Servicio al cliente',
    description: 'Atención y acompañamiento de clientes o usuarios.',
    sortOrder: 4,
  },
  {
    code: 'ADMINISTRATIVE_MANAGEMENT',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Gestión administrativa',
    description: 'Gestión administrativa y documental.',
    sortOrder: 5,
  },
  {
    code: 'COMMERCIAL_MANAGEMENT',
    macroCode: 'FUNCTIONAL_DOMAIN_KNOWLEDGE',
    name: 'Gestión comercial',
    description: 'Gestión comercial y ventas.',
    sortOrder: 6,
  },
];

/**
 * Seed inicial acotado a las skills presentes en extractionId=201.
 * La suma de weights por skill es <= 1 (validado en servicio y en tests).
 * Las skills sin correspondencia inequívoca quedan deliberadamente sin mapping
 * y se reportan como UNMAPPED_SKILL en cada run.
 */
export const PA1_MAPPINGS: Pa1MappingDefinition[] = [
  // Presentación
  {
    skillKey: 'presentacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Presentación',
    subCode: 'PRESENTATION_SPOKESPERSONSHIP',
    weight: 0.6,
    mappingType: 'DIRECT',
    rationale: 'Presentar ante audiencia es el contenido central del subatributo.',
  },
  {
    skillKey: 'presentacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Presentación',
    subCode: 'ORAL_COMMUNICATION',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Presentar exige expresión oral sostenida.',
  },
  {
    skillKey: 'presentacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Presentación',
    subCode: 'AUDIOVISUAL_COMMUNICATION',
    weight: 0.15,
    mappingType: 'SUPPORTING',
    rationale: 'La presentación observada ocurre en formatos audiovisuales.',
  },

  // Locución
  {
    skillKey: 'locucion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Locución',
    subCode: 'ORAL_COMMUNICATION',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'La locución es uso profesional de la voz.',
  },
  {
    skillKey: 'locucion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Locución',
    subCode: 'AUDIOVISUAL_COMMUNICATION',
    weight: 0.45,
    mappingType: 'SUPPORTING',
    rationale: 'La locución se materializa en piezas audiovisuales.',
  },

  // Actuación
  {
    skillKey: 'actuacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Actuación',
    subCode: 'AUDIOVISUAL_COMMUNICATION',
    weight: 0.6,
    mappingType: 'DIRECT',
    rationale: 'La actuación registrada comunica mediante formato audiovisual.',
  },
  {
    skillKey: 'actuacion',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Actuación',
    subCode: 'CONTENT_CREATION_DESIGN',
    weight: 0.4,
    mappingType: 'SUPPORTING',
    rationale: 'Actuar aporta a la construcción de la pieza de contenido.',
  },

  // Creación de guiones
  {
    skillKey: 'creacion_de_guiones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Creación de guiones',
    subCode: 'WRITTEN_COMMUNICATION',
    weight: 0.4,
    mappingType: 'DIRECT',
    rationale: 'El guion es una pieza escrita.',
  },
  {
    skillKey: 'creacion_de_guiones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Creación de guiones',
    subCode: 'CONTENT_CREATION_DESIGN',
    weight: 0.35,
    mappingType: 'DIRECT',
    rationale: 'El guion define la pieza de contenido a producir.',
  },
  {
    skillKey: 'creacion_de_guiones',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Creación de guiones',
    subCode: 'AUDIOVISUAL_PRODUCTION',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'El guion es insumo directo de la producción audiovisual.',
  },

  // Edición audiovisual
  {
    skillKey: 'edicion_audiovisual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Edición audiovisual',
    subCode: 'AUDIOVISUAL_PRODUCTION',
    weight: 0.6,
    mappingType: 'DIRECT',
    rationale: 'La edición es la etapa central de la producción audiovisual.',
  },
  {
    skillKey: 'edicion_audiovisual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Edición audiovisual',
    subCode: 'CONTENT_CREATION_DESIGN',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Editar define la forma final de la pieza de contenido.',
  },
  {
    skillKey: 'edicion_audiovisual',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Edición audiovisual',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.15,
    mappingType: 'CONTEXTUAL',
    rationale: 'La edición se realiza con herramientas digitales.',
  },

  // Instagram
  {
    skillKey: 'instagram',
    skillType: 'TOOL',
    skillName: 'Instagram',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.5,
    mappingType: 'DIRECT',
    rationale: 'Instagram es canal central de gestión de redes sociales.',
  },
  {
    skillKey: 'instagram',
    skillType: 'TOOL',
    skillName: 'Instagram',
    subCode: 'AUDIENCE_RELATIONSHIP',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Operar el canal implica interacción con la audiencia.',
  },
  {
    skillKey: 'instagram',
    skillType: 'TOOL',
    skillName: 'Instagram',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Uso operativo de una plataforma digital.',
  },

  // Facebook
  {
    skillKey: 'facebook',
    skillType: 'TOOL',
    skillName: 'Facebook',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.5,
    mappingType: 'DIRECT',
    rationale: 'Facebook es canal de gestión de redes sociales.',
  },
  {
    skillKey: 'facebook',
    skillType: 'TOOL',
    skillName: 'Facebook',
    subCode: 'AUDIENCE_RELATIONSHIP',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Operar el canal implica interacción con la audiencia.',
  },
  {
    skillKey: 'facebook',
    skillType: 'TOOL',
    skillName: 'Facebook',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Uso operativo de una plataforma digital.',
  },

  // TikTok
  {
    skillKey: 'tiktok',
    skillType: 'TOOL',
    skillName: 'TikTok',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.45,
    mappingType: 'DIRECT',
    rationale: 'TikTok es canal de gestión de redes sociales.',
  },
  {
    skillKey: 'tiktok',
    skillType: 'TOOL',
    skillName: 'TikTok',
    subCode: 'AUDIOVISUAL_COMMUNICATION',
    weight: 0.3,
    mappingType: 'SUPPORTING',
    rationale: 'El formato nativo del canal es video corto.',
  },
  {
    skillKey: 'tiktok',
    skillType: 'TOOL',
    skillName: 'TikTok',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.25,
    mappingType: 'SUPPORTING',
    rationale: 'Uso operativo de una plataforma digital.',
  },

  // Estrategia Digital
  {
    skillKey: 'estrategia_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategia Digital',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.6,
    mappingType: 'DIRECT',
    rationale: 'La estrategia digital pertenece al dominio de marketing digital.',
  },
  {
    skillKey: 'estrategia_digital',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Estrategia Digital',
    subCode: 'ORGANIZATION_PLANNING',
    weight: 0.4,
    mappingType: 'SUPPORTING',
    rationale: 'Definir estrategia implica planificación.',
  },

  // Gestión de redes sociales
  {
    skillKey: 'gestion_de_redes_sociales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de redes sociales',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'Corresponde directamente al subatributo funcional.',
  },
  {
    skillKey: 'gestion_de_redes_sociales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de redes sociales',
    subCode: 'AUDIENCE_RELATIONSHIP',
    weight: 0.3,
    mappingType: 'SUPPORTING',
    rationale: 'Gestionar canales implica relación con la comunidad.',
  },
  {
    skillKey: 'gestion_de_redes_sociales',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión de redes sociales',
    subCode: 'PROCESS_MANAGEMENT',
    weight: 0.15,
    mappingType: 'CONTEXTUAL',
    rationale: 'La gestión de canales supone un proceso recurrente de publicación.',
  },

  // Investigación de mercados
  {
    skillKey: 'investigacion_de_mercados',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Investigación de mercados',
    subCode: 'MARKETING_SOCIAL_MEDIA',
    weight: 0.7,
    mappingType: 'DIRECT',
    rationale: 'La investigación de mercados es conocimiento funcional de marketing.',
  },

  // Comunicación Estratégica
  {
    skillKey: 'comunicacion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Comunicación Estratégica',
    subCode: 'WRITTEN_COMMUNICATION',
    weight: 0.35,
    mappingType: 'DIRECT',
    rationale: 'La comunicación estratégica se materializa en piezas escritas.',
  },
  {
    skillKey: 'comunicacion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Comunicación Estratégica',
    subCode: 'AUDIENCE_RELATIONSHIP',
    weight: 0.35,
    mappingType: 'SUPPORTING',
    rationale: 'Requiere segmentar y dirigirse a audiencias definidas.',
  },
  {
    skillKey: 'comunicacion_estrategica',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Comunicación Estratégica',
    subCode: 'ORGANIZATION_PLANNING',
    weight: 0.3,
    mappingType: 'CONTEXTUAL',
    rationale: 'Supone planificar mensajes y canales.',
  },

  // Gestión del cambio
  {
    skillKey: 'gestion_del_cambio',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Gestión del cambio',
    subCode: 'CHANGE_MANAGEMENT',
    weight: 1.0,
    mappingType: 'DIRECT',
    rationale: 'Correspondencia uno a uno con el subatributo.',
  },

  // Diseño Gráfico
  {
    skillKey: 'diseno_grafico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Gráfico',
    subCode: 'CONTENT_CREATION_DESIGN',
    weight: 0.7,
    mappingType: 'DIRECT',
    rationale: 'El diseño gráfico es diseño de piezas de contenido.',
  },
  {
    skillKey: 'diseno_grafico',
    skillType: 'PROFESSIONAL_KNOWLEDGE',
    skillName: 'Diseño Gráfico',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.3,
    mappingType: 'SUPPORTING',
    rationale: 'Se ejecuta con herramientas digitales de diseño.',
  },

  // Canva
  {
    skillKey: 'canva',
    skillType: 'TOOL',
    skillName: 'Canva',
    subCode: 'CONTENT_CREATION_DESIGN',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'Canva es herramienta de diseño de piezas de contenido.',
  },
  {
    skillKey: 'canva',
    skillType: 'TOOL',
    skillName: 'Canva',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.45,
    mappingType: 'SUPPORTING',
    rationale: 'Uso de herramienta digital.',
  },

  // CapCut
  {
    skillKey: 'capcut',
    skillType: 'TOOL',
    skillName: 'CapCut',
    subCode: 'AUDIOVISUAL_PRODUCTION',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'CapCut es editor de video.',
  },
  {
    skillKey: 'capcut',
    skillType: 'TOOL',
    skillName: 'CapCut',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.45,
    mappingType: 'SUPPORTING',
    rationale: 'Uso de herramienta digital.',
  },

  // Clipchamp
  {
    skillKey: 'clipchamp',
    skillType: 'TOOL',
    skillName: 'Clipchamp',
    subCode: 'AUDIOVISUAL_PRODUCTION',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'Clipchamp es editor de video.',
  },
  {
    skillKey: 'clipchamp',
    skillType: 'TOOL',
    skillName: 'Clipchamp',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.45,
    mappingType: 'SUPPORTING',
    rationale: 'Uso de herramienta digital.',
  },

  // InShot
  {
    skillKey: 'inshot',
    skillType: 'TOOL',
    skillName: 'InShot',
    subCode: 'AUDIOVISUAL_PRODUCTION',
    weight: 0.55,
    mappingType: 'DIRECT',
    rationale: 'InShot es editor de video.',
  },
  {
    skillKey: 'inshot',
    skillType: 'TOOL',
    skillName: 'InShot',
    subCode: 'DIGITAL_TOOLS',
    weight: 0.45,
    mappingType: 'SUPPORTING',
    rationale: 'Uso de herramienta digital.',
  },

  // Soft skills con correspondencia inequívoca
  {
    skillKey: 'trabajo_en_equipo',
    skillType: 'SOFT_SKILL',
    skillName: 'Trabajo en equipo',
    subCode: 'TEAMWORK',
    weight: 1.0,
    mappingType: 'DIRECT',
    rationale: 'Correspondencia uno a uno con el subatributo.',
  },
  {
    skillKey: 'adaptabilidad',
    skillType: 'SOFT_SKILL',
    skillName: 'Adaptabilidad',
    subCode: 'ADAPTABILITY',
    weight: 1.0,
    mappingType: 'DIRECT',
    rationale: 'Correspondencia uno a uno con el subatributo.',
  },
  {
    skillKey: 'resolucion_de_conflictos',
    skillType: 'SOFT_SKILL',
    skillName: 'Resolución de conflictos',
    subCode: 'CONFLICT_MANAGEMENT',
    weight: 1.0,
    mappingType: 'DIRECT',
    rationale: 'Correspondencia uno a uno con el subatributo.',
  },
  {
    skillKey: 'comunicacion_efectiva',
    skillType: 'SOFT_SKILL',
    skillName: 'Comunicación efectiva',
    subCode: 'ORAL_COMMUNICATION',
    weight: 0.5,
    mappingType: 'DIRECT',
    rationale: 'Cubre la dimensión oral de la comunicación.',
  },
  {
    skillKey: 'comunicacion_efectiva',
    skillType: 'SOFT_SKILL',
    skillName: 'Comunicación efectiva',
    subCode: 'WRITTEN_COMMUNICATION',
    weight: 0.5,
    mappingType: 'DIRECT',
    rationale: 'Cubre la dimensión escrita de la comunicación.',
  },
];

/**
 * Skills del perfil piloto deliberadamente sin mapping en pa1.
 * Se documentan aquí para que el UNMAPPED sea una decisión trazable y no un olvido.
 */
export const PA1_INTENTIONAL_UNMAPPED: Array<{
  skillKey: string;
  skillType: string;
  skillName: string;
  reason: string;
  /**
   * Subatributos a los que la skill es temáticamente cercana. No genera
   * contribución; solo activa HAS_UNMAPPED_RELATED_SKILLS para que el resultado
   * declare que existe una skill cercana deliberadamente no mapeada.
   */
  relatedSubCodes: string[];
}> = [
  {
    skillKey: 'creatividad',
    skillType: 'SOFT_SKILL',
    skillName: 'Creatividad',
    reason:
      'Ningún subatributo de pa1 corresponde de forma inequívoca a creatividad ' +
      'como atributo transversal; mapearla a diseño o resolución de problemas ' +
      'sería un mapping forzado.',
    relatedSubCodes: ['CONTENT_CREATION_DESIGN', 'PROBLEM_SOLVING'],
  },
];

export const PA1_DEFAULT_TARGET_SUPPORTING_SKILLS =
  DEFAULT_TARGET_SUPPORTING_SKILLS;
