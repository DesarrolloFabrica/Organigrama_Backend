/**
 * Prueba HTTP de `GET /api/org-chart/vacancies` con la cadena real:
 * JwtAuthGuard global → OrgChartVersionReadPlanInterceptor → OrgChartController.
 * El servicio de vacantes y el de versiones son dobles. Datos sintéticos.
 */
import { INestApplication } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { OrgChartController } from '../org-chart.controller';
import { OrgChartVersionService } from '../org-chart-version.service';
import { OrgChartService } from '../org-chart.service';
import { OrgChartCvService } from '../org-chart-cv.service';
import { OrgChartVacancyService } from './org-chart-vacancy.service';
import { OrgChartWorkforceEventsService } from '../workforce-events/org-chart-workforce-events.service';
import { OrgChartCompetenciesService } from '../org-chart-competencies.service';
import { CompetencyPeopleSearchService } from '../competency-people-search.service';
import { OrgChartVideoService } from '../video/org-chart-video.service';
import { OrgChartVideoStreamService } from '../video/org-chart-video-stream.service';
import { OrgChartChangeTokenService } from '../org-chart-change-token.service';
import { OrgChartDirectoryExportService } from '../org-chart-directory-export.service';
import { OrgChartVersionReadPlanInterceptor } from '../org-chart-version-read-plan.interceptor';
import { getOrgChartOverlayVersionIds } from '../org-chart-version-read-plan';

const PATH = '/api/org-chart/vacancies';
const GLOBAL = { items: [{ id: 1 }, { id: 2 }] };

describe('GET /api/org-chart/vacancies (HTTP)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let vacancyService: {
    getVacancies: jest.Mock;
    getVacanciesForNode: jest.Mock;
  };
  let versionService: {
    resolveReadPlan: jest.Mock;
    resolveVersionForRequest: jest.Mock;
  };
  let overlaysSeenByService: string[] | null;

  const token = () =>
    jwt.sign({
      personId: '500',
      googleSubject: 'sub-sintetico',
      googleEmail: 'usuario.sintetico@example.test',
      eduEmail: 'usuario.sintetico@example.test',
      permissions: [],
    });
  const get = (url: string, bearer?: string) => {
    const req = request(app.getHttpServer()).get(url);
    return bearer ? req.set('Authorization', `Bearer ${bearer}`) : req;
  };

  beforeAll(async () => {
    vacancyService = {
      getVacancies: jest.fn(),
      getVacanciesForNode: jest.fn(),
    };
    versionService = {
      resolveReadPlan: jest.fn(),
      resolveVersionForRequest: jest.fn(),
    };
    const unused = {};
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'jwt-solo-pruebas-vacantes' })],
      controllers: [OrgChartController],
      providers: [
        {
          provide: AuthService,
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
        { provide: OrgChartVersionService, useValue: versionService },
        { provide: OrgChartVacancyService, useValue: vacancyService },
        { provide: OrgChartService, useValue: unused },
        { provide: OrgChartCvService, useValue: unused },
        { provide: OrgChartWorkforceEventsService, useValue: unused },
        { provide: OrgChartCompetenciesService, useValue: unused },
        { provide: CompetencyPeopleSearchService, useValue: unused },
        { provide: OrgChartVideoService, useValue: unused },
        { provide: OrgChartVideoStreamService, useValue: unused },
        { provide: OrgChartChangeTokenService, useValue: unused },
        { provide: OrgChartDirectoryExportService, useValue: unused },
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
    overlaysSeenByService = null;
    vacancyService.getVacancies.mockReset().mockResolvedValue(GLOBAL);
    vacancyService.getVacanciesForNode
      .mockReset()
      .mockImplementation((personId: string) => {
        // El servicio debe correr dentro del plan de lectura de la petición.
        overlaysSeenByService = getOrgChartOverlayVersionIds();
        return Promise.resolve({
          items: [],
          scope: { kind: 'none', personId, areaName: null },
        });
      });
    versionService.resolveReadPlan.mockReset().mockResolvedValue({
      globalVersionId: '4',
      overlays: [{ versionId: '9' }],
      applyPlanta: true,
      applyExceptions: true,
      cacheKey: 'g4|o9|planta|exc',
    });
    versionService.resolveVersionForRequest.mockReset().mockResolvedValue('4');
  });

  it('anónimo → 401 con y sin personId', async () => {
    await get(PATH).expect(401);
    await get(`${PATH}?personId=20`).expect(401);
    expect(vacancyService.getVacancies).not.toHaveBeenCalled();
    expect(vacancyService.getVacanciesForNode).not.toHaveBeenCalled();
  });

  it('sin personId → contrato original, sin resolver versión', async () => {
    const res = await get(PATH, token()).expect(200);
    expect(res.body).toEqual(GLOBAL);
    expect(vacancyService.getVacanciesForNode).not.toHaveBeenCalled();
    expect(versionService.resolveReadPlan).not.toHaveBeenCalled();
    expect(versionService.resolveVersionForRequest).not.toHaveBeenCalled();
  });

  it('con personId → alcance del nodo dentro del plan de la versión pedida', async () => {
    const res = await get(
      `${PATH}?personId=20&versionId=4&scopeVersionId=9`,
      token(),
    ).expect(200);
    expect((res.body as { scope: unknown }).scope).toEqual({
      kind: 'none',
      personId: '20',
      areaName: null,
    });
    expect(vacancyService.getVacanciesForNode).toHaveBeenCalledWith('20', '4');
    expect(vacancyService.getVacancies).not.toHaveBeenCalled();
    expect(versionService.resolveReadPlan).toHaveBeenCalledWith(
      expect.anything(),
      { versionId: '4', versionCode: undefined, scopeVersionId: '9' },
    );
    expect(versionService.resolveVersionForRequest).toHaveBeenCalledWith(
      expect.anything(),
      { versionId: '4', versionCode: undefined },
    );
    expect(overlaysSeenByService).toEqual(['9']);
  });

  it.each([
    ['vacío', `${PATH}?personId=`],
    ['no numérico', `${PATH}?personId=abc`],
    ['clave visual de nodo', `${PATH}?personId=20::77`],
    ['repetido', `${PATH}?personId=20&personId=30`],
    ['cero', `${PATH}?personId=0`],
  ])('personId %s → 400, nunca la lista global', async (_label, url) => {
    await get(url, token()).expect(400);
    expect(vacancyService.getVacancies).not.toHaveBeenCalled();
    expect(vacancyService.getVacanciesForNode).not.toHaveBeenCalled();
  });

  it('persona inexistente → 404 del servicio, nunca la lista global', async () => {
    vacancyService.getVacanciesForNode.mockRejectedValueOnce(
      new NotFoundException('Persona 999 no encontrada o inactiva.'),
    );
    await get(`${PATH}?personId=999`, token()).expect(404);
    expect(vacancyService.getVacancies).not.toHaveBeenCalled();
  });

  it('versión no autorizada → el error del versionado se propaga', async () => {
    versionService.resolveReadPlan.mockRejectedValueOnce(
      new NotFoundException('Versión no disponible.'),
    );
    await get(`${PATH}?personId=20&versionId=77`, token()).expect(404);
    expect(vacancyService.getVacanciesForNode).not.toHaveBeenCalled();
    expect(vacancyService.getVacancies).not.toHaveBeenCalled();
  });
});
