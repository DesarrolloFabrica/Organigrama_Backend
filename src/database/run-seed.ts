import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { seedEmployeesIfEmpty } from './employees.seed';

/**
 * Ejecutable vía `npm run seed`: reutiliza la misma configuración TypeORM que la app.
 */
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const ds = app.get(DataSource);
    await seedEmployeesIfEmpty(ds);
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[seed] error', err);
  process.exit(1);
});
