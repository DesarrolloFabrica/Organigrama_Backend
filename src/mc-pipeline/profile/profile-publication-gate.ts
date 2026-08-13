/**
 * FASE 12A — Field Publication Gate.
 *
 * Layers (do not conflate):
 * - DISCOVERED: P2 domain candidates (unchanged; not presentation tabs)
 * - RESOLVED: R1 primary/secondary fields (kept for audit/provenance)
 * - PUBLISHABLE: resolved fields eligible for PersonDetail tabs
 *
 * Gate lives in Profile Assembly / presentation — never weakens P2/R1.
 */
import { SPECIALTY_CATALOG_SCOPE } from '../catalog/specialties-visual-education';
import type { ProfileFieldBlock } from './profile.types';

export type FieldPublicationStatus =
  | 'PUBLISHABLE'
  | 'PROVENANCE_ONLY';

export type FieldPublicationDecision = {
  status: FieldPublicationStatus;
  reasonCode: string;
  taxonomyPending: boolean;
  catalogAvailable: boolean;
  observedSpecialtyCount: number;
  observedSkillCount: number;
};

/**
 * Decide whether a RESOLVED field block may appear as a PersonDetail tab.
 */
export function classifyFieldPublication(
  field: Pick<
    ProfileFieldBlock,
    'fieldCode' | 'role' | 'specialties' | 'skills' | 'toolsTechnologies'
  >,
): FieldPublicationDecision {
  const catalogAvailable = SPECIALTY_CATALOG_SCOPE.has(field.fieldCode);
  const observedSpecialtyCount = field.specialties?.length ?? 0;
  const observedSkillCount = field.skills?.length ?? 0;
  const taxonomyPending = !catalogAvailable;

  // PRIMARY: always publishable for the lead Field identity.
  // Missing specialty catalog ⇒ taxonomy pending (PARTIAL), not "no evidence".
  if (field.role === 'PRIMARY') {
    return {
      status: 'PUBLISHABLE',
      reasonCode: taxonomyPending
        ? 'PRIMARY_TAXONOMY_PENDING'
        : observedSpecialtyCount > 0
          ? 'PRIMARY_WITH_OBSERVED_SPECIALTY'
          : 'PRIMARY_RESOLVED',
      taxonomyPending,
      catalogAvailable,
      observedSpecialtyCount,
      observedSkillCount,
    };
  }

  // SECONDARY without specialty catalog: provenance only (no empty Marketing/VD tab).
  if (!catalogAvailable) {
    return {
      status: 'PROVENANCE_ONLY',
      reasonCode: 'SECONDARY_TAXONOMY_NOT_AVAILABLE',
      taxonomyPending: true,
      catalogAvailable: false,
      observedSpecialtyCount,
      observedSkillCount,
    };
  }

  // SECONDARY with catalog: require ≥1 OBSERVED specialty (already filtered upstream).
  // Tools / WEAK / R1 alone / empty radar are not sufficient.
  if (observedSpecialtyCount < 1) {
    return {
      status: 'PROVENANCE_ONLY',
      reasonCode: 'SECONDARY_NO_OBSERVED_SPECIALTY',
      taxonomyPending: false,
      catalogAvailable: true,
      observedSpecialtyCount,
      observedSkillCount,
    };
  }

  return {
    status: 'PUBLISHABLE',
    reasonCode: 'SECONDARY_WITH_OBSERVED_SPECIALTY',
    taxonomyPending: false,
    catalogAvailable: true,
    observedSpecialtyCount,
    observedSkillCount,
  };
}

export function isPublishableField(
  field: Pick<
    ProfileFieldBlock,
    | 'fieldCode'
    | 'role'
    | 'specialties'
    | 'skills'
    | 'toolsTechnologies'
    | 'publicationStatus'
  >,
): boolean {
  if (field.publicationStatus === 'PUBLISHABLE') return true;
  if (field.publicationStatus === 'PROVENANCE_ONLY') return false;
  return classifyFieldPublication(field).status === 'PUBLISHABLE';
}

export function selectPublishableFields(
  fields: ProfileFieldBlock[],
): ProfileFieldBlock[] {
  return fields.filter((f) => isPublishableField(f));
}
