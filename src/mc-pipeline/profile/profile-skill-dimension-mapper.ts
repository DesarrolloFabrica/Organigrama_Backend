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

function mapVisualDesign(s: SkillMappingInput): SkillDimensionMapping {
  const b = blobOf(s);
  const dims = new Set<string>();
  const reasons: string[] = [];

  if (/editorial|maquet|ebook|revista|folleto|indesign/.test(b)) {
    dims.add('VD_EDITORIAL');
    reasons.push('señales editoriales/maquetación');
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
  if (/ui|interfaz|ux|producto digital|design system|pantalla/.test(b)) {
    dims.add('VD_PRODUCT_INTERFACE');
    reasons.push('señales de interfaz/producto');
  }
  if (/ilustraci[oó]n|illustration|personaje/.test(b)) {
    dims.add('VD_ILLUSTRATION');
    reasons.push('señales de ilustración');
  }
  if (/motion|animaci[oó]n|after effects|capcut|premiere/.test(b)) {
    dims.add('VD_MOTION');
    reasons.push('señales de motion/video');
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
  // Campos sin heurística piloto: sin dimensiones (no cross-field inventado)
  return {
    skillCode: s.skillCode,
    dimensionCodes: [],
    supportingEvidenceUnitIds: [...s.supportingEvidenceUnitIds],
    mappingJustification: `no dimension mapper for field ${s.parentFieldCode} in 8E pilot`,
  };
}
