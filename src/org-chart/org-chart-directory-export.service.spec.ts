import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PersonPermissionService } from '../permissions/person-permission.service';
import { OrgChartDirectoryExportAuditService } from './org-chart-directory-export-audit.service';
import { OrgChartDirectoryExportService } from './org-chart-directory-export.service';
import { OrgChartVersionService } from './org-chart-version.service';
import { OrgChartService } from './org-chart.service';
import type { RoleNameOverrides } from './org-chart-directory-people';
import {
  getOrgChartVersionReadPlan,
  type OrgChartVersionReadPlan,
} from './org-chart-version-read-plan';
import type { OrgViewerContext } from './org-viewer-context';

/** Todos los datos son sintéticos: ningún nombre/correo/documento es real. */
const AUTHORIZED = 'exportador.sintetico@example.test';
const HTML = 'ORG_DIRECTORY_EXPORT_HTML';
const XLS = 'ORG_DIRECTORY_EXPORT_XLS';

function exportViewer(
  eduEmail: string | null,
  permissions: string[] = [],
): OrgViewerContext {
  return {
    personId: '100',
    eduEmail,
    permissions,
  };
}

function plan(
  overrides: Partial<OrgChartVersionReadPlan> = {},
): OrgChartVersionReadPlan {
  return {
    globalVersionId: '7',
    overlays: [],
    applyPlanta: true,
    applyExceptions: true,
    cacheKey: 'g7|onone|planta|exc',
    ...overrides,
  };
}

function syntheticRows() {
  return [
    {
      person_id: '10',
      boss_id: '1',
      relation_id: '501',
      boss_is_active: true,
      full_name: 'Persona Sintética Uno',
      type_document: 'CC',
      document: '0000000001',
      edu_email: 'uno@example.test',
      email: null,
      phone: '3000000001',
      emergency_contact_name: 'Contacto Sintético',
      emergency_contact_phone: '3000000009',
      emergency_contact_relationship: 'Familiar',
      skills: 'Excel (Ofimática)',
      base_role_name: 'COORDINADOR',
      area_name: 'Área Sintética',
      hierarchy_name: 'Nivel 3',
      school_name: null,
      program_name: null,
      boss_name: 'Jefe Sintético',
      boss_edu_email: 'jefe@example.test',
      photo_url: 'https://example.test/foto-uno.png',
    },
    {
      person_id: '11',
      boss_id: '10',
      relation_id: '502',
      boss_is_active: true,
      full_name: 'Docente Sintético',
      document: '0000000002',
      edu_email: 'docente@example.test',
      email: null,
      phone: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relationship: null,
      base_role_name: 'DOCENTE',
      area_name: 'Área Sintética',
      hierarchy_name: 'Nivel 5',
      school_name: null,
      program_name: null,
      boss_name: 'Persona Sintética Uno',
      boss_edu_email: 'uno@example.test',
      photo_url: null,
    },
  ];
}

describe('OrgChartDirectoryExportService', () => {
  let service: OrgChartDirectoryExportService;
  /** Consulta del directorio (la del manager de la transacción). */
  let dataSource: {
    query: jest.Mock<Promise<unknown>, [string, unknown[]]>;
    createQueryRunner: jest.Mock;
  };
  type FakeRunner = {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
    isTransactionActive: boolean;
    manager: { query: jest.Mock };
  };
  /** Un QueryRunner nuevo por descarga, en orden. */
  let runners: FakeRunner[];
  /** Secuencia de operaciones (transacción, consulta y overrides) en orden. */
  let steps: string[];
  let versionService: {
    resolveReadPlan: jest.Mock;
    getVersionById: jest.Mock;
  };
  let permissionService: {
    getPersistedPermissionCodes: jest.Mock<
      Promise<string[]>,
      [string, readonly string[]]
    >;
  };
  let audit: { record: jest.Mock; recordBestEffort: jest.Mock };
  let orgChartService: { getRoleNameOverridesForVersion: jest.Mock };
  let granted: string[];
  let rows: Record<string, unknown>[];
  let overrides: RoleNameOverrides;
  let planSeenByQuery: OrgChartVersionReadPlan | undefined;
  let planSeenByOverrides: OrgChartVersionReadPlan | undefined;

  beforeEach(async () => {
    granted = [HTML, XLS];
    rows = syntheticRows();
    overrides = { byPerson: new Map(), byRelation: new Map() };
    planSeenByQuery = undefined;
    planSeenByOverrides = undefined;
    runners = [];
    steps = [];
    const query = jest
      .fn<Promise<unknown>, [string, unknown[]]>()
      .mockImplementation(() => {
        steps.push('directorio');
        planSeenByQuery = getOrgChartVersionReadPlan();
        // Copia: cada descarga recibe filas nuevas, como de PostgreSQL.
        return Promise.resolve(rows.map((row) => ({ ...row })));
      });
    const newRunner = (): FakeRunner => {
      const runner: FakeRunner = {
        connect: jest.fn(() => {
          steps.push('connect');
          return Promise.resolve();
        }),
        startTransaction: jest.fn((level: string) => {
          steps.push(`start ${level}`);
          runner.isTransactionActive = true;
          return Promise.resolve();
        }),
        commitTransaction: jest.fn(() => {
          steps.push('commit');
          runner.isTransactionActive = false;
          return Promise.resolve();
        }),
        rollbackTransaction: jest.fn(() => {
          steps.push('rollback');
          runner.isTransactionActive = false;
          return Promise.resolve();
        }),
        release: jest.fn(() => {
          steps.push('release');
          return Promise.resolve();
        }),
        query: jest.fn((sql: string) => {
          steps.push(sql);
          return Promise.resolve();
        }),
        isTransactionActive: false,
        manager: { query },
      };
      runners.push(runner);
      return runner;
    };
    dataSource = {
      query,
      createQueryRunner: jest.fn(newRunner),
    };
    orgChartService = {
      getRoleNameOverridesForVersion: jest.fn().mockImplementation(() => {
        steps.push('overrides');
        planSeenByOverrides = getOrgChartVersionReadPlan();
        return Promise.resolve(overrides);
      }),
    };
    versionService = {
      resolveReadPlan: jest.fn().mockResolvedValue(plan()),
      getVersionById: jest.fn().mockResolvedValue({
        id: '7',
        code: 'current',
        name: 'Versión actual',
        is_active: true,
      }),
    };
    permissionService = {
      getPersistedPermissionCodes: jest
        .fn<Promise<string[]>, [string, readonly string[]]>()
        .mockImplementation((_personId, codes) =>
          Promise.resolve(codes.filter((c) => granted.includes(c))),
        ),
    };
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      recordBestEffort: jest.fn().mockResolvedValue(undefined),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartDirectoryExportService,
        { provide: OrgChartVersionService, useValue: versionService },
        { provide: OrgChartService, useValue: orgChartService },
        { provide: PersonPermissionService, useValue: permissionService },
        { provide: OrgChartDirectoryExportAuditService, useValue: audit },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartDirectoryExportService);
  });

  describe('autorización por permiso vigente en BD', () => {
    it.each([
      ['exportActiveHtml', HTML],
      ['exportActiveDirectory', XLS],
    ] as const)('%s consulta solo %s en PostgreSQL', async (method, code) => {
      await service[method](exportViewer(AUTHORIZED));
      expect(
        permissionService.getPersistedPermissionCodes,
      ).toHaveBeenCalledWith('100', [code]);
    });

    it.each([
      ['exportActiveHtml', [XLS], 'html'],
      ['exportActiveDirectory', [HTML], 'xls'],
      ['exportActiveHtml', [], 'html'],
      ['exportActiveDirectory', [], 'xls'],
    ] as const)(
      '%s → 403 con permisos %j, auditado DENIED y sin consultar el informe',
      async (method, perms, format) => {
        granted = [...perms];
        await expect(service[method](exportViewer(AUTHORIZED))).rejects.toThrow(
          ForbiddenException,
        );
        expect(versionService.resolveReadPlan).not.toHaveBeenCalled();
        expect(dataSource.query).not.toHaveBeenCalled();
        expect(audit.record).not.toHaveBeenCalled();
        expect(audit.recordBestEffort).toHaveBeenCalledWith({
          personId: '100',
          format,
          result: 'DENIED',
          errorCode: 'FORBIDDEN',
        });
      },
    );

    it('ignora los permisos del JWT: códigos en la sesión pero no en BD → 403', async () => {
      granted = [];
      await expect(
        service.exportActiveHtml(exportViewer(AUTHORIZED, [HTML, XLS])),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ORG_ADMIN / ORG_READ_ALL / ORG_CONTACT_READ_ALL no autorizan', async () => {
      const legacy = ['ORG_ADMIN', 'ORG_READ_ALL', 'ORG_CONTACT_READ_ALL'];
      granted = legacy;
      for (const method of [
        'exportActiveHtml',
        'exportActiveDirectory',
      ] as const) {
        await expect(
          service[method](exportViewer(AUTHORIZED, legacy)),
        ).rejects.toThrow(ForbiddenException);
      }
      expect(dataSource.query).not.toHaveBeenCalled();
    });

    it('sin personId en la sesión → 401 sin consultar nada', async () => {
      await expect(
        service.exportActiveHtml({
          personId: '',
          eduEmail: AUTHORIZED,
          permissions: [],
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(
        permissionService.getPersistedPermissionCodes,
      ).not.toHaveBeenCalled();
      expect(audit.recordBestEffort).not.toHaveBeenCalled();
    });

    it('si falla la consulta de permisos → 503 (fail-closed) y ERROR auditado', async () => {
      permissionService.getPersistedPermissionCodes.mockRejectedValue(
        new Error('connection refused'),
      );
      await expect(
        service.exportActiveDirectory(exportViewer(AUTHORIZED)),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(audit.recordBestEffort).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'ERROR',
          errorCode: 'PERMISSION_CHECK_FAILED',
        }),
      );
    });

    it('getExportPermissions refleja la BD', async () => {
      granted = [XLS];
      await expect(
        service.getExportPermissions(exportViewer(AUTHORIZED)),
      ).resolves.toEqual({ html: false, xls: true });
    });
  });

  describe('auditoría', () => {
    it.each([
      ['exportActiveHtml', 'html'],
      ['exportActiveDirectory', 'xls'],
    ] as const)(
      '%s registra SUCCESS con versión y filas, sin datos personales',
      async (method, format) => {
        await service[method](exportViewer(AUTHORIZED));
        expect(audit.record).toHaveBeenCalledTimes(1);
        expect(audit.record).toHaveBeenCalledWith({
          personId: '100',
          format,
          result: 'SUCCESS',
          versionId: '7',
          rowCount: 1,
        });
        const serialized = JSON.stringify(audit.record.mock.calls);
        for (const pii of [
          'Persona Sintética',
          '0000000001',
          'uno@example.test',
          AUTHORIZED,
          '3000000001',
        ]) {
          expect(serialized).not.toContain(pii);
        }
      },
    );

    it('si no se puede registrar SUCCESS, no entrega el archivo (503)', async () => {
      audit.record.mockRejectedValue(new Error('relation does not exist'));
      await expect(
        service.exportActiveDirectory(exportViewer(AUTHORIZED)),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('si falla la generación registra ERROR y propaga el error original', async () => {
      dataSource.query.mockRejectedValue(new Error('timeout'));
      await expect(
        service.exportActiveHtml(exportViewer(AUTHORIZED)),
      ).rejects.toThrow('timeout');
      expect(audit.record).not.toHaveBeenCalled();
      expect(audit.recordBestEffort).toHaveBeenCalledWith({
        personId: '100',
        format: 'html',
        result: 'ERROR',
        errorCode: 'GENERATION_FAILED',
      });
    });
  });

  describe('versión y plan de lectura', () => {
    it('resuelve el plan de la versión vigente sin parámetros de la petición', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      expect(versionService.resolveReadPlan).toHaveBeenCalledWith(
        expect.objectContaining({ personId: '100' }),
        {},
      );
      expect(versionService.getVersionById).toHaveBeenCalledWith('7');
      // La consulta corre dentro del plan (ALS), igual que el mapa.
      expect(planSeenByQuery).toEqual(plan());
    });

    it('con Planta + excepciones usa la función publicada', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain(
        'organigrama.org_chart_effective_relations_published($1, ARRAY[]::bigint[]) r',
      );
      expect(params).toEqual(['7']);
    });

    it('con Planta sin capa de excepciones usa la función de Planta', async () => {
      versionService.resolveReadPlan.mockResolvedValue(
        plan({ applyExceptions: false }),
      );
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      expect(dataSource.query.mock.calls[0][0]).toContain(
        'organigrama.org_chart_effective_relations_planta($1, ARRAY[]::bigint[]) r',
      );
    });

    it('pasa los overlays de coordinación como $2', async () => {
      versionService.resolveReadPlan.mockResolvedValue(
        plan({
          overlays: [
            {
              versionId: '9',
              scopeCode: 'fabrica',
              scopeLabel: 'Fábrica',
              rootPersonId: '49',
            },
          ],
        }),
      );
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const [sql, params] = dataSource.query.mock.calls[0];
      expect(sql).toContain('($1, $2::bigint[]) r');
      expect(params).toEqual(['7', ['9']]);
    });

    it('sin Planta ni overlays lee la tabla filtrada por versión', async () => {
      versionService.resolveReadPlan.mockResolvedValue(
        plan({ applyPlanta: false, applyExceptions: false }),
      );
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const sql = dataSource.query.mock.calls[0][0];
      expect(sql).toContain('FROM organigrama.org_visual_relation r');
      expect(sql).toContain('r.version_id = $1');
    });

    it('incluye hijos por posición colgados de quien ocupa la posición', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const sql = dataSource.query.mock.calls[0][0];
      expect(sql).toContain(
        'organigrama.org_visual_relation_position_child pc',
      );
      expect(sql).toContain('ee.child_person_id::text AS boss_id');
      expect(sql).toContain('ON ee.id = pc.parent_relation_id');
    });

    it('una fila por ubicación (persona, jefe), sin descartar jefes', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const sql = dataSource.query.mock.calls[0][0];
      expect(sql).toContain(
        "SELECT DISTINCT ON (e.person_id, COALESCE(e.boss_id, ''))",
      );
      expect(sql).not.toMatch(/SELECT DISTINCT ON \(e\.person_id\)\s/);
      expect(sql).toContain('FROM placements e');
    });

    it('conserva al jefe inactivo y expone su estado', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const sql = dataSource.query.mock.calls[0][0];
      expect(sql).toContain('boss.is_active AS boss_is_active');
      expect(sql).toMatch(
        /LEFT JOIN core\.person boss\s+ON boss\.id::text = e\.boss_id\s+LEFT/,
      );
    });

    it('el cargo no se resuelve en SQL: overrides del servicio del mapa dentro del mismo plan', async () => {
      const overlayPlan = plan({
        overlays: [
          {
            versionId: '9',
            scopeCode: 'fabrica',
            scopeLabel: 'Fábrica',
            rootPersonId: '49',
          },
        ],
      });
      versionService.resolveReadPlan.mockResolvedValue(overlayPlan);
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      const sql = dataSource.query.mock.calls[0][0];
      expect(sql).not.toContain('org_chart_person_override');
      expect(sql).not.toContain('org_visual_relation_override');
      expect(
        orgChartService.getRoleNameOverridesForVersion,
      ).toHaveBeenCalledWith('7', { manager: runners[0].manager });
      expect(planSeenByOverrides).toEqual(overlayPlan);
    });

    it('solo personas activas de core', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      expect(dataSource.query.mock.calls[0][0]).toMatch(
        /INNER JOIN core\.person p\s+ON p\.id::text = e\.person_id\s+AND p\.is_active = true/,
      );
    });
  });

  describe('estado vigente en cada descarga', () => {
    const SNAPSHOT = [
      'connect',
      'start REPEATABLE READ',
      'SET TRANSACTION READ ONLY',
      'directorio',
      'overrides',
      'commit',
      'release',
    ];

    it.each([['exportActiveDirectory'], ['exportActiveHtml']] as const)(
      '%s: consulta y overrides en una sola instantánea de solo lectura',
      async (method) => {
        await service[method](exportViewer(AUTHORIZED));

        expect(steps).toEqual(SNAPSHOT);
        expect(runners).toHaveLength(1);
        expect(runners[0].rollbackTransaction).not.toHaveBeenCalled();
      },
    );

    it('dos descargas seguidas → dos generaciones completas (sin reutilizar nada)', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      expect(versionService.resolveReadPlan).toHaveBeenCalledTimes(2);
      expect(versionService.getVersionById).toHaveBeenCalledTimes(2);
      expect(dataSource.query).toHaveBeenCalledTimes(2);
      expect(
        orgChartService.getRoleNameOverridesForVersion,
      ).toHaveBeenCalledTimes(2);
      expect(runners).toHaveLength(2);
      expect(steps).toEqual([...SNAPSHOT, ...SNAPSHOT]);
    });

    it('la segunda descarga refleja altas, bajas y cambios de cargo, jefe y coordinación', async () => {
      const first = (
        await service.exportActiveDirectory(exportViewer(AUTHORIZED))
      ).buffer.toString('utf8');

      // Cambios ya incorporados a la base entre las dos descargas.
      rows = [
        {
          ...rows[0],
          boss_id: '3',
          boss_name: 'Jefa Nueva Sintética',
          boss_edu_email: 'jefa.nueva@example.test',
          area_name: 'Coordinación Nueva Sintética',
        },
        {
          ...rows[0],
          person_id: '12',
          relation_id: '520',
          full_name: 'Alta Sintética',
          document: '0000000012',
          base_role_name: 'ANALISTA',
          boss_id: '10',
          boss_name: 'Persona Sintética Uno',
          boss_edu_email: 'uno@example.test',
        },
      ];
      overrides = {
        byPerson: new Map([['10', 'LIDER SINTÉTICO']]),
        byRelation: new Map(),
      };
      const second = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );
      const xml = second.buffer.toString('utf8');

      expect(first).not.toEqual(xml);
      expect(second.rowCount).toBe(2);
      expect(xml).toContain('Alta Sintética');
      expect(xml).toContain('LIDER SINTÉTICO');
      expect(xml).toContain('Jefa Nueva Sintética');
      expect(xml).toContain('Coordinación Nueva Sintética');
      expect(xml).not.toContain('Jefe Sintético<');
      expect(xml).not.toContain('>COORDINADOR<');
    });

    it('si la consulta falla: ROLLBACK, conexión liberada, ERROR auditado y sin archivo', async () => {
      dataSource.query.mockRejectedValueOnce(new Error('conexión perdida'));

      await expect(
        service.exportActiveDirectory(exportViewer(AUTHORIZED)),
      ).rejects.toThrow('conexión perdida');

      expect(steps).toEqual([
        'connect',
        'start REPEATABLE READ',
        'SET TRANSACTION READ ONLY',
        'rollback',
        'release',
      ]);
      expect(dataSource.query).toHaveBeenCalledTimes(1);
      expect(
        orgChartService.getRoleNameOverridesForVersion,
      ).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(audit.recordBestEffort).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 'ERROR',
          errorCode: 'GENERATION_FAILED',
        }),
      );
    });

    it('si fallan los overrides tampoco hay archivo (no cae a datos parciales)', async () => {
      orgChartService.getRoleNameOverridesForVersion.mockRejectedValueOnce(
        new Error('timeout'),
      );

      await expect(
        service.exportActiveHtml(exportViewer(AUTHORIZED)),
      ).rejects.toThrow('timeout');
      expect(steps.slice(-2)).toEqual(['rollback', 'release']);
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('si no hay conexión disponible: error, conexión liberada y sin archivo', async () => {
      dataSource.createQueryRunner.mockImplementationOnce(() => {
        const runner = {
          connect: jest.fn().mockRejectedValue(new Error('sin conexión')),
          isTransactionActive: false,
          release: jest.fn(() => {
            steps.push('release');
            return Promise.resolve();
          }),
        };
        return runner;
      });

      await expect(
        service.exportActiveDirectory(exportViewer(AUTHORIZED)),
      ).rejects.toThrow('sin conexión');
      expect(steps).toEqual(['release']);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
    });
  });

  describe('contenido', () => {
    it('Excel: hoja XML con la versión activa, sin docentes de planta', async () => {
      const file = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );

      expect(file.rowCount).toBe(1);
      expect(file.versionLabel).toBe('Versión actual · current (activa)');
      expect(file.filename).toMatch(
        /^organigrama-activo-\d{4}-\d{2}-\d{2}\.xls$/,
      );
      const xml = file.buffer.toString('utf8');
      expect(xml).toContain('Persona Sintética Uno');
      expect(xml).toContain('Área Sintética');
      expect(xml).toContain('Jefe Sintético');
      expect(xml).toContain('Contacto Sintético');
      expect(xml).toContain('Excel (Ofimática)');
      expect(xml).not.toContain('Docente Sintético');
    });

    it('Excel: «Base general» + Dirección + una pestaña por coordinación desde la misma lectura', async () => {
      const base = rows[0];
      rows = [
        {
          ...base,
          person_id: '1144',
          boss_id: null,
          relation_id: null,
          boss_is_active: null,
          full_name: 'Directora Sintética',
          document: '0000001144',
          area_name: 'DIRECCIÓN SINTÉTICA',
          base_role_name: 'DIRECTOR',
        },
        {
          ...base,
          person_id: '300',
          boss_id: '1144',
          relation_id: '601',
          full_name: 'Supervisor B2B Sintético',
          document: '0000000300',
          area_name: 'B2B',
          base_role_name: 'SUPERVISOR B2B',
          boss_name: 'Directora Sintética',
        },
        {
          ...base,
          person_id: '301',
          boss_id: '300',
          relation_id: '602',
          full_name: 'Auxiliar B2B Sintética',
          document: '0000000301',
          area_name: 'B2B',
          base_role_name: 'AUXILIAR',
          boss_name: 'Supervisor B2B Sintético',
        },
        {
          ...base,
          person_id: '302',
          boss_id: '300',
          relation_id: '603',
          full_name: 'Docente B2B Sintético',
          document: '0000000302',
          area_name: 'B2B',
          base_role_name: 'DOCENTE',
          boss_name: 'Supervisor B2B Sintético',
        },
      ];

      const file = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );
      const xml = file.buffer.toString('utf8');
      const sheets = [
        ...xml.matchAll(
          /<Worksheet ss:Name="([^"]*)">([\s\S]*?)<\/Worksheet>/g,
        ),
      ].map((m) => ({ name: m[1], body: m[2] }));

      // La auditoría sigue contando las filas de la base general.
      expect(file.rowCount).toBe(3);
      expect(sheets.map((s) => s.name)).toEqual([
        'Base general',
        'DIRECCIÓN SINTÉTICA',
        'B2B',
      ]);
      expect(sheets[1].body).toContain(
        'Dirección: DIRECCIÓN SINTÉTICA — Responsable: Directora Sintética',
      );
      const b2b = sheets[2].body;
      expect(b2b).toContain(
        'Coordinación: B2B — Responsable: Supervisor B2B Sintético',
      );
      expect(b2b.indexOf('Supervisor B2B Sintético')).toBeLessThan(
        b2b.indexOf('Auxiliar B2B Sintética'),
      );
      // Título + encabezados + 2 personas (la Directora solo figura como jefe).
      expect(b2b.match(/<Row[ >]/g)).toHaveLength(4);
      expect(b2b).not.toContain('Docente B2B Sintético');
      expect(sheets[0].body).toContain('Directora Sintética');
      // La base general conserva su presentación original (sin filtros).
      expect(sheets[0].body).not.toContain('AutoFilter');
      // Una sola consulta: todas las hojas salen de la misma instantánea.
      expect(dataSource.query).toHaveBeenCalledTimes(1);
      expect(runners).toHaveLength(1);
    });

    it('HTML: documento descargable con la persona y sin docentes de planta', async () => {
      const file = await service.exportActiveHtml(exportViewer(AUTHORIZED));

      expect(file.filename).toMatch(/^organigrama-\d{4}-\d{2}-\d{2}\.html$/);
      const html = file.buffer.toString('utf8');
      expect(html.trimStart().toLowerCase()).toMatch(/^<!doctype html>/);
      expect(html).toContain('Persona Sintética Uno');
      expect(html).not.toContain('Docente Sintético');
    });

    /** Ubicación adicional de la persona 10 bajo otro jefe (mismos datos personales). */
    function secondPlacement(extra: Record<string, unknown>) {
      return { ...rows[0], relation_id: '503', ...extra };
    }

    it('Excel: varios jefes → una fila con todos los jefes por nombre', async () => {
      rows = [
        rows[0],
        secondPlacement({
          boss_id: '2',
          boss_name: 'Ana Jefa Sintética',
          boss_edu_email: 'ana.jefa@example.test',
        }),
        rows[1],
      ];
      const file = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );

      expect(file.rowCount).toBe(1);
      const xml = file.buffer.toString('utf8');
      expect(xml.match(/Persona Sintética Uno/g)).toHaveLength(1);
      expect(xml).toContain('Ana Jefa Sintética | Jefe Sintético');
      expect(xml).toContain('ana.jefa@example.test | jefe@example.test');
    });

    it('HTML: varios jefes → aparece bajo cada uno y cuenta una vez', async () => {
      rows = [
        {
          ...rows[0],
          person_id: '1',
          boss_id: null,
          relation_id: null,
          boss_is_active: null,
          full_name: 'Directora Sintética',
          document: '0000000101',
          base_role_name: 'DIRECTOR',
        },
        {
          ...rows[0],
          person_id: '2',
          boss_id: '1',
          relation_id: '510',
          full_name: 'Coordinadora Sintética',
          document: '0000000102',
          base_role_name: 'COORDINADOR',
        },
        {
          ...rows[0],
          boss_id: '1',
          relation_id: '511',
          base_role_name: 'LIDER',
        },
        {
          ...rows[0],
          boss_id: '2',
          relation_id: '512',
          base_role_name: 'LIDER',
        },
      ];
      const file = await service.exportActiveHtml(exportViewer(AUTHORIZED));

      expect(file.rowCount).toBe(3);
      const html = file.buffer.toString('utf8');
      expect(html).toContain('3 personas</p>');
      const hierarchy = html.slice(0, html.indexOf('id="area-'));
      // Bajo la Directora y bajo la Coordinadora.
      expect(hierarchy.match(/Persona Sintética Uno/g)).toHaveLength(2);
    });

    it('Excel: jefe inactivo → se conserva la fila con «(inactivo)»', async () => {
      rows = [
        {
          ...rows[0],
          boss_name: 'Jefa Retirada Sintética',
          boss_is_active: false,
        },
      ];
      const file = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );

      expect(file.rowCount).toBe(1);
      expect(file.buffer.toString('utf8')).toContain(
        'Jefa Retirada Sintética (inactivo)',
      );
    });

    it('HTML: jefe inactivo → sección diferenciada', async () => {
      rows = [
        {
          ...rows[0],
          boss_name: 'Jefa Retirada Sintética',
          boss_is_active: false,
        },
      ];
      const file = await service.exportActiveHtml(exportViewer(AUTHORIZED));

      const html = file.buffer.toString('utf8');
      expect(html).toContain('id="jefe-registrado-inactivo"');
      expect(html).toContain(
        'Jefe registrado: Jefa Retirada Sintética (inactivo)',
      );
    });

    it('cargo con override de overlay: decide la exclusión y la columna Cargo', async () => {
      // El overlay vuelve docente a la persona 10 → sale del informe;
      // y vuelve coordinador al docente 11 → entra.
      overrides = {
        byPerson: new Map([
          ['10', 'DOCENTE'],
          ['11', 'COORDINADOR DE OVERLAY'],
        ]),
        byRelation: new Map(),
      };
      const file = await service.exportActiveDirectory(
        exportViewer(AUTHORIZED),
      );

      const xml = file.buffer.toString('utf8');
      expect(file.rowCount).toBe(1);
      expect(xml).toContain('Docente Sintético');
      expect(xml).toContain('COORDINADOR DE OVERLAY');
      // Sigue como «Jefe» del otro, pero ya no tiene fila propia.
      expect(xml).not.toContain(
        '<Row><Cell><Data ss:Type="String">Persona Sintética Uno</Data>',
      );
    });

    it('nombre del archivo con la fecha de Colombia', async () => {
      jest.useFakeTimers({ now: new Date('2026-11-24T01:30:00Z') });
      try {
        const xls = await service.exportActiveDirectory(
          exportViewer(AUTHORIZED),
        );
        const html = await service.exportActiveHtml(exportViewer(AUTHORIZED));
        expect(xls.filename).toBe('organigrama-activo-2026-11-23.xls');
        expect(html.filename).toBe('organigrama-2026-11-23.html');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
