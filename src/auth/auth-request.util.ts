import type { Request } from 'express';
import { AUTH_SESSION_REQUEST_KEY } from './auth.types';
import type { AuthenticatedSessionContext } from './types/authenticated-session.context';

export function getAuthSessionFromRequest(
  req: Request,
): AuthenticatedSessionContext | undefined {
  const session = (req as Request & Record<string, unknown>)[
    AUTH_SESSION_REQUEST_KEY
  ];

  if (!session || typeof session !== 'object') {
    return undefined;
  }

  const candidate = session as AuthenticatedSessionContext;
  if (!candidate.personId || !candidate.googleSubject) {
    return undefined;
  }

  return candidate;
}
