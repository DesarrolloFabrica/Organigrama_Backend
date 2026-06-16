import type { Request } from 'express';
import { getAuthSessionFromRequest } from '../auth/auth-request.util';
import type { OrgViewerContext } from './org-viewer-context';

/** Construye OrgViewerContext desde la sesión JWT del request. */
export function buildOrgViewerContext(req: Request): OrgViewerContext {
  const session = getAuthSessionFromRequest(req)!;
  return {
    personId: session.personId,
    eduEmail: session.eduEmail ?? null,
    permissions: session.permissions ?? [],
  };
}
