import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type DescendantCacheEntry = {
  ids: Set<string>;
  expiresAt: number;
};

/**
 * Autorización jerárquica sobre `organigrama.org_visual_relation`.
 *
 * El viewer puede ver ficha completa de sí mismo y de cualquier descendiente activo
 * (personas bajo su cadena de mando visual).
 */
@Injectable()
export class OrgChartVisibilityService {
  private readonly descendantCache = new Map<string, DescendantCacheEntry>();
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async canViewFullProfile(
    viewerPersonId: string,
    targetPersonId: string,
  ): Promise<boolean> {
    const viewer = String(viewerPersonId).trim();
    const target = String(targetPersonId).trim();
    if (!viewer || !target) {
      return false;
    }
    if (viewer === target) {
      return true;
    }
    const descendants = await this.getVisibleDescendantIds(viewer);
    return descendants.has(target);
  }

  /**
   * Todos los `child_person_id` alcanzables bajo `viewerPersonId` (sin incluir al viewer).
   */
  async getVisibleDescendantIds(viewerPersonId: string): Promise<Set<string>> {
    const viewer = String(viewerPersonId).trim();
    if (!viewer) {
      return new Set();
    }

    const now = Date.now();
    const cached = this.descendantCache.get(viewer);
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
        WHERE r.parent_person_id = $1
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
        WHERE r.is_active = true
      )
      SELECT person_id::text AS person_id
      FROM descendants;
      `,
      [viewer],
    );

    const ids = new Set(
      (rows ?? []).map((row) => String(row.person_id)),
    );

    this.descendantCache.set(viewer, {
      ids,
      expiresAt: now + this.cacheTtlMs,
    });

    return ids;
  }

  /** Limpia cache de descendientes (p. ej. tras cambios masivos en relaciones). */
  clearDescendantCache(viewerPersonId?: string): void {
    if (viewerPersonId) {
      this.descendantCache.delete(String(viewerPersonId));
      return;
    }
    this.descendantCache.clear();
  }
}
