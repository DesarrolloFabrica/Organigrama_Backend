/**
 * Helpers de normalización / enmascarado para curaduría manual.
 * Reutiliza toCanonicalKey y SAFE_SKILL_ALIASES existentes.
 */

import { SAFE_SKILL_ALIASES } from '../../cv-skills/cv-skills.normalize';
import { toCanonicalKey } from '../../cv-skills/cv-skills-persistence.service';
import { maskDocument } from '../../database/scripts/utils/cv-skills-version-dry-run';

export { toCanonicalKey, maskDocument, SAFE_SKILL_ALIASES };

/**
 * Resuelve alias seguro de código (SAFE_SKILL_ALIASES) → nombre canónico.
 */
export function resolveSafeAliasCanonicalName(
  inputName: string,
): string | null {
  const key = inputName
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
  return SAFE_SKILL_ALIASES[key] ?? null;
}
