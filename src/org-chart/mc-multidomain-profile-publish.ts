/**
 * Reglas de publicación multidominio para la ficha (piloto MC1).
 *
 * No modifica PA2, Qualification ni CDR: solo filtra/ordena evaluaciones
 * ya persistidas para presentación.
 *
 * Política de pestaña (alineada a propuesta piloto + publicación provisional):
 * - PRIMARY_MATCH → visible (contenido completo)
 * - SECONDARY_SIGNAL → visible (etiqueta de señal secundaria)
 * - OUTSIDE → no visible
 * - INSUFFICIENT_EVIDENCE → no visible
 *
 * CDR: solo se expone si existe resultado persistido; este módulo no lo inventa.
 */

import type { McDomainQualification } from '../mc-catalog/mc-domain-qualification';
import { classifyDomainConceptually } from '../mc-catalog/mc-domain-qualification';

/** Orden estable de catálogo cuando no hay CDR ni scores comparables. */
export const MC_DOMAIN_STABLE_ORDER: readonly string[] = [
  'SOFTWARE',
  'VISUAL_DESIGN',
  'AUDIOVISUAL_PRODUCTION',
  'OPERATIONS_MANAGEMENT',
  'TALENT_MANAGEMENT',
] as const;

export const MC_PUBLISHABLE_QUALIFICATIONS: readonly McDomainQualification[] = [
  'PRIMARY_MATCH',
  'SECONDARY_SIGNAL',
] as const;

export type McPublishableDomainCandidate = {
  evaluationId: string;
  domainCode: string;
  domainName: string;
  domainSortOrder: number;
  extractionId: string;
  isActive: boolean;
  status: string;
  /** NULL en históricas → se deriva de conteos. */
  domainQualification: McDomainQualification | null;
  activeCount: number;
  emergentCount: number;
  hiddenCount: number;
  defaultSpecialtyCode: string | null;
  engineRulesVersion: string;
  completedAt: string | null;
};

export function deriveDomainQualification(
  row: Pick<
    McPublishableDomainCandidate,
    'domainQualification' | 'activeCount' | 'emergentCount' | 'hiddenCount'
  >,
): McDomainQualification {
  if (row.domainQualification) {
    return row.domainQualification;
  }
  return classifyDomainConceptually(
    {
      activeCount: row.activeCount,
      emergentCount: row.emergentCount,
      hiddenCount: row.hiddenCount,
      specialtyResults: [],
    },
    'MEDIUM',
  );
}

export function isPublishableQualification(
  q: McDomainQualification,
): boolean {
  return (MC_PUBLISHABLE_QUALIFICATIONS as readonly string[]).includes(q);
}

export function filterPublishableDomains(
  candidates: readonly McPublishableDomainCandidate[],
  activeExtractionId: string | null,
): McPublishableDomainCandidate[] {
  if (!activeExtractionId) return [];
  const filtered = candidates.filter((c) => {
    if (c.status !== 'SUCCEEDED') return false;
    if (String(c.extractionId) !== String(activeExtractionId)) return false;
    return isPublishableQualification(deriveDomainQualification(c));
  });

  // Una evaluación por dominio: prioriza is_active, luego PRIMARY, luego id ↓.
  const byDomain = new Map<string, McPublishableDomainCandidate>();
  for (const row of filtered) {
    const key = row.domainCode.toUpperCase();
    const prev = byDomain.get(key);
    if (!prev) {
      byDomain.set(key, row);
      continue;
    }
    const qNew = deriveDomainQualification(row);
    const qPrev = deriveDomainQualification(prev);
    const better =
      Number(row.isActive) - Number(prev.isActive) ||
      Number(qNew === 'PRIMARY_MATCH') - Number(qPrev === 'PRIMARY_MATCH') ||
      Number(row.evaluationId) - Number(prev.evaluationId);
    if (better > 0) byDomain.set(key, row);
  }
  return [...byDomain.values()];
}

/**
 * Orden determinístico (no usa orden de llegada de BD):
 * 1. is_active (evaluación publicada)
 * 2. PRIMARY_MATCH antes que SECONDARY_SIGNAL
 * 3. activeCount ↓, emergentCount ↓
 * 4. domainSortOrder / MC_DOMAIN_STABLE_ORDER
 * 5. evaluationId ↑
 */
export function sortPublishableDomains(
  domains: readonly McPublishableDomainCandidate[],
): McPublishableDomainCandidate[] {
  const stableIndex = (code: string): number => {
    const i = MC_DOMAIN_STABLE_ORDER.indexOf(code.toUpperCase());
    return i === -1 ? 999 : i;
  };

  return [...domains].sort((a, b) => {
    const qa = deriveDomainQualification(a);
    const qb = deriveDomainQualification(b);
    const activeCmp = Number(b.isActive) - Number(a.isActive);
    if (activeCmp !== 0) return activeCmp;
    const primaryCmp =
      Number(qb === 'PRIMARY_MATCH') - Number(qa === 'PRIMARY_MATCH');
    if (primaryCmp !== 0) return primaryCmp;
    if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
    if (b.emergentCount !== a.emergentCount) {
      return b.emergentCount - a.emergentCount;
    }
    const sortA =
      Number.isFinite(a.domainSortOrder) && a.domainSortOrder > 0
        ? a.domainSortOrder
        : stableIndex(a.domainCode);
    const sortB =
      Number.isFinite(b.domainSortOrder) && b.domainSortOrder > 0
        ? b.domainSortOrder
        : stableIndex(b.domainCode);
    if (sortA !== sortB) return sortA - sortB;
    return Number(a.evaluationId) - Number(b.evaluationId);
  });
}

/**
 * Dominio predeterminado (sin CDR persistido):
 * 1. Evaluación is_active entre publicables
 * 2. PRIMARY_MATCH
 * 3. Mayor activeCount / emergentCount (vía sort)
 * 4. Primer dominio del orden estable ya aplicado
 */
export function selectDefaultDomainCode(
  sortedPublishable: readonly McPublishableDomainCandidate[],
): string | null {
  if (!sortedPublishable.length) return null;
  const active = sortedPublishable.find((d) => d.isActive);
  if (active) return active.domainCode.toUpperCase();
  const primary = sortedPublishable.find(
    (d) => deriveDomainQualification(d) === 'PRIMARY_MATCH',
  );
  if (primary) return primary.domainCode.toUpperCase();
  return sortedPublishable[0].domainCode.toUpperCase();
}
