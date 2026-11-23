import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartDirectoryExportService } from './org-chart-directory-export.service';
import { OrgChartVersionService } from './org-chart-version.service';
import {
  getOrgChartVersionReadPlan,
  type OrgChartVersionReadPlan,
} from './org-chart-version-read-plan';
import type { OrgViewerContext } from './org-viewer-context';

/** Todos los datos son sintéticos: ningún nombre/correo/documento es real. */
const AUTHORIZED = 'exportador.sintetico@example.test';

function exportViewer(eduEmail: string | null): OrgViewerContext {
  return {
    personId: '100',
    eduEmail,
    permissions: [],
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
  let planSeenByQuery: OrgChartVersionReadPlan | undefined;
  const originalEnv = process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;

  beforeEach(async () => {
    process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = AUTHORIZED;
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartDirectoryExportService,
        { provide: OrgChartVersionService, useValue: versionService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartDirectoryExportService);
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    } else {
      process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS = originalEnv;
    }
  });

  describe('autorización', () => {
    it('rechaza un correo fuera de la lista', () => {
      expect(() =>
        service.ensureCanExport(exportViewer('otro_usuario@example.test')),
      ).toThrow(ForbiddenException);
    });

    it('rechaza una sesión sin correo', () => {
      expect(() => service.ensureCanExport(exportViewer(null))).toThrow(
        ForbiddenException,
      );
    });

    it.each(['exportActiveDirectory', 'exportActiveHtml'] as const)(
      '%s está deshabilitado sin ORG_CHART_DIRECTORY_EXPORT_EMAILS y no consulta datos',
      async (method) => {
        delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
        // Ni siquiera las cuentas que antes eran el valor por defecto.
        for (const email of [
          AUTHORIZED,
          'desarrollofabrica@cun.edu.co',
          'raul_valencia@cun.edu.co',
        ]) {
          await expect(service[method](exportViewer(email))).rejects.toThrow(
            ForbiddenException,
          );
        }
        expect(versionService.resolveReadPlan).not.toHaveBeenCalled();
        expect(dataSource.query).not.toHaveBeenCalled();
      },
    );
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
