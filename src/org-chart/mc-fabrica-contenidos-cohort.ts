/**
 * Cohorte Fábrica de Contenidos — clasificación pura por rol (MC1).
 *
 * El rol SOLO decide inclusión en el piloto.
 * No determina PRIMARY_MATCH, especialidades, skills ni CDR.
 */

export type FabricaCohortClass =
  | 'INCLUDE_DESIGN'
  | 'INCLUDE_AUDIOVISUAL'
  | 'INCLUDE_DESIGN_AND_AUDIOVISUAL'
  | 'EXCLUDE_PRESENTER'
  | 'EXCLUDE_ADMINISTRATIVE'
  | 'EXCLUDE_OTHER_ROLE'
  | 'MANUAL_REVIEW';

export type FabricaPipelineAction =
  | 'EVALUATE_MISSING_DOMAINS'
  | 'REEXTRACT_CURRENT_CV'
  | 'CREATE_EXTRACTION'
  | 'SKIP_NO_CV'
  | 'SKIP_PDF_INACCESSIBLE'
  | 'SKIP_RUNNING'
  | 'SKIP_MANUAL_REVIEW'
  | 'REPOINT_OR_METADATA_REPAIR'
  | 'SKIP_UNVERIFIABLE';

export type FabricaContentClass =
  | 'SAME_CONTENT_DIFFERENT_FILE_ID'
  | 'DIFFERENT_CONTENT'
  | 'UNVERIFIABLE'
  | 'NOT_APPLICABLE';

/** Texto canónico del nodo padre (sin tildes / puntuación). */
export const FABRICA_PARENT_NAME_NEEDLES = [
  'vacante',
  'coordinador fabrica de contenidos',
  'disenadores de contenido',
  'presentadoras',
] as const;

const PRESENTER_ROLE = [
  'presentador',
  'presentadora',
  'presentador de contenido',
  'presentadora de contenido',
];

const ADMIN_ROLE = [
  'auxiliar administrativo',
  'auxiliar administrativo de operaciones',
  'administrativo de operaciones',
  'asistente administrativo',
];

const DESIGN_ROLE = [
  'analista de diseno de contenidos',
  'analista de diseno',
  'disenador de contenidos',
  'disenadora de contenidos',
  'disenador ux ui',
  'disenadora ux ui',
  'disenador ux/ui',
  'disenador grafico',
  'disenadora grafica',
  'diseno grafico',
  'diseno de contenidos',
  'diseno visual',
  'disenador integral',
];

const AV_ROLE = [
  'editor de video',
  'editora de video',
  'realizador audiovisual',
  'realizadora audiovisual',
  'productor audiovisual',
  'productora audiovisual',
  'animador',
  'animadora',
  'motion graphics',
  'motion designer',
  'postproductor',
  'postproductora',
  'post produccion',
  'edicion de video',
];

export function normalizeFabricaText(input: string | null | undefined): string {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((n) => haystack.includes(normalizeFabricaText(n)));
}

/**
 * Resuelve candidatos a nodo padre por nombre normalizado.
 * Ambigüedad si hay >1 match completo de agujas.
 */
export function matchFabricaParentCandidates<T extends { fullName: string }>(
  people: readonly T[],
): T[] {
  return people.filter((p) => {
    const n = normalizeFabricaText(p.fullName);
    return FABRICA_PARENT_NAME_NEEDLES.every((needle) => n.includes(needle));
  });
}

/**
 * Clasifica un hijo directo por su rol organizacional.
 * No usa skills del CV.
 */
export function classifyFabricaCohortByRole(
  roleName: string | null | undefined,
): { classification: FabricaCohortClass; reason: string } {
  const role = normalizeFabricaText(roleName);
  if (!role) {
    return {
      classification: 'MANUAL_REVIEW',
      reason: 'Rol vacío o ausente',
    };
  }

  if (includesAny(role, PRESENTER_ROLE) || role.includes('presentador')) {
    return {
      classification: 'EXCLUDE_PRESENTER',
      reason:
        'Cargo de presentación; dominio profesional aún no modelado',
    };
  }

  if (includesAny(role, ADMIN_ROLE) || role.includes('auxiliar administrativo')) {
    return {
      classification: 'EXCLUDE_ADMINISTRATIVE',
      reason: 'Cargo administrativo/operativo de apoyo',
    };
  }

  const isDesign = includesAny(role, DESIGN_ROLE) || role.includes('diseno');
  const isAv =
    includesAny(role, AV_ROLE) ||
    role.includes('audiovisual') ||
    role.includes('edicion de video') ||
    role.includes('motion');

  if (isDesign && isAv) {
    return {
      classification: 'INCLUDE_DESIGN_AND_AUDIOVISUAL',
      reason: 'Rol con señales de diseño y audiovisual',
    };
  }
  if (isDesign) {
    return {
      classification: 'INCLUDE_DESIGN',
      reason: 'Rol de diseño / analista de contenidos',
    };
  }
  if (isAv) {
    return {
      classification: 'INCLUDE_AUDIOVISUAL',
      reason: 'Rol de producción/edición audiovisual',
    };
  }

  return {
    classification: 'EXCLUDE_OTHER_ROLE',
    reason: `Rol fuera del alcance del piloto: ${roleName}`,
  };
}

export function isFabricaCohortIncluded(
  classification: FabricaCohortClass,
): boolean {
  return (
    classification === 'INCLUDE_DESIGN' ||
    classification === 'INCLUDE_AUDIOVISUAL' ||
    classification === 'INCLUDE_DESIGN_AND_AUDIOVISUAL'
  );
}

export type FabricaPipelineState =
  | 'HEALTHY_CURRENT'
  | 'STALE_SELECTED_EXTRACTION'
  | 'NO_USABLE_EXTRACTION'
  | 'NO_PERSON_CV'
  | 'PDF_NOT_ACCESSIBLE'
  | 'RUNNING_OR_PENDING'
  | 'MANUAL_REVIEW';

export function classifyFabricaPipelineState(input: {
  hasActivePersonCv: boolean;
  activeCvDriveFileId: string | null;
  activeExtraction: {
    id: string;
    status: string;
    isActive: boolean;
    driveFileId: string | null;
  } | null;
  hasRunningOrPending: boolean;
  pdfAccessible?: boolean | null;
}): FabricaPipelineState {
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

export function classifyFabricaContentClass(input: {
  cvDriveFileId: string | null;
  extractionDriveFileId: string | null;
  cvSha256: string | null;
  extractionSha256: string | null;
}): FabricaContentClass {
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

export function actionForFabricaPipelineState(
  state: FabricaPipelineState,
  contentClass?: FabricaContentClass | null,
): FabricaPipelineAction {
  switch (state) {
    case 'HEALTHY_CURRENT':
      return 'EVALUATE_MISSING_DOMAINS';
    case 'STALE_SELECTED_EXTRACTION':
      if (contentClass === 'SAME_CONTENT_DIFFERENT_FILE_ID') {
        return 'REPOINT_OR_METADATA_REPAIR';
      }
      if (contentClass === 'UNVERIFIABLE') return 'SKIP_UNVERIFIABLE';
      return 'REEXTRACT_CURRENT_CV';
    case 'NO_USABLE_EXTRACTION':
      return 'CREATE_EXTRACTION';
    case 'NO_PERSON_CV':
      return 'SKIP_NO_CV';
    case 'PDF_NOT_ACCESSIBLE':
      return 'SKIP_PDF_INACCESSIBLE';
    case 'RUNNING_OR_PENDING':
      return 'SKIP_RUNNING';
    case 'MANUAL_REVIEW':
    default:
      return 'SKIP_MANUAL_REVIEW';
  }
}

/** Dominios oficiales a evaluar en el piloto (sin SOFTWARE automático). */
export const FABRICA_PILOT_DOMAINS = [
  { domainCode: 'VISUAL_DESIGN', rulesVersion: 'pa2-visual-design-1.1.0' },
  {
    domainCode: 'AUDIOVISUAL_PRODUCTION',
    rulesVersion: 'pa2-audiovisual-production-1.0.0',
  },
] as const;
