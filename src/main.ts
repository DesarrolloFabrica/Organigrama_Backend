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
      .listen(port, '0.0.0.0', () => {
        console.log(`Puerto ${port} abierto (/api/health/live)`);
        resolve();
      })
      .on('error', reject);
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

  console.log(`Organigrama API lista en 0.0.0.0:${port}`);
  console.log(`CORS origins: ${corsOrigins.join(', ')}`);
}

bootstrap().catch((err: unknown) => {
  bootStatus = 'failed';
  bootError = err instanceof Error ? err.message : String(err);

  console.error('Fallo al arrancar (PostgreSQL / Nest):', err);
  process.exit(1);
});
