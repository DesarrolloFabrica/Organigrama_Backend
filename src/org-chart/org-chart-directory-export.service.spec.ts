import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartDirectoryExportService } from './org-chart-directory-export.service';
import { OrgChartVersionService } from './org-chart-version.service';
import type { OrgViewerContext } from './org-viewer-context';

function exportViewer(eduEmail: string): OrgViewerContext {
  return {
    personId: '100',
    eduEmail,
    permissions: [],
  };
}

describe('OrgChartDirectoryExportService', () => {
  let service: OrgChartDirectoryExportService;
  let dataSource: { query: jest.Mock };
  let versionService: { getActiveVersion: jest.Mock };
  const originalEnv = process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;

  beforeEach(async () => {
    delete process.env.ORG_CHART_DIRECTORY_EXPORT_EMAILS;
    dataSource = { query: jest.fn() };
    versionService = {
      getActiveVersion: jest.fn().mockResolvedValue({
        id: '7',
        code: 'current',
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

  it('rechaza un correo fuera de la lista', () => {
    expect(() =>
      service.ensureCanExport(exportViewer('otro_usuario@cun.edu.co')),
    ).toThrow(ForbiddenException);
  });

  it('exporta la versión activa con área, jefe y emergencia', async () => {
    dataSource.query.mockResolvedValue([
      {
        person_id: '10',
        boss_id: '1',
        full_name: 'Ana Pérez',
        document: '123',
        edu_email: 'ana_perez@cun.edu.co',
        email: null,
        phone: '3001112233',
        emergency_contact_name: 'Luis Pérez',
        emergency_contact_phone: '3100000000',
        emergency_contact_relationship: 'Padre',
        role_name: 'COORDINADOR',
        area_name: 'Operaciones',
        hierarchy_name: 'Nivel 3',
        school_name: null,
        program_name: null,
        boss_name: 'Raúl Valencia',
        boss_edu_email: 'raul_valencia@cun.edu.co',
      },
      {
        person_id: '11',
        boss_id: '10',
        full_name: 'Docente Ejemplo',
        document: '456',
        edu_email: 'docente@cun.edu.co',
        email: null,
        phone: null,
        emergency_contact_name: 'N/A',
        emergency_contact_phone: null,
        emergency_contact_relationship: null,
        role_name: 'DOCENTE',
        area_name: 'Operaciones',
        hierarchy_name: 'Nivel 5',
        school_name: null,
        program_name: null,
        boss_name: 'Ana Pérez',
        boss_edu_email: 'ana_perez@cun.edu.co',
      },
    ]);

    const file = await service.exportActiveDirectory(
      exportViewer('lorena_gomez@cun.edu.co'),
    );

    expect(versionService.getActiveVersion).toHaveBeenCalled();
    expect(dataSource.query.mock.calls[0][1]).toEqual(['7']);
    expect(file.rowCount).toBe(1);
    expect(file.filename).toMatch(/^organigrama-activo-\d{4}-\d{2}-\d{2}\.xls$/);
    const xml = file.buffer.toString('utf8');
    expect(xml).toContain('Ana Pérez');
    expect(xml).toContain('Operaciones');
    expect(xml).toContain('Raúl Valencia');
    expect(xml).toContain('Luis Pérez');
    expect(xml).not.toContain('Docente Ejemplo');
  });
});
