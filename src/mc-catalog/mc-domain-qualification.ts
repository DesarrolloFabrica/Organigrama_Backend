/**
 * Calificación intra-dominio (MC1.1A).
 *
 * Representa el grado conceptual de compatibilidad de una persona con UN dominio
 * evaluado individualmente. No indica posición relativa entre dominios ni
 * práctica profesional dominante.
 *
 * PRIMARY_MATCH ≠ dominio profesional dominante de la persona.
 *
 * Semántica de calificaciones:
 * - PRIMARY_MATCH: activeCount ≥ 1 (evidencia suficiente para ≥1 especialidad ACTIVE).
 * - SECONDARY_SIGNAL: activeCount = 0 y emergentCount ≥ 1 (señal débil/parcial).
 * - OUTSIDE: activeCount = 0 y emergentCount = 0 (hubo evaluación PA2; el dominio
 *   no está respaldado). Distinto de “nunca evaluado”.
 * - INSUFFICIENT_EVIDENCE: el tier global de evidencia del perfil es INSUFFICIENT
 *   (p. ej. sin skills profesionales STRONG/MODERATE). No se interpreta afinidad
 *   de dominio; la evidencia base no permite una evaluación profesional confiable.
 */

import type { McPa2EngineRunResult, McPa2SpecialtyResult } from './mc-pa2.types';

/** Tier de calidad de evidencia global usado por scripts de activación. */
export type McEvidenceQualityTier =
  | 'HIGH'
  | 'MEDIUM'
  | 'LOW'
  | 'INSUFFICIENT';

export const MC_DOMAIN_QUALIFICATIONS = [
  'PRIMARY_MATCH',
  'SECONDARY_SIGNAL',
  'OUTSIDE',
  'INSUFFICIENT_EVIDENCE',
] as const;

/**
 * Calificación interna de una persona frente a un dominio individual.
 * No representa la posición del dominio frente a otros dominios.
 */
export type McDomainQualification = (typeof MC_DOMAIN_QUALIFICATIONS)[number];

export interface McDomainQualificationInput {
  activeCount: number;
  emergentCount: number;
  hiddenCount: number;
  specialtyResults: Pick<
    McPa2SpecialtyResult,
    'presentationStatus' | 'professionalContribution'
  >[];
}

/**
 * Clasifica el resultado PA2 de un dominio según las reglas vigentes (MC1.10).
 * Lógica extraída sin cambios desde mc110-activate-person-competencies.
 */
export function classifyDomainConceptually(
  result: McPa2EngineRunResult | McDomainQualificationInput,
  qualityTier: McEvidenceQualityTier,
): McDomainQualification {
  if (qualityTier === 'INSUFFICIENT') {
    return 'INSUFFICIENT_EVIDENCE';
  }

  const activeCount = result.activeCount;
  const emergentCount = result.emergentCount;
  const hiddenCount = result.hiddenCount;
  const specialtyResults = result.specialtyResults;

  if (activeCount >= 1) {
    return 'PRIMARY_MATCH';
  }

  const emergentWithProfessional = specialtyResults.filter(
    (r) =>
      r.presentationStatus === 'EMERGENT' && r.professionalContribution > 0,
  );

  if (emergentCount >= 1 && emergentWithProfessional.length > 0) {
    return 'SECONDARY_SIGNAL';
  }

  if (emergentCount >= 1 && activeCount === 0) {
    return 'SECONDARY_SIGNAL';
  }

  if (activeCount === 0 && emergentCount === 0 && hiddenCount > 0) {
    return 'OUTSIDE';
  }

  if (activeCount === 0 && emergentCount === 0) {
    return 'OUTSIDE';
  }

  return 'OUTSIDE';
}

/**
 * Réplica la consulta de dominio principal del Explorador (solo lectura).
 * Usada en pruebas de regresión MC1.1B — no modificar sin alinear con API.
 */
export function selectPrimaryDomainCodeForApiSummary(
  evaluations: ReadonlyArray<{
    id: number;
    domain_code: string;
    is_active: boolean;
    status: string;
    catalog_is_active: boolean;
  }>,
): string | null {
  const rows = evaluations
    .filter((e) => e.is_active && e.status === 'SUCCEEDED')
    .sort(
      (a, b) =>
        Number(b.catalog_is_active) - Number(a.catalog_is_active) ||
        b.id - a.id,
    );
  return rows[0]?.domain_code ?? null;
}
