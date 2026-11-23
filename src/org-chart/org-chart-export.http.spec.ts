/**
 * Prueba HTTP de los exportadores (Excel y HTML) con la pila real de
 * autenticación: JwtAuthGuard global + AuthService.verifyAccessToken + JWT
 * firmado, OrgChartController, OrgChartVersionReadPlanInterceptor y
 * OrgChartDirectoryExportService reales. Solo la base de datos y los servicios
 * ajenos a la exportación son dobles. Todos los datos son sintéticos.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.types';
import { OrgChartController } from './org-chart.controller';
import { OrgChartDirectoryExportService } from './org-chart-directory-export.service';
import { OrgChartVersionService } from './org-chart-version.service';
import { OrgChartService } from './org-chart.service';
import { OrgChartCvService } from './org-chart-cv.service';
import { OrgChartVacancyService } from './vacancies/org-chart-vacancy.service';
import { OrgChartWorkforceEventsService } from './workforce-events/org-chart-workforce-events.service';
import { OrgChartCompetenciesService } from './org-chart-competencies.service';
import { CompetencyPeopleSearchService } from './competency-people-search.service';
import { OrgChartVideoService } from './video/org-chart-video.service';
import { OrgChartVideoStreamService } from './video/org-chart-video-stream.service';
import { OrgChartChangeTokenService } from './org-chart-change-token.service';
import { OrgChartVersionReadPlanInterceptor } from './org-chart-version-read-plan.interceptor';

const JWT_SECRET = 'jwt-secreto-solo-para-pruebas';
const AUTHORIZED = 'exportador.sintetico@example.test';
const ENDPOINTS = [
  {
    path: '/api/org-chart/export/directory',
    type: /application\/vnd\.ms-excel/,
    file: /^attachment; filename="organigrama-activo-\d{4}-\d{2}-\d{2}\.xls"$/,
  },
  {
    path: '/api/org-chart/export/html',
    type: /text\/html/,
    file: /^attachment; filename="organigrama-\d{4}-\d{2}-\d{2}\.html"$/,
  },
] as const;

const SYNTHETIC_ROWS = [
  {
    person_id: '10',
    boss_id: null,
    full_name: 'Persona Sintética Raíz',
    document: '0000000010',
    role_name: 'DIRECTOR SINTÉTICO',
    area_name: 'Área Sintética',
    edu_email: 'raiz@example.test',
  },
  {
    person_id: '11',
    boss_id: '10',
    full_name: 'Persona Sintética Hija',
    document: '0000000011',
    role_name: 'COORDINADOR',
    area_name: 'Área Sintética',
    edu_email: 'hija@example.test',
  },
];

describe('Exportadores del organigrama (HTTP + autenticación real)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let dataSource: { query: jest.Mock<Promise<unknown>, [string, unknown[]]> };
  let versionService: { resolveReadPlan: jest.Mock; getVersionById: jest.Mock };
  const originalEnv = process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;

  const token = (session: Partial<JwtPayload>) =>
    jwt.sign({
      personId: '500',
      googleSubject: 'sub-sintetico',
      googleEmail: 'google@example.test',
      permissions: [],
      ...session,
    });

  beforeAll(async () => {
    dataSource = { query: jest.fn<Promise<unknown>, [string, unknown[]]>() };
    versionService = {
      resolveReadPlan: jest.fn(),
      getVersionById: jest.fn(),
    };
    const unused = {};

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      controllers: [OrgChartController],
      providers: [
        {
          provide: AuthService,
          // AuthService real: verifyAccessToken solo depende de JwtService.
          useFactory: (jwtService: JwtService) =>
            new AuthService(
              undefined as never,
              undefined as never,
              jwtService,
              undefined as never,
              undefined as never,
              undefined as never,
            ),
          inject: [JwtService],
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        OrgChartVersionReadPlanInterceptor,
        OrgChartDirectoryExportService,
        { provide: OrgChartVersionService, useValue: versionService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
        { provide: OrgChartService, useValue: unused },
        { provide: OrgChartCvService, useValue: unused },
        { provide: OrgChartVacancyService, useValue: unused },
        { provide: OrgChartWorkforceEventsService, useValue: unused },
        { provide: OrgChartCompetenciesService, useValue: unused },
        { provide: CompetencyPeopleSearchService, useValue: unused },
        { provide: OrgChartVideoService, useValue: unused },
        { provide: OrgChartVideoStreamService, useValue: unused },
        { provide: OrgChartChangeTokenService, useValue: unused },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = AUTHORIZED;
    dataSource.query.mockReset().mockResolvedValue(SYNTHETIC_ROWS);
    versionService.resolveReadPlan.mockReset().mockResolvedValue({
      globalVersionId: '4',
      overlays: [],
      applyPlanta: true,
      applyExceptions: true,
      cacheKey: 'g4|onone|planta|exc',
    });
    versionService.getVersionById.mockReset().mockResolvedValue({
      id: '4',
      code: 'version-sintetica',
      name: 'Versión sintética',
      is_active: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalEnv === undefined) {
      delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    } else {
      process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = originalEnv;
    }
  });

  describe.each(ENDPOINTS)('$path', ({ path, type, file }) => {
    it('401 sin token', async () => {
      await request(app.getHttpServer()).get(path).expect(401);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('401 con token firmado con otro secreto', async () => {
      const forged = new JwtService({ secret: 'otro-secreto' }).sign({
        personId: '1',
        eduEmail: AUTHORIZED,
        permissions: ['ORG_ADMIN'],
      });
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', `Bearer ${forged}`)
        .expect(401);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('403 con sesión válida fuera de la lista y no consulta datos', async () => {
      const res = await request(app.getHttpServer())
        .get(path)
        .set(
          'Authorization',
          `Bearer ${token({ eduEmail: 'otro@example.test' })}`,
        )
        .expect(403);
      expect(JSON.stringify(res.body)).not.toContain('Persona Sintética');
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('403 aunque tenga ORG_ADMIN y ORG_READ_ALL (no hay bypass por rol)', async () => {
      await request(app.getHttpServer())
        .get(path)
        .set(
          'Authorization',
          `Bearer ${token({ eduEmail: 'admin@example.test', permissions: ['ORG_ADMIN', 'ORG_READ_ALL'] })}`,
        )
        .expect(403);
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('403 sin la variable de entorno, incluso para las cuentas del antiguo valor por defecto', async () => {
      delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
      for (const eduEmail of [AUTHORIZED, 'desarrollofabrica@cun.edu.co']) {
        await request(app.getHttpServer())
          .get(path)
          .set('Authorization', `Bearer ${token({ eduEmail })}`)
          .expect(403);
      }
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('el rechazo no escribe el correo en los logs', async () => {
      const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      await request(app.getHttpServer())
        .get(path)
        .set(
          'Authorization',
          `Bearer ${token({ eduEmail: 'otro@example.test' })}`,
        )
        .expect(403);
      const logged = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(logged).toContain('denied personId=500');
      expect(logged).not.toContain('otro@example.test');
    });

    it('200 para un correo autorizado: archivo descargable, sin caché', async () => {
      const res = await request(app.getHttpServer())
        .get(path)
        .set(
          'Authorization',
          `Bearer ${token({ eduEmail: ' Exportador.Sintetico@example.test ' })}`,
        )
        .expect(200);

      expect(res.headers['content-type']).toMatch(type);
      expect(res.headers['content-disposition']).toMatch(file);
      expect(res.headers['cache-control']).toContain('no-store');
      const body: string = Buffer.isBuffer(res.body)
        ? res.body.toString('utf8')
        : res.text;
      expect(body).toContain('Persona Sintética Hija');
      expect(dataSource.query).toHaveBeenCalledTimes(1);
    });

    it('ignora versionId de la URL: siempre exporta la versión vigente', async () => {
      await request(app.getHttpServer())
        .get(`${path}?versionId=1`)
        .set('Authorization', `Bearer ${token({ eduEmail: AUTHORIZED })}`)
        .expect(200);

      // El servicio resuelve su propio plan sin parámetros.
      expect(versionService.resolveReadPlan).toHaveBeenLastCalledWith(
        expect.objectContaining({ personId: '500' }),
        {},
      );
      expect(dataSource.query.mock.calls[0][1]).toEqual(['4']);
    });
  });
});
