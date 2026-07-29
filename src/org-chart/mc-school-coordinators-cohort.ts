/**
 * MC1 — Cohorte piloto MVP coordinadores de escuela.
 *
 * Identidad y señales de capacidad: funciones puras.
 * El cargo solo identifica a la persona; no clasifica competencias profesionales.
 */

export type SchoolCoordinatorIdentityStatus =
  | 'RESOLVED'
  | 'IDENTITY_MANUAL_REVIEW';

export type SchoolCoordinatorPipelineState =
  | 'HEALTHY_CURRENT'
  | 'STALE_SELECTED_EXTRACTION'
  | 'NO_USABLE_EXTRACTION'
  | 'NO_PERSON_CV'
  | 'PDF_NOT_ACCESSIBLE'
  | 'SAME_CONTENT_DIFFERENT_FILE_ID'
  | 'RUNNING_OR_PENDING'
  | 'MANUAL_REVIEW';

export type SchoolCoordinatorContentClass =
  | 'SAME_CONTENT_DIFFERENT_FILE_ID'
  | 'DIFFERENT_CONTENT'
  | 'UNVERIFIABLE'
  | 'NOT_APPLICABLE';

export type SchoolCoordinatorC1Action =
  | 'NO_ACTION'
  | 'EVALUATE_CURRENT_EXTRACTION'
  | 'REEXTRACT'
  | 'FIRST_EXTRACTION'
  | 'BLOCKED_NO_CV'
  | 'MANUAL_REVIEW'
  | 'REPOINT_OR_METADATA_REPAIR';

export type SchoolCoordinatorEvidenceLevel =
  | 'STRONG_PROFESSIONAL_EVIDENCE'
  | 'MODERATE_PROFESSIONAL_EVIDENCE'
  | 'TOOL_OR_TERM_ONLY'
  | 'EDUCATION_ONLY'
  | 'INFERRED_FROM_ROLE'
  | 'NO_EVIDENCE';

export type ProvisionalClusterCode =
  | 'ACADEMIC_MANAGEMENT'
  | 'EDUCATION_AND_PEDAGOGY'
  | 'BUSINESS_MANAGEMENT'
  | 'CULTURAL_AND_ARTISTIC_MANAGEMENT'
  | 'ENGINEERING_MANAGEMENT'
  | 'LEADERSHIP_AND_PROJECTS'
  | 'QUALITY_ASSURANCE'
  | 'OTHER';

export type ClusterSignalClass =
  | 'ISOLATED_SIGNAL'
  | 'REPEATED_CROSS_PROFILE_SIGNAL'
  | 'DOMAIN_CANDIDATE'
  | 'SPECIALTY_CANDIDATE'
  | 'CROSS_DOMAIN_CAPABILITY';

export type NewDomainDiagnosis =
  | 'NO_NEW_DOMAIN_SIGNAL'
  | 'WEAK_NEW_DOMAIN_SIGNAL'
  | 'DOMAIN_CANDIDATE_REQUIRES_MORE_PROFILES'
  | 'STRONG_DOMAIN_CANDIDATE'
  | 'MULTIPLE_DOMAIN_CANDIDATES';

export type SchoolCoordinatorExpected = {
  key: string;
  expectedName: string;
  expectedRoleNeedle: string;
  schoolLabel: string;
};

/** Dominios oficiales evaluables en C1 (HUMAN_RESOURCES no es operativo). */
export const SCHOOL_COORDINATORS_OPERATIVE_DOMAINS = [
  { domainCode: 'SOFTWARE', rulesVersion: 'pa2-software-1.1.0' },
  { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
  {
    domainCode: 'AUDIOVISUAL_PRODUCTION',
    rulesVersion: 'pa2-audiovisual-production-1.0.0',
  },
] as const;

export const SCHOOL_COORDINATORS_DISCOVERED_DOMAINS = [
  'HUMAN_RESOURCES',
] as const;

export const SCHOOL_COORDINATORS_EXPECTED: readonly SchoolCoordinatorExpected[] =
  [
    {
      key: 'viviana',
      expectedName: 'Viviana Andrea Cabrera Cabrera',
      expectedRoleNeedle: 'coordinador escuela de ingenieria',
      schoolLabel: 'Escuela de Ingeniería',
    },
    {
      key: 'maira',
      expectedName: 'Maira Alejandra Doncel Largo',
      expectedRoleNeedle: 'coordinador escuela de transversales',
      schoolLabel: 'Escuela de Transversales',
    },
    {
      key: 'andres',
      expectedName: 'Andrés Felipe Prieto Lizarazo',
      expectedRoleNeedle: 'coordinador escuela de negocios',
      schoolLabel: 'Escuela de Negocios',
    },
    {
      key: 'carlos',
      expectedName: 'Carlos Andrés Rodríguez',
      expectedRoleNeedle: 'coordinador escuela de bellas artes',
      schoolLabel: 'Escuela de Bellas Artes',
    },
    {
      key: 'aura',
      expectedName: 'Aura Marcela Royero Vergara',
      expectedRoleNeedle: 'coordinador escuela de transformacion empresarial',
      schoolLabel: 'Escuela de Transformación Empresarial',
    },
  ] as const;

/** Familias de búsqueda (no competencias a insertar). */
export const CAPABILITY_FAMILY_NEEDLES: Record<
  string,
  { cluster: ProvisionalClusterCode; needles: string[] }
> = {
  GESTION_ACADEMICA: {
    cluster: 'ACADEMIC_MANAGEMENT',
    needles: [
      'gestion academica',
      'coordinacion academica',
      'planeacion academica',
      'seguimiento docente',
      'gestion de programas',
      'gestion curricular',
      'diseno curricular',
      'evaluacion academica',
      'registro calificado',
      'acreditacion',
      'autoevaluacion',
      'gestion de indicadores',
      'gestion estudiantil',
      'coordinador academico',
      'coordinacion de programa',
      'programa academico',
    ],
  },
  EDUCACION_PEDAGOGIA: {
    cluster: 'EDUCATION_AND_PEDAGOGY',
    needles: [
      'docencia',
      'pedagogia',
      'diseno instruccional',
      'evaluacion del aprendizaje',
      'formacion docente',
      'educacion virtual',
      'educacion presencial',
      'ambientes de aprendizaje',
      'didactica',
      'investigacion educativa',
      'innovacion educativa',
      'contenidos educativos',
      'tutor',
      'facilitador',
    ],
  },
  LIDERAZGO_GESTION: {
    cluster: 'LEADERSHIP_AND_PROJECTS',
    needles: [
      'liderazgo de equipos',
      'liderazgo',
      'gestion de proyectos',
      'planeacion estrategica',
      'toma de decisiones',
      'gestion del cambio',
      'resolucion de conflictos',
      'gestion de stakeholders',
      'gestion de presupuesto',
      'seguimiento de indicadores',
      'mejora de procesos',
      'direccion de equipos',
    ],
  },
  INGENIERIA_TECNOLOGIA: {
    cluster: 'ENGINEERING_MANAGEMENT',
    needles: [
      'ingenieria de software',
      'desarrollo de software',
      'analitica de datos',
      'sistemas de informacion',
      'automatizacion',
      'infraestructura tecnologica',
      'gestion tecnologica',
      'investigacion aplicada',
      'proyectos tecnologicos',
      'arquitectura de software',
      'devops',
    ],
  },
  NEGOCIOS: {
    cluster: 'BUSINESS_MANAGEMENT',
    needles: [
      'administracion de empresas',
      'estrategia empresarial',
      'emprendimiento',
      'innovacion empresarial',
      'mercadeo',
      'marketing',
      'finanzas',
      'gestion comercial',
      'modelos de negocio',
      'consultoria',
      'gestion organizacional',
      'transformacion empresarial',
      'negocios',
    ],
  },
  ARTES_CULTURA: {
    cluster: 'CULTURAL_AND_ARTISTIC_MANAGEMENT',
    needles: [
      'artes visuales',
      'creacion artistica',
      'produccion cultural',
      'gestion cultural',
      'direccion artistica',
      'investigacion creacion',
      'artes escenicas',
      'curaduria',
      'produccion de eventos',
      'pedagogia artistica',
      'bellas artes',
      'musica',
      'diseno grafico',
    ],
  },
  CALIDAD: {
    cluster: 'QUALITY_ASSURANCE',
    needles: [
      'aseguramiento de calidad',
      'sistema de gestion de calidad',
      'iso 9001',
      'auditoria interna',
      'mejora continua',
      'indicadores de calidad',
    ],
  },
};

export const MATRIX_COMPETENCY_ROWS: Array<{
  key: string;
  label: string;
  family: string;
  needles: string[];
}> = [
  {
    key: 'gestion_academica',
    label: 'Gestión académica',
    family: 'gestion academica',
    needles: [
      'gestion academica',
      'coordinacion academica',
      'planeacion academica',
      'gestion curricular',
      'programa academico',
    ],
  },
  {
    key: 'pedagogia',
    label: 'Pedagogía / docencia',
    family: 'pedagogia',
    needles: [
      'docencia',
      'pedagogia',
      'didactica',
      'diseno instruccional',
      'formacion docente',
    ],
  },
  {
    key: 'liderazgo',
    label: 'Liderazgo de equipos',
    family: 'liderazgo',
    needles: ['liderazgo', 'direccion de equipos', 'gestion de equipos'],
  },
  {
    key: 'investigacion',
    label: 'Investigación',
    family: 'investigacion',
    needles: [
      'investigacion',
      'investigacion educativa',
      'investigacion aplicada',
      'investigacion creacion',
    ],
  },
  {
    key: 'tecnologia',
    label: 'Tecnología / ingeniería',
    family: 'tecnologia',
    needles: [
      'desarrollo de software',
      'ingenieria',
      'sistemas de informacion',
      'analitica de datos',
      'automatizacion',
    ],
  },
  {
    key: 'negocios',
    label: 'Negocios / gestión empresarial',
    family: 'negocios',
    needles: [
      'negocios',
      'emprendimiento',
      'mercadeo',
      'marketing',
      'finanzas',
      'transformacion empresarial',
      'estrategia empresarial',
    ],
  },
  {
    key: 'creatividad_artes',
    label: 'Creatividad y artes',
    family: 'creatividad y artes',
    needles: [
      'artes',
      'diseno',
      'musica',
      'gestion cultural',
      'produccion cultural',
      'creacion artistica',
    ],
  },
  {
    key: 'gestion_proyectos',
    label: 'Gestión de proyectos',
    family: 'gestion de proyectos',
    needles: [
      'gestion de proyectos',
      'planeacion estrategica',
      'seguimiento de indicadores',
    ],
  },
  {
    key: 'calidad',
    label: 'Aseguramiento de calidad',
    family: 'aseguramiento de calidad',
    needles: [
      'aseguramiento de calidad',
      'acreditacion',
      'registro calificado',
      'autoevaluacion',
      'iso 9001',
    ],
  },
];

export function normalizeSchoolText(
  input: string | null | undefined,
): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function nameTokens(fullName: string): string[] {
  return normalizeSchoolText(fullName).split(' ').filter(Boolean);
}

export function personNameMatchesExpected(
  personFullName: string,
  expectedName: string,
): boolean {
  const tokens = nameTokens(expectedName);
  const hay = normalizeSchoolText(personFullName);
  return tokens.length > 0 && tokens.every((t) => hay.includes(t));
}

export function roleMatchesExpected(
  roleName: string | null | undefined,
  expectedRoleNeedle: string,
): boolean {
  return normalizeSchoolText(roleName).includes(
    normalizeSchoolText(expectedRoleNeedle),
  );
}

export type PersonIdentityCandidate = {
  personId: string;
  document: string | null;
  fullName: string;
  roleName: string | null;
  email: string | null;
  isActive: boolean;
};

/**
 * Resuelve identidad: match por nombre + verificación de rol.
 * Ambigüedad o mismatch → IDENTITY_MANUAL_REVIEW.
 */
export function resolveSchoolCoordinatorIdentity(
  expected: SchoolCoordinatorExpected,
  people: readonly PersonIdentityCandidate[],
): {
  status: SchoolCoordinatorIdentityStatus;
  reason: string;
  matches: PersonIdentityCandidate[];
  selected: PersonIdentityCandidate | null;
} {
  const byName = people.filter((p) =>
    personNameMatchesExpected(p.fullName, expected.expectedName),
  );
  if (byName.length === 0) {
    return {
      status: 'IDENTITY_MANUAL_REVIEW',
      reason: 'NO_NAME_MATCH',
      matches: [],
      selected: null,
    };
  }

  const byRole = byName.filter((p) =>
    roleMatchesExpected(p.roleName, expected.expectedRoleNeedle),
  );
  const pool = byRole.length > 0 ? byRole : byName;

  if (pool.length > 1) {
    return {
      status: 'IDENTITY_MANUAL_REVIEW',
      reason: 'AMBIGUOUS_MATCHES',
      matches: pool,
      selected: null,
    };
  }

  const selected = pool[0];
  if (!selected.document?.trim()) {
    return {
      status: 'IDENTITY_MANUAL_REVIEW',
      reason: 'NO_DOCUMENT',
      matches: pool,
      selected: null,
    };
  }
  if (!roleMatchesExpected(selected.roleName, expected.expectedRoleNeedle)) {
    return {
      status: 'IDENTITY_MANUAL_REVIEW',
      reason: 'ROLE_MISMATCH',
      matches: pool,
      selected: null,
    };
  }
  if (!selected.isActive) {
    return {
      status: 'IDENTITY_MANUAL_REVIEW',
      reason: 'PERSON_INACTIVE',
      matches: pool,
      selected: null,
    };
  }

  return {
    status: 'RESOLVED',
    reason: 'OK',
    matches: pool,
    selected,
  };
}

export function classifySchoolPipelineState(input: {
  hasActivePersonCv: boolean;
  activeCvDriveFileId: string | null;
  activeExtraction: {
    status: string;
    isActive: boolean;
    driveFileId: string | null;
  } | null;
  hasRunningOrPending: boolean;
  pdfAccessible?: boolean | null;
}): SchoolCoordinatorPipelineState {
  if (input.hasRunningOrPending) return 'RUNNING_OR_PENDING';
  if (!input.hasActivePersonCv) return 'NO_PERSON_CV';
  if (input.pdfAccessible === false) return 'PDF_NOT_ACCESSIBLE';
  if (!input.activeExtraction || input.activeExtraction.status !== 'SUCCEEDED') {
    return 'NO_USABLE_EXTRACTION';
  }
  const cvFile = input.activeCvDriveFileId?.trim() || '';
  const extFile = input.activeExtraction.driveFileId?.trim() || '';
  if (cvFile && extFile && cvFile !== extFile) {
    return 'STALE_SELECTED_EXTRACTION';
  }
  return 'HEALTHY_CURRENT';
}

export function classifySchoolContentClass(input: {
  cvDriveFileId: string | null;
  extractionDriveFileId: string | null;
  cvSha256: string | null;
  extractionSha256: string | null;
}): SchoolCoordinatorContentClass {
  const cvSha = input.cvSha256?.toLowerCase() || null;
  const extSha = input.extractionSha256?.toLowerCase() || null;
  if (!cvSha || !extSha) return 'UNVERIFIABLE';
  if (cvSha === extSha) {
    const cvF = input.cvDriveFileId || '';
    const exF = input.extractionDriveFileId || '';
    if (cvF && exF && cvF !== exF) return 'SAME_CONTENT_DIFFERENT_FILE_ID';
    return 'NOT_APPLICABLE';
  }
  return 'DIFFERENT_CONTENT';
}

export function actionForSchoolC1(input: {
  identityStatus: SchoolCoordinatorIdentityStatus;
  pipelineState: SchoolCoordinatorPipelineState | null;
  contentClass?: SchoolCoordinatorContentClass | null;
  inActiveVersion: boolean;
}): SchoolCoordinatorC1Action {
  if (input.identityStatus !== 'RESOLVED') return 'MANUAL_REVIEW';
  if (!input.inActiveVersion) return 'MANUAL_REVIEW';
  switch (input.pipelineState) {
    case 'HEALTHY_CURRENT':
      return 'EVALUATE_CURRENT_EXTRACTION';
    case 'STALE_SELECTED_EXTRACTION':
      if (input.contentClass === 'SAME_CONTENT_DIFFERENT_FILE_ID') {
        return 'REPOINT_OR_METADATA_REPAIR';
      }
      if (input.contentClass === 'UNVERIFIABLE') return 'MANUAL_REVIEW';
      return 'REEXTRACT';
    case 'NO_USABLE_EXTRACTION':
      return 'FIRST_EXTRACTION';
    case 'NO_PERSON_CV':
    case 'PDF_NOT_ACCESSIBLE':
      return 'BLOCKED_NO_CV';
    case 'RUNNING_OR_PENDING':
    case 'MANUAL_REVIEW':
    case 'SAME_CONTENT_DIFFERENT_FILE_ID':
      return 'MANUAL_REVIEW';
    default:
      return 'MANUAL_REVIEW';
  }
}

export type CapabilityHitInput = {
  text: string;
  skillType?: string | null;
  evidenceLevel?: string | null;
  hasWorkExperience?: boolean | null;
  sourceType?: string | null;
};

export function matchCapabilityFamilies(text: string): string[] {
  const n = normalizeSchoolText(text);
  const out: string[] = [];
  for (const [family, def] of Object.entries(CAPABILITY_FAMILY_NEEDLES)) {
    if (def.needles.some((needle) => n.includes(normalizeSchoolText(needle)))) {
      out.push(family);
    }
  }
  return out;
}

/**
 * Nivel de evidencia para publicación MVP.
 * Nunca usa cargo/escuela (INFERRED_FROM_ROLE solo si se marca explícitamente).
 */
export function classifyCapabilityEvidenceLevel(
  hit: CapabilityHitInput,
  opts?: { inferredFromRole?: boolean },
): SchoolCoordinatorEvidenceLevel {
  if (opts?.inferredFromRole) return 'INFERRED_FROM_ROLE';
  const text = normalizeSchoolText(hit.text);
  if (!text) return 'NO_EVIDENCE';

  const skillType = normalizeSchoolText(hit.skillType);
  const level = normalizeSchoolText(hit.evidenceLevel);
  const source = normalizeSchoolText(hit.sourceType);

  if (skillType === 'tool' || skillType === 'methodology') {
    if (!hit.hasWorkExperience && level !== 'strong' && level !== 'moderate') {
      return 'TOOL_OR_TERM_ONLY';
    }
  }

  if (
    source === 'education' ||
    (level === 'weak' && source.includes('education'))
  ) {
    if (!hit.hasWorkExperience) return 'EDUCATION_ONLY';
  }

  if (level === 'strong' || hit.hasWorkExperience === true) {
    return 'STRONG_PROFESSIONAL_EVIDENCE';
  }
  if (level === 'moderate') return 'MODERATE_PROFESSIONAL_EVIDENCE';
  if (level === 'weak' || level === 'none') {
    return hit.hasWorkExperience
      ? 'MODERATE_PROFESSIONAL_EVIDENCE'
      : 'TOOL_OR_TERM_ONLY';
  }

  // Extracción sin evidence engine: heurística por tipo de fuente
  if (
    source === 'work_experience' ||
    source === 'responsibility' ||
    source === 'achievement'
  ) {
    return 'STRONG_PROFESSIONAL_EVIDENCE';
  }
  if (source === 'profile_summary') return 'MODERATE_PROFESSIONAL_EVIDENCE';
  if (source === 'education') return 'EDUCATION_ONLY';

  return 'MODERATE_PROFESSIONAL_EVIDENCE';
}

export function isPublishableCapability(
  level: SchoolCoordinatorEvidenceLevel,
): boolean {
  return (
    level === 'STRONG_PROFESSIONAL_EVIDENCE' ||
    level === 'MODERATE_PROFESSIONAL_EVIDENCE'
  );
}

export type MatrixCellStrength = 'STRONG' | 'MODERATE' | 'WEAK' | 'ABSENT';

export function matrixStrengthFromLevels(
  levels: SchoolCoordinatorEvidenceLevel[],
): MatrixCellStrength {
  if (levels.includes('STRONG_PROFESSIONAL_EVIDENCE')) return 'STRONG';
  if (levels.includes('MODERATE_PROFESSIONAL_EVIDENCE')) return 'MODERATE';
  if (
    levels.includes('TOOL_OR_TERM_ONLY') ||
    levels.includes('EDUCATION_ONLY')
  ) {
    return 'WEAK';
  }
  return 'ABSENT';
}

export function classifyClusterSignal(input: {
  personCount: number;
  strongHits: number;
  coveredByOperativeDomain: boolean;
}): ClusterSignalClass {
  if (input.coveredByOperativeDomain) return 'CROSS_DOMAIN_CAPABILITY';
  if (input.personCount >= 3 && input.strongHits >= 4) return 'DOMAIN_CANDIDATE';
  if (input.personCount >= 2) return 'REPEATED_CROSS_PROFILE_SIGNAL';
  if (input.personCount === 1 && input.strongHits >= 2) {
    return 'SPECIALTY_CANDIDATE';
  }
  return 'ISOLATED_SIGNAL';
}

export function diagnoseNewDomainOverall(input: {
  clusters: Array<{
    signalClass: ClusterSignalClass;
    personCount: number;
  }>;
  profilesWithoutRepresentableDomain: number;
}): NewDomainDiagnosis {
  const domainCandidates = input.clusters.filter(
    (c) => c.signalClass === 'DOMAIN_CANDIDATE',
  );
  const repeated = input.clusters.filter(
    (c) =>
      c.signalClass === 'REPEATED_CROSS_PROFILE_SIGNAL' ||
      c.signalClass === 'SPECIALTY_CANDIDATE',
  );

  if (domainCandidates.length >= 2) return 'MULTIPLE_DOMAIN_CANDIDATES';
  if (domainCandidates.length === 1) {
    if (domainCandidates[0].personCount >= 4) return 'STRONG_DOMAIN_CANDIDATE';
    return 'DOMAIN_CANDIDATE_REQUIRES_MORE_PROFILES';
  }
  if (repeated.length >= 1 && input.profilesWithoutRepresentableDomain >= 3) {
    return 'WEAK_NEW_DOMAIN_SIGNAL';
  }
  if (repeated.length >= 1) return 'WEAK_NEW_DOMAIN_SIGNAL';
  return 'NO_NEW_DOMAIN_SIGNAL';
}

/** No mapear escuela → dominio (regla anti-forzado). */
export function schoolDoesNotImplyDomain(
  schoolLabel: string,
  domainOrCluster: string,
): boolean {
  const s = normalizeSchoolText(schoolLabel);
  const d = normalizeSchoolText(domainOrCluster);
  if (s.includes('ingenieria') && d.includes('engineering')) return true;
  if (s.includes('negocios') && d.includes('business')) return true;
  if (s.includes('bellas artes') && d.includes('cultural')) return true;
  if (s.includes('transformacion') && d.includes('business')) return true;
  return false;
}
