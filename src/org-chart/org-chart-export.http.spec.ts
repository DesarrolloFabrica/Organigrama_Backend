/**
 * Prueba HTTP de los exportadores con la cadena real:
 * JwtAuthGuard global + AuthService.verifyAccessToken (JWT firmado) →
 * OrgChartController → OrgChartDirectoryExportService →
 * PersonPermissionService (consulta a core.person_permission) →
 * OrgChartDirectoryExportAuditService (INSERT de auditoría).
 *
 * La "base de datos" es un doble en memoria compartido con la lógica real del
 * script org:grant-directory-export, para probar concesión y revocación de
 * extremo a extremo. Todos los datos son sintéticos.
 */
import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { InMemoryPermissionDb } from '../../test/support/in-memory-permission-db';
import { AuthService } from '../auth/auth.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.types';
import {
  runGrantDirectoryExport,
  type GrantDirectoryExportArgs,
} from '../database/scripts/utils/grant-directory-export.core';
import { PersonPermission } from '../permissions/entities/person-permission.entity';
import { PersonPermissionService } from '../permissions/person-permission.service';
import { OrgChartController } from './org-chart.controller';
import { OrgChartDirectoryExportAuditService } from './org-chart-directory-export-audit.service';
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
const HTML = 'ORG_DIRECTORY_EXPORT_HTML';
const XLS = 'ORG_DIRECTORY_EXPORT_XLS';
const LEGACY = ['ORG_ADMIN', 'ORG_READ_ALL', 'ORG_CONTACT_READ_ALL'];

/** Persona sintética que usa la app (id de core.person). */
const USER = { id: '500', email: 'usuario.sintetico@example.test' };

const HTML_PATH = '/api/org-chart/export/html';
const XLS_PATH = '/api/org-chart/export/directory';
const PERMS_PATH = '/api/org-chart/export/permissions';

/** Filas sintéticas del informe (lo que devolvería la consulta del directorio). */
const REPORT_ROWS = [
  {
    person_id: '10',
    boss_id: null,
    full_name: 'Persona Sintética Raíz',
    document: '0000000010',
    base_role_name: 'DIRECTOR SINTÉTICO',
    area_name: 'Área Sintética',
    edu_email: 'raiz@example.test',
    phone: '3000000010',
  },
  {
    person_id: '11',
    boss_id: '10',
    full_name: 'Persona Sintética Hija',
    document: '0000000011',
    base_role_name: 'COORDINADOR',
    area_name: 'Área Sintética',
    edu_email: 'hija@example.test',
    phone: '3000000011',
  },
];
const PII = [
  'Persona Sintética',
  '0000000010',
  '0000000011',
  'raiz@example.test',
  'hija@example.test',
  '3000000010',
  USER.email,
];

describe('Exportadores del organigrama: permisos por formato (HTTP)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  let db: InMemoryPermissionDb;
  let reportQueries: number;
  /** Estado actual de la «base» que lee la consulta del informe. */
  let reportRows: Array<Record<string, unknown>>;
  let versionService: {
    resolveReadPlan: jest.Mock;
    getVersionById: jest.Mock;
  };
  let logged: string[];

  const token = (session: Partial<JwtPayload> = {}) =>
    jwt.sign({
      personId: USER.id,
      googleSubject: 'sub-sintetico',
      googleEmail: USER.email,
      eduEmail: USER.email,
      permissions: [],
      ...session,
    });
  const get = (path: string, bearer?: string) => {
    const req = request(app.getHttpServer()).get(path);
    return bearer ? req.set('Authorization', `Bearer ${bearer}`) : req;
  };
  const script = (args: Partial<GrantDirectoryExportArgs>) =>
    runGrantDirectoryExport(
      db,
      {
        email: USER.email,
        format: 'both',
        dryRun: false,
        revoke: false,
        ...args,
      },
      { info: () => undefined, error: () => undefined },
    );

  beforeAll(async () => {
    db = new InMemoryPermissionDb([
      { id: USER.id, eduEmail: USER.email, active: true },
    ]);
    versionService = { resolveReadPlan: jest.fn(), getVersionById: jest.fn() };
    const query = (sql: string, params?: unknown[]) => {
      if (
        /INSERT INTO organigrama\.org_chart_directory_export_audit/.test(sql)
      ) {
        return db.query(sql, params);
      }
      reportQueries++;
      return Promise.resolve(reportRows.map((row) => ({ ...row })));
    };
    const dataSource = {
      query,
      // Instantánea de solo lectura del informe (un runner por descarga).
      createQueryRunner: () => {
        const runner = {
          isTransactionActive: false,
          connect: () => Promise.resolve(),
          startTransaction: () => {
            runner.isTransactionActive = true;
            return Promise.resolve();
          },
          commitTransaction: () => {
            runner.isTransactionActive = false;
            return Promise.resolve();
          },
          rollbackTransaction: () => {
            runner.isTransactionActive = false;
            return Promise.resolve();
          },
          release: () => Promise.resolve(),
          query: () => Promise.resolve(),
          manager: { query },
        };
        return runner;
      },
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
        OrgChartDirectoryExportAuditService,
        PersonPermissionService,
        {
          provide: getRepositoryToken(PersonPermission),
          useFactory: () => db.permissionRepository(),
        },
        { provide: ConfigService, useValue: { get: () => '' } },
        { provide: OrgChartVersionService, useValue: versionService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
        {
          provide: OrgChartService,
          useValue: {
            getRoleNameOverridesForVersion: () =>
              Promise.resolve({ byPerson: new Map(), byRelation: new Map() }),
          },
        },
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
    db.permissions.clear();
    db.audit.length = 0;
    db.failAuditWrites = false;
    db.failPermissionReads = false;
    reportQueries = 0;
    reportRows = [...REPORT_ROWS];
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
    logged = [];
    for (const level of ['log', 'warn', 'error'] as const) {
      jest
        .spyOn(Logger.prototype, level)
        .mockImplementation((message: unknown) => {
          logged.push(String(message));
        });
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const expectDownload = async (path: string, bearer: string) => {
    const res = await get(path, bearer).expect(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="/,
    );
    expect(res.headers['cache-control']).toContain('no-store');
    return res;
  };

  it('anónimo → 401 en los tres endpoints, sin consultar permisos ni datos', async () => {
    for (const path of [HTML_PATH, XLS_PATH, PERMS_PATH]) {
      await get(path).expect(401);
    }
    const forged = new JwtService({ secret: 'otro-secreto' }).sign({
      personId: USER.id,
      permissions: [HTML, XLS],
    });
    await get(HTML_PATH, forged).expect(401);
    expect(reportQueries).toBe(0);
    expect(db.audit).toHaveLength(0);
  });

  it('autenticado sin permisos → 403 en ambos, auditado DENIED, sin datos', async () => {
    const res = await get(HTML_PATH, token()).expect(403);
    // El error es JSON (no hereda el Content-Type del archivo).
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.body).toMatchObject({
      code: 'DIRECTORY_EXPORT_FORBIDDEN',
      format: 'html',
    });
    const xls = await get(XLS_PATH, token()).expect(403);
    expect(xls.headers['content-type']).toMatch(/application\/json/);
    expect(xls.body).toMatchObject({ format: 'xls' });
    expect(reportQueries).toBe(0);
    expect(versionService.resolveReadPlan).not.toHaveBeenCalled();
    expect(db.audit.map((a) => [a.export_format, a.result])).toEqual([
      ['html', 'DENIED'],
      ['xls', 'DENIED'],
    ]);
  });

  it('solo HTML → descarga HTML, Excel 403', async () => {
    db.grant(USER.id, HTML);
    const res = await expectDownload(HTML_PATH, token());
    expect(res.headers['content-type']).toMatch(/text\/html/);
    await get(XLS_PATH, token()).expect(403);
  });

  it('solo Excel → descarga Excel, HTML 403', async () => {
    db.grant(USER.id, XLS);
    const res = await expectDownload(XLS_PATH, token());
    expect(res.headers['content-type']).toMatch(/application\/vnd\.ms-excel/);
    await get(HTML_PATH, token()).expect(403);
  });

  it('ambos permisos → ambas descargas, auditadas SUCCESS con versión y filas', async () => {
    db.grant(USER.id, HTML, XLS);
    await expectDownload(HTML_PATH, token());
    await expectDownload(XLS_PATH, token());
    expect(
      db.audit.map(
        ({ export_format, result, version_id, row_count, person_id }) => ({
          export_format,
          result,
          version_id,
          row_count,
          person_id,
        }),
      ),
    ).toEqual([
      {
        export_format: 'html',
        result: 'SUCCESS',
        version_id: '4',
        row_count: 2,
        person_id: USER.id,
      },
      {
        export_format: 'xls',
        result: 'SUCCESS',
        version_id: '4',
        row_count: 2,
        person_id: USER.id,
      },
    ]);
  });

  it('cada descarga se genera de nuevo con el estado vigente, sin caché HTTP ni ETag', async () => {
    db.grant(USER.id, HTML, XLS);
    const asText = (path: string) =>
      expectDownload(path, token()).then((res) => {
        expect(res.headers.etag).toBeUndefined();
        expect(res.headers['last-modified']).toBeUndefined();
        return Buffer.isBuffer(res.body)
          ? res.body.toString('utf8')
          : String(res.text);
      });
    const binary = (path: string) =>
      get(path, token())
        .buffer(true)
        .parse((res, done) => {
          const chunks: Buffer[] = [];
          res.on('data', (chunk: Buffer) => chunks.push(chunk));
          res.on('end', () => done(null, Buffer.concat(chunks)));
        });

    const xls1 = (await binary(XLS_PATH)).body as Buffer;
    const html1 = await asText(HTML_PATH);

    // Alta de una persona y baja de otra, ya incorporadas a la base.
    reportRows = [
      REPORT_ROWS[0],
      {
        person_id: '12',
        boss_id: '10',
        full_name: 'Persona Sintética Alta',
        document: '0000000012',
        base_role_name: 'ANALISTA',
        area_name: 'Área Sintética',
        edu_email: 'alta@example.test',
        phone: '3000000012',
      },
    ];
    const xls2 = ((await binary(XLS_PATH)).body as Buffer).toString('utf8');
    const html2 = await asText(HTML_PATH);

    expect(xls1.toString('utf8')).toContain('Persona Sintética Hija');
    expect(xls2).not.toContain('Persona Sintética Hija');
    expect(xls2).toContain('Persona Sintética Alta');
    expect(html1).toContain('Persona Sintética Hija');
    expect(html2).not.toContain('Persona Sintética Hija');
    expect(html2).toContain('Persona Sintética Alta');
    expect(reportQueries).toBe(4);
    expect(versionService.resolveReadPlan).toHaveBeenCalledTimes(4);
    expect(db.audit.map((a) => [a.export_format, a.result])).toEqual([
      ['xls', 'SUCCESS'],
      ['html', 'SUCCESS'],
      ['xls', 'SUCCESS'],
      ['html', 'SUCCESS'],
    ]);
  });

  it('revocación con JWT vigente → 403 inmediato (el JWT conserva los códigos)', async () => {
    db.grant(USER.id, HTML, XLS);
    const stale = token({ permissions: [HTML, XLS] });
    await expectDownload(HTML_PATH, stale);

    db.permissions.delete(`${USER.id}|${HTML}`);
    await get(HTML_PATH, stale).expect(403);
    await expectDownload(XLS_PATH, stale);
    const perms = await get(PERMS_PATH, stale).expect(200);
    expect(perms.body).toEqual({ html: false, xls: true });
  });

  it('códigos de exportación en el JWT sin respaldo en BD → 403', async () => {
    await get(HTML_PATH, token({ permissions: [HTML, XLS] })).expect(403);
    await get(XLS_PATH, token({ permissions: [HTML, XLS] })).expect(403);
  });

  it('administrador (ORG_ADMIN, ORG_READ_ALL, ORG_CONTACT_READ_ALL) sin permisos específicos → 403', async () => {
    db.grant(USER.id, ...LEGACY);
    const admin = token({ permissions: LEGACY });
    await get(HTML_PATH, admin).expect(403);
    await get(XLS_PATH, admin).expect(403);
    const perms = await get(PERMS_PATH, admin).expect(200);
    expect(perms.body).toEqual({ html: false, xls: false });
  });

  it('permisos concedidos y revocados con la lógica del script', async () => {
    const session = token();
    await get(XLS_PATH, session).expect(403);

    expect((await script({ format: 'xls' })).exitCode).toBe(0);
    await expectDownload(XLS_PATH, session);
    await get(HTML_PATH, session).expect(403);

    expect((await script({ format: 'html' })).exitCode).toBe(0);
    await expectDownload(HTML_PATH, session);

    expect((await script({ format: 'both', revoke: true })).exitCode).toBe(0);
    await get(HTML_PATH, session).expect(403);
    await get(XLS_PATH, session).expect(403);
  });

  it('compatibilidad: los permisos anteriores siguen cargándose igual', async () => {
    db.grant(USER.id, ...LEGACY, HTML);
    const service = app.get(PersonPermissionService);
    const all = await service.getPermissionsForPerson(USER.id, USER.email);
    expect([...all].sort()).toEqual([...LEGACY, HTML].sort());
    db.permissions.delete(`${USER.id}|${HTML}`);
    const legacyOnly = await service.getPermissionsForPerson(
      USER.id,
      USER.email,
    );
    expect([...legacyOnly].sort()).toEqual([...LEGACY].sort());
  });

  it('si no se puede escribir la auditoría, la descarga se cancela (503) y no sale el archivo', async () => {
    db.grant(USER.id, HTML, XLS);
    db.failAuditWrites = true;
    const res = await get(XLS_PATH, token()).expect(503);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('Persona Sintética');
  });

  it('si falla la consulta de permisos → 503 sin generar el informe', async () => {
    db.failPermissionReads = true;
    await get(HTML_PATH, token()).expect(503);
    expect(reportQueries).toBe(0);
  });

  it('ignora versionId de la URL: siempre la versión vigente', async () => {
    db.grant(USER.id, XLS);
    await expectDownload(`${XLS_PATH}?versionId=1`, token());
    expect(versionService.resolveReadPlan).toHaveBeenCalledTimes(1);
    expect(versionService.resolveReadPlan).toHaveBeenCalledWith(
      expect.objectContaining({ personId: USER.id }),
      {},
    );
  });

  it('trazabilidad sin datos personales: ni la auditoría ni los logs contienen campos del informe ni correos', async () => {
    db.grant(USER.id, HTML, XLS);
    await expectDownload(HTML_PATH, token());
    await expectDownload(XLS_PATH, token());
    db.permissions.clear();
    await get(HTML_PATH, token()).expect(403);

    const auditJson = JSON.stringify(db.audit);
    const logs = logged.join('\n');
    for (const value of PII) {
      expect(auditJson).not.toContain(value);
      expect(logs).not.toContain(value);
    }
    expect(Object.keys(db.audit[0]).sort()).toEqual([
      'created_at',
      'error_code',
      'export_format',
      'person_id',
      'result',
      'row_count',
      'version_id',
    ]);
    expect(logs).toContain(
      `exported format=html rows=2 version=4 personId=${USER.id}`,
    );
    expect(logs).toContain(`denied format=html personId=${USER.id}`);
  });
});
