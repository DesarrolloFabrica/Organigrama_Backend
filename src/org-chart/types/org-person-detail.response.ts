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
  profile: OrgPersonFullProfileDto | null;
};
