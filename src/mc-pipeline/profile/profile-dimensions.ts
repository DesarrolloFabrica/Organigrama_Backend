/**
 * Dimensiones 8C (v0) — códigos y labels para ensamblaje de perfil.
 * No modifica taxonomía Field/Specialty/Skill.
 */

export type DimensionDef = {
  code: string;
  label: string;
  fieldCode: string;
};

export const PROFILE_DIMENSIONS_VERSION = '8C.5';

export const DIMENSIONS_BY_FIELD: Record<string, DimensionDef[]> = {
  VISUAL_DESIGN: [
    {
      code: 'VD_VISUAL_COMMUNICATION',
      label: 'Comunicación visual',
      fieldCode: 'VISUAL_DESIGN',
    },
    {
      code: 'VD_BRAND_SYSTEMS',
      label: 'Sistemas de marca',
      fieldCode: 'VISUAL_DESIGN',
    },
    {
      code: 'VD_EDITORIAL',
      label: 'Editorial / publicación',
      fieldCode: 'VISUAL_DESIGN',
    },
    {
      code: 'VD_PRODUCT_INTERFACE',
      label: 'Interfaz de producto',
      fieldCode: 'VISUAL_DESIGN',
    },
    {
      code: 'VD_ILLUSTRATION',
      label: 'Imagen ilustrada',
      fieldCode: 'VISUAL_DESIGN',
    },
    { code: 'VD_MOTION', label: 'Motion', fieldCode: 'VISUAL_DESIGN' },
    {
      code: 'VD_PRODUCTION_CRAFT',
      label: 'Producción visual',
      fieldCode: 'VISUAL_DESIGN',
    },
  ],
  EDUCATION: [
    {
      code: 'ED_LEARNING_DESIGN',
      label: 'Diseño de aprendizaje',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_FACILITATION',
      label: 'Facilitación / docencia',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_CURRICULUM',
      label: 'Currículo / programa',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_ASSESSMENT',
      label: 'Evaluación formativa',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_LEARNING_RESOURCES',
      label: 'Recursos de aprendizaje',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_ACADEMIC_OPS',
      label: 'Operación académica',
      fieldCode: 'EDUCATION',
    },
    {
      code: 'ED_LEARNING_ENVIRONMENTS',
      label: 'Entornos de aprendizaje',
      fieldCode: 'EDUCATION',
    },
  ],
  SOFTWARE_ENGINEERING: [
    { code: 'SE_FRONTEND', label: 'Frontend', fieldCode: 'SOFTWARE_ENGINEERING' },
    { code: 'SE_BACKEND', label: 'Backend', fieldCode: 'SOFTWARE_ENGINEERING' },
    {
      code: 'SE_DATA_STORES',
      label: 'Bases de datos',
      fieldCode: 'SOFTWARE_ENGINEERING',
    },
    {
      code: 'SE_APIS_INTEGRATION',
      label: 'APIs e integración',
      fieldCode: 'SOFTWARE_ENGINEERING',
    },
    {
      code: 'SE_CLOUD_INFRA',
      label: 'Cloud / infraestructura',
      fieldCode: 'SOFTWARE_ENGINEERING',
    },
    {
      code: 'SE_ENG_QUALITY',
      label: 'Ingeniería y calidad',
      fieldCode: 'SOFTWARE_ENGINEERING',
    },
    {
      code: 'SE_APPLIED_AI',
      label: 'IA aplicada',
      fieldCode: 'SOFTWARE_ENGINEERING',
    },
  ],
  PROJECT_PROGRAM_MGMT: [
    {
      code: 'PPM_PLANNING',
      label: 'Planificación',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_COORDINATION_EXECUTION',
      label: 'Coordinación y ejecución',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_STAKEHOLDERS',
      label: 'Stakeholders',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_RISKS',
      label: 'Riesgos',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_RESOURCES_BUDGET',
      label: 'Recursos y presupuesto',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_MONITORING_CONTROL',
      label: 'Seguimiento y control',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
    {
      code: 'PPM_IMPROVEMENT_GOVERNANCE',
      label: 'Mejora y gobernanza',
      fieldCode: 'PROJECT_PROGRAM_MGMT',
    },
  ],
  FINANCE_ADMIN: [
    {
      code: 'FA_FINANCIAL_PLANNING',
      label: 'Planeación financiera',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_FINANCIAL_CONTROL',
      label: 'Control financiero',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_ADMIN_OPS',
      label: 'Operación administrativa',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_ACCOUNTING',
      label: 'Contabilidad y conciliación',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_PROCUREMENT',
      label: 'Compras y proveedores',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_DOCUMENT_MGMT',
      label: 'Gestión documental',
      fieldCode: 'FINANCE_ADMIN',
    },
    {
      code: 'FA_REPORTING',
      label: 'Reportes y seguimiento',
      fieldCode: 'FINANCE_ADMIN',
    },
  ],
  AUDIOVISUAL_PRODUCTION: [
    {
      code: 'AV_PREPRODUCTION',
      label: 'Preproducción',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_CAPTURE',
      label: 'Captura',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_PRODUCTION_REALIZATION',
      label: 'Producción / realización',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_EDITING_MONTAGE',
      label: 'Edición / montaje',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_VISUAL_FINISHING',
      label: 'Acabado visual',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_AUDIO',
      label: 'Audio',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
    {
      code: 'AV_DELIVERY',
      label: 'Entrega / publicación',
      fieldCode: 'AUDIOVISUAL_PRODUCTION',
    },
  ],
  COMMUNICATIONS: [
    {
      code: 'COMM_MESSAGE_NARRATIVE',
      label: 'Mensaje y narrativa',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_ORAL_PRESENTATION',
      label: 'Comunicación oral / presentación',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_WRITING',
      label: 'Escritura y redacción',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_AUDIENCE_RELATIONS',
      label: 'Relación con audiencias',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_PLANNING',
      label: 'Planeación de comunicación',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_DIGITAL_CHANNELS',
      label: 'Canales digitales',
      fieldCode: 'COMMUNICATIONS',
    },
    {
      code: 'COMM_SPOKESPERSONSHIP',
      label: 'Vocería / representación',
      fieldCode: 'COMMUNICATIONS',
    },
  ],
};

export function dimensionsForField(fieldCode: string): DimensionDef[] {
  return DIMENSIONS_BY_FIELD[fieldCode] ?? [];
}
