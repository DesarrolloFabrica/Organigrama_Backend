import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  const corsOrigins = corsOrigin
    ? corsOrigin
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : ['http://localhost:5173'];

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
}
void bootstrap();
