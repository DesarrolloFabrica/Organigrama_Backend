import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';

const VERSION_ID = '1';

function viewer(
  personId: string,
  permissions: string[] = [],
): OrgViewerContext {
  return { personId, eduEmail: null, permissions };
}

describe('OrgChartVisibilityService', () => {
  let service: OrgChartVisibilityService;
  let queryMock: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartVisibilityService,
        {
          provide: DataSource,
          useValue: { query: queryMock },
        },
      ],
    }).compile();

    service = moduleRef.get(OrgChartVisibilityService);
  });

  it('canViewFullProfile: true para el mismo usuario', async () => {
    await expect(
      service.canViewFullProfile(viewer('10'), '10', VERSION_ID),
    ).resolves.toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('canViewFullProfile: true si el target es descendiente', async () => {
    queryMock.mockResolvedValueOnce([{ person_id: '20' }, { person_id: '30' }]);

    await expect(
      service.canViewFullProfile(viewer('10'), '30', VERSION_ID),
    ).resolves.toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('canViewFullProfile: false si el target no es descendiente', async () => {
    queryMock.mockResolvedValueOnce([{ person_id: '20' }]);

    await expect(
      service.canViewFullProfile(viewer('10'), '99', VERSION_ID),
    ).resolves.toBe(false);
  });

  it('canViewFullProfile: true si viewer tiene ORG_READ_ALL (sin consultar BD)', async () => {
    await expect(
      service.canViewFullProfile(
        viewer('10', ['ORG_READ_ALL']),
        '99',
        VERSION_ID,
      ),
    ).resolves.toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('getVisibleDescendantIds: reutiliza cache en la segunda llamada', async () => {
    queryMock.mockResolvedValue([{ person_id: '20' }]);

    const first = await service.getVisibleDescendantIds(
      viewer('10'),
      VERSION_ID,
    );
    const second = await service.getVisibleDescendantIds(
      viewer('10'),
      VERSION_ID,
    );

    expect(first.has('20')).toBe(true);
    expect(second.has('20')).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
