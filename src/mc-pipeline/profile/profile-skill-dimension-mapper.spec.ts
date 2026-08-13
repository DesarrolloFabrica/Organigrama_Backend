import { mapSkillToDimensions } from './profile-skill-dimension-mapper';

function vd(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'VISUAL_DESIGN',
    parentSpecialtyCode: partial.parentSpecialtyCode ?? 'GRAPHIC_DESIGN',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions VISUAL_DESIGN (FASE 12E)', () => {
  it('guidelines ≠ Product UI (no bare /ui/)', () => {
    const m = vd({
      skillCode: 'brand_guidelines_application',
      name: 'Aplicación y gestión de lineamientos de identidad visual',
      parentSpecialtyCode: 'BRAND_IDENTITY_DESIGN',
      supportingSignals: [
        'asegurar el cumplimiento estricto de lineamientos de identidad corporativa',
        'mantener la coherencia con el key visual',
      ],
    });
    expect(m.dimensionCodes).toContain('VD_BRAND_SYSTEMS');
    expect(m.dimensionCodes).not.toContain('VD_PRODUCT_INTERFACE');
  });

  it('Suite Adobe ≠ Product UI', () => {
    const m = vd({
      skillCode: 'graphic_design_and_conceptualization',
      name: 'Conceptualización y diseño gráfico',
      supportingSignals: ['conceptualización y diseño de piezas gráficas'],
      toolOrTechnologySignals: ['Suite Adobe'],
    });
    expect(m.dimensionCodes).not.toContain('VD_PRODUCT_INTERFACE');
  });

  it('InDesign solo en tools ≠ Editorial', () => {
    const m = vd({
      skillCode: 'graphic_collateral_design',
      name: 'Graphic Collateral Design',
      supportingSignals: ['Desarrollo de piezas gráficas para campañas'],
      toolOrTechnologySignals: ['Adobe InDesign', 'Figma', 'Photoshop'],
    });
    expect(m.dimensionCodes).not.toContain('VD_EDITORIAL');
    expect(m.dimensionCodes).toContain('VD_VISUAL_COMMUNICATION');
  });

  it('Premiere/CapCut solos ≠ Motion', () => {
    const m = vd({
      skillCode: 'audiovisual_editing_and_production',
      name: 'Diseño y edición de contenidos audiovisuales',
      supportingSignals: [
        'diseño y edición de vídeos educativos',
        'creación de contenido audiovisual',
      ],
      toolOrTechnologySignals: ['CapCut', 'Premiere'],
    });
    expect(m.dimensionCodes).not.toContain('VD_MOTION');
  });

  it('Figma solo ≠ Product UI', () => {
    const m = vd({
      skillCode: 'graphic_design_production',
      name: 'Diseño y producción de piezas gráficas',
      supportingSignals: ['creación de piezas gráficas'],
      toolOrTechnologySignals: ['Figma', 'Illustrator'],
    });
    expect(m.dimensionCodes).not.toContain('VD_PRODUCT_INTERFACE');
  });

  it('user_interface_design → Product UI', () => {
    const m = vd({
      skillCode: 'user_interface_design',
      name: 'Diseño de interfaces de usuario (UI)',
      parentSpecialtyCode: 'UX_PRODUCT_DESIGN',
      supportingSignals: [
        'Diseñar interfaces UI/UX y maquetación visual para aplicaciones y plataformas web',
      ],
    });
    expect(m.dimensionCodes).toContain('VD_PRODUCT_INTERFACE');
  });

  it('editorial layout → Editorial', () => {
    const m = vd({
      skillCode: 'layout_and_editorial_design',
      name: 'Diagramación y maquetación editorial',
      supportingSignals: ['diagramación', 'informes de gestión'],
      toolOrTechnologySignals: ['InDesign'],
    });
    expect(m.dimensionCodes).toContain('VD_EDITORIAL');
  });

  it('brand identity → Brand', () => {
    const m = vd({
      skillCode: 'brand_conceptualization',
      name: 'Conceptualización y desarrollo de marcas',
      parentSpecialtyCode: 'BRAND_IDENTITY_DESIGN',
      supportingSignals: ['conceptualización de marcas'],
    });
    expect(m.dimensionCodes).toContain('VD_BRAND_SYSTEMS');
  });

  it('motion graphics / animación → Motion', () => {
    const m = vd({
      skillCode: 'motion_graphics_design',
      name: 'Motion graphics y animación gráfica',
      supportingSignals: ['creación de motion graphics', 'animación gráfica'],
    });
    expect(m.dimensionCodes).toContain('VD_MOTION');
  });

  it('maquetación web ≠ Editorial', () => {
    const m = vd({
      skillCode: 'user_interface_design',
      name: 'Diseño de interfaces de usuario (UI)',
      parentSpecialtyCode: 'UX_PRODUCT_DESIGN',
      supportingSignals: [
        'Diseñar interfaces UI/UX y maquetación visual para aplicaciones y plataformas web',
      ],
    });
    expect(m.dimensionCodes).not.toContain('VD_EDITORIAL');
    expect(m.dimensionCodes).toContain('VD_PRODUCT_INTERFACE');
  });

  it('maquetación editorial → Editorial', () => {
    const m = vd({
      skillCode: 'editorial_layout',
      name: 'Maquetación editorial de revistas',
      supportingSignals: ['maquetación editorial de revista impresa'],
    });
    expect(m.dimensionCodes).toContain('VD_EDITORIAL');
  });

  it('maquetación publicitaria aislada ≠ Editorial', () => {
    const m = vd({
      skillCode: 'advertising_layout_and_photo_retouching',
      name: 'Maquetación publicitaria y retoque fotográfico',
      supportingSignals: [
        'retoque fotográfico y maquetación de piezas publicitarias',
        'Maquetación publicitaria',
      ],
      toolOrTechnologySignals: ['Adobe InDesign'],
    });
    expect(m.dimensionCodes).not.toContain('VD_EDITORIAL');
  });
});

function da(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'DATA_ANALYTICS',
    parentSpecialtyCode: partial.parentSpecialtyCode ?? 'BUSINESS_INTELLIGENCE',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions DATA_ANALYTICS', () => {
  it('Power BI / Tableau solo en tools ≠ radar axes', () => {
    const m = da({
      skillCode: 'generic_team_support',
      name: 'Acompañamiento a equipos',
      supportingSignals: ['coordinación con stakeholders internos'],
      toolOrTechnologySignals: ['Power BI', 'Tableau', 'SQL', 'GCP'],
    });
    expect(m.dimensionCodes).toEqual(['DA_BUSINESS_REPORTING']);
    expect(m.mappingJustification).toContain('fallback');
  });

  it('dashboard/reporting signals → DA_BUSINESS_REPORTING', () => {
    const m = da({
      skillCode: 'executive_dashboard_design',
      name: 'Diseño de tableros ejecutivos',
      supportingSignals: [
        'implementé tableros dinámicos convirtiendo datos brutos en insights',
      ],
      toolOrTechnologySignals: ['Power BI'],
    });
    expect(m.dimensionCodes).toContain('DA_BUSINESS_REPORTING');
    expect(m.dimensionCodes).toContain('DA_DECISION_ENABLEMENT');
  });

  it('ETL/repositorio signals → pipeline/platform', () => {
    const m = da({
      skillCode: 'operational_data_repository',
      name: 'Consolidación de repositorio de datos operacional',
      parentSpecialtyCode: 'DATA_ENGINEERING',
      supportingSignals: [
        'consolidé repositorio de datos operacional garantizando trazabilidad',
        'gestión de ETL en entornos cloud',
      ],
    });
    expect(m.dimensionCodes).toContain('DA_DATA_PIPELINE');
    expect(m.dimensionCodes).toContain('DA_DATA_PLATFORM');
    expect(m.dimensionCodes).toContain('DA_GOVERNANCE_QUALITY');
  });

  it('predictive model signals → DA_PREDICTIVE_MODELING', () => {
    const m = da({
      skillCode: 'student_retention_predictive_mvp',
      name: 'MVP de modelo predictivo de permanencia',
      parentSpecialtyCode: 'PREDICTIVE_ANALYTICS',
      supportingSignals: [
        'construí MVP de modelo predictivo de permanencia estudiantil',
      ],
      toolOrTechnologySignals: ['LightGBM'],
    });
    expect(m.dimensionCodes).toContain('DA_PREDICTIVE_MODELING');
    expect(m.dimensionCodes).not.toContain('DA_BUSINESS_REPORTING');
  });
});

function dm(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'DIGITAL_MARKETING',
    parentSpecialtyCode: partial.parentSpecialtyCode ?? 'CAMPAIGN_MARKETING',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions DIGITAL_MARKETING', () => {
  it('Google Ads / CMS solo en tools ≠ radar axes', () => {
    const m = dm({
      skillCode: 'generic_team_coordination',
      name: 'Coordinación con equipos internos',
      supportingSignals: ['trabajo colaborativo con stakeholders'],
      toolOrTechnologySignals: ['Google Ads', 'CMS', 'Moodle', 'Power BI'],
    });
    expect(m.dimensionCodes).toEqual(['DM_CAMPAIGN_EXECUTION']);
    expect(m.mappingJustification).toContain('fallback');
  });

  it('campaign planning/execution → campaign + strategy axes', () => {
    const m = dm({
      skillCode: 'campaign_planning_and_tracking',
      name: 'Planeación y seguimiento de campañas',
      supportingSignals: [
        'planeación estratégica, ejecución y seguimiento de campañas de publicidad',
      ],
    });
    expect(m.dimensionCodes).toContain('DM_CAMPAIGN_EXECUTION');
    expect(m.dimensionCodes).toContain('DM_STRATEGY_PLANNING');
  });

  it('funnels/conversion → conversion axis', () => {
    const m = dm({
      skillCode: 'conversion_funnel_structuring',
      name: 'Estructuración de funnels de conversión',
      parentSpecialtyCode: 'GROWTH_MARKETING',
      supportingSignals: [
        'estructuración de funnels de conversión para nuevos productos',
        'crecimiento de tráfico web y conversión de usuarios',
      ],
    });
    expect(m.dimensionCodes).toContain('DM_CONVERSION_OPTIMIZATION');
    expect(m.dimensionCodes).toContain('DM_GROWTH_ACQUISITION');
  });

  it('GTM/product lifecycle → product GTM axis', () => {
    const m = dm({
      skillCode: 'go_to_market_for_digital_products',
      name: 'Estrategias Go-to-Market de productos digitales',
      parentSpecialtyCode: 'PRODUCT_MARKETING',
      supportingSignals: [
        'estrategias Go-To-Market',
        'ciclo de vida de productos e-learning desde análisis de mercado',
      ],
    });
    expect(m.dimensionCodes).toContain('DM_PRODUCT_GTM');
  });
});

function cs(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'CUSTOMER_SUCCESS',
    parentSpecialtyCode:
      partial.parentSpecialtyCode ?? 'CUSTOMER_LIFECYCLE_CARE',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions CUSTOMER_SUCCESS', () => {
  it('CRM/Zoho solo en tools ≠ radar axes', () => {
    const m = cs({
      skillCode: 'generic_coordination',
      name: 'Coordinación con equipos internos',
      supportingSignals: ['trabajo colaborativo con stakeholders'],
      toolOrTechnologySignals: ['Zoho CRM', 'Salesforce', 'SINU', 'Five9'],
    });
    expect(m.dimensionCodes).toEqual(['CS_LIFECYCLE_FOLLOWUP']);
    expect(m.mappingJustification).toContain('fallback');
  });

  it('vinculación/admisión → intake axis', () => {
    const m = cs({
      skillCode: 'student_admission_advisory',
      name: 'Asesoría de vinculación y admisión',
      parentSpecialtyCode: 'CUSTOMER_INTAKE_ONBOARDING',
      supportingSignals: [
        'captación y vinculación de aspirantes',
        'asesoría de admisión y matrícula',
      ],
    });
    expect(m.dimensionCodes).toContain('CS_INTAKE_ENROLLMENT');
    expect(m.dimensionCodes).toContain('CS_RELATIONSHIP_ADVISING');
  });

  it('retención/fidelización → retention axis', () => {
    const m = cs({
      skillCode: 'retention_plans',
      name: 'Planes de retención y fidelización',
      parentSpecialtyCode: 'CUSTOMER_RETENTION_LOYALTY',
      supportingSignals: [
        'retención de estudiantes para evitar deserción',
        'planes de fidelización y postventa',
      ],
    });
    expect(m.dimensionCodes).toContain('CS_RETENTION_LOYALTY');
  });

  it('servicio/PQRS → service axis', () => {
    const m = cs({
      skillCode: 'pqrs_resolution',
      name: 'Gestión de PQRS y servicio al cliente',
      parentSpecialtyCode: 'CUSTOMER_SERVICE_SUPPORT',
      supportingSignals: [
        'servicio al cliente y atención al usuario',
        'gestión de PQRS y resolución de conflictos',
      ],
    });
    expect(m.dimensionCodes).toContain('CS_SERVICE_RESOLUTION');
  });

  it('cierre consultivo → commercial conversion axis', () => {
    const m = cs({
      skillCode: 'consultative_closing',
      name: 'Cierre consultivo comercial',
      parentSpecialtyCode: 'CUSTOMER_INTAKE_ONBOARDING',
      supportingSignals: [
        'prospección y cierre consultivo de vinculación',
        'metas comerciales B2B',
      ],
    });
    expect(m.dimensionCodes).toContain('CS_COMMERCIAL_CONVERSION');
  });
});

function hr(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'PEOPLE_HR',
    parentSpecialtyCode:
      partial.parentSpecialtyCode ?? 'TALENT_ACQUISITION',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions PEOPLE_HR', () => {
  it('HCM/ATS solo en tools ≠ radar axes de práctica', () => {
    const m = hr({
      skillCode: 'generic_hr_coord',
      name: 'Coordinación interna de área',
      supportingSignals: ['trabajo colaborativo con stakeholders'],
      toolOrTechnologySignals: ['Workday', 'BambooHR', 'ATS'],
    });
    expect(m.dimensionCodes).toEqual(['HR_TALENT_ACQUISITION']);
    expect(m.mappingJustification).toContain('fallback');
  });

  it('selección/vinculación de personal → talent acquisition', () => {
    const m = hr({
      skillCode: 'staff_selection',
      name: 'Selección y vinculación de personal',
      parentSpecialtyCode: 'TALENT_ACQUISITION',
      supportingSignals: [
        'procesos de selección de personal',
        'vinculación de pasantes asegurando perfiles requeridos',
      ],
    });
    expect(m.dimensionCodes).toContain('HR_TALENT_ACQUISITION');
    expect(m.dimensionCodes).toContain('HR_ROLE_PROFILING');
  });

  it('descriptivos de cargo + reclutamiento → profiling + acquisition', () => {
    const m = hr({
      skillCode: 'job_desc_recruiting',
      name: 'Descriptivos de cargo y reclutamiento',
      parentSpecialtyCode: 'TALENT_ACQUISITION',
      supportingSignals: [
        'elaboración de descriptivos de cargo',
        'apoyo en procesos de reclutamiento',
      ],
    });
    expect(m.dimensionCodes).toContain('HR_ROLE_PROFILING');
    expect(m.dimensionCodes).toContain('HR_TALENT_ACQUISITION');
  });

  it('turnos/permisos/capacitaciones → workforce ops + people learning', () => {
    const m = hr({
      skillCode: 'workforce_schedule_training',
      name: 'Coordinación de turnos y capacitaciones',
      parentSpecialtyCode: 'WORKFORCE_ADMINISTRATION',
      supportingSignals: [
        'coordinación de turnos y permisos del personal',
        'capacitaciones del personal',
      ],
    });
    expect(m.dimensionCodes).toContain('HR_WORKFORCE_OPS');
    expect(m.dimensionCodes).toContain('HR_PEOPLE_LEARNING');
  });

  it('integración de nuevo talento → onboarding axis', () => {
    const m = hr({
      skillCode: 'talent_integration',
      name: 'Integración de nuevo talento',
      parentSpecialtyCode: 'WORKFORCE_ADMINISTRATION',
      supportingSignals: ['optimizando la integración de nuevo talento al área'],
    });
    expect(m.dimensionCodes).toContain('HR_ONBOARDING_INTEGRATION');
  });

  it('entrevistas de retiro → exit axis (no infla acquisition sin evidencia)', () => {
    const m = hr({
      skillCode: 'exit_interviews',
      name: 'Entrevistas de retiro',
      parentSpecialtyCode: 'WORKFORCE_ADMINISTRATION',
      supportingSignals: ['desarrollo de entrevistas de retiro'],
    });
    expect(m.dimensionCodes).toContain('HR_EXIT_SEPARATION');
    expect(m.dimensionCodes).not.toContain('HR_TALENT_ACQUISITION');
  });

  it('bienestar/actividades internas → wellbeing axis', () => {
    const m = hr({
      skillCode: 'wellbeing_support',
      name: 'Apoyo en bienestar',
      parentSpecialtyCode: 'WORKFORCE_ADMINISTRATION',
      supportingSignals: [
        'apoyo en actividades de bienestar y actividades internas',
      ],
    });
    expect(m.dimensionCodes).toContain('HR_WELLBEING_INTERNAL');
  });
});

function itSys(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'IT_SYSTEMS',
    parentSpecialtyCode:
      partial.parentSpecialtyCode ?? 'SYSTEMS_ADMINISTRATION',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions IT_SYSTEMS', () => {
  it('VMware/Git/M365/Power BI solo en tools ≠ radar axes de práctica', () => {
    const m = itSys({
      skillCode: 'generic_it_coord',
      name: 'Coordinación interna de área',
      supportingSignals: ['trabajo colaborativo con stakeholders'],
      toolOrTechnologySignals: ['VMware', 'Git', 'M365', 'Power BI', 'GLPI'],
    });
    expect(m.dimensionCodes).toEqual(['IT_SYSADMIN']);
    expect(m.mappingJustification).toContain('fallback');
  });

  it('LAN/WAN/VPN + routers → networking', () => {
    const m = itSys({
      skillCode: 'network_ops',
      name: 'Administración de redes LAN/WAN',
      parentSpecialtyCode: 'NETWORK_INFRASTRUCTURE',
      supportingSignals: [
        'administración de redes LAN, WAN y VPN',
        'configuración y monitoreo de routers y switches',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_NETWORKING');
  });

  it('mesa de ayuda + ANS → service desk', () => {
    const m = itSys({
      skillCode: 'helpdesk_sla',
      name: 'Mesa de ayuda con ANS',
      parentSpecialtyCode: 'IT_SERVICE_DESK',
      supportingSignals: [
        'mesa de ayuda con ANS para soporte ofimático y VPN a usuarios',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_SERVICE_DESK');
  });

  it('servidores + AD + virtualización → sysadmin', () => {
    const m = itSys({
      skillCode: 'server_admin',
      name: 'Administración de servidores y AD',
      parentSpecialtyCode: 'SYSTEMS_ADMINISTRATION',
      supportingSignals: [
        'instalación y configuración de servidores físicos y virtuales',
        'administración de Windows Server, Linux y Active Directory',
        'gestión de plataformas de virtualización',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_SYSADMIN');
  });

  it('firewalls + parches + backups → security ops', () => {
    const m = itSys({
      skillCode: 'secops_hardening',
      name: 'Seguridad perimetral y respaldos',
      parentSpecialtyCode: 'IT_SECURITY_OPERATIONS',
      supportingSignals: [
        'implementación de medidas de seguridad perimetral y gestión de firewalls',
        'aplicación de parches de seguridad y políticas de respaldo',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_SECURITY_OPS');
  });

  it('inventario de equipos → endpoints/assets', () => {
    const m = itSys({
      skillCode: 'asset_inventory',
      name: 'Inventario tecnológico',
      parentSpecialtyCode: 'SYSTEMS_ADMINISTRATION',
      supportingSignals: ['inventario de equipos de cómputo y activos de TI'],
    });
    expect(m.dimensionCodes).toContain('IT_ENDPOINTS_ASSETS');
  });

  it('continuidad de servicios críticos → availability', () => {
    const m = itSys({
      skillCode: 'service_continuity',
      name: 'Continuidad de servicios críticos',
      parentSpecialtyCode: 'IT_SERVICE_DESK',
      supportingSignals: [
        'soporte técnico especializado para continuidad de servicios críticos',
        'reducción de tasas de incidentes',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_AVAILABILITY_CONTINUITY');
    expect(m.dimensionCodes).toContain('IT_SERVICE_DESK');
  });

  it('proveedores estratégicos de red → vendor/SLA', () => {
    const m = itSys({
      skillCode: 'vendor_mgmt',
      name: 'Gestión de proveedores de conectividad',
      parentSpecialtyCode: 'NETWORK_INFRASTRUCTURE',
      supportingSignals: [
        'gestión de proveedores estratégicos de red y telecomunicaciones',
      ],
    });
    expect(m.dimensionCodes).toContain('IT_VENDOR_SLA');
  });
});

function legalSkill(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
    toolOrTechnologySignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'LEGAL',
    parentSpecialtyCode: partial.parentSpecialtyCode ?? 'LEGAL_ADVISORY',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: partial.toolOrTechnologySignals ?? [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions LEGAL', () => {
  it('SECOP/Ley 80 solo en tools sin práctica → sin dimensiones', () => {
    const m = mapSkillToDimensions({
      skillCode: 'secop_only',
      name: 'Operador de plataforma',
      parentFieldCode: 'LEGAL',
      parentSpecialtyCode: 'NOT_A_SPECIALTY',
      supportingSignals: [],
      toolOrTechnologySignals: ['SECOP', 'Ley 80', 'Colombia Compra Eficiente'],
      supportingEvidenceUnitIds: ['e1'],
    });
    expect(m.dimensionCodes).toEqual([]);
  });

  it('asesoría jurídica → LEGAL_ADVISORY', () => {
    const m = legalSkill({
      skillCode: 'legal_advisory',
      name: 'Asesoría jurídica especializada',
      parentSpecialtyCode: 'LEGAL_ADVISORY',
      supportingSignals: [
        'asesoría jurídica a personas naturales y jurídicas',
        'interpretación jurídica aplicada',
      ],
    });
    expect(m.dimensionCodes).toContain('LEGAL_ADVISORY');
  });

  it('contratación estatal jurídica → PUBLIC_CONTRACTING_LEGAL', () => {
    const m = legalSkill({
      skillCode: 'public_contracting',
      name: 'Contratación estatal',
      parentSpecialtyCode: 'PUBLIC_SECTOR_CONTRACTING',
      supportingSignals: [
        'acompañamiento legal en etapas precontractual y contractual',
        'estructuración jurídica de pliegos y minutas',
      ],
    });
    expect(m.dimensionCodes).toContain('PUBLIC_CONTRACTING_LEGAL');
  });

  it('litigio y demandas → LITIGATION_DISPUTES y LEGAL_PROCEDURE', () => {
    const m = legalSkill({
      skillCode: 'litigation',
      name: 'Litigio laboral',
      parentSpecialtyCode: 'LITIGATION_DISPUTES',
      supportingSignals: [
        'realización de demandas laborales y contestación de demandas',
        'seguimiento procesal y representación legal',
      ],
    });
    expect(m.dimensionCodes).toContain('LITIGATION_DISPUTES');
    expect(m.dimensionCodes).toContain('LEGAL_PROCEDURE');
  });

  it('actos administrativos → LEGAL_ANALYSIS_NORMATIVE', () => {
    const m = legalSkill({
      skillCode: 'admin_law',
      name: 'Derecho administrativo',
      parentSpecialtyCode: 'ADMINISTRATIVE_LAW',
      supportingSignals: [
        'elaboración de actos administrativos y conceptos jurídicos',
        'análisis normativo de cumplimiento',
      ],
    });
    expect(m.dimensionCodes).toContain('LEGAL_ANALYSIS_NORMATIVE');
  });

  it('dimensión 0 sin señales ni specialty fallback explícito', () => {
    const m = mapSkillToDimensions({
      skillCode: 'orphan',
      name: 'Gestión contractual genérica',
      parentFieldCode: 'LEGAL',
      parentSpecialtyCode: 'UNKNOWN_SPECIALTY',
      supportingSignals: ['coordinación de contratos operativos'],
      toolOrTechnologySignals: [],
      supportingEvidenceUnitIds: [],
    });
    expect(m.dimensionCodes).toEqual([]);
  });
});
