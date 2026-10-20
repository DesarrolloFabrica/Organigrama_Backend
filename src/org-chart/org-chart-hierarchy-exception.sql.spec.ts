/**
 * Pruebas SQL aisladas de la capa de excepciones jerárquicas (migraciones 037/038)
 * y de supresiones de aristas (039), con sus scripts de activación/retirada,
 * sobre un PostgreSQL desechable con datos SINTÉTICOS que replican la topología
 * real (Raúl → Haider con su segunda posición 49 → 49 y su equipo por posición,
 * overlay de Fábrica, Planta moviendo a Sara y Johan).
 *
 * Se omite salvo que ORG_CHART_SQL_TEST_URL apunte a localhost, p. ej.:
 *   docker run --rm -d --name org-exc-test -e POSTGRES_PASSWORD=test -p 5444:5432 postgres:18
 *   ORG_CHART_SQL_TEST_URL=postgres://postgres:test@localhost:5444/postgres \
 *     npx jest src/org-chart/org-chart-hierarchy-exception.sql.spec.ts
 */
/* El proyecto no incluye @types/pg (pg se usa vía TypeORM): el cliente queda
   sin tipos en esta prueba aislada y no se añade la dependencia solo por ella. */
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { buildChangeTokenSql } from './org-chart-change-token.service';

const URL = process.env.ORG_CHART_SQL_TEST_URL ?? '';
const IS_LOCAL = /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(URL);
const ROOT = join(__dirname, '..', '..');
const BATCH = 'provisional-haider-sara-johan-2026-10';

const IRON = 1144;
const RAUL = 1082;
const HAIDER = 49;
const SARA = 52;
const JOHAN = 2;
const CAMILO = 1; // equipo de Johan
const SARA_KID = 1207; // equipo de Sara
const PEER = 1310; // par de Haider bajo Raúl
const NEW_HIRE = 1772; // alta de Orbit solo en Planta, bajo Johan
const OTHER_MOVE = 1773; // cambio de Orbit no relacionado, bajo PEER
// Equipo por posición de la segunda posición de Haider (49 → 49):
const ANALYST_DUP = 1213; // también tiene jefe en Orbit (Johan)
const ANALYST_ORPHAN = 1350; // sin otro jefe en el mapa
const ANALYST_INACTIVE = 1212; // persona inactiva
const SUPPRESSION_BATCH = 'provisional-haider-segunda-posicion-2026-10';

const ORBIT_PLANTA = [
  { person_id: JOHAN, parent_person_id: RAUL },
  { person_id: SARA, parent_person_id: RAUL },
  { person_id: ANALYST_DUP, parent_person_id: JOHAN },
  { person_id: NEW_HIRE, parent_person_id: JOHAN },
  { person_id: OTHER_MOVE, parent_person_id: PEER },
];

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

function opsScript(
  name: string,
  vars: Record<string, string>,
  dir = 'org-chart-hierarchy-exception',
): string {
  let sql = read(`scripts/sql/${dir}/${name}.sql`);
  for (const [key, value] of Object.entries(vars)) {
    sql = sql.split(`:'${key}'`).join(`'${value.replace(/'/g, "''")}'`);
  }
  return sql;
}

(IS_LOCAL ? describe : describe.skip)(
  'excepciones jerárquicas (SQL aislado)',
  () => {
    let db: Client;

    const rows = async <T = Record<string, unknown>>(
      sql: string,
      params: unknown[] = [],
    ) => (await db.query(sql, params)).rows as T[];

    const parentsOf = async (fn: string, version: number, child: number) =>
      (
        await rows<{ p: string }>(
          `SELECT parent_person_id::text p FROM organigrama.${fn}($1, ARRAY[6]::bigint[])
         WHERE child_person_id = $2 ORDER BY parent_person_id`,
          [version, child],
        )
      ).map((r) => Number(r.p));

    const published = (child: number) =>
      parentsOf('org_chart_effective_relations_published', 4, child);

    const descendants = async (viewer: number) =>
      (
        await rows<{ id: string }>(
          // Mismo CTE que OrgChartVisibilityService (UNION).
          `WITH RECURSIVE effective AS (
           SELECT * FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
         ), d AS (
           SELECT r.child_person_id AS person_id FROM effective r
           JOIN core.person p ON p.id = r.child_person_id AND p.is_active
           WHERE r.parent_person_id = $1
           UNION
           SELECT r.child_person_id FROM effective r
           JOIN d ON r.parent_person_id = d.person_id
           JOIN core.person p ON p.id = r.child_person_id AND p.is_active
         ) SELECT person_id::text id FROM d ORDER BY person_id`,
          [viewer],
        )
      ).map((r) => Number(r.id));

    const token = async () =>
      (await rows<{ token: string }>(buildChangeTokenSql(true, true, true)))[0]
        .token;

    const childrenOf = async (parent: number) =>
      (
        await rows<{ c: string }>(
          `SELECT child_person_id::text c FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
         WHERE parent_person_id = $1 ORDER BY child_person_id`,
          [parent],
        )
      ).map((r) => Number(r.c));

    const runScript = async (sql: string) => {
      try {
        await db.query(sql);
      } catch (error) {
        await db.query('ROLLBACK').catch(() => undefined);
        throw error;
      }
    };

    beforeAll(async () => {
      db = new Client({ connectionString: URL });
      await db.connect();
      await db.query(`
      DROP SCHEMA IF EXISTS organigrama CASCADE;
      DROP SCHEMA IF EXISTS core CASCADE;
      DROP SCHEMA IF EXISTS vacancies CASCADE;
      CREATE SCHEMA core; CREATE SCHEMA organigrama; CREATE SCHEMA vacancies;
      CREATE TABLE core.person (
        id BIGINT PRIMARY KEY, full_name TEXT NOT NULL, is_active BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
      CREATE TABLE organigrama.org_chart_version (
        id BIGSERIAL PRIMARY KEY, code VARCHAR(100) NOT NULL, name VARCHAR(255) NOT NULL,
        description TEXT, period_label VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT false, is_locked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by_person_id BIGINT, updated_by_person_id BIGINT);
      CREATE TABLE organigrama.org_visual_relation (
        id BIGSERIAL PRIMARY KEY, parent_person_id BIGINT NOT NULL, child_person_id BIGINT NOT NULL,
        relation_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT_REPORT', visual_level INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(), updated_at TIMESTAMP NOT NULL DEFAULT now(),
        version_id BIGINT NOT NULL,
        UNIQUE (version_id, parent_person_id, child_person_id));
      CREATE TABLE organigrama.org_visual_relation_override (id BIGSERIAL, updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE organigrama.org_visual_relation_position_child (
        id BIGSERIAL PRIMARY KEY, version_id BIGINT NOT NULL, parent_relation_id BIGINT NOT NULL,
        child_person_id BIGINT NOT NULL, relation_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT_REPORT',
        visual_level INTEGER, is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now(),
        UNIQUE (version_id, parent_relation_id, child_person_id));
      CREATE TABLE organigrama.org_chart_person_override (id BIGSERIAL, updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE vacancies.vacancy (id BIGSERIAL, updated_at TIMESTAMPTZ DEFAULT now());
    `);
      await db.query(read('migrations/029_org_chart_scoped_versions.sql'));
      await db.query(read('test/sql/planta-baseline.sql'));

      await db.query(`
      INSERT INTO core.person (id, full_name) VALUES
        (${IRON}, 'IRON ALEXANDER FUENTES RODRIGUEZ'), (${RAUL}, 'RAUL VALENCIA CIFUENTES'),
        (${HAIDER}, 'HAIDER YESID BELLO MELO'), (${SARA}, 'SARA JULIANA MARTINEZ LOPEZ'),
        (${JOHAN}, 'JOHAN SEBASTIAN DAZA SARMIENTO'), (${CAMILO}, 'CAMILO SINTETICO'),
        (${SARA_KID}, 'EQUIPO SARA SINTETICO'), (${PEER}, 'PAR SINTETICO'),
        (${NEW_HIRE}, 'ALTA ORBIT SINTETICA'), (${OTHER_MOVE}, 'CAMBIO ORBIT SINTETICO'),
        (${ANALYST_DUP}, 'ANALISTA CON JEFE ORBIT'), (${ANALYST_ORPHAN}, 'ANALISTA SOLO POR POSICION');
      INSERT INTO core.person (id, full_name, is_active) VALUES
        (${ANALYST_INACTIVE}, 'ANALISTA INACTIVO', false);
      INSERT INTO organigrama.org_chart_version (id, code, name, is_active, is_locked, scope_type, scope_code, scope_root_person_id) VALUES
        (3, 'historico', 'Histórico', false, true, 'GLOBAL', NULL, NULL),
        (4, 'vigente', 'Versión actual', true, true, 'GLOBAL', NULL, NULL),
        (6, 'fabrica-contenidos-oficial', 'Fábrica 2.0', true, false, 'COORDINATION', 'fabrica-contenidos', ${HAIDER});
      INSERT INTO organigrama.org_visual_relation (version_id, parent_person_id, child_person_id, visual_level) VALUES
        (3, ${IRON}, ${RAUL}, 2), (3, ${RAUL}, ${HAIDER}, 3), (3, ${RAUL}, ${PEER}, 3),
        (3, ${PEER}, ${JOHAN}, 4), (3, ${HAIDER}, ${SARA}, 3), (3, ${JOHAN}, ${CAMILO}, 5),
        (4, ${IRON}, ${RAUL}, 2), (4, ${RAUL}, ${HAIDER}, 3), (4, ${RAUL}, ${PEER}, 3),
        (4, ${HAIDER}, ${JOHAN}, 4), (4, ${HAIDER}, ${SARA}, 3),
        (4, ${JOHAN}, ${CAMILO}, 5), (4, ${SARA}, ${SARA_KID}, 4),
        (6, ${HAIDER}, ${JOHAN}, 4), (6, ${HAIDER}, ${SARA}, 3), (6, ${HAIDER}, ${HAIDER}, 3),
        (6, ${JOHAN}, ${CAMILO}, 5), (6, ${SARA}, ${SARA_KID}, 4);
      -- Estado B (Orbit): Sara y Johan bajo Raúl; altas y cambios no relacionados.
      INSERT INTO core.planta_org_override (person_id, parent_person_id) VALUES
        (${SARA}, ${RAUL}), (${JOHAN}, ${RAUL}), (${NEW_HIRE}, ${JOHAN}), (${OTHER_MOVE}, ${PEER}),
        (${ANALYST_DUP}, ${JOHAN});
      -- Equipo por posición de la segunda posición de Haider (como 032).
      INSERT INTO organigrama.org_visual_relation_position_child
        (version_id, parent_relation_id, child_person_id, visual_level)
      SELECT 6, r.id, x.child, 4
      FROM organigrama.org_visual_relation r
      CROSS JOIN (VALUES (${ANALYST_DUP}), (${ANALYST_ORPHAN}), (${ANALYST_INACTIVE})) AS x(child)
      WHERE r.version_id = 6 AND r.parent_person_id = ${HAIDER} AND r.child_person_id = ${HAIDER};
    `);
      await db.query(read('migrations/037_org_chart_hierarchy_exception.sql'));
      await db.query(
        read('migrations/038_provisional_haider_sara_johan_draft.sql'),
      );
      await db.query(read('migrations/039_org_chart_relation_suppression.sql'));
    });

    afterAll(async () => {
      await db?.end();
    });

    it('038 crea el lote en DRAFT y no cambia nada visible (Estado B publicado)', async () => {
      const drafts = await rows(
        `SELECT person_id::int, parent_person_id::int, status, global_version_id::int
       FROM organigrama.org_chart_hierarchy_exception ORDER BY person_id`,
      );
      expect(drafts).toEqual([
        {
          person_id: JOHAN,
          parent_person_id: HAIDER,
          status: 'DRAFT',
          global_version_id: 4,
        },
        {
          person_id: SARA,
          parent_person_id: HAIDER,
          status: 'DRAFT',
          global_version_id: 4,
        },
      ]);
      expect(await published(SARA)).toEqual([RAUL]);
      expect(await published(JOHAN)).toEqual([RAUL]);

      // Idempotente.
      await db.query(
        read('migrations/038_provisional_haider_sara_johan_draft.sql'),
      );
      const [{ n }] = await rows<{ n: number }>(
        'SELECT COUNT(*)::int n FROM organigrama.org_chart_hierarchy_exception',
      );
      expect(n).toBe(2);
    });

    describe('con el lote ACTIVE (Estado A)', () => {
      let tokenBefore: string;

      beforeAll(async () => {
        tokenBefore = await token();
        await runScript(opsScript('activate', { batch: BATCH, actor: '1229' }));
      });

      it('Sara y Johan son hijos directos de Haider, con un único jefe', async () => {
        expect(await published(SARA)).toEqual([HAIDER]);
        expect(await published(JOHAN)).toEqual([HAIDER]);
      });

      it('no quedan bajo Raúl ni hay pares padre-hijo duplicados', async () => {
        const raulKids = await rows<{ c: string }>(
          `SELECT child_person_id::text c FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
         WHERE parent_person_id = $1 ORDER BY child_person_id`,
          [RAUL],
        );
        expect(raulKids.map((r) => Number(r.c))).toEqual([HAIDER, PEER]);

        const dup = await rows(
          `SELECT parent_person_id, child_person_id
         FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
         GROUP BY 1, 2 HAVING COUNT(*) > 1`,
        );
        expect(dup).toEqual([]);
      });

      it('el resto de Orbit y de la versión sigue igual (altas incluidas)', async () => {
        expect(await published(NEW_HIRE)).toEqual([JOHAN]);
        expect(await published(OTHER_MOVE)).toEqual([PEER]);
        expect(await published(CAMILO)).toEqual([JOHAN]);
        expect(await published(SARA_KID)).toEqual([SARA]);
        expect(await published(HAIDER)).toEqual([HAIDER, RAUL]); // segunda posición intacta
      });

      it('descendientes / visibilidad: termina con el ciclo 49 → 49 y no se amplía a pares', async () => {
        expect(await descendants(HAIDER)).toEqual(
          [CAMILO, JOHAN, HAIDER, SARA, SARA_KID, NEW_HIRE, ANALYST_DUP].sort(
            (a, b) => a - b,
          ),
        );
        expect(await descendants(PEER)).toEqual([OTHER_MOVE]);
        const raul = await descendants(RAUL);
        expect(raul).toEqual(
          expect.arrayContaining([HAIDER, SARA, JOHAN, CAMILO, NEW_HIRE]),
        );
      });

      it('la versión histórica conserva su estructura', async () => {
        const v3 = await rows<{ p: string; c: string }>(
          `SELECT parent_person_id::text p, child_person_id::text c
         FROM organigrama.org_chart_effective_relations(3, ARRAY[]::bigint[])
         WHERE child_person_id IN ($1, $2) ORDER BY 2`,
          [JOHAN, SARA],
        );
        expect(v3).toEqual([
          { p: String(PEER), c: String(JOHAN) },
          { p: String(HAIDER), c: String(SARA) },
        ]);
        // Las excepciones de la versión 4 no se aplican a otra versión global.
        const v3pub = await rows<{ p: string }>(
          `SELECT parent_person_id::text p FROM organigrama.org_chart_effective_relations_published(3, ARRAY[]::bigint[])
         WHERE child_person_id = $1`,
          [JOHAN],
        );
        expect(v3pub).toEqual([{ p: String(RAUL) }]);
      });

      it('no toca datos de Orbit', async () => {
        const planta = await rows(
          `SELECT person_id::int, parent_person_id::int FROM core.planta_org_override ORDER BY 1`,
        );
        expect(planta).toEqual(ORBIT_PLANTA);
      });

      it('la activación cambia el change-token', async () => {
        expect(await token()).not.toBe(tokenBefore);
      });

      it('una excepción que cerraría un ciclo se rechaza y se revierte entera', async () => {
        await db.query(
          `INSERT INTO organigrama.org_chart_hierarchy_exception
           (global_version_id, person_id, parent_person_id, batch_code, reason)
         VALUES (4, ${HAIDER}, ${CAMILO}, 'ciclo', 'prueba de ciclo')`,
        );
        await expect(
          runScript(opsScript('activate', { batch: 'ciclo', actor: '1229' })),
        ).rejects.toThrow(/único jefe provisional|ciclo/);
        const [{ status }] = await rows<{ status: string }>(
          `SELECT status FROM organigrama.org_chart_hierarchy_exception WHERE batch_code = 'ciclo'`,
        );
        expect(status).toBe('DRAFT');
        expect(await published(HAIDER)).toEqual([HAIDER, RAUL]);
      });

      it('transiciones no permitidas fallan (auditoría)', async () => {
        await expect(
          db.query(
            `UPDATE organigrama.org_chart_hierarchy_exception SET parent_person_id = ${PEER}
           WHERE batch_code = $1 AND person_id = ${SARA}`,
            [BATCH],
          ),
        ).rejects.toThrow(/inmutables/);
        await expect(
          db.query(
            `UPDATE organigrama.org_chart_hierarchy_exception SET status = 'DRAFT', activated_at = NULL
           WHERE batch_code = $1 AND person_id = ${SARA}`,
            [BATCH],
          ),
        ).rejects.toThrow(/no permitida/);
      });
    });

    describe('supresión de la segunda posición de Haider (039)', () => {
      const relationRows = async () =>
        rows(
          `SELECT id::int, version_id::int, parent_person_id::int, child_person_id::int, is_active
         FROM organigrama.org_visual_relation ORDER BY id`,
        );
      const positionRows = async () =>
        rows(
          `SELECT parent_relation_id::int, child_person_id::int, is_active
         FROM organigrama.org_visual_relation_position_child ORDER BY id`,
        );
      let relationsBefore: unknown[];
      let positionsBefore: unknown[];
      let selfRelationId: number;

      beforeAll(async () => {
        relationsBefore = await relationRows();
        positionsBefore = await positionRows();
        [{ id: selfRelationId }] = await rows<{ id: number }>(
          `SELECT id::int FROM organigrama.org_visual_relation
         WHERE version_id = 6 AND parent_person_id = $1 AND child_person_id = $1`,
          [HAIDER],
        );
      });

      it('039 crea la supresión DRAFT por id de arista y no cambia nada visible', async () => {
        const drafts = await rows(
          `SELECT relation_id::int, parent_person_id::int, child_person_id::int, status, global_version_id::int
         FROM organigrama.org_chart_relation_suppression`,
        );
        expect(drafts).toEqual([
          {
            relation_id: selfRelationId,
            parent_person_id: HAIDER,
            child_person_id: HAIDER,
            status: 'DRAFT',
            global_version_id: 4,
          },
        ]);
        expect(await published(HAIDER)).toEqual([HAIDER, RAUL]);

        await db.query(
          read('migrations/039_org_chart_relation_suppression.sql'),
        );
        const [{ n }] = await rows<{ n: number }>(
          'SELECT COUNT(*)::int n FROM organigrama.org_chart_relation_suppression',
        );
        expect(n).toBe(1);
      });

      it('sin decisión explícita, la activación se detiene y nombra a quien quedaría sin ubicación', async () => {
        await expect(
          runScript(
            opsScript(
              'activate',
              { batch: SUPPRESSION_BATCH, actor: '1229', accept_unplaced: '' },
              'org-chart-relation-suppression',
            ),
          ),
        ).rejects.toThrow(
          /ANALISTA SOLO POR POSICION \(1350\).*Decisión requerida/,
        );
        const [{ status }] = await rows<{ status: string }>(
          `SELECT status FROM organigrama.org_chart_relation_suppression WHERE batch_code = $1`,
          [SUPPRESSION_BATCH],
        );
        expect(status).toBe('DRAFT');
        expect(await published(HAIDER)).toEqual([HAIDER, RAUL]);
      });

      it('una aceptación que no coincide con los afectados también se rechaza', async () => {
        await expect(
          runScript(
            opsScript(
              'activate',
              {
                batch: SUPPRESSION_BATCH,
                actor: '1229',
                accept_unplaced: `${ANALYST_DUP}`,
              },
              'org-chart-relation-suppression',
            ),
          ),
        ).rejects.toThrow(/Decisión requerida/);
      });

      describe('con la supresión ACTIVE', () => {
        let tokenBefore: string;

        beforeAll(async () => {
          tokenBefore = await token();
          await runScript(
            opsScript(
              'activate',
              {
                batch: SUPPRESSION_BATCH,
                actor: '1229',
                accept_unplaced: `${ANALYST_ORPHAN}`,
              },
              'org-chart-relation-suppression',
            ),
          );
        });

        it('la decisión de dejar sin ubicación queda registrada', async () => {
          const [{ accepted }] = await rows<{ accepted: string[] }>(
            `SELECT accepted_unplaced_person_ids::text[] accepted
           FROM organigrama.org_chart_relation_suppression WHERE batch_code = $1`,
            [SUPPRESSION_BATCH],
          );
          expect(accepted).toEqual([String(ANALYST_ORPHAN)]);
        });

        it('Haider aparece una sola vez, bajo Raúl, sin auto-arista', async () => {
          expect(await published(HAIDER)).toEqual([RAUL]);
          const selfEdges = await rows(
            `SELECT id FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
           WHERE parent_person_id = child_person_id`,
          );
          expect(selfEdges).toEqual([]);
        });

        it('Sara y Johan son los únicos hijos directos de Haider', async () => {
          expect(await published(SARA)).toEqual([HAIDER]);
          expect(await published(JOHAN)).toEqual([HAIDER]);
          expect(await childrenOf(HAIDER)).toEqual([JOHAN, SARA]);
        });

        it('nadie se reasigna al titular; quien tiene jefe en Orbit lo conserva', async () => {
          // Con jefe en Orbit: se queda solo bajo ese jefe (sin duplicado).
          expect(await published(ANALYST_DUP)).toEqual([JOHAN]);
          // Sin otro jefe: NO se cuelga de Haider ni de nadie (decisión aceptada).
          expect(await published(ANALYST_ORPHAN)).toEqual([]);
          // Sigue existiendo en la base.
          const [{ n }] = await rows<{ n: number }>(
            `SELECT COUNT(*)::int n FROM core.person WHERE id = $1 AND is_active`,
            [ANALYST_ORPHAN],
          );
          expect(n).toBe(1);
          // Inactivo: no se pinta.
          expect(await published(ANALYST_INACTIVE)).toEqual([]);

          const multi = await rows(
            `SELECT child_person_id FROM organigrama.org_chart_effective_relations_published(4, ARRAY[6]::bigint[])
           GROUP BY 1 HAVING COUNT(*) > 1`,
          );
          expect(multi).toEqual([]);
        });

        it('descendientes coherentes y sin ciclos', async () => {
          const haider = await descendants(HAIDER);
          expect(haider).toEqual(
            [CAMILO, JOHAN, SARA, SARA_KID, NEW_HIRE, ANALYST_DUP].sort(
              (a, b) => a - b,
            ),
          );
          expect(haider).not.toContain(HAIDER);
          // Permisos = grafo publicado: nadie gana visibilidad sobre ANALYST_ORPHAN.
          expect(haider).not.toContain(ANALYST_ORPHAN);
          expect(await descendants(PEER)).toEqual([OTHER_MOVE]);
          const raul = await descendants(RAUL);
          expect(raul).toEqual(expect.arrayContaining([HAIDER, SARA, JOHAN]));
          expect(raul).not.toContain(ANALYST_ORPHAN);
        });

        it('un cambio futuro de Orbit sobre Sara se guarda en la fuente pero no rompe la publicación', async () => {
          const before = await token();
          await db.query(
            `UPDATE core.planta_org_override SET parent_person_id = $1, updated_at = now() WHERE person_id = $2`,
            [PEER, SARA],
          );
          try {
            expect(await published(SARA)).toEqual([HAIDER]);
            expect(await childrenOf(HAIDER)).toEqual([JOHAN, SARA]);
            expect(await token()).not.toBe(before); // los clientes se enteran
          } finally {
            await db.query(
              `UPDATE core.planta_org_override SET parent_person_id = $1 WHERE person_id = $2`,
              [RAUL, SARA],
            );
          }
        });

        it('las versiones históricas y la versión sin Planta no cambian', async () => {
          const v6 = await rows(
            `SELECT id FROM organigrama.org_chart_effective_relations(4, ARRAY[6]::bigint[])
           WHERE id = $1`,
            [selfRelationId],
          );
          expect(v6).toHaveLength(1);
          const v3pub = await rows<{ p: string }>(
            `SELECT parent_person_id::text p FROM organigrama.org_chart_effective_relations_published(3, ARRAY[]::bigint[])
           WHERE child_person_id = $1`,
            [HAIDER],
          );
          expect(v3pub).toEqual([{ p: String(RAUL) }]);
        });

        it('no borra ni modifica relaciones, hijos por posición ni Orbit', async () => {
          expect(await relationRows()).toEqual(relationsBefore);
          expect(await positionRows()).toEqual(positionsBefore);
          const planta = await rows(
            `SELECT person_id::int, parent_person_id::int FROM core.planta_org_override ORDER BY 1`,
          );
          expect(planta).toEqual(ORBIT_PLANTA);
        });

        it('la activación cambia el change-token', async () => {
          expect(await token()).not.toBe(tokenBefore);
        });

        it('una supresión que dejaría a alguien fuera del mapa se rechaza entera', async () => {
          await db.query(
            `INSERT INTO organigrama.org_chart_relation_suppression
             (global_version_id, relation_id, parent_person_id, child_person_id, batch_code, reason)
           SELECT 4, id, parent_person_id, child_person_id, 'huerfano', 'prueba'
           FROM organigrama.org_visual_relation
           WHERE version_id = 4 AND parent_person_id = ${IRON} AND child_person_id = ${RAUL}`,
          );
          await expect(
            runScript(
              opsScript(
                'activate',
                { batch: 'huerfano', actor: '1229', accept_unplaced: '' },
                'org-chart-relation-suppression',
              ),
            ),
          ).rejects.toThrow(/sin jefe/);
          const [{ status }] = await rows<{ status: string }>(
            `SELECT status FROM organigrama.org_chart_relation_suppression WHERE batch_code = 'huerfano'`,
          );
          expect(status).toBe('DRAFT');
          expect(await published(RAUL)).toEqual([IRON]);
        });

        it('arista y transiciones no permitidas fallan (auditoría)', async () => {
          await expect(
            db.query(
              `UPDATE organigrama.org_chart_relation_suppression SET relation_id = relation_id + 1
             WHERE batch_code = $1`,
              [SUPPRESSION_BATCH],
            ),
          ).rejects.toThrow(/inmutables/);
          await expect(
            db.query(
              `UPDATE organigrama.org_chart_relation_suppression SET status = 'DRAFT', activated_at = NULL
             WHERE batch_code = $1`,
              [SUPPRESSION_BATCH],
            ),
          ).rejects.toThrow(/no permitida/);
        });
      });

      describe('tras retirar la supresión', () => {
        beforeAll(async () => {
          await runScript(
            opsScript(
              'retire',
              {
                batch: SUPPRESSION_BATCH,
                actor: '1229',
                reason: 'Se restablece la segunda posición',
              },
              'org-chart-relation-suppression',
            ),
          );
        });

        it('la segunda posición vuelve tal como estaba', async () => {
          expect(await published(HAIDER)).toEqual([HAIDER, RAUL]);
          expect(await published(ANALYST_ORPHAN)).toEqual([]);
          expect(await published(SARA)).toEqual([HAIDER]);
          const [{ status }] = await rows<{ status: string }>(
            `SELECT status FROM organigrama.org_chart_relation_suppression WHERE batch_code = $1`,
            [SUPPRESSION_BATCH],
          );
          expect(status).toBe('RETIRED');
        });
      });
    });

    describe('tras retirar el lote', () => {
      let tokenBefore: string;

      beforeAll(async () => {
        tokenBefore = await token();
        await runScript(
          opsScript('retire', {
            batch: BATCH,
            actor: '1229',
            reason: 'Aprobada la estructura de Orbit',
          }),
        );
      });

      it('vuelve a prevalecer Orbit sin restaurar datos', async () => {
        expect(await published(SARA)).toEqual([RAUL]);
        expect(await published(JOHAN)).toEqual([RAUL]);
        expect(await published(NEW_HIRE)).toEqual([JOHAN]);
      });

      it('las filas quedan como historial RETIRED y el token cambia', async () => {
        const history = await rows<{ status: string; retire_reason: string }>(
          `SELECT status, retire_reason FROM organigrama.org_chart_hierarchy_exception
         WHERE batch_code = $1`,
          [BATCH],
        );
        expect(history).toHaveLength(2);
        expect(history.every((h) => h.status === 'RETIRED')).toBe(true);
        expect(await token()).not.toBe(tokenBefore);
        await expect(
          db.query(
            `UPDATE organigrama.org_chart_hierarchy_exception SET status = 'ACTIVE', retired_at = NULL
           WHERE batch_code = $1`,
            [BATCH],
          ),
        ).rejects.toThrow(/no permitida/);
      });
    });
  },
);
