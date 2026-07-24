/**
 * Normalización conservadora de nombres de skills.
 * Solo capitalización, marcas comerciales y alias inequívocos.
 * Nunca añade área, tecnología, nivel ni contexto interpretado.
 */

/** Términos demasiado genéricos si aparecen aislados (sin objeto/contexto). */
export const BARE_GENERIC_TERMS = [
  'implementación',
  'implementacion',
  'desarrollo',
  'diseño',
  'diseno',
  'gestión',
  'gestion',
  'producción',
  'produccion',
  'comunicación',
  'comunicacion',
  'implementation',
  'development',
  'design',
  'management',
  'production',
  'communication',
] as const;

/**
 * Alias inequívocos: clave en minúsculas (sin acentos, espacios colapsados)
 * → forma canónica.
 * Solo expansiones de marca/nombre, sin añadir dominio funcional.
 */
export const SAFE_SKILL_ALIASES: Readonly<Record<string, string>> = {
  tailwind: 'Tailwind CSS',
  'tailwind css': 'Tailwind CSS',
  photoshop: 'Adobe Photoshop',
  'adobe photoshop': 'Adobe Photoshop',
  illustrator: 'Adobe Illustrator',
  'adobe illustrator': 'Adobe Illustrator',
  'premiere pro': 'Adobe Premiere Pro',
  'adobe premiere pro': 'Adobe Premiere Pro',
  'after effects': 'Adobe After Effects',
  'adobe after effects': 'Adobe After Effects',
  audition: 'Adobe Audition',
  'adobe audition': 'Adobe Audition',
  js: 'JavaScript',
  javascript: 'JavaScript',
  ts: 'TypeScript',
  typescript: 'TypeScript',
  'node.js': 'Node.js',
  nodejs: 'Node.js',
  'node js': 'Node.js',
  // Fase A — runtimes / cloud inequívocos
  express: 'Express.js',
  'express.js': 'Express.js',
  'express js': 'Express.js',
  go: 'Go',
  golang: 'Go',
  'cloud sql': 'Google Cloud SQL',
  'google cloud sql': 'Google Cloud SQL',
  aws: 'Amazon Web Services',
  'amazon web services': 'Amazon Web Services',
  s3: 'Amazon S3',
  'amazon s3': 'Amazon S3',
  cloudfront: 'Amazon CloudFront',
  'amazon cloudfront': 'Amazon CloudFront',
  'cloud front': 'Amazon CloudFront',
  azure: 'Microsoft Azure',
  'microsoft azure': 'Microsoft Azure',
};

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeKey(value: string): string {
  return collapseWhitespace(value)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * Formato superficial del original: trim + colapsar espacios.
 * No cambia el significado ni expande alias.
 */
export function superficialNormalizedName(originalName: string): string {
  return collapseWhitespace(originalName);
}

/**
 * True si el nombre es exactamente un término genérico aislado
 * (sin objeto ni contexto adicional).
 */
export function isBareGenericSkillName(name: string): boolean {
  const key = normalizeKey(name);
  return (BARE_GENERIC_TERMS as readonly string[]).includes(key);
}

/**
 * True si `normalized` introduce tokens que no están en `original`
 * y no se explican por un alias seguro.
 */
export function addsInterpretedContext(
  originalName: string,
  normalizedName: string,
): boolean {
  const originalKey = normalizeKey(originalName);
  const normalizedKey = normalizeKey(normalizedName);

  if (originalKey === normalizedKey) return false;

  const aliasTarget = SAFE_SKILL_ALIASES[originalKey];
  if (aliasTarget && normalizeKey(aliasTarget) === normalizedKey) {
    return false;
  }

  // También aceptar si el proposed es el alias y el original es variante del alias.
  for (const [aliasKey, target] of Object.entries(SAFE_SKILL_ALIASES)) {
    if (
      normalizeKey(target) === normalizedKey &&
      (originalKey === aliasKey || originalKey === normalizeKey(target))
    ) {
      return false;
    }
  }

  const originalTokens = new Set(originalKey.split(' ').filter(Boolean));
  const normalizedTokens = normalizedKey.split(' ').filter(Boolean);

  // Si normalized añade tokens que no están en original → contexto interpretado.
  return normalizedTokens.some((token) => !originalTokens.has(token));
}

export type NormalizationResult =
  | { ok: true; normalizedName: string; warning?: string }
  | { ok: false; warning: string };

/**
 * Resuelve el nombre normalizado de forma conservadora.
 * - Alias seguros (Tailwind → Tailwind CSS, Express → Express.js, …).
 * - Capitalización del original si no hay alias y la propuesta no inventa tokens.
 * - Si la propuesta añade contexto sin alias: conserva el original (formato
 *   superficial) y emite warning — no descarta la skill.
 * - Skills genéricas aisladas: ok=false (sí se descartan en validación).
 */
export function resolveNormalizedName(
  originalName: string,
  proposedNormalizedName: string,
  path: string,
): NormalizationResult {
  const original = superficialNormalizedName(originalName);
  const proposed = collapseWhitespace(proposedNormalizedName);
  const originalKey = normalizeKey(original);

  if (isBareGenericSkillName(original)) {
    return {
      ok: false,
      warning:
        `${path}: skill genérica aislada "${original}" sin objeto/contexto explícito; descartada.`,
    };
  }

  const alias = SAFE_SKILL_ALIASES[originalKey];
  if (alias) {
    return { ok: true, normalizedName: alias };
  }

  if (addsInterpretedContext(original, proposed)) {
    return {
      ok: true,
      normalizedName: original,
      warning:
        `${path}: normalizedName "${proposed}" añade contexto no presente en ` +
        `originalName "${original}"; se conservó el original (normalización no interpretativa).`,
    };
  }

  // Sin alias: conservar la propuesta solo si no inventa tokens; si es igual
  // ignorando mayúsculas, preferir la capitalización propuesta si es razonable,
  // si no el original.
  if (normalizeKey(proposed) === originalKey) {
    return { ok: true, normalizedName: proposed.length > 0 ? proposed : original };
  }

  return { ok: true, normalizedName: proposed };
}
