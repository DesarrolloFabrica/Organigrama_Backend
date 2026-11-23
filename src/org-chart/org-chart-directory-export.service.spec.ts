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
      role_name: 'COORDINADOR',
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
      full_name: 'Docente Sintético',
      document: '0000000002',
      edu_email: 'docente@example.test',
      email: null,
      phone: null,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      emergency_contact_relationship: null,
      role_name: 'DOCENTE',
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
  let dataSource: {
    query: jest.Mock<Promise<unknown>, [string, unknown[]]>;
  };
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
  let granted: string[];
  let planSeenByQuery: OrgChartVersionReadPlan | undefined;

  beforeEach(async () => {
    granted = [HTML, XLS];
    planSeenByQuery = undefined;
    dataSource = {
      query: jest
        .fn<Promise<unknown>, [string, unknown[]]>()
        .mockImplementation(() => {
          planSeenByQuery = getOrgChartVersionReadPlan();
          return Promise.resolve(syntheticRows());
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
      expect(sql).toContain('ORDER BY e.person_id, e.edge_rank');
    });

    it('solo personas activas de core', async () => {
      await service.exportActiveDirectory(exportViewer(AUTHORIZED));

      expect(dataSource.query.mock.calls[0][0]).toMatch(
        /INNER JOIN core\.person p\s+ON p\.id::text = e\.person_id\s+AND p\.is_active = true/,
      );
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

    it('HTML: documento descargable con la persona y sin docentes de planta', async () => {
      const file = await service.exportActiveHtml(exportViewer(AUTHORIZED));

      expect(file.filename).toMatch(/^organigrama-\d{4}-\d{2}-\d{2}\.html$/);
      const html = file.buffer.toString('utf8');
      expect(html.trimStart().toLowerCase()).toMatch(/^<!doctype html>/);
      expect(html).toContain('Persona Sintética Uno');
      expect(html).not.toContain('Docente Sintético');
    });
  });
});
