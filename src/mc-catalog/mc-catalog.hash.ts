import { createHash } from 'node:crypto';
import type { McCatalogDefinition } from './mc-catalog.types';

/**
 * Hash determinista de la definición declarativa del catálogo MC1.
 * Independiente de ids de BD. Cambia solo si cambia el contenido semántico.
 */
export function computeMcCatalogDefinitionHash(
  definition: McCatalogDefinition,
): string {
  const payload = {
    catalogCode: definition.catalogCode,
    catalogVersion: definition.catalogVersion,
    domains: definition.domains.map((d) => ({
      code: d.code,
      name: d.name,
      sortOrder: d.sortOrder,
      specialties: d.specialties.map((s) => ({
        code: s.code,
        name: s.name,
        purpose: s.purpose,
        description: s.description,
        lifecycleStatus: s.lifecycleStatus,
        sortOrder: s.sortOrder,
      })),
    })),
  };

  return createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}
