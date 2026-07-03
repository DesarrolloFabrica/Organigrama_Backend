/**
 * Script: npm run generate:drive-cv-token
 *
 * Generador LOCAL del token OAuth para el módulo de hojas de vida (CV).
 *
 * Flujo:
 *  1. Carga el .env.
 *  2. Lee las credenciales OAuth de cliente desde GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH.
 *  3. Genera una URL de consentimiento (offline + consent) con scope drive.readonly.
 *  4. Pide al usuario que abra la URL, autorice y pegue el código en la terminal.
 *  5. Intercambia el código por tokens (access_token + refresh_token).
 *  6. Guarda el token en GOOGLE_DRIVE_CV_TOKEN_PATH (creando secrets/ si hace falta).
 *
 * Este script es solo para uso local/manual: NO toca la base de datos, ni el
 * diagnóstico, ni endpoints, ni frontend. Nunca imprime tokens completos.
 *
 * La cuenta que debe autorizar el acceso es: desarrollofabrica@cun.edu.co
 */

// Cargamos el .env ANTES de leer cualquier variable de entorno.
import * as dotenv from 'dotenv';
dotenv.config();

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { google } from 'googleapis';
import { GOOGLE_DRIVE_READONLY_SCOPE } from './utils/google-drive-cv-client';

const TAG = '[DriveCV:token]';

/**
 * Forma flexible del JSON de credenciales OAuth de cliente.
 *
 * Aceptamos tanto el formato típico de Google (wrapper "installed"/"web")
 * como un JSON "plano" con client_id/client_secret en la raíz.
 */
type OAuthClientFile = {
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  redirect_uris?: string[];
  installed?: OAuthClientFile;
  web?: OAuthClientFile;
};

/** Credenciales de cliente ya normalizadas para construir el OAuth2Client. */
type OAuthClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

/**
 * Lee y valida las credenciales OAuth de cliente desde el archivo configurado.
 * Lanza errores claros si falta la variable o el archivo no existe.
 */
function loadOAuthClientConfig(): OAuthClientConfig {
  const clientPath = process.env.GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH?.trim();
  if (!clientPath) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_DRIVE_CV_OAUTH_CLIENT_PATH. ' +
        'Defínela en el .env apuntando al JSON de credenciales OAuth ' +
        '(ej: ./secrets/google-drive-oauth-client.json).',
    );
  }

  const absolutePath = resolve(clientPath);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `No se encontró el archivo de credenciales OAuth en "${absolutePath}". ` +
        'Descárgalo desde Google Cloud Console (Credenciales > ID de cliente OAuth) ' +
        'y colócalo en esa ruta.',
    );
  }

  let parsed: OAuthClientFile;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, 'utf8')) as OAuthClientFile;
  } catch {
    throw new Error(
      `El archivo de credenciales "${absolutePath}" no es un JSON válido.`,
    );
  }

  // El client_id/secret puede venir dentro de "installed"/"web" o en la raíz.
  const clientInfo = parsed.installed ?? parsed.web ?? parsed;

  const clientId = clientInfo.client_id?.trim();
  const clientSecret = clientInfo.client_secret?.trim();
  if (!clientId || !clientSecret) {
    throw new Error(
      `El archivo "${absolutePath}" no contiene client_id y client_secret válidos.`,
    );
  }

  // Para el flujo manual usamos OOB / copiar-pegar el código.
  // Tomamos el primer redirect_uri configurado, o el estándar para apps de escritorio.
  const redirectUri =
    clientInfo.redirect_uri ??
    (Array.isArray(clientInfo.redirect_uris)
      ? clientInfo.redirect_uris[0]
      : undefined) ??
    'urn:ietf:wg:oauth:2.0:oob';

  return { clientId, clientSecret, redirectUri };
}

/**
 * Devuelve la ruta ABSOLUTA donde se guardará el token (sin exigir que exista).
 */
function getTokenOutputPath(): string {
  const tokenPath = process.env.GOOGLE_DRIVE_CV_TOKEN_PATH?.trim();
  if (!tokenPath) {
    throw new Error(
      'Falta la variable de entorno GOOGLE_DRIVE_CV_TOKEN_PATH. ' +
        'Defínela en el .env (ej: ./secrets/google-drive-token.json).',
    );
  }
  return resolve(tokenPath);
}

/**
 * Enmascara un secreto para poder mostrarlo en consola sin exponerlo.
 * Ej: "1//0abcdef...xyz" -> "1//0a…(73)" (solo prefijo + longitud).
 */
function maskSecret(value?: string | null): string {
  if (!value) return '(ausente)';
  const prefix = value.slice(0, 4);
  return `${prefix}… (longitud ${value.length})`;
}

async function main(): Promise<void> {
  // 1) Credenciales de cliente + ruta de salida del token.
  const clientConfig = loadOAuthClientConfig();
  const tokenOutputPath = getTokenOutputPath();

  // 2) Construimos el cliente OAuth2 con las credenciales de cliente.
  const oauth2Client = new google.auth.OAuth2(
    clientConfig.clientId,
    clientConfig.clientSecret,
    clientConfig.redirectUri,
  );

  // 3) Generamos la URL de consentimiento.
  //    - access_type 'offline' => Google entrega refresh_token.
  //    - prompt 'consent'      => fuerza la pantalla de consentimiento para
  //                               garantizar que devuelva refresh_token.
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [GOOGLE_DRIVE_READONLY_SCOPE],
  });

  console.log('');
  console.log(`${TAG} Cuenta que debe autorizar: desarrollofabrica@cun.edu.co`);
  console.log(`${TAG} Scope solicitado: ${GOOGLE_DRIVE_READONLY_SCOPE}`);
  console.log('');
  console.log(`${TAG} 1) Abre esta URL en el navegador y autoriza el acceso:`);
  console.log('');
  console.log(authUrl);
  console.log('');
  console.log(
    `${TAG} 2) Copia el código de autorización que te muestra Google y pégalo abajo.`,
  );

  // 4) Pedimos el código por terminal.
  const rl = createInterface({ input, output });
  let code: string;
  try {
    code = (await rl.question(`${TAG} Código de autorización: `)).trim();
  } finally {
    rl.close();
  }

  if (!code) {
    throw new Error('No se ingresó ningún código de autorización.');
  }

  // 5) Intercambiamos el código por tokens.
  console.log('');
  console.log(`${TAG} Intercambiando el código por tokens...`);
  const { tokens } = await oauth2Client.getToken(code);

  // Advertencia clave: sin refresh_token el acceso dejará de funcionar al expirar
  // el access_token. Suele pasar si la cuenta ya autorizó antes sin revocar.
  if (!tokens.refresh_token) {
    console.warn('');
    console.warn(
      `${TAG} ADVERTENCIA: Google NO devolvió refresh_token. ` +
        'El acceso expirará y no podrá renovarse automáticamente.',
    );
    console.warn(
      `${TAG} Solución: vuelve a ejecutar asegurando prompt='consent' (ya lo usamos), ` +
        'o revoca el acceso previo de la app en https://myaccount.google.com/permissions ' +
        'con la cuenta desarrollofabrica@cun.edu.co y reintenta.',
    );
  }

  // 6) Construimos el JSON del token en el formato que consume la utilidad:
  //    credenciales de cliente + tokens en la raíz (formato "plano").
  const tokenFileContent = {
    client_id: clientConfig.clientId,
    client_secret: clientConfig.clientSecret,
    redirect_uri: clientConfig.redirectUri,
    access_token: tokens.access_token ?? undefined,
    refresh_token: tokens.refresh_token ?? undefined,
    scope: tokens.scope ?? GOOGLE_DRIVE_READONLY_SCOPE,
    token_type: tokens.token_type ?? 'Bearer',
    expiry_date: tokens.expiry_date ?? undefined,
  };

  // Creamos la carpeta destino (ej: secrets/) si no existe.
  mkdirSync(dirname(tokenOutputPath), { recursive: true });

  // Guardamos el token con formato legible.
  writeFileSync(
    tokenOutputPath,
    JSON.stringify(tokenFileContent, null, 2),
    'utf8',
  );

  // Confirmación SIN exponer los tokens completos.
  console.log('');
  console.log(`${TAG} Token guardado en: ${tokenOutputPath}`);
  console.log(`${TAG} access_token:  ${maskSecret(tokens.access_token)}`);
  console.log(`${TAG} refresh_token: ${maskSecret(tokens.refresh_token)}`);
  console.log('');
  console.log(`${TAG} Listo. Ya puedes ejecutar: npm run diag:drive-cv`);
}

main().catch((err: unknown) => {
  console.error('');
  console.error(
    `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
  );
  process.exit(1);
});
