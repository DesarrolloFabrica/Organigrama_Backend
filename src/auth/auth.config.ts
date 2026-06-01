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
