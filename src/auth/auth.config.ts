import { NotFoundException } from '@nestjs/common';

/** Login dev: solo `NODE_ENV=development` + `DEV_LOGIN_ENABLED=true`. */
export function isDevLoginRouteEnabled(): boolean {
  const isDev = process.env.NODE_ENV === 'development';
  const devLoginEnabled = process.env.DEV_LOGIN_ENABLED === 'true';
  return isDev && devLoginEnabled;
}

/**
 * Bloquea el endpoint dev-login antes de ejecutar lógica.
 * Usa 404 para no revelar la existencia de la ruta.
 */
export function assertDevLoginRouteEnabled(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new NotFoundException('Dev login disabled in production');
  }

  if (!isDevLoginRouteEnabled()) {
    throw new NotFoundException();
  }
}

export function getGoogleClientId(): string {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    '550902908078-fvabjtle954fqr6alhofdv7fvvr4bcbv.apps.googleusercontent.com'
  );
}

export function getJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_JWT_SECRET es obligatorio en producción');
  }

  return 'organigrama-dev-jwt-secret-change-me';
}

export function getJwtExpiresIn(): string {
  return process.env.AUTH_JWT_EXPIRES_IN?.trim() || '7d';
}
