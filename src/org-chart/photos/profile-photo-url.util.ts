import { Logger } from '@nestjs/common';

/** True si la URL es absoluta http(s). */
export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  const url = value?.trim();
  if (!url) {
    return false;
  }
  return /^https?:\/\//i.test(url);
}

export type ResolvePublicPhotoUrlOptions = {
  personId: string;
  source: string | null;
  publicBaseUrl: string;
  logger?: Logger;
};

/**
 * Resuelve la URL pública de una foto de perfil almacenada en
 * `person_profile_state.profile_photo_url`:
 * - Absoluta (http/https): se devuelve tal cual.
 * - Root-relativa (empieza por "/"): se resuelve contra `publicBaseUrl`.
 * - Cualquier otra forma: se rechaza con log claro y se devuelve null.
 */
export function resolvePublicPhotoUrl(
  rawUrl: string | null | undefined,
  options: ResolvePublicPhotoUrlOptions,
): string | null {
  const url = rawUrl?.trim();
  if (!url) {
    return null;
  }

  if (isAbsoluteHttpUrl(url)) {
    return url;
  }

  if (url.startsWith('/')) {
    const base = options.publicBaseUrl.replace(/\/$/, '');
    return `${base}${url}`;
  }

  options.logger?.warn(
    `[profile-photo] URL de foto no resoluble para personId=${options.personId} ` +
      `source=${options.source ?? 'null'}: "${url}" ` +
      `(no es absoluta http(s) ni root-relativa "/...").`,
  );
  return null;
}
