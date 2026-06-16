/**
 * Diagnóstico org_visual_relation — solo lectura.
 * Uso: node scripts/diagnose-org-visual-relations.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const pg = require('pg');

function loadEnv() {
  const raw = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  const env = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function section(title) {
  console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`);
}

function printRows(label, result, limit = 50) {
  console.log(`\n--- ${label} (${result.rowCount} filas) ---`);
  if (result.rowCount === 0) {
    console.log('(sin filas)');
    return;
  }
  const rows = result.rows.slice(0, limit);
  console.table(rows);
  if (result.rowCount > limit) {
    console.log(`... truncado, mostrando ${limit} de ${result.rowCount}`);
  }
}

async function main() {
  const env = loadEnv();
  const client = new pg.Client({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    ssl: env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  try {
    section('1. Conteo de personas en core.person');
    printRows('total_personas', await client.query(`
      SELECT COUNT(*)::int AS total_personas FROM core.person
    `));
    printRows('personas_activas', await client.query(`
      SELECT COUNT(*)::int AS personas_activas
      FROM core.person WHERE is_active = true
    `));

    section('2. Relaciones por versión y estado');
    printRows('por_version', await client.query(`
      SELECT
        v.id AS version_id,
        v.code,
        v.is_active AS version_activa,
        v.is_locked,
        COUNT(r.id)::int AS relaciones_totales,
        COUNT(*) FILTER (WHERE r.is_active = true)::int AS relaciones_activas,
        COUNT(*) FILTER (WHERE r.is_active = false)::int AS relaciones_inactivas
      FROM organigrama.org_chart_version v
      LEFT JOIN organigrama.org_visual_relation r ON r.version_id = v.id
      GROUP BY v.id, v.code, v.is_active, v.is_locked
      ORDER BY v.id
    `));

    section('3. Personas distintas en cada versión (activas)');
    printRows('personas_distintas', await client.query(`
      WITH active_rel AS (
        SELECT version_id, parent_person_id, child_person_id
        FROM organigrama.org_visual_relation
        WHERE is_active = true
      ),
      persons_in_version AS (
        SELECT version_id, parent_person_id AS person_id FROM active_rel
        UNION
        SELECT version_id, child_person_id AS person_id FROM active_rel
      )
      SELECT
        v.id AS version_id,
        v.code,
        COUNT(DISTINCT ar.parent_person_id)::int AS padres_distintos,
        COUNT(DISTINCT ar.child_person_id)::int AS hijos_distintos,
        COUNT(DISTINCT piv.person_id)::int AS personas_distintas_en_relaciones
      FROM organigrama.org_chart_version v
      LEFT JOIN active_rel ar ON ar.version_id = v.id
      LEFT JOIN persons_in_version piv ON piv.version_id = v.id
      GROUP BY v.id, v.code
      ORDER BY v.id
    `));

    section('4. Duplicados exactos padre-hijo por versión');
    const dupes = await client.query(`
      SELECT
        version_id,
        parent_person_id,
        child_person_id,
        COUNT(*)::int AS repeticiones
      FROM organigrama.org_visual_relation
      GROUP BY version_id, parent_person_id, child_person_id
      HAVING COUNT(*) > 1
      ORDER BY repeticiones DESC
    `);
    printRows('duplicados', dupes);

    section('5. Personas con más de un padre (activas)');
    const multiParent = await client.query(`
      SELECT
        r.version_id,
        v.code,
        r.child_person_id,
        p.full_name,
        p.edu_email,
        COUNT(DISTINCT r.parent_person_id)::int AS cantidad_padres,
        ARRAY_AGG(DISTINCT r.parent_person_id ORDER BY r.parent_person_id) AS padres
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id
      LEFT JOIN core.person p ON p.id = r.child_person_id
      WHERE r.is_active = true
      GROUP BY r.version_id, v.code, r.child_person_id, p.full_name, p.edu_email
      HAVING COUNT(DISTINCT r.parent_person_id) > 1
      ORDER BY cantidad_padres DESC, r.child_person_id
    `);
    printRows('multi_padre', multiParent, 30);

    section('5b. Resumen multi-padre por versión');
    printRows('resumen', await client.query(`
      SELECT
        r.version_id,
        v.code,
        COUNT(*)::int AS hijos_con_multiples_padres
      FROM (
        SELECT version_id, child_person_id
        FROM organigrama.org_visual_relation
        WHERE is_active = true
        GROUP BY version_id, child_person_id
        HAVING COUNT(DISTINCT parent_person_id) > 1
      ) r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id
      GROUP BY r.version_id, v.code
      ORDER BY r.version_id
    `));

    section('6. Relaciones con personas inexistentes');
    const orphan = await client.query(`
      SELECT r.id, r.version_id, r.parent_person_id, r.child_person_id, r.is_active
      FROM organigrama.org_visual_relation r
      LEFT JOIN core.person parent_p ON parent_p.id = r.parent_person_id
      LEFT JOIN core.person child_p ON child_p.id = r.child_person_id
      WHERE parent_p.id IS NULL OR child_p.id IS NULL
      LIMIT 50
    `);
    printRows('huerfanas', orphan);

    section('7. Top 30 padres con más hijos (activas)');
    printRows('top_padres', await client.query(`
      SELECT
        r.version_id,
        v.code,
        r.parent_person_id,
        p.full_name AS parent_name,
        COUNT(*)::int AS total_hijos
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id
      LEFT JOIN core.person p ON p.id = r.parent_person_id
      WHERE r.is_active = true
      GROUP BY r.version_id, v.code, r.parent_person_id, p.full_name
      ORDER BY total_hijos DESC
      LIMIT 30
    `));

    section('8. Total físico y por version_id');
    printRows('total_fisico', await client.query(`
      SELECT COUNT(*)::int AS total_relaciones_todas_las_versiones
      FROM organigrama.org_visual_relation
    `));
    printRows('por_version_id', await client.query(`
      SELECT version_id, COUNT(*)::int AS relaciones
      FROM organigrama.org_visual_relation
      GROUP BY version_id
      ORDER BY version_id
    `));

    section('9. Ciclos jerárquicos (muestra, versión current activas)');
    const cycles = await client.query(`
      WITH RECURSIVE walk AS (
        SELECT
          r.version_id,
          r.parent_person_id AS root_id,
          r.child_person_id AS current_id,
          ARRAY[r.parent_person_id, r.child_person_id]::bigint[] AS path,
          false AS is_cycle
        FROM organigrama.org_visual_relation r
        JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
        WHERE r.is_active = true

        UNION ALL

        SELECT
          w.version_id,
          w.root_id,
          r.child_person_id,
          w.path || r.child_person_id,
          r.child_person_id = ANY(w.path)
        FROM walk w
        JOIN organigrama.org_visual_relation r
          ON r.version_id = w.version_id
         AND r.parent_person_id = w.current_id
         AND r.is_active = true
        WHERE NOT w.is_cycle
          AND cardinality(w.path) < 30
      )
      SELECT DISTINCT
        version_id,
        root_id,
        current_id,
        path
      FROM walk
      WHERE is_cycle
      LIMIT 20
    `);
    printRows('ciclos', cycles);

    section('10. Hijos en core.person que NO aparecen como child en current (activas)');
    printRows('personas_sin_padre_en_arbol', await client.query(`
      SELECT COUNT(*)::int AS personas_activas_sin_relacion_como_hijo
      FROM core.person p
      WHERE p.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM organigrama.org_visual_relation r
          JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
          WHERE r.child_person_id = p.id AND r.is_active = true
        )
    `));

    section('11. Relaciones activas vs hijos únicos (current)');
    printRows('current_ratio', await client.query(`
      SELECT
        COUNT(*)::int AS relaciones_activas,
        COUNT(DISTINCT child_person_id)::int AS hijos_unicos,
        COUNT(*)::int - COUNT(DISTINCT child_person_id)::int AS exceso_sobre_hijos_unicos
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
      WHERE r.is_active = true
    `));

    section('12. Distribución cantidad_padres por hijo (current, activas)');
    printRows('distribucion_padres', await client.query(`
      SELECT
        cantidad_padres,
        COUNT(*)::int AS cantidad_hijos
      FROM (
        SELECT child_person_id, COUNT(DISTINCT parent_person_id)::int AS cantidad_padres
        FROM organigrama.org_visual_relation r
        JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
        WHERE r.is_active = true
        GROUP BY child_person_id
      ) x
      GROUP BY cantidad_padres
      ORDER BY cantidad_padres
    `));

    section('13. Huérfana 1205→1218: qué persona falta');
    printRows('detalle_huerfana', await client.query(`
      SELECT
        r.id,
        r.version_id,
        r.parent_person_id,
        parent_p.full_name AS parent_name,
        parent_p.is_active AS parent_active,
        r.child_person_id,
        child_p.full_name AS child_name,
        child_p.is_active AS child_active
      FROM organigrama.org_visual_relation r
      LEFT JOIN core.person parent_p ON parent_p.id = r.parent_person_id
      LEFT JOIN core.person child_p ON child_p.id = r.child_person_id
      WHERE r.parent_person_id = 1205 AND r.child_person_id = 1218
      LIMIT 5
    `));

    section('14. relation_type en current (activas)');
    printRows('relation_types', await client.query(`
      SELECT relation_type, COUNT(*)::int AS cnt
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
      WHERE r.is_active = true
      GROUP BY relation_type
      ORDER BY cnt DESC
    `));

    section('15. Los 8 padres que comparten 126 hijos');
    printRows('ocho_padres', await client.query(`
      SELECT r.parent_person_id, p.full_name, COUNT(DISTINCT r.child_person_id)::int AS hijos
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
      LEFT JOIN core.person p ON p.id = r.parent_person_id
      WHERE r.is_active = true
        AND r.child_person_id IN (
          SELECT child_person_id
          FROM organigrama.org_visual_relation r2
          JOIN organigrama.org_chart_version v2 ON v2.id = r2.version_id AND v2.code = 'current'
          WHERE r2.is_active = true
          GROUP BY child_person_id
          HAVING COUNT(DISTINCT parent_person_id) = 8
        )
      GROUP BY r.parent_person_id, p.full_name
      ORDER BY r.parent_person_id
    `));

    section('16. Relación inactiva (current)');
    printRows('inactiva', await client.query(`
      SELECT r.id, r.parent_person_id, r.child_person_id, r.relation_type, r.is_active
      FROM organigrama.org_visual_relation r
      JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
      WHERE r.is_active = false
    `));

    section('RESUMEN NUMÉRICO');
    const current = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM core.person) AS total_personas,
        (SELECT COUNT(*)::int FROM core.person WHERE is_active = true) AS personas_activas,
        (SELECT COUNT(*)::int FROM organigrama.org_visual_relation r
         JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current') AS current_rel_total,
        (SELECT COUNT(*)::int FROM organigrama.org_visual_relation r
         JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
         WHERE r.is_active = true) AS current_rel_activas,
        (SELECT COUNT(DISTINCT child_person_id)::int FROM organigrama.org_visual_relation r
         JOIN organigrama.org_chart_version v ON v.id = r.version_id AND v.code = 'current'
         WHERE r.is_active = true) AS current_hijos_unicos
    `);
    console.table(current.rows[0]);
    console.log(`\nDuplicados padre-hijo: ${dupes.rowCount}`);
    console.log(`Hijos con múltiples padres (filas): ${multiParent.rowCount}`);
    console.log(`Relaciones huérfanas: ${orphan.rowCount}`);
    console.log(`Ciclos detectados (muestra): ${cycles.rowCount}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
