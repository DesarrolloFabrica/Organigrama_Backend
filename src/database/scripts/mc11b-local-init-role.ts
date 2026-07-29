/**
 * Crea rol/DB mc1_local en PostgreSQL ya instalado (Opción B).
 *
 * Requiere URL admin local explícita — NUNCA Cloud SQL:
 *
 *   $env:MC1_LOCAL_ADMIN_URL="postgres://postgres:TU_PASSWORD@127.0.0.1:5432/postgres"
 *   npm run mc:local:init-role -- --i-confirm-init-role
 *
 * Solo permite hosts locales (assertLocalDatabaseHost).
 */
import * as dotenv from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { assertLocalDatabaseHost } from '../local/assert-local-db-host';

const TAG = '[MC1 Local Init Role]';

function loadTargetEnv(): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const envPath = resolve(process.cwd(), '.env.mc1-local');
  if (!existsSync(envPath)) {
    throw new Error(`Falta ${envPath}`);
  }
  dotenv.config({ path: envPath, override: true, quiet: true });
  const host = process.env.DB_HOST ?? '';
  assertLocalDatabaseHost(host);
  return {
    host,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'mc1_local',
    user: process.env.DB_USERNAME || 'mc1_local',
    password: (process.env.DB_PASSWORD || '').replace(/^'|'$/g, ''),
  };
}

function parseAdminUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const u = new URL(url);
  const host = u.hostname;
  assertLocalDatabaseHost(host);
  return {
    host,
    port: Number(u.port || 5432),
    database: (u.pathname || '/postgres').replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

async function main(): Promise<void> {
  if (!process.argv.includes('--i-confirm-init-role')) {
    throw new Error('Requiere --i-confirm-init-role');
  }
  const adminEnvPath = resolve(process.cwd(), '.env.mc1-local-admin');
  if (existsSync(adminEnvPath)) {
    dotenv.config({ path: adminEnvPath, override: true, quiet: true });
    console.log(`${TAG} admin env=${adminEnvPath}`);
  }
  const adminUrl = process.env.MC1_LOCAL_ADMIN_URL?.trim();
  if (!adminUrl) {
    throw new Error(
      'Define MC1_LOCAL_ADMIN_URL en .env.mc1-local-admin (solo localhost)',
    );
  }

  const target = loadTargetEnv();
  const admin = parseAdminUrl(adminUrl);

  const client = new Client({
    host: admin.host,
    port: admin.port,
    database: admin.database,
    user: admin.user,
    password: admin.password,
  });
  await client.connect();
  try {
    const info = await client.query(
      'SELECT current_database() AS db, current_user AS u, inet_server_addr() AS addr, version() AS v',
    );
    console.log(`${TAG} admin connected`, {
      db: info.rows[0].db,
      user: info.rows[0].u,
      addr: info.rows[0].addr,
      version: String(info.rows[0].v).slice(0, 60),
    });

    const role = await client.query(`SELECT 1 FROM pg_roles WHERE rolname = $1`, [
      target.user,
    ]);
    if (!role.rowCount) {
      await client.query(
        `CREATE ROLE ${quoteIdent(target.user)} LOGIN PASSWORD ${quoteLiteral(target.password)}`,
      );
      console.log(`${TAG} role created: ${target.user}`);
    } else {
      await client.query(
        `ALTER ROLE ${quoteIdent(target.user)} WITH LOGIN PASSWORD ${quoteLiteral(target.password)}`,
      );
      console.log(`${TAG} role updated: ${target.user}`);
    }

    const db = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [target.database],
    );
    if (!db.rowCount) {
      await client.query(
        `CREATE DATABASE ${quoteIdent(target.database)} OWNER ${quoteIdent(target.user)}`,
      );
      console.log(`${TAG} database created: ${target.database}`);
    } else {
      console.log(`${TAG} database exists: ${target.database}`);
    }

    await client.query(
      `GRANT ALL PRIVILEGES ON DATABASE ${quoteIdent(target.database)} TO ${quoteIdent(target.user)}`,
    );
  } finally {
    await client.end();
  }

  // Conectar como target y otorgar schema public
  const t = new Client({
    host: target.host,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
  });
  await t.connect();
  try {
    await t.query(`GRANT ALL ON SCHEMA public TO CURRENT_USER`);
    const check = await t.query(
      'SELECT current_database() AS db, current_user AS u, version() AS v',
    );
    console.log(`${TAG} target OK`, check.rows[0]);
  } finally {
    await t.end();
  }
}

function quoteIdent(id: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(id)) {
    throw new Error(`Identificador inválido: ${id}`);
  }
  return `"${id}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(TAG, err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
