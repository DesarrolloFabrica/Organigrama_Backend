import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';
import { join } from 'path';

type BootStatus = 'starting' | 'ready' | 'failed';

let bootStatus: BootStatus = 'starting';
let bootStartedAt = Date.now();
let bootError: string | undefined;

function buildCorsOrigins(): string[] {
  // Lee los orígenes permitidos desde variable de entorno
  const corsOrigin = process.env.CORS_ORIGIN?.trim();

  // Si no hay configuración, permite el frontend local de Vite
  if (!corsOrigin) {
    return ['http://localhost:5173'];
  }

  // Permite varios orígenes separados por coma
  return corsOrigin
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Determina la interfaz de red en la que Nest escucha.
 *
 * - En producción (Cloud Run) se usa `0.0.0.0` para exponer el servicio.
 * - En desarrollo local se usa `::` (dual-stack IPv4 + IPv6) para que tanto
 *   `127.0.0.1` como `localhost` (que en Windows suele resolver a `::1`)
 *   respondan y no aparezca ERR_CONNECTION_REFUSED.
 * - Puede forzarse manualmente con la variable de entorno `HOST`.
 */
function resolveHost(): string {
  const explicitHost = process.env.HOST?.trim();
  if (explicitHost) {
    return explicitHost;
  }

  return process.env.NODE_ENV === 'production' ? '0.0.0.0' : '::';
}

/** Construye las URLs legibles para mostrar en consola al arrancar. */
function buildReachableUrls(host: string, port: number): string[] {
  // Con dual-stack (`::`) o cualquiera (`0.0.0.0`) el API es accesible por
  // ambos nombres locales; los listamos para facilitar las pruebas.
  if (host === '::' || host === '0.0.0.0') {
    return [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
    ];
  }

  return [`http://${host}:${port}`];
}

function applyCorsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
  allowedOrigins: string[],
): void {
  // Obtiene el origin del navegador
  const origin = req.headers.origin;

  // Si el origin está permitido, agrega headers CORS
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  // Métodos HTTP permitidos
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  );

  // Headers permitidos
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization',
  );

  // Responde preflight OPTIONS sin llegar a Nest
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}

async function bootstrap() {
  const corsOrigins = buildCorsOrigins();
  const port = Number(process.env.PORT ?? 3000);
  const host = resolveHost();

  // Crea la instancia base de Express usada por Nest
  const expressApp = express();

  // Sirve archivos estáticos desde Organigrama_Backend/public
  // Ejemplo: public/vault-boy.png queda disponible en /public/vault-boy.png
  expressApp.use('/public', express.static(join(process.cwd(), 'public')));

  // Aplica CORS manual antes de que Nest arranque
  expressApp.use((req: Request, res: Response, next: NextFunction) =>
    applyCorsMiddleware(req, res, next, corsOrigins),
  );

  // Endpoint de salud disponible incluso mientras Nest/DB inicia
  expressApp.get('/api/health/live', (_req, res) => {
    res.json({
      ok: bootStatus === 'ready',
      status: bootStatus,
      uptimeMs: Date.now() - bootStartedAt,
      dbHost: process.env.DB_HOST,
      hint:
        bootStatus === 'starting'
          ? 'Esperando conexion a PostgreSQL (TypeORM). Si tarda mucho, Cloud Run no alcanza la BD: usa conexion Cloud SQL en el servicio.'
          : undefined,
      error: bootError,
    });
  });

  // Bloquea temporalmente /api mientras Nest o PostgreSQL todavía no están listos
  expressApp.use('/api', (req: Request, res: Response, next: NextFunction) => {
    if (bootStatus === 'ready') {
      next();
      return;
    }

    res.status(503).json({
      ok: false,
      status: bootStatus,
      message:
        bootStatus === 'failed'
          ? 'No se pudo conectar a PostgreSQL. Revisa Cloud SQL / DB_HOST / DB_SSL en Cloud Run.'
          : 'API iniciando: conectando a PostgreSQL...',
      error: bootError,
      dbHost: process.env.DB_HOST,
    });
  });

  // Abre el puerto antes de inicializar Nest para que Cloud Run tenga health check temprano
  await new Promise<void>((resolve, reject) => {
    expressApp
      .listen(port, host, () => {
        console.log(`Puerto ${port} abierto en host ${host} (/api/health/live)`);
        resolve();
      })
      .on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          console.error(
            `El puerto ${port} ya está en uso. Cierra el proceso que lo ocupa o cambia la variable PORT.`,
          );
        }
        reject(err);
      });
  });

  bootStartedAt = Date.now();

  console.log(
    `Conectando a PostgreSQL en ${process.env.DB_HOST}:${process.env.DB_PORT ?? '5432'} (db=${process.env.DB_NAME})...`,
  );

  // Crea Nest usando el ExpressAdapter existente
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
    {
      logger: ['error', 'warn', 'log'],
    },
  );

  // Prefijo global para todos los endpoints Nest
  app.setGlobalPrefix('api');

  // CORS también en Nest para las rutas administradas por Nest
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  // Inicializa Nest sobre la misma instancia de Express
  await app.init();

  bootStatus = 'ready';

  const reachableUrls = buildReachableUrls(host, port);

  console.log('----------------------------------------------------');
  console.log(`Organigrama API lista (host=${host}, puerto=${port})`);
  console.log(`URLs API:      ${reachableUrls.map((u) => `${u}/api`).join('  |  ')}`);
  console.log(`Health check:  ${reachableUrls[0]}/api/health`);
  console.log(`CORS origins:  ${corsOrigins.join(', ')}`);
  console.log('----------------------------------------------------');
}

bootstrap().catch((err: unknown) => {
  bootStatus = 'failed';
  bootError = err instanceof Error ? err.message : String(err);

  console.error('Fallo al arrancar (PostgreSQL / Nest):', err);
  process.exit(1);
});
