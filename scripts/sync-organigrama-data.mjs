/**
 * Copia datos del organigrama desde una BD origen (p. ej. local) a otra (p. ej. remota).
 *
 * Uso (PowerShell):
 *   $env:LOCAL_DB_HOST="localhost"; $env:LOCAL_DB_PORT="5432"; $env:LOCAL_DB_USER="postgres";
 *   $env:LOCAL_DB_PASSWORD="postgres"; $env:LOCAL_DB_NAME="organigrama";
 *   $env:REMOTE_DB_HOST="..."; $env:REMOTE_DB_USER="..."; $env:REMOTE_DB_PASSWORD="...";
 *   $env:REMOTE_DB_NAME="org"; $env:REMOTE_DB_PORT="5432";
 *   node scripts/sync-organigrama-data.mjs
 *
 * No guardar contraseñas en este archivo.
 */

import pg from 'pg';

const { Pool } = pg;

const localCfg = {
  host: process.env.LOCAL_DB_HOST ?? 'localhost',
  port: Number(process.env.LOCAL_DB_PORT ?? '5432'),
  user: process.env.LOCAL_DB_USER ?? 'postgres',
  password: process.env.LOCAL_DB_PASSWORD ?? 'postgres',
  database: process.env.LOCAL_DB_NAME ?? 'organigrama',
};

const remoteCfg = {
  host: process.env.REMOTE_DB_HOST ?? '',
  port: Number(process.env.REMOTE_DB_PORT ?? '5432'),
  user: process.env.REMOTE_DB_USER ?? '',
  password: process.env.REMOTE_DB_PASSWORD ?? '',
  database: process.env.REMOTE_DB_NAME ?? '',
};

/** Orden de inserción respetando FKs típicas del modelo. */
const TABLES = [
  'region',
  'hierarchy',
  'role',
  'area',
  'school',
  'program',
  'city',
  'campus',
  'contract_type',
  'person',
  'org_relation',
];

function requireRemote() {
  if (!remoteCfg.host || !remoteCfg.user || !remoteCfg.database) {
    console.error(
      'Faltan REMOTE_DB_HOST, REMOTE_DB_USER o REMOTE_DB_NAME en el entorno.',
    );
    process.exit(1);
  }
}

async function tableExists(pool, name) {
  const r = await pool.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [name],
  );
  return r.rowCount > 0;
}

async function truncateRemote(remote) {
  const exist = [];
  for (const t of TABLES) {
    if (await tableExists(remote, t)) exist.push(`"${t}"`);
  }
  if (exist.length === 0) {
    throw new Error(
      'En la BD remota no existen tablas del organigrama. Crea el esquema (p. ej. arrancando Nest con DB_SYNCHRONIZE=true una vez contra esa BD).',
    );
  }
  await remote.query(
    `TRUNCATE TABLE ${exist.join(', ')} RESTART IDENTITY CASCADE`,
  );
  console.log('TRUNCATE en remoto:', exist.join(', '));
}

async function copyTable(local, remote, table) {
  if (!(await tableExists(local, table))) {
    console.warn(`Origen: tabla "${table}" no existe, se omite.`);
    return 0;
  }
  if (!(await tableExists(remote, table))) {
    throw new Error(
      `Remoto: falta la tabla "${table}". Alinea el esquema antes de sincronizar.`,
    );
  }

  const { rows } = await local.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`${table}: 0 filas en origen`);
    return 0;
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const client = await remote.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      const vals = cols.map((c) => row[c]);
      const ph = cols.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO "${table}" (${colList}) VALUES (${ph})`,
        vals,
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`${table}: ${rows.length} filas copiadas`);
  return rows.length;
}

async function main() {
  requireRemote();
  const local = new Pool(localCfg);
  const remote = new Pool({
    ...remoteCfg,
    ssl:
      process.env.REMOTE_DB_SSL === '0' || process.env.REMOTE_DB_SSL === 'false'
        ? false
        : { rejectUnauthorized: false },
  });

  try {
    await local.query('SELECT 1');
    console.log('Origen OK:', `${localCfg.user}@${localCfg.host}/${localCfg.database}`);
  } catch (e) {
    console.error('No se pudo conectar al origen (local). ¿PostgreSQL encendido?', e.message);
    process.exit(1);
  }

  try {
    await remote.query('SELECT 1');
    console.log('Remoto OK:', `${remoteCfg.user}@${remoteCfg.host}/${remoteCfg.database}`);
  } catch (e) {
    console.error('No se pudo conectar al remoto (IP/firewall/SSL/usuario).', e.message);
    process.exit(1);
  }

  const dry = process.env.SYNC_DRY_RUN === '1';
  if (dry) {
    console.log('SYNC_DRY_RUN=1: solo comprobación de tablas, sin truncar ni insertar.');
    for (const t of TABLES) {
      const a = await tableExists(local, t);
      const b = await tableExists(remote, t);
      console.log(`  ${t}: local=${a} remoto=${b}`);
    }
    await local.end();
    await remote.end();
    return;
  }

  await truncateRemote(remote);
  for (const t of TABLES) {
    await copyTable(local, remote, t);
  }

  console.log('Sincronización terminada.');
  await local.end();
  await remote.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
