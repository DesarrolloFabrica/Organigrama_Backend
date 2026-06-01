/** Contexto de sesión autenticada tras login con Google. */
export type AuthenticatedSessionContext = {
  personId: string;
  googleSubject: string;
  googleEmail?: string;
  googlePictureUrl?: string | null;
};
