import type { AuthenticatedSessionContext } from './types/authenticated-session.context';

export type AuthUserResponse = {
  personId: string;
  fullName: string;
  eduEmail: string | null;
  googleEmail: string;
  pictureUrl: string | null;
  /** Permisos técnicos de aplicación. Solo para uso de UI en el frontend; la seguridad real vive en backend. */
  permissions: string[];
};

export type GoogleLoginResponse = {
  accessToken: string;
  user: AuthUserResponse;
};

export type JwtPayload = AuthenticatedSessionContext & {
  googleEmail: string;
};

export const AUTH_SESSION_REQUEST_KEY = 'authSession';
