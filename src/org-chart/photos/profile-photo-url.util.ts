import { Logger } from '@nestjs/common';

const BUNDLED_PROFILE_PHOTO_PATH =
  /^\/public\/profile-photos\/\d+\.(webp|jpe?g|png|gif)$/i;

/** True si la URL es absoluta http(s). */
export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  const url = value?.trim();
  if (!url) {
    return false;
  }
  return /^https?:\/\//i.test(url);
}

/**
 * True si la URL apunta al paquete estático `public/profile-photos/{id}.*`.
 * Esas fotos solo deben servirse si el archivo existe en disco (proxy local).
 * Si la ruta quedó en BD y el archivo no se desplegó, exponerla produce
 * `<img>` rotos en el organigrama.
 */
export function isBundledProfilePhotoPath(
  value: string | null | undefined,
): boolean {
  const url = value?.trim();
  if (!url) {
    return false;
  }

  if (url.startsWith('/')) {
    return BUNDLED_PROFILE_PHOTO_PATH.test(url.split('?')[0] ?? url);
  }

  if (!isAbsoluteHttpUrl(url)) {
    return false;
  }

  try {
    return BUNDLED_PROFILE_PHOTO_PATH.test(new URL(url).pathname);
  } catch {
    return false;
  }
}

/**
 * True si la URL apunta a loopback (localhost / 127.0.0.1 / ::1).
 * Esas URLs funcionan en el PC de desarrollo y fallan en Cloud Run.
 */
export function isLoopbackHttpUrl(value: string | null | undefined): boolean {
  const url = value?.trim();
  if (!url || !isAbsoluteHttpUrl(url)) {
    return false;
  }

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, '');
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
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
 * - Absoluta (http/https): se devuelve tal cual, salvo loopback (localhost),
 *   que se ignora porque no es alcanzable desde Cloud Run.
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
    if (isLoopbackHttpUrl(url)) {
      options.logger?.warn(
        `[profile-photo] URL loopback ignorada para personId=${options.personId} ` +
          `source=${options.source ?? 'null'} (no es usable en Cloud Run).`,
      );
      return null;
    }
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
