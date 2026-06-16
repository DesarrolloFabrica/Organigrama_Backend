/** Contexto de sesión autenticada tras login con Google. */
export type AuthenticatedSessionContext = {
  personId: string;
  googleSubject: string;
  googleEmail?: string;
  googlePictureUrl?: string | null;
  /** Correo institucional de core.person (para validaciones técnicas). */
  eduEmail?: string | null;
  /** Permisos técnicos de aplicación (ej. ORG_READ_ALL, ORG_ADMIN). Vacío para usuarios normales. */
  permissions: string[];
};
