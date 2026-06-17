import { Injectable } from '@nestjs/common';

import { InjectDataSource } from '@nestjs/typeorm';

import { DataSource } from 'typeorm';

import type { OrgViewerContext } from './org-viewer-context';

import { viewerHasGlobalReadAccess } from './org-viewer-context';

type DescendantCacheEntry = {
  ids: Set<string>;

  expiresAt: number;
};

/**

 * Autorización jerárquica sobre `organigrama.org_visual_relation`.

 *

 * Reglas:

 *  - Si el viewer tiene ORG_READ_ALL → acceso total sin redacción.

 *  - El viewer puede ver ficha completa de sí mismo y de cualquier descendiente

 *    activo bajo su cadena de mando visual.

 */

@Injectable()
export class OrgChartVisibilityService {
  private readonly descendantCache = new Map<string, DescendantCacheEntry>();

  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private cacheKey(versionId: string, viewerPersonId: string): string {
    return `${versionId}:${viewerPersonId}`;
  }

  /**

   * ¿El viewer puede ver la ficha completa del target?

   * Cortocircuita a `true` si el viewer tiene ORG_READ_ALL.

   */

  async canViewFullProfile(
    viewer: OrgViewerContext,

    targetPersonId: string,

    versionId: string,
  ): Promise<boolean> {
    if (viewerHasGlobalReadAccess(viewer)) {
      return true;
    }

    const viewerId = String(viewer.personId).trim();

    const target = String(targetPersonId).trim();

    if (!viewerId || !target) {
      return false;
    }

    if (viewerId === target) {
      return true;
    }

    const descendants = await this.getVisibleDescendantIds(viewer, versionId);

    return descendants.has(target);
  }

  /**

   * Todos los `child_person_id` alcanzables bajo `viewer.personId` (sin incluir al viewer).

   * Si el viewer tiene ORG_READ_ALL, devuelve un Set vacío (el llamador debe omitir la redacción

   * chequeando `viewerHasGlobalReadAccess` antes de usar este resultado).

   */

  async getVisibleDescendantIds(
    viewer: OrgViewerContext,

    versionId: string,
  ): Promise<Set<string>> {
    const viewerId = String(viewer.personId).trim();

    if (!viewerId) {
      return new Set();
    }

    const now = Date.now();

    const key = this.cacheKey(versionId, viewerId);

    const cached = this.descendantCache.get(key);

    if (cached && cached.expiresAt > now) {
      return cached.ids;
    }

    const rows = await this.dataSource.query<{ person_id: string }[]>(
      `

      WITH RECURSIVE descendants AS (

        SELECT

          r.child_person_id AS person_id

        FROM organigrama.org_visual_relation r

        INNER JOIN core.person p

          ON p.id = r.child_person_id

          AND p.is_active = true

        WHERE r.version_id = $2

          AND r.parent_person_id = $1

          AND r.is_active = true



        UNION ALL



        SELECT

          r.child_person_id

        FROM organigrama.org_visual_relation r

        INNER JOIN descendants d

          ON r.parent_person_id = d.person_id

        INNER JOIN core.person p

          ON p.id = r.child_person_id

          AND p.is_active = true

        WHERE r.version_id = $2

          AND r.is_active = true

      )

      SELECT person_id::text AS person_id

      FROM descendants;

      `,

      [viewerId, versionId],
    );

    const ids = new Set((rows ?? []).map((row) => String(row.person_id)));

    this.descendantCache.set(key, {
      ids,

      expiresAt: now + this.cacheTtlMs,
    });

    return ids;
  }

  /** Limpia cache de descendientes (p. ej. tras cambios masivos en relaciones). */

  clearDescendantCache(viewerPersonId?: string, versionId?: string): void {
    if (viewerPersonId && versionId) {
      this.descendantCache.delete(this.cacheKey(versionId, viewerPersonId));

      return;
    }

    this.descendantCache.clear();
  }
}
