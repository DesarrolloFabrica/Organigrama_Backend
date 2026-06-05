import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrgChartVisibilityService } from './org-chart-visibility.service';

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
    await expect(service.canViewFullProfile('10', '10')).resolves.toBe(true);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('canViewFullProfile: true si el target es descendiente', async () => {
    queryMock.mockResolvedValueOnce([
      { person_id: '20' },
      { person_id: '30' },
    ]);

    await expect(service.canViewFullProfile('10', '30')).resolves.toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('canViewFullProfile: false si el target no es descendiente', async () => {
    queryMock.mockResolvedValueOnce([{ person_id: '20' }]);

    await expect(service.canViewFullProfile('10', '99')).resolves.toBe(false);
  });

  it('getVisibleDescendantIds: reutiliza cache en la segunda llamada', async () => {
    queryMock.mockResolvedValue([{ person_id: '20' }]);

    const first = await service.getVisibleDescendantIds('10');
    const second = await service.getVisibleDescendantIds('10');

    expect(first.has('20')).toBe(true);
    expect(second.has('20')).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
