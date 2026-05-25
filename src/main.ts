import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module';
import type { Request, Response, NextFunction } from 'express';

type BootStatus = 'starting' | 'ready' | 'failed';

let bootStatus: BootStatus = 'starting';
let bootStartedAt = Date.now();
let bootError: string | undefined;

function buildCorsOrigins(): string[] {
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (!corsOrigin) {
    return ['http://localhost:5173'];
  }
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
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization',
  );
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
}

async function bootstrap() {
  const corsOrigins = buildCorsOrigins();
  const port = Number(process.env.PORT ?? 3000);
  const expressApp = express();

  expressApp.use((req: Request, res: Response, next: NextFunction) =>
    applyCorsMiddleware(req, res, next, corsOrigins),
  );

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

  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

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
