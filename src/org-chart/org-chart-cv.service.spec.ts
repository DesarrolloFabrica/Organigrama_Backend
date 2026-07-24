import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartCvService } from './org-chart-cv.service';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';

describe('OrgChartCvService', () => {
  let service: OrgChartCvService;
  let visibility: { canViewFullProfile: jest.Mock };
  let dataSource: { query: jest.Mock };

  const viewer: OrgViewerContext = {
    personId: '1',
    eduEmail: 'boss@cun.edu.co',
    permissions: ['ORG_READ_ALL'],
  };

  beforeEach(async () => {
    visibility = { canViewFullProfile: jest.fn().mockResolvedValue(true) };
    dataSource = { query: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartCvService,
        { provide: OrgChartVisibilityService, useValue: visibility },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartCvService);
  });

  it('person_cv activo → hasCv=true', async () => {
    dataSource.query.mockResolvedValue([
      {
        drive_file_name: '123.pdf',
        drive_web_url: 'https://drive/x',
        synced_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const r = await service.getPersonCv(viewer, '10', 'v1');
    expect(r.hasCv).toBe(true);
    expect(r.fileName).toBe('123.pdf');
    expect(dataSource.query.mock.calls[0][0]).toMatch(/is_active = true/);
  });

  it('solo person_cv inactivo (query vacía) → hasCv=false', async () => {
    // El SELECT filtra is_active=true; filas inactivas no aparecen.
    dataSource.query.mockResolvedValue([]);
    const r = await service.getPersonCv(viewer, '10', 'v1');
    expect(r.hasCv).toBe(false);
    expect(r.fileName).toBeUndefined();
  });

  it('sin person_cv → hasCv=false', async () => {
    dataSource.query.mockResolvedValue([]);
    const r = await service.getPersonCv(viewer, '10', 'v1');
    expect(r.hasCv).toBe(false);
  });

  it('sin permiso → hasCv=false sin consultar BD', async () => {
    visibility.canViewFullProfile.mockResolvedValue(false);
    const r = await service.getPersonCv(viewer, '10', 'v1');
    expect(r.hasCv).toBe(false);
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
