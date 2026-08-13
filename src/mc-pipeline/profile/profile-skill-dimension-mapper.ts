/**
 * Mapping auditable Skill → Dimension(s) dentro del mismo Field (piloto 8E).
 * Heurística determinista por keywords; no reclasifica taxonomía.
 */

export type SkillMappingInput = {
  skillCode: string;
  name: string;
  parentFieldCode: string;
  parentSpecialtyCode: string;
  supportingSignals: string[];
  toolOrTechnologySignals: string[];
  supportingEvidenceUnitIds: string[];
};

export type SkillDimensionMapping = {
  skillCode: string;
  dimensionCodes: string[];
  supportingEvidenceUnitIds: string[];
  mappingJustification: string;
};

function blobOf(s: SkillMappingInput): string {
  return [
    s.skillCode,
    s.name,
    ...s.supportingSignals,
    ...s.toolOrTechnologySignals,
  ]
    .join(' ')
    .toLowerCase();
}

/**
 * Blob semántico para VISUAL_DESIGN → radar.
 * Excluye tools: una tool no constituye evidencia de práctica profesional.
 */
function semanticBlobOf(s: SkillMappingInput): string {
  return [s.skillCode, s.name, ...s.supportingSignals]
    .join(' ')
    .toLowerCase();
}

/** Práctica editorial (no maquetación aislada; no tools). */
function matchesVisualDesignEditorial(b: string): boolean {
  if (
    /editorial|ebook|revista|folleto|\blibros?\b|diagramaci[oó]n|layout[\s_-]?editorial|editorial[\s_-]?(?:design|layout)/.test(
      b,
    )
  ) {
    return true;
  }
  // maquetación solo con contexto editorial / publicación impresa
  if (
    /maquetaci[oó]n\s+(?:editorial|de\s+(?:la\s+)?(?:revista|libro|ebook|publicaci[oó]n|folleto)|impres)/.test(
      b,
    )
  ) {
    return true;
  }
  // maquetación web / app / interfaz / pantalla → no editorial
  return false;
}

/** Product UI por práctica UI/UX, no por substring accidental (/ui/ en guidelines|Suite). */
function matchesVisualDesignProductUi(b: string): boolean {
  return /\bui\b|ui[\s_-]?design|user[\s_-]?interface|interfaz|\bux\b|producto digital|design system|pantalla/.test(
    b,
  );
}

/** Motion Design — no video/audiovisual genérico ni NLEs. */
function matchesVisualDesignMotion(b: string): boolean {
  return /motion\s*graphics|motion\s*design|motion[\s_-]graphics|motion[\s_-]design|animaci[oó]n(?:\s+gr[aá]fica)?|gr[aá]ficos?\s+animados|kinetic\s+typograph/.test(
    b,
  );
}

function mapVisualDesign(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (matchesVisualDesignEditorial(b)) {
    dims.add('VD_EDITORIAL');
    reasons.push('señales editoriales/diagramación/maquetación editorial');
  }
  if (
    /brand|identidad|identidad gr[aá]fica|l[ií]nea gr[aá]fica|branding/.test(
      b,
    )
  ) {
    dims.add('VD_BRAND_SYSTEMS');
    reasons.push('señales de marca/identidad');
  }
  if (
    /publicitar|pieza|gr[aá]fic|campa[nñ]a|infograf|comunicaci[oó]n visual|digital design|contenido digital|redes sociales|email marketing/.test(
      b,
    )
  ) {
    dims.add('VD_VISUAL_COMMUNICATION');
    reasons.push('señales de comunicación visual / piezas');
  }
  if (matchesVisualDesignProductUi(b)) {
    dims.add('VD_PRODUCT_INTERFACE');
    reasons.push('señales de interfaz/producto');
  }
  if (/ilustraci[oó]n|illustration|personaje/.test(b)) {
    dims.add('VD_ILLUSTRATION');
    reasons.push('señales de ilustración');
  }
  if (matchesVisualDesignMotion(b)) {
    dims.add('VD_MOTION');
    reasons.push('señales de motion design / animación gráfica');
  }
  if (
    /arte final|producci[oó]n|qa|calidad|export|preprensa/.test(b)
  ) {
    dims.add('VD_PRODUCTION_CRAFT');
    reasons.push('señales de craft/producción visual');
  }

  // Fallback: specialty GRAPHIC_DESIGN → comunicación visual
  if (dims.size === 0) {
    dims.add('VD_VISUAL_COMMUNICATION');
    reasons.push('fallback specialty GRAPHIC_DESIGN → comunicación visual');
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapEducation(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /instruccional|instructional|curso|dise[nñ]o de aprendizaje|contenido educativo|formativo/.test(
      b,
    )
  ) {
    dims.add('ED_LEARNING_DESIGN');
    reasons.push('señales de diseño instruccional/aprendizaje');
  }
  if (
    /recurso|authoring|diagramaci[oó]n|microaprendizaje|interactivo|genially|ispring|video|podcast/.test(
      b,
    )
  ) {
    dims.add('ED_LEARNING_RESOURCES');
    reasons.push('señales de recursos de aprendizaje');
  }
  if (/evaluaci[oó]n|r[uú]brica|assessment|qa pedag[oó]gico/.test(b)) {
    dims.add('ED_ASSESSMENT');
    reasons.push('señales de evaluación/QA pedagógico');
  }
  if (/lms|moodle|scorm|entorno|aula h[ií]brida|iseazy/.test(b)) {
    dims.add('ED_LEARNING_ENVIRONMENTS');
    reasons.push('señales de entornos/LMS');
  }
  if (/facilit|docen|taller|clase|impartir/.test(b)) {
    dims.add('ED_FACILITATION');
    reasons.push('señales de facilitación/docencia');
  }
  if (/curr[ií]cul|malla|plan de estudio/.test(b)) {
    dims.add('ED_CURRICULUM');
    reasons.push('señales curriculares');
  }
  if (/coordinaci[oó]n|gesti[oó]n acad[eé]mica|programa acad/.test(b)) {
    dims.add('ED_ACADEMIC_OPS');
    reasons.push('señales de operación académica');
  }

  if (dims.size === 0) {
    dims.add('ED_LEARNING_DESIGN');
    reasons.push('fallback specialty INSTRUCTIONAL_DESIGN → learning design');
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapProjectProgramMgmt(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /planific|cronograma|schedule|alcance|scope|roadmap|hitos|milestones|wbs/.test(
      b,
    )
  ) {
    dims.add('PPM_PLANNING');
    reasons.push('señales de planificación/alcance/cronograma');
  }
  if (
    /coordinaci[oó]n|ejecuci[oó]n|entrega|delivery|equipo|stakeholders? interno|seguimiento de tareas|kickoff/.test(
      b,
    )
  ) {
    dims.add('PPM_COORDINATION_EXECUTION');
    reasons.push('señales de coordinación/ejecución');
  }
  if (
    /stakeholder|interesad|sponsor|comunicaci[oó]n con|alineaci[oó]n de actores|gestion de expectativas/.test(
      b,
    )
  ) {
    dims.add('PPM_STAKEHOLDERS');
    reasons.push('señales de stakeholders');
  }
  if (/riesgo|risk|mitigaci[oó]n|contingencia|issue log/.test(b)) {
    dims.add('PPM_RISKS');
    reasons.push('señales de riesgos');
  }
  if (
    /presupuesto|budget|recursos|costos|costos?|financiaci[oó]n|asignaci[oó]n de recursos/.test(
      b,
    )
  ) {
    dims.add('PPM_RESOURCES_BUDGET');
    reasons.push('señales de recursos/presupuesto');
  }
  if (
    /seguimiento|control|kpi|status report|tablero|dashboard|monitoreo|reporting|avance/.test(
      b,
    )
  ) {
    dims.add('PPM_MONITORING_CONTROL');
    reasons.push('señales de seguimiento/control');
  }
  if (
    /pmo|gobernanza|governance|mejora de proceso|process improvement|est[aá]ndar|plantilla|lean|six sigma|continu(a|ous) improvement/.test(
      b,
    )
  ) {
    dims.add('PPM_IMPROVEMENT_GOVERNANCE');
    reasons.push('señales de mejora/gobernanza/PMO');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'PMO_GOVERNANCE') {
      dims.add('PPM_IMPROVEMENT_GOVERNANCE');
      reasons.push('fallback specialty PMO_GOVERNANCE');
    } else if (s.parentSpecialtyCode === 'PROCESS_IMPROVEMENT') {
      dims.add('PPM_IMPROVEMENT_GOVERNANCE');
      reasons.push('fallback specialty PROCESS_IMPROVEMENT');
    } else if (s.parentSpecialtyCode === 'PROGRAM_MANAGEMENT') {
      dims.add('PPM_COORDINATION_EXECUTION');
      reasons.push('fallback specialty PROGRAM_MANAGEMENT');
    } else {
      dims.add('PPM_COORDINATION_EXECUTION');
      reasons.push('fallback specialty PROJECT_MANAGEMENT → coordinación');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapFinanceAdmin(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /planeaci[oó]n financiera|presupuesto|budget|forecast|proyecci[oó]n financiera|elaboraci[oó]n de presupuesto/.test(
      b,
    )
  ) {
    dims.add('FA_FINANCIAL_PLANNING');
    reasons.push('señales de planeación financiera/presupuestal');
  }
  if (
    /control financiero|control presupuest|desviaci[oó]n|ejecuci[oó]n presupuest|aseguramiento de gasto|controller/.test(
      b,
    )
  ) {
    dims.add('FA_FINANCIAL_CONTROL');
    reasons.push('señales de control financiero/presupuestal');
  }
  if (
    /administrativ|tr[aá]mite|operaci[oó]n admin|soporte admin|oficina|ventanilla|procesos admin/.test(
      b,
    )
  ) {
    dims.add('FA_ADMIN_OPS');
    reasons.push('señales de operación administrativa');
  }
  if (
    /contab|conciliaci[oó]n|cuentas por|libro|asiento|facturaci[oó]n|cobranza|accounts payable|accounts receivable/.test(
      b,
    )
  ) {
    dims.add('FA_ACCOUNTING');
    reasons.push('señales contables/conciliación');
  }
  if (
    /compra|proveedor|procurement|purchasing|adquisici[oó]n|orden de compra/.test(
      b,
    )
  ) {
    dims.add('FA_PROCUREMENT');
    reasons.push('señales de compras/proveedores');
  }
  if (
    /documental|archivo|expediente|soporte documental|gesti[oó]n documental|filing/.test(
      b,
    )
  ) {
    dims.add('FA_DOCUMENT_MGMT');
    reasons.push('señales de gestión documental');
  }
  if (
    /reporte|informe financiero|seguimiento|dashboard|reporting|indicador/.test(
      b,
    )
  ) {
    dims.add('FA_REPORTING');
    reasons.push('señales de reportes/seguimiento');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'ACCOUNTING_OPERATIONS') {
      dims.add('FA_ACCOUNTING');
      reasons.push('fallback specialty ACCOUNTING_OPERATIONS');
    } else if (s.parentSpecialtyCode === 'BUDGET_FINANCIAL_CONTROL') {
      dims.add('FA_FINANCIAL_CONTROL');
      reasons.push('fallback specialty BUDGET_FINANCIAL_CONTROL');
    } else if (s.parentSpecialtyCode === 'ADMINISTRATIVE_MANAGEMENT') {
      dims.add('FA_ADMIN_OPS');
      reasons.push('fallback specialty ADMINISTRATIVE_MANAGEMENT');
    } else {
      dims.add('FA_FINANCIAL_PLANNING');
      reasons.push('fallback specialty FINANCIAL_MANAGEMENT → planeación');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapSoftwareEngineering(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /frontend|ui|interfaz|componente|react|angular|next\.?js|css|html|experiencia (de )?usuario|estado|client[- ]side/.test(
      b,
    )
  ) {
    dims.add('SE_FRONTEND');
    reasons.push('señales frontend/UI/componentes');
  }
  if (
    /backend|servidor|server|servicio|l[oó]gica de negocio|nest|node\.?js|\.net|express|api rest|endpoint/.test(
      b,
    )
  ) {
    dims.add('SE_BACKEND');
    reasons.push('señales backend/servicios');
  }
  if (
    /base(s)? de datos|database|persistencia|modelado|orm|sql|postgres|mysql|mongo|typeorm/.test(
      b,
    )
  ) {
    dims.add('SE_DATA_STORES');
    reasons.push('señales de persistencia/datos');
  }
  if (
    /api|integraci[oó]n|graphql|rest|webhook|contrato de (api|servicio)|interoperab/.test(
      b,
    )
  ) {
    dims.add('SE_APIS_INTEGRATION');
    reasons.push('señales de APIs/integración');
  }
  if (
    /cloud|infra|despliegue|deploy|docker|kubernetes|k8s|ci\/?cd|pipeline|gcp|aws|azure|container|terraform/.test(
      b,
    )
  ) {
    dims.add('SE_CLOUD_INFRA');
    reasons.push('señales cloud/infra/delivery');
  }
  if (
    /calidad|quality|test|prueba|qa|code review|git|github|gitlab|agile|scrum|requerimiento|engineering practice/.test(
      b,
    )
  ) {
    dims.add('SE_ENG_QUALITY');
    reasons.push('señales de ingeniería/calidad');
  }
  if (
    /ia aplicada|inteligencia artificial|machine learning|llm|prompt|modelo generativo|openai|gemini/.test(
      b,
    )
  ) {
    dims.add('SE_APPLIED_AI');
    reasons.push('señales de IA aplicada al software');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'FRONTEND_ENGINEERING') {
      dims.add('SE_FRONTEND');
      reasons.push('fallback specialty FRONTEND_ENGINEERING');
    } else if (s.parentSpecialtyCode === 'BACKEND_ENGINEERING') {
      dims.add('SE_BACKEND');
      reasons.push('fallback specialty BACKEND_ENGINEERING');
    } else if (s.parentSpecialtyCode === 'MOBILE_ENGINEERING') {
      dims.add('SE_FRONTEND');
      reasons.push('fallback specialty MOBILE_ENGINEERING → frontend/client');
    } else if (s.parentSpecialtyCode === 'PLATFORM_DEVOPS_ENGINEERING') {
      dims.add('SE_CLOUD_INFRA');
      reasons.push('fallback specialty PLATFORM_DEVOPS_ENGINEERING');
    } else {
      dims.add('SE_BACKEND');
      reasons.push('fallback SOFTWARE_ENGINEERING → backend');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapAudiovisualProduction(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /preproducci[oó]n|storyboard|gui[oó]n|script|planificaci[oó]n de rodaje|plan de rodaje|casting|locaci[oó]n/.test(
      b,
    )
  ) {
    dims.add('AV_PREPRODUCTION');
    reasons.push('señales de preproducción');
  }
  if (
    /c[aá]mara|camera|captura|rodaje|filmaci[oó]n|toma|iluminaci[oó]n|lighting|fotometr|cinematograf/.test(
      b,
    )
  ) {
    dims.add('AV_CAPTURE');
    reasons.push('señales de captura/cámara/iluminación');
  }
  if (
    /realizaci[oó]n|producci[oó]n audiovisual|producci[oó]n de video|coordinaci[oó]n de producci[oó]n|direcci[oó]n de|multic[aá]mara|streaming|live production|vide[oó]grafo/.test(
      b,
    )
  ) {
    dims.add('AV_PRODUCTION_REALIZATION');
    reasons.push('señales de producción/realización');
  }
  if (
    /edici[oó]n|montaje|editing|nle|timeline|premiere|final cut|avid|capcut|corte|ritmo/.test(
      b,
    )
  ) {
    dims.add('AV_EDITING_MONTAGE');
    reasons.push('señales de edición/montaje');
  }
  if (
    /color|grading|correcci[oó]n de color|composici[oó]n|compositing|vfx|finishing|acabado|davinci|after effects/.test(
      b,
    )
  ) {
    dims.add('AV_VISUAL_FINISHING');
    reasons.push('señales de acabado visual/color/compositing');
  }
  if (
    /audio|sonido|sound|mezcla|dise[nñ]o sonoro|audition|di[aá]logo|foley|stem/.test(
      b,
    )
  ) {
    dims.add('AV_AUDIO');
    reasons.push('señales de audio');
  }
  if (
    /export|entrega|master|codec|encoding|publicaci[oó]n|delivery|formato de entrega|render final/.test(
      b,
    )
  ) {
    dims.add('AV_DELIVERY');
    reasons.push('señales de entrega/publicación');
  }
  if (
    /fotograf[ií]a|photography|sesi[oó]n fotogr[aá]fica|retrato|lightroom|revelado/.test(
      b,
    )
  ) {
    dims.add('AV_CAPTURE');
    reasons.push('señales fotográficas → captura');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'VIDEO_PRODUCTION') {
      dims.add('AV_PRODUCTION_REALIZATION');
      reasons.push('fallback specialty VIDEO_PRODUCTION');
    } else if (s.parentSpecialtyCode === 'VIDEO_POST_PRODUCTION') {
      dims.add('AV_EDITING_MONTAGE');
      reasons.push('fallback specialty VIDEO_POST_PRODUCTION');
    } else if (s.parentSpecialtyCode === 'PHOTOGRAPHY') {
      dims.add('AV_CAPTURE');
      reasons.push('fallback specialty PHOTOGRAPHY');
    } else if (s.parentSpecialtyCode === 'AUDIO_PRODUCTION') {
      dims.add('AV_AUDIO');
      reasons.push('fallback specialty AUDIO_PRODUCTION');
    } else {
      dims.add('AV_PRODUCTION_REALIZATION');
      reasons.push('fallback AUDIOVISUAL_PRODUCTION → producción');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapCommunications(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /narrativa|storytelling|mensaje|discurso|story|argumentaci[oó]n|posicionamiento de mensaje/.test(
      b,
    )
  ) {
    dims.add('COMM_MESSAGE_NARRATIVE');
    reasons.push('señales de mensaje/narrativa');
  }
  if (
    /on[\s_-]?camera|frente a c[aá]mara|presentaci[oó]n oral|presentador|conducci[oó]n|locuci[oó]n|oratoria|moderaci[oó]n|hablar en p[uú]blico|comunicaci[oó]n oral/.test(
      b,
    )
  ) {
    dims.add('COMM_ORAL_PRESENTATION');
    reasons.push('señales de comunicación oral/presentación');
  }
  if (
    /redacci[oó]n|escritura|copywriting|guion|gui[oó]n|escrito|editorial|period[ií]stic/.test(
      b,
    )
  ) {
    dims.add('COMM_WRITING');
    reasons.push('señales de escritura/redacción');
  }
  if (
    /audiencia|comunidad|community|p[uú]blico|engagement comunicacional|relacionamiento con audiencias|manejo de audiencia/.test(
      b,
    )
  ) {
    dims.add('COMM_AUDIENCE_RELATIONS');
    reasons.push('señales de relación con audiencias');
  }
  if (
    /planeaci[oó]n de comunicaci[oó]n|plan de comunicaci[oó]n|plan de contenidos|estrategia comunicacional|calendario editorial/.test(
      b,
    )
  ) {
    dims.add('COMM_PLANNING');
    reasons.push('señales de planeación de comunicación');
  }
  if (
    /canal(?:es)? digital|redes sociales|social media|comunicaci[oó]n digital|medios digitales|online|plataforma digital/.test(
      b,
    )
  ) {
    dims.add('COMM_DIGITAL_CHANNELS');
    reasons.push('señales de canales digitales');
  }
  if (
    /vocer[ií]a|portavoz|spokes|representaci[oó]n institucional|representaci[oó]n de (la )?marca|reputaci[oó]n|relaciones p[uú]blicas|prensa/.test(
      b,
    )
  ) {
    dims.add('COMM_SPOKESPERSONSHIP');
    reasons.push('señales de vocería/representación');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'CORPORATE_COMMUNICATIONS') {
      dims.add('COMM_SPOKESPERSONSHIP');
      reasons.push('fallback specialty CORPORATE_COMMUNICATIONS');
    } else if (s.parentSpecialtyCode === 'DIGITAL_COMMUNICATIONS') {
      dims.add('COMM_DIGITAL_CHANNELS');
      reasons.push('fallback specialty DIGITAL_COMMUNICATIONS');
    } else if (s.parentSpecialtyCode === 'PUBLIC_RELATIONS') {
      dims.add('COMM_SPOKESPERSONSHIP');
      reasons.push('fallback specialty PUBLIC_RELATIONS');
    } else if (s.parentSpecialtyCode === 'JOURNALISM') {
      dims.add('COMM_WRITING');
      reasons.push('fallback specialty JOURNALISM');
    } else {
      dims.add('COMM_MESSAGE_NARRATIVE');
      reasons.push('fallback COMMUNICATIONS → mensaje');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapDataAnalytics(s: SkillMappingInput): SkillDimensionMapping {
  // Tools excluded from semantic blob — tools must not activate radar axes.
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /etl|pipeline|transformaci[oó]n|ingesta|integraci[oó]n de datos|automatizaci[oó]n de (?:datos|flujos)|data[\s_-]?prep|consolidaci[oó]n de datos/.test(
      b,
    )
  ) {
    dims.add('DA_DATA_PIPELINE');
    reasons.push('señales de pipeline/ETL/transformación');
  }
  if (
    /repositorio|arquitectura(?:s)? de datos|esquema|data[\s_-]?platform|almacenamiento de datos|disponibilidad de (?:la )?informaci[oó]n|centraliz(?:ar|aci[oó]n) (?:de )?datos/.test(
      b,
    )
  ) {
    dims.add('DA_DATA_PLATFORM');
    reasons.push('señales de plataforma/repositorio/esquema');
  }
  if (
    /dashboard|tablero|reporting|business intelligence|\bbi\b|visualizaci[oó]n (?:de datos|anal[ií]tica|integral|ejecutiva)|kpi|monitoreo continuo|informe(?:s)? ejecutiv/.test(
      b,
    )
  ) {
    // Note: tool names in skill NAME/signals may appear; tools array is excluded via semanticBlobOf.
    dims.add('DA_BUSINESS_REPORTING');
    reasons.push('señales de reporting/BI/tableros');
  }
  if (
    /predictiv|modelo(?:s)? predictiv|machine learning|\bml\b|lightgbm|[aá]rbol(?:es)? de decisi[oó]n|ciencia de datos|data science/.test(
      b,
    )
  ) {
    dims.add('DA_PREDICTIVE_MODELING');
    reasons.push('señales de modelado predictivo/ML');
  }
  if (
    /gobernanza|gobierno de datos|integridad|trazabilidad|calidad de datos|data[\s_-]?quality|data[\s_-]?governance/.test(
      b,
    )
  ) {
    dims.add('DA_GOVERNANCE_QUALITY');
    reasons.push('señales de gobernanza/calidad');
  }
  if (
    /toma de decisiones|decisiones anal[ií]ticas|lectura estrat[eé]gica|insights?|alertas de riesgo|habilitaci[oó]n de decisi[oó]n|soporte anal[ií]tico|indicadores/.test(
      b,
    )
  ) {
    dims.add('DA_DECISION_ENABLEMENT');
    reasons.push('señales de habilitación de decisión/insights');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'BUSINESS_INTELLIGENCE') {
      dims.add('DA_BUSINESS_REPORTING');
      reasons.push('fallback specialty BUSINESS_INTELLIGENCE');
    } else if (s.parentSpecialtyCode === 'DATA_ENGINEERING') {
      dims.add('DA_DATA_PIPELINE');
      reasons.push('fallback specialty DATA_ENGINEERING');
    } else if (s.parentSpecialtyCode === 'PREDICTIVE_ANALYTICS') {
      dims.add('DA_PREDICTIVE_MODELING');
      reasons.push('fallback specialty PREDICTIVE_ANALYTICS');
    } else if (s.parentSpecialtyCode === 'DATA_GOVERNANCE') {
      dims.add('DA_GOVERNANCE_QUALITY');
      reasons.push('fallback specialty DATA_GOVERNANCE');
    } else {
      dims.add('DA_BUSINESS_REPORTING');
      reasons.push('fallback DATA_ANALYTICS → reporting');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapDigitalMarketing(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /estrategia digital|planeaci[oó]n estrat[eé]gica|plan(?:es)? de marketing|marketing strategy|alineaci[oó]n con (?:los )?objetivos/.test(
      b,
    )
  ) {
    dims.add('DM_STRATEGY_PLANNING');
    reasons.push('señales de estrategia/planeación de marketing');
  }
  if (
    /campa[nñ]a|publicidad|advertising|pauta|ejecuci[oó]n de campa[nñ]a|seguimiento de campa[nñ]a/.test(
      b,
    )
  ) {
    dims.add('DM_CAMPAIGN_EXECUTION');
    reasons.push('señales de ejecución de campañas/publicidad');
  }
  if (
    /crecimiento|growth|tr[aá]fico web|adquisici[oó]n|portafolio|marketing 360|posicionamiento de productos/.test(
      b,
    )
  ) {
    dims.add('DM_GROWTH_ACQUISITION');
    reasons.push('señales de crecimiento/adquisición');
  }
  if (
    /conversi[oó]n|funnel|embudo|optimizaci[oó]n de embudos|conversion|kpi|okr/.test(
      b,
    )
  ) {
    dims.add('DM_CONVERSION_OPTIMIZATION');
    reasons.push('señales de conversión/embudos/KPIs');
  }
  if (
    /go[\s_-]?to[\s_-]?market|\bgtm\b|ciclo de vida del producto|product marketing|productos? digitales|lanzamiento de producto|an[aá]lisis de mercado/.test(
      b,
    )
  ) {
    dims.add('DM_PRODUCT_GTM');
    reasons.push('señales de producto/GTM');
  }
  if (
    /marca|brand|identidad corporativa|tono de comunicaci[oó]n|visibilidad|posicionamiento|imagen de marca|branding/.test(
      b,
    )
  ) {
    dims.add('DM_BRAND_POSITIONING');
    reasons.push('señales de marca/posicionamiento');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'CAMPAIGN_MARKETING') {
      dims.add('DM_CAMPAIGN_EXECUTION');
      reasons.push('fallback specialty CAMPAIGN_MARKETING');
    } else if (s.parentSpecialtyCode === 'GROWTH_MARKETING') {
      dims.add('DM_CONVERSION_OPTIMIZATION');
      reasons.push('fallback specialty GROWTH_MARKETING');
    } else if (s.parentSpecialtyCode === 'PRODUCT_MARKETING') {
      dims.add('DM_PRODUCT_GTM');
      reasons.push('fallback specialty PRODUCT_MARKETING');
    } else if (s.parentSpecialtyCode === 'BRAND_DIGITAL_MARKETING') {
      dims.add('DM_BRAND_POSITIONING');
      reasons.push('fallback specialty BRAND_DIGITAL_MARKETING');
    } else {
      dims.add('DM_STRATEGY_PLANNING');
      reasons.push('fallback DIGITAL_MARKETING → estrategia');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapPeopleHr(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  // tools alone never activate axes (tools listed separately; blob may include names)
  const toolOnly =
    /^(?:\s*(?:bamboo|workday|sap successfactors|successfactors|adp|softland n[oó]mina|siigo n[oó]mina|talento humano hcm|ats)\s*)+$/i.test(
      b.trim(),
    );

  if (!toolOnly) {
    if (
      /selecci[oó]n(?:\s+de)?\s+personal|reclutamiento|recruiting|hiring|staffing|vinculaci[oó]n(?:\s+de)?\s+(?:personal|pasantes|colaboradores|empleados)|contrataci[oó]n(?:\s+de)?\s+(?:personal|pasantes|colaboradores)/.test(
        b,
      )
    ) {
      dims.add('HR_TALENT_ACQUISITION');
      reasons.push('señales de selección/reclutamiento/vinculación laboral');
    }
    if (
      /descriptivos? de cargo|perfiles? requeridos|perfil(?:es)? de (?:cargo|puesto|rol)|job description|dise[nñ]o de (?:cargos|puestos)/.test(
        b,
      )
    ) {
      dims.add('HR_ROLE_PROFILING');
      reasons.push('señales de perfiles/descriptivos de cargo');
    }
    if (
      /integraci[oó]n(?:\s+de)?(?:\s+nuevo)?\s+talento|onboarding(?:\s+de)?\s+(?:personal|colaboradores|empleados)|inducci[oó]n(?:\s+de)?\s+(?:personal|colaboradores)|incorporaci[oó]n(?:\s+de)?\s+(?:personal|colaboradores)/.test(
        b,
      )
    ) {
      dims.add('HR_ONBOARDING_INTEGRATION');
      reasons.push('señales de integración/onboarding de talento');
    }
    if (
      /turnos?(?:\s+del)?\s+personal|permisos?(?:\s+del)?\s+personal|coordinaci[oó]n(?:\s+de)?\s+(?:turnos|permisos)|administraci[oó]n operativa(?:\s+de)?\s+personal|ops(?:\s+de)?\s+personal/.test(
        b,
      )
    ) {
      dims.add('HR_WORKFORCE_OPS');
      reasons.push('señales de ops de personal (turnos/permisos)');
    }
    if (
      /capacitaci[oó]n(?:es)?(?:\s+del|\s+al|\s+de)?\s+personal|formaci[oó]n(?:\s+del|\s+al|\s+de)?\s+personal|entrenamiento(?:\s+del|\s+al|\s+de)?\s+personal|people learning/.test(
        b,
      )
    ) {
      dims.add('HR_PEOPLE_LEARNING');
      reasons.push('señales de capacitación del personal');
    }
    if (
      /bienestar(?:\s+laboral|\s+organizacional)?|actividades internas|eventos corporativos internos|clima laboral|cultura organizacional/.test(
        b,
      )
    ) {
      dims.add('HR_WELLBEING_INTERNAL');
      reasons.push('señales de bienestar/actividades internas');
    }
    if (
      /entrevista(?:s)? de retiro|exit interview|desvinculaci[oó]n(?:\s+de)?\s+(?:personal|colaboradores|empleados)|offboarding|separaci[oó]n laboral/.test(
        b,
      )
    ) {
      dims.add('HR_EXIT_SEPARATION');
      reasons.push('señales de retiro/desvinculación');
    }
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'TALENT_ACQUISITION') {
      dims.add('HR_TALENT_ACQUISITION');
      reasons.push('fallback specialty TALENT_ACQUISITION');
    } else if (s.parentSpecialtyCode === 'WORKFORCE_ADMINISTRATION') {
      dims.add('HR_WORKFORCE_OPS');
      reasons.push('fallback specialty WORKFORCE_ADMINISTRATION');
    } else {
      dims.add('HR_TALENT_ACQUISITION');
      reasons.push('fallback PEOPLE_HR → talent acquisition');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapCustomerSuccess(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /vinculaci[oó]n|admisi[oó]n|matr[ií]cul|captaci[oó]n|onboarding|alta de (?:cliente|usuario|aspirante)|incorporaci[oó]n|enrollment|intake/.test(
      b,
    )
  ) {
    dims.add('CS_INTAKE_ENROLLMENT');
    reasons.push('señales de vinculación/admisión/intake');
  }
  if (
    /ciclo (?:de vida|integral)|lifecycle|seguimiento (?:de |a )?(?:prospect|cliente|usuario|aspirante)|embudo|funnel|cuidado (?:del|de la) (?:cliente|relaci[oó]n)/.test(
      b,
    )
  ) {
    dims.add('CS_LIFECYCLE_FOLLOWUP');
    reasons.push('señales de ciclo de vida/seguimiento');
  }
  if (
    /retenci[oó]n|fidelizaci[oó]n|postventa|post[\s_-]?venta|lealtad|permanencia|loyalty|evitar (?:abandono|cancelaci[oó]n|deserción)/.test(
      b,
    )
  ) {
    dims.add('CS_RETENTION_LOYALTY');
    reasons.push('señales de retención/fidelización');
  }
  if (
    /servicio al cliente|atenci[oó]n al (?:cliente|usuario)|pqrs|soporte|resoluci[oó]n de (?:conflicto|caso|queja)|customer service|help ?desk/.test(
      b,
    )
  ) {
    dims.add('CS_SERVICE_RESOLUTION');
    reasons.push('señales de servicio/atención/soporte');
  }
  if (
    /asesor[ií]a|acompa[nñ]amiento|orientaci[oó]n (?:al|de) (?:cliente|usuario|aspirante)|relaci[oó]n (?:con el |con la )?(?:cliente|usuario)|account (?:care|management)/.test(
      b,
    )
  ) {
    dims.add('CS_RELATIONSHIP_ADVISING');
    reasons.push('señales de asesoría/acompañamiento');
  }
  if (
    /cierre consultivo|venta consultiva|negociaci[oó]n|metas? comerciales|conversi[oó]n comercial|prospecci[oó]n|portabilidad|cierre de (?:venta|vinculaci[oó]n)|comercial b2b/.test(
      b,
    )
  ) {
    dims.add('CS_COMMERCIAL_CONVERSION');
    reasons.push('señales de conversión comercial');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'CUSTOMER_INTAKE_ONBOARDING') {
      dims.add('CS_INTAKE_ENROLLMENT');
      reasons.push('fallback specialty CUSTOMER_INTAKE_ONBOARDING');
    } else if (s.parentSpecialtyCode === 'CUSTOMER_LIFECYCLE_CARE') {
      dims.add('CS_LIFECYCLE_FOLLOWUP');
      reasons.push('fallback specialty CUSTOMER_LIFECYCLE_CARE');
    } else if (s.parentSpecialtyCode === 'CUSTOMER_RETENTION_LOYALTY') {
      dims.add('CS_RETENTION_LOYALTY');
      reasons.push('fallback specialty CUSTOMER_RETENTION_LOYALTY');
    } else if (s.parentSpecialtyCode === 'CUSTOMER_SERVICE_SUPPORT') {
      dims.add('CS_SERVICE_RESOLUTION');
      reasons.push('fallback specialty CUSTOMER_SERVICE_SUPPORT');
    } else {
      dims.add('CS_RELATIONSHIP_ADVISING');
      reasons.push('fallback CUSTOMER_SUCCESS → asesoría');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapItSystems(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /(?:administraci[oó]n|dise[nñ]o|planificaci[oó]n|monitoreo|gesti[oó]n)(?:\s+de)?\s+redes?|redes?\s+(?:lan|wan|vpn|wireless|wifi)|infraestructura de red|\b(?:lan|wan|vpn|wifi|wireless)\b|routers?|switches?|conectividad(?:\s+de\s+red)?|telecomunicaciones/.test(
      b,
    )
  ) {
    dims.add('IT_NETWORKING');
    reasons.push('señales de redes/conectividad');
  }
  if (
    /mesa de ayuda|help\s?desk|soporte(?:\s+t[eé]cnico|\s+ofim[aá]tico|\s+a\s+usuarios|\s+especializado)?|incidentes?(?:\s+de)?(?:\s+(?:conectividad|ti|sistemas|infra))?|ans\b|acuerdos? de nivel de servicio|\bsla\b/.test(
      b,
    )
  ) {
    dims.add('IT_SERVICE_DESK');
    reasons.push('señales de mesa de ayuda/soporte');
  }
  if (
    /servidores?(?:\s+(?:f[ií]sicos?|virtuales?))?|sistemas operativos|windows server|\blinux\b|active directory|\bvirtualizaci[oó]n\b|mantenimiento(?:\s+(?:preventivo|correctivo))?(?:\s+de)?(?:\s+(?:infra(?:estructura)?|sistemas?|servidores?))?/.test(
      b,
    )
  ) {
    dims.add('IT_SYSADMIN');
    reasons.push('señales de administración de sistemas');
  }
  if (
    /seguridad perimetral|firewalls?|parches?(?:\s+de)?(?:\s+seguridad)?|respaldos?|\bbackups?\b|pol[ií]ticas? de (?:seguridad|respaldo)|aseguramiento operativo|seguridad operativa/.test(
      b,
    )
  ) {
    dims.add('IT_SECURITY_OPS');
    reasons.push('señales de seguridad operativa');
  }
  if (
    /inventarios?(?:\s+de)?(?:\s+(?:equipos?|activos?|hardware|ti))?|endpoints?|equipos? de c[oó]mputo|activos? de ti|inventario tecnol[oó]gico/.test(
      b,
    )
  ) {
    dims.add('IT_ENDPOINTS_ASSETS');
    reasons.push('señales de endpoints/inventarios');
  }
  if (
    /continuidad(?:\s+(?:operativa|de servicios|de negocio|del servicio))?|disponibilidad|servicios? cr[ií]ticos?|disaster recovery|\bdrp\b|\bbcp\b|uptime|reduc(?:ci[oó]n|ir)\s+(?:de\s+)?(?:tasas?\s+de\s+)?incidentes/.test(
      b,
    )
  ) {
    dims.add('IT_AVAILABILITY_CONTINUITY');
    reasons.push('señales de disponibilidad/continuidad');
  }
  if (
    /proveedores?\s+(?:estrat[eé]gicos?|de\s+(?:red|conectividad|telecom(?:unicaciones)?|ti|infraestructura))|gesti[oó]n de proveedores|acuerdos? de nivel de servicio con proveedores|ans con proveedores/.test(
      b,
    )
  ) {
    dims.add('IT_VENDOR_SLA');
    reasons.push('señales de proveedores/ANS');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'NETWORK_INFRASTRUCTURE') {
      dims.add('IT_NETWORKING');
      reasons.push('fallback specialty NETWORK_INFRASTRUCTURE');
    } else if (s.parentSpecialtyCode === 'IT_SERVICE_DESK') {
      dims.add('IT_SERVICE_DESK');
      reasons.push('fallback specialty IT_SERVICE_DESK');
    } else if (s.parentSpecialtyCode === 'SYSTEMS_ADMINISTRATION') {
      dims.add('IT_SYSADMIN');
      reasons.push('fallback specialty SYSTEMS_ADMINISTRATION');
    } else if (s.parentSpecialtyCode === 'IT_SECURITY_OPERATIONS') {
      dims.add('IT_SECURITY_OPS');
      reasons.push('fallback specialty IT_SECURITY_OPERATIONS');
    } else {
      dims.add('IT_SYSADMIN');
      reasons.push('fallback IT_SYSTEMS → systems administration');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

function mapLegal(s: SkillMappingInput): SkillDimensionMapping {
  const b = semanticBlobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (
    /asesor[ií]a jur[ií]dica|asesor[ií]a legal|interpretaci[oó]n jur[ií]dica|acompa[nñ]amiento (?:jur[ií]dico|legal)|counsel|legal advisory|abogado (?:litigante|asesor|independiente)/.test(
      b,
    )
  ) {
    dims.add('LEGAL_ADVISORY');
    reasons.push('señales de asesoría jurídica');
  }
  if (
    /an[aá]lisis normativo|conceptos? jur[ií]dicos?|actos administrativos|cumplimiento normativo|derecho administrativo|riesgos? normativ/.test(
      b,
    )
  ) {
    dims.add('LEGAL_ANALYSIS_NORMATIVE');
    reasons.push('señales de análisis normativo/administrativo');
  }
  if (
    /(?:elaboraci[oó]n|redacci[oó]n|revisi[oó]n|estructuraci[oó]n)(?:\s+de)?\s+(?:documentos?|escritos?|minutas?|pliegos?|conceptos?)(?:\s+jur[ií]dicos?)?|documentaci[oó]n jur[ií]dica|escritos? procesales|demandas?|contestaci[oó]n(?:es)? de demandas?/.test(
      b,
    )
  ) {
    dims.add('LEGAL_DOCUMENTATION');
    reasons.push('señales de documentación jurídica');
  }
  if (
    /seguimiento procesal|procedimientos? jur[ií]dicos?|tr[aá]mites? (?:judiciales?|notariales?)|representaci[oó]n legal|actuaciones? (?:procesales?|jur[ií]dicas?)|expedientes? (?:judiciales?|procesales?)/.test(
      b,
    )
  ) {
    dims.add('LEGAL_PROCEDURE');
    reasons.push('señales de procedimiento jurídico');
  }
  if (
    /contrataci[oó]n (?:estatal|p[uú]blica)|procesos? (?:precontractual(?:es)?|contractual(?:es)?|postcontractual(?:es)?)|pliegos?(?:\s+de)?(?:\s+condiciones)?|minutas? contractuales|expedientes? contractuales|acompa[nñ]amiento (?:jur[ií]dico|legal)(?:\s+en)?(?:\s+contrataci[oó]n)?/.test(
      b,
    )
  ) {
    dims.add('PUBLIC_CONTRACTING_LEGAL');
    reasons.push('señales de contratación estatal jurídica');
  }
  if (
    /litigio|litigante|controversias?|demandas? (?:laborales?|civiles?|comerciales?)|representaci[oó]n (?:en|ante) (?:tribunales?|juzgados?)|procesos? (?:judiciales?|contenciosos?)/.test(
      b,
    )
  ) {
    dims.add('LITIGATION_DISPUTES');
    reasons.push('señales de litigio/controversias');
  }

  if (dims.size === 0) {
    if (s.parentSpecialtyCode === 'LEGAL_ADVISORY') {
      dims.add('LEGAL_ADVISORY');
      reasons.push('fallback specialty LEGAL_ADVISORY');
    } else if (s.parentSpecialtyCode === 'LEGAL_DOCUMENT_DRAFTING') {
      dims.add('LEGAL_DOCUMENTATION');
      reasons.push('fallback specialty LEGAL_DOCUMENT_DRAFTING');
    } else if (s.parentSpecialtyCode === 'PUBLIC_SECTOR_CONTRACTING') {
      dims.add('PUBLIC_CONTRACTING_LEGAL');
      reasons.push('fallback specialty PUBLIC_SECTOR_CONTRACTING');
    } else if (s.parentSpecialtyCode === 'ADMINISTRATIVE_LAW') {
      dims.add('LEGAL_ANALYSIS_NORMATIVE');
      reasons.push('fallback specialty ADMINISTRATIVE_LAW');
    } else if (s.parentSpecialtyCode === 'LITIGATION_DISPUTES') {
      dims.add('LITIGATION_DISPUTES');
      reasons.push('fallback specialty LITIGATION_DISPUTES');
    }
  }

  return {
    skillCode: s.skillCode,
    dimensionCodes: [...dims],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: reasons.join('; '),
  };
}

export function mapSkillToDimensions(
  s: SkillMappingInput,
): SkillDimensionMapping {
  if (s.parentFieldCode === 'VISUAL_DESIGN') return mapVisualDesign(s);
  if (s.parentFieldCode === 'EDUCATION') return mapEducation(s);
  if (s.parentFieldCode === 'PROJECT_PROGRAM_MGMT') {
    return mapProjectProgramMgmt(s);
  }
  if (s.parentFieldCode === 'FINANCE_ADMIN') return mapFinanceAdmin(s);
  if (s.parentFieldCode === 'SOFTWARE_ENGINEERING') {
    return mapSoftwareEngineering(s);
  }
  if (s.parentFieldCode === 'AUDIOVISUAL_PRODUCTION') {
    return mapAudiovisualProduction(s);
  }
  if (s.parentFieldCode === 'COMMUNICATIONS') {
    return mapCommunications(s);
  }
  if (s.parentFieldCode === 'DATA_ANALYTICS') {
    return mapDataAnalytics(s);
  }
  if (s.parentFieldCode === 'DIGITAL_MARKETING') {
    return mapDigitalMarketing(s);
  }
  if (s.parentFieldCode === 'CUSTOMER_SUCCESS') {
    return mapCustomerSuccess(s);
  }
  if (s.parentFieldCode === 'PEOPLE_HR') {
    return mapPeopleHr(s);
  }
  if (s.parentFieldCode === 'IT_SYSTEMS') {
    return mapItSystems(s);
  }
  if (s.parentFieldCode === 'LEGAL') {
    return mapLegal(s);
  }
  // Campos sin heurística piloto: sin dimensiones (no cross-field inventado)
  return {
    skillCode: s.skillCode,
    dimensionCodes: [],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: `no dimension mapper for field ${s.parentFieldCode} in 8E pilot`,
  };
}
