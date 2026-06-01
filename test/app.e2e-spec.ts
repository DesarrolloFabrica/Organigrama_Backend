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

  it('GET /api/org-chart/root and progressive children', async () => {
    const rootRes = await request(app.getHttpServer())
      .get('/api/org-chart/root')
      .expect(200);

    const root = rootRes.body as {
      id: string;
      children: { id: string }[];
    };

    expect(typeof root.id).toBe('string');
    expect(root.id.length).toBeGreaterThan(0);
    expect(Array.isArray(root.children)).toBe(true);

    if (root.children.length === 0) {
      return;
    }

    const childId = root.children[0].id;
    const childrenRes = await request(app.getHttpServer())
      .get(`/api/org-chart/children/${childId}`)
      .expect(200);

    expect(Array.isArray(childrenRes.body)).toBe(true);
  });

  afterEach(async () => {
    await app.close();
  });
});
