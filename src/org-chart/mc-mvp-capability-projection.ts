/**
 * Proyección MVP de competencias publicables (read-time).
 * No depende de PRIMARY_MATCH. No muta catálogo ni aliases globales.
 */

import {
  CAPABILITY_FAMILY_NEEDLES,
  classifyCapabilityEvidenceLevel,
  isPublishableCapability,
  matchCapabilityFamilies,
  normalizeSchoolText,
  type ProvisionalClusterCode,
  type SchoolCoordinatorEvidenceLevel,
} from './mc-school-coordinators-cohort';

export type MvpNormalizationKind =
  | 'CANONICAL_MATCH'
  | 'EXISTING_ALIAS_MATCH'
  | 'PROVISIONAL_NORMALIZATION'
  | 'UNMAPPED_SIGNAL';

export type MvpCapabilityItem = {
  code: string | null;
  label: string;
  evidenceLevel: 'STRONG' | 'MODERATE' | 'WEAK' | 'EMERGING';
  sourceCount: number;
  domainCode: string | null;
  classification: string;
  clusters: ProvisionalClusterCode[];
  normalization: MvpNormalizationKind;
  originalSignals: string[];
};

export type MvpToolItem = {
  label: string;
  type: 'TOOL' | 'METHODOLOGY';
  evidenceLevel: string;
  hasProfessionalContext: boolean;
  sourceCount: number;
};

export type MvpProfessionalCapabilities = {
  consolidatedCapabilities: MvpCapabilityItem[];
  complementaryCapabilities: MvpCapabilityItem[];
  emergingCapabilities: MvpCapabilityItem[];
  tools: MvpToolItem[];
  methodologies: MvpToolItem[];
  classificationPending: boolean;
  qualityAlerts: string[];
};

/** Normalizaciones provisionales del piloto (no aliases globales). */
export const MVP_PROVISIONAL_CANONICALS: Array<{
  code: string;
  label: string;
  cluster: ProvisionalClusterCode;
  needles: string[];
}> = [
  {
    code: 'ACADEMIC_MANAGEMENT',
    label: 'Gestión académica',
    cluster: 'ACADEMIC_MANAGEMENT',
    needles: [
      'gestion academica',
      'coordinacion academica',
      'planeacion academica',
      'administracion academica',
      'procesos academicos',
      'gestion curricular',
      'diseno curricular',
      'registro calificado',
      'acreditacion',
      'gestion de programas',
      'seguimiento docente',
    ],
  },
  {
    code: 'EDUCATION_AND_PEDAGOGY',
    label: 'Educación y pedagogía',
    cluster: 'EDUCATION_AND_PEDAGOGY',
    needles: [
      'docencia',
      'pedagogia',
      'didactica',
      'diseno instruccional',
      'innovacion educativa',
      'educacion virtual',
      'formacion docente',
      'ambientes de aprendizaje',
      'investigacion educativa',
      'contenidos educativos',
    ],
  },
  {
    code: 'TEAM_LEADERSHIP',
    label: 'Liderazgo de equipos',
    cluster: 'LEADERSHIP_AND_PROJECTS',
    needles: [
      'liderazgo de equipos',
      'liderazgo',
      'direccion de equipos',
      'coordinacion de personal',
      'liderazgo estrategico',
      'liderazgo interdisciplinario',
    ],
  },
  {
    code: 'PROJECT_MANAGEMENT',
    label: 'Gestión de proyectos',
    cluster: 'LEADERSHIP_AND_PROJECTS',
    needles: [
      'gestion de proyectos',
      'planeacion estrategica',
      'seguimiento de indicadores',
      'mejora de procesos',
      'gestion del cambio',
    ],
  },
  {
    code: 'BUSINESS_MANAGEMENT',
    label: 'Gestión empresarial',
    cluster: 'BUSINESS_MANAGEMENT',
    needles: [
      'emprendimiento',
      'estrategia empresarial',
      'transformacion empresarial',
      'mercadeo',
      'marketing',
      'negocios',
      'gestion comercial',
      'modelos de negocio',
      'consultoria',
      'gestion organizacional',
    ],
  },
  {
    code: 'INFORMATION_SYSTEMS',
    label: 'Sistemas de información',
    cluster: 'ENGINEERING_MANAGEMENT',
    needles: [
      'sistemas de informacion',
      'gestion de sistemas',
      'analitica de datos',
      'desarrollo de software',
      'gestion tecnologica',
      'automatizacion',
    ],
  },
  {
    code: 'CULTURAL_ARTISTIC',
    label: 'Gestión cultural y artística',
    cluster: 'CULTURAL_AND_ARTISTIC_MANAGEMENT',
    needles: [
      'gestion cultural',
      'produccion cultural',
      'artes visuales',
      'creacion artistica',
      'direccion artistica',
      'pedagogia artistica',
      'investigacion creacion',
      'bellas artes',
      'curaduria',
      'produccion de eventos',
    ],
  },
  {
    code: 'QUALITY_ASSURANCE',
    label: 'Aseguramiento de calidad',
    cluster: 'QUALITY_ASSURANCE',
    needles: [
      'aseguramiento de calidad',
      'autoevaluacion',
      'iso 9001',
      'auditoria interna',
      'mejora continua',
    ],
  },
];

export type MvpSkillEvidenceRow = {
  normalizedName: string;
  originalName?: string | null;
  skillType?: string | null;
  evidenceLevel?: string | null;
  hasWorkExperience?: boolean | null;
  substantiveCount?: number | null;
  evidenceItems?: Array<{
    sourceType?: string;
    evidenceText?: string;
  }> | null;
  evidenceText?: string | null;
};

function matchProvisional(text: string): {
  code: string;
  label: string;
  cluster: ProvisionalClusterCode;
  kind: MvpNormalizationKind;
} | null {
  const n = normalizeSchoolText(text);
  for (const c of MVP_PROVISIONAL_CANONICALS) {
    if (c.needles.some((needle) => n.includes(normalizeSchoolText(needle)))) {
      return {
        code: c.code,
        label: c.label,
        cluster: c.cluster,
        kind: 'PROVISIONAL_NORMALIZATION',
      };
    }
  }
  return null;
}

function toPublicEvidenceLevel(
  level: SchoolCoordinatorEvidenceLevel,
): 'STRONG' | 'MODERATE' | 'WEAK' | 'EMERGING' {
  if (level === 'STRONG_PROFESSIONAL_EVIDENCE') return 'STRONG';
  if (level === 'MODERATE_PROFESSIONAL_EVIDENCE') return 'MODERATE';
  if (level === 'EDUCATION_ONLY' || level === 'TOOL_OR_TERM_ONLY') {
    return 'WEAK';
  }
  return 'EMERGING';
}

function isToolType(skillType: string | null | undefined): boolean {
  const t = normalizeSchoolText(skillType);
  return t === 'tool' || t === 'herramienta';
}

function isMethodologyType(skillType: string | null | undefined): boolean {
  const t = normalizeSchoolText(skillType);
  return t === 'methodology' || t === 'metodologia';
}

/**
 * Construye proyección MVP desde filas de extracción/evidence.
 * No usa cargo ni escuela.
 */
export function buildMvpProfessionalCapabilities(
  rows: readonly MvpSkillEvidenceRow[],
  opts?: { hasPublishableDomain?: boolean },
): MvpProfessionalCapabilities {
  type Acc = {
    code: string | null;
    label: string;
    levels: SchoolCoordinatorEvidenceLevel[];
    originals: Set<string>;
    clusters: Set<ProvisionalClusterCode>;
    normalization: MvpNormalizationKind;
    sourceCount: number;
  };

  const byKey = new Map<string, Acc>();
  const tools: MvpToolItem[] = [];
  const methodologies: MvpToolItem[] = [];
  let educationOnly = 0;
  let totalSignals = 0;

  for (const row of rows) {
    const name = row.originalName || row.normalizedName;
    if (!name?.trim()) continue;
    totalSignals += 1;

    const level = classifyCapabilityEvidenceLevel({
      text: name,
      skillType: row.skillType,
      evidenceLevel: row.evidenceLevel,
      hasWorkExperience: row.hasWorkExperience,
    });

    if (level === 'EDUCATION_ONLY') educationOnly += 1;

    const hasContext =
      Boolean(row.hasWorkExperience) ||
      (row.substantiveCount ?? 0) > 0 ||
      (row.evidenceItems?.length ?? 0) > 0 ||
      Boolean(row.evidenceText?.trim());

    if (isToolType(row.skillType)) {
      tools.push({
        label: name,
        type: 'TOOL',
        evidenceLevel: toPublicEvidenceLevel(level),
        hasProfessionalContext: hasContext,
        sourceCount: 1,
      });
      continue;
    }
    if (isMethodologyType(row.skillType)) {
      methodologies.push({
        label: name,
        type: 'METHODOLOGY',
        evidenceLevel: toPublicEvidenceLevel(level),
        hasProfessionalContext: hasContext,
        sourceCount: 1,
      });
      continue;
    }

    if (
      level === 'INFERRED_FROM_ROLE' ||
      level === 'NO_EVIDENCE' ||
      level === 'TOOL_OR_TERM_ONLY'
    ) {
      continue;
    }

    const provisional = matchProvisional(name);
    const families = matchCapabilityFamilies(name);
    const clusters = new Set<ProvisionalClusterCode>();
    if (provisional) clusters.add(provisional.cluster);
    for (const f of families) {
      const c = CAPABILITY_FAMILY_NEEDLES[f]?.cluster;
      if (c) clusters.add(c);
    }

    const key = provisional?.code ?? `UNMAPPED:${normalizeSchoolText(name)}`;
    const label = provisional?.label ?? name;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        code: provisional?.code ?? null,
        label,
        levels: [level],
        originals: new Set([name]),
        clusters,
        normalization: provisional?.kind ?? 'UNMAPPED_SIGNAL',
        sourceCount: 1,
      });
    } else {
      existing.levels.push(level);
      existing.originals.add(name);
      existing.sourceCount += 1;
      for (const c of clusters) existing.clusters.add(c);
    }

    // Señales en evidence_items
    for (const it of row.evidenceItems ?? []) {
      const text = String(it.evidenceText ?? '');
      if (!text) continue;
      const fam = matchCapabilityFamilies(text);
      const prov = matchProvisional(text);
      if (!fam.length && !prov) continue;
      const itemLevel = classifyCapabilityEvidenceLevel({
        text,
        sourceType: it.sourceType,
        hasWorkExperience:
          it.sourceType === 'WORK_EXPERIENCE' ||
          it.sourceType === 'RESPONSIBILITY',
      });
      if (!isPublishableCapability(itemLevel) && itemLevel !== 'EDUCATION_ONLY') {
        continue;
      }
      const itemKey = prov?.code ?? key;
      const acc = byKey.get(itemKey);
      if (acc) {
        acc.levels.push(itemLevel);
        acc.sourceCount += 1;
        acc.originals.add(text.slice(0, 80));
      }
    }
  }

  const consolidated: MvpCapabilityItem[] = [];
  const complementary: MvpCapabilityItem[] = [];
  const emerging: MvpCapabilityItem[] = [];

  for (const acc of byKey.values()) {
    const hasStrong = acc.levels.includes('STRONG_PROFESSIONAL_EVIDENCE');
    const hasModerate = acc.levels.includes('MODERATE_PROFESSIONAL_EVIDENCE');
    const item: MvpCapabilityItem = {
      code: acc.code,
      label: acc.label,
      evidenceLevel: hasStrong
        ? 'STRONG'
        : hasModerate
          ? 'MODERATE'
          : 'EMERGING',
      sourceCount: acc.sourceCount,
      domainCode: null,
      classification: acc.code
        ? 'CROSS_DOMAIN_CAPABILITY'
        : 'UNMAPPED_CAPABILITY',
      clusters: [...acc.clusters],
      normalization: acc.normalization,
      originalSignals: [...acc.originals].slice(0, 8),
    };

    if (hasStrong && acc.sourceCount >= 1) {
      consolidated.push(item);
    } else if (hasModerate) {
      complementary.push(item);
    } else {
      emerging.push(item);
    }
  }

  const sortBySources = (a: MvpCapabilityItem, b: MvpCapabilityItem) =>
    b.sourceCount - a.sourceCount || a.label.localeCompare(b.label);

  consolidated.sort(sortBySources);
  complementary.sort(sortBySources);
  emerging.sort(sortBySources);

  const qualityAlerts: string[] = [];
  if (totalSignals > 0 && educationOnly / totalSignals > 0.7) {
    qualityAlerts.push('MOSTLY_EDUCATION_ONLY');
  }
  if (consolidated.length > 20) {
    qualityAlerts.push('TOO_MANY_CONSOLIDATED');
  }
  if (
    consolidated.length > 0 &&
    emerging.length === 0 &&
    complementary.length === 0
  ) {
    qualityAlerts.push('NO_TIER_DIFFERENTIATION');
  }
  if (
    tools.some((t) => !t.hasProfessionalContext) &&
    tools.length === consolidated.length
  ) {
    qualityAlerts.push('TOOLS_WITHOUT_CONTEXT');
  }

  const hasCaps =
    consolidated.length + complementary.length + emerging.length > 0;

  return {
    consolidatedCapabilities: consolidated,
    complementaryCapabilities: complementary,
    emergingCapabilities: emerging,
    tools: dedupeTools(tools),
    methodologies: dedupeTools(methodologies),
    classificationPending: !opts?.hasPublishableDomain && hasCaps,
    qualityAlerts,
  };
}

function dedupeTools(items: MvpToolItem[]): MvpToolItem[] {
  const map = new Map<string, MvpToolItem>();
  for (const it of items) {
    const k = normalizeSchoolText(it.label);
    const prev = map.get(k);
    if (!prev) map.set(k, it);
    else {
      prev.sourceCount += it.sourceCount;
      prev.hasProfessionalContext =
        prev.hasProfessionalContext || it.hasProfessionalContext;
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}
