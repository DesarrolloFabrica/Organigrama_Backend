import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module';
import { seedEmployeesIfEmpty } from './../src/database/employees.seed';

describe('API (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    /**
     * Carga datos demo si la BD está vacía (requiere PostgreSQL según `.env`).
     * Usa la misma base que `npm run start:dev`; en CI conviene una BD dedicada.
     */
    const ds = app.get(DataSource);
    await seedEmployeesIfEmpty(ds);
  });

  it('GET /api/health', () => {
    return request(app.getHttpServer()).get('/api/health').expect(200).expect({
      ok: true,
      app: 'Organigrama Backend',
      status: 'running',
    });
  });

  it('GET /api/org-chart', () => {
    return request(app.getHttpServer())
      .get('/api/org-chart')
      .expect(200)
      .expect((res) => {
        const body = res.body as {
          id: string;
          name: string;
          role: { name: string } | null;
          hierarchy: { name: string } | null;
          area: { name: string } | null;
          children: unknown[];
        };
        expect(body.name).toBe('Director de Operaciones');
        expect(body.role?.name).toBe('Director');
        expect(body.hierarchy?.name).toBe('Dirección');
        expect(body.area?.name).toBe('Dirección de Operaciones');
        expect(Array.isArray(body.children)).toBe(true);
        expect(body.children).toHaveLength(2);
        expect(typeof body.id).toBe('string');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
