/**
 * Lo más simple para alinear datos con Cloud Run:
 * 1) Arranca Cloud SQL Auth Proxy (descarga el .exe a tools/ si falta).
 * 2) Ejecuta sync-organigrama-data.mjs hacia localhost (túnel) → base organigrama en Cloud SQL.
 *
 * Requisitos: `gcloud auth application-default login` (o credenciales ADC válidas).
 *
 * PowerShell:
 *   $env:CLOUDSQL_PASSWORD="..."   # usuario organigrama_user en Cloud SQL
 *   npm run sync:cloudsql
 *
 * Opcional: CLOUDSQL_INSTANCE (default it-fab-contenido-edu-5:us-central1:carga-lms-desarrollo),
 * CLOUDSQL_USER (default organigrama_user), CLOUDSQL_DB (default organigrama), CLOUDSQL_PROXY_PORT (default 26433)
 */

import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import net from 'node:net';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const toolsDir = join(rootDir, 'tools');
const proxyExe = join(toolsDir, 'cloud-sql-proxy.exe');
const PROXY_VERSION = '2.11.3';
const PROXY_URL = `https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v${PROXY_VERSION}/cloud-sql-proxy.x64.exe`;

const INSTANCE =
  process.env.CLOUDSQL_INSTANCE ??
  'it-fab-contenido-edu-5:us-central1:carga-lms-desarrollo';
const PROXY_PORT = Number(process.env.CLOUDSQL_PROXY_PORT ?? '26433');
const CLOUD_USER = process.env.CLOUDSQL_USER ?? 'organigrama_user';
const CLOUD_DB = process.env.CLOUDSQL_DB ?? 'organigrama';
const CLOUD_PASS = process.env.CLOUDSQL_PASSWORD ?? '';

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    mkdirSync(dirname(dest), { recursive: true });
    const f = createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const loc = res.headers.location;
          f.close();
          if (!loc) {
            reject(new Error('Redirect sin Location'));
            return;
          }
          downloadFile(loc, dest).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode !== 200) {
          f.close();
          reject(new Error(`HTTP ${res.statusCode} al descargar proxy`));
          return;
        }
        res.pipe(f);
        f.on('finish', () => f.close(() => resolve()));
      })
      .on('error', reject);
  });
}

async function ensureProxy() {
  mkdirSync(toolsDir, { recursive: true });
  if (!existsSync(proxyExe)) {
    console.log('Descargando Cloud SQL Auth Proxy…');
    await downloadFile(PROXY_URL, proxyExe);
    console.log('Proxy guardado en', proxyExe);
  }
}

function waitPort(port, host = '127.0.0.1', timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timeout esperando puerto ${port}`));
        return;
      }
      const s = net.createConnection({ port, host }, () => {
        s.destroy();
        resolve();
      });
      s.on('error', () => {
        s.destroy();
        setTimeout(check, 400);
      });
    };
    check();
  });
}

async function main() {
  if (!CLOUD_PASS) {
    console.error(
      'Define CLOUDSQL_PASSWORD (contraseña de organigrama_user en Cloud SQL).',
    );
    process.exit(1);
  }

  await ensureProxy();

  const proxy = spawn(proxyExe, [`--port=${PROXY_PORT}`, INSTANCE], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let proxyErr = '';
  proxy.stderr?.on('data', (d) => {
    proxyErr += d.toString();
    process.stderr.write(d);
  });
  proxy.stdout?.on('data', (d) => process.stdout.write(d));

  await new Promise((r) => setTimeout(r, 800));
  try {
    await waitPort(PROXY_PORT);
  } catch (e) {
    proxy.kill('SIGTERM');
    console.error('El proxy no abrió el puerto. ¿`gcloud auth application-default login`?', e.message);
    if (proxyErr) console.error(proxyErr.slice(-2000));
    process.exit(1);
  }

  const env = {
    ...process.env,
    REMOTE_DB_HOST: '127.0.0.1',
    REMOTE_DB_PORT: String(PROXY_PORT),
    REMOTE_DB_USER: CLOUD_USER,
    REMOTE_DB_PASSWORD: CLOUD_PASS,
    REMOTE_DB_NAME: CLOUD_DB,
    REMOTE_DB_SSL: 'false',
    SYNC_DRY_RUN: '',
  };

  try {
    execFileSync(process.execPath, [join(rootDir, 'scripts', 'sync-organigrama-data.mjs')], {
      cwd: rootDir,
      env,
      stdio: 'inherit',
    });
  } finally {
    proxy.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(
    '\nListo. Cloud Run ya usa esta instancia por socket; la base `organigrama` debería coincidir con tu local.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
