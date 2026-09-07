import type { OrgNodeKind } from './org-node.type';
import type { OrgPersonFullProfileDto } from './org-person-full-profile.dto';

/** Respuesta de GET /api/org-chart/person/:id con visibilidad jerárquica. */
export type OrgPersonDetailResponseDto = {
  id: string;
  name: string;
  institutionalEmail: string | null;
  canViewFullProfile: boolean;
  photoUrl: string | null;
  nodeKind?: OrgNodeKind;
  /**
   * Teléfono visible para este viewer.
   *
   * - Ficha completa (self / descendiente / ORG_READ_ALL): mismo valor que
   *   `profile.phone`.
   * - Ficha redactada: `null`, salvo que el viewer tenga ORG_CONTACT_READ_ALL.
   *
   * Es el ÚNICO campo privado que puede venir informado con `profile === null`.
   */
  phone: string | null;
  profile: OrgPersonFullProfileDto | null;
};
