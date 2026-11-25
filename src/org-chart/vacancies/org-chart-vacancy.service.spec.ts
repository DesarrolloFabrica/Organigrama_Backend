import { NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { OrgChartVacancyService } from './org-chart-vacancy.service';
import type { Vacancy } from './entities/vacancy.entity';

/** Ubicaciones sintéticas (lo que devolvería la consulta de placements). */
const PLACEMENT_ROWS = [
  {
    person_id: '1144',
    boss_id: null,
    full_name: 'Raíz',
    area_id: '1',
    area_name: 'DIRECCION',
  },
  {
    person_id: '20',
    boss_id: '1144',
    full_name: 'Coord A',
    area_id: '100',
    area_name: 'AREA A',
  },
  {
    person_id: '21',
    boss_id: '20',
    full_name: 'Analista A',
    area_id: '100',
    area_name: 'AREA A',
  },
  {
    person_id: '50',
    boss_id: '1144',
    full_name: 'Sin área',
    area_id: null,
    area_name: null,
  },
];

function vacancy(id: string, areaId: string | null, quantity = 1): Vacancy {
  return {
    id,
    area_id: areaId,
    school_id: null,
    program_id: null,
    position_name: `Cargo ${id}`,
    curricular_line: null,
    quantity,
    operation_status: 'requisition_sent',
    created_at: new Date('2026-11-25T10:00:00Z'),
    updated_at: new Date('2026-11-25T10:00:00Z'),
  };
}

describe('OrgChartVacancyService.getVacanciesForNode', () => {
  let service: OrgChartVacancyService;
  let vacancyRepo: { find: jest.Mock };
  let dataSource: { query: jest.Mock };
  let personActive: boolean;

  beforeEach(() => {
    personActive = true;
    vacancyRepo = {
      find: jest.fn().mockResolvedValue([vacancy('1', '100', 3)]),
    };
    const emptyRepo = { find: jest.fn().mockResolvedValue([]) };
    dataSource = {
      query: jest.fn((sql: string) => {
        if (/FROM core\.person WHERE id = \$1/.test(sql)) {
          return Promise.resolve(personActive ? [{ id: 'x' }] : []);
        }
        return Promise.resolve(PLACEMENT_ROWS);
      }),
    };
    service = new OrgChartVacancyService(
      vacancyRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      emptyRepo as never,
      dataSource as never,
    );
    jest.spyOn(service['log'], 'log').mockImplementation(() => undefined);
  });

  it('raíz → todas las requisiciones visibles, sin filtro de área', async () => {
    const res = await service.getVacanciesForNode('1144', '4');
    expect(res.scope).toEqual({
      kind: 'global',
      personId: '1144',
      areaName: null,
    });
    expect(vacancyRepo.find).toHaveBeenCalledWith({
      where: { operation_status: 'requisition_sent' },
      order: { created_at: 'DESC' },
    });
    expect(res.items).toHaveLength(1);
  });

  it('cabeza de coordinación → filtra por el ID de su área', async () => {
    const res = await service.getVacanciesForNode('20', '4');
    expect(res.scope).toEqual({
      kind: 'coordination',
      personId: '20',
      areaName: 'AREA A',
    });
    expect(vacancyRepo.find).toHaveBeenCalledWith({
      where: { operation_status: 'requisition_sent', area_id: In(['100']) },
      order: { created_at: 'DESC' },
    });
    expect(res.items[0]).toMatchObject({ id: 1, areaId: 100, quantity: 3 });
  });

  it('nodo bajo una coordinación → lista vacía sin consultar vacantes', async () => {
    const res = await service.getVacanciesForNode('21', '4');
    expect(res).toEqual({
      items: [],
      scope: { kind: 'none', personId: '21', areaName: null },
    });
    expect(vacancyRepo.find).not.toHaveBeenCalled();
  });

  it('coordinación cuya cabeza no tiene área → lista vacía, nunca global', async () => {
    const res = await service.getVacanciesForNode('50', '4');
    expect(res.scope.kind).toBe('coordination');
    expect(res.items).toEqual([]);
    expect(vacancyRepo.find).not.toHaveBeenCalled();
  });

  it('persona inexistente o inactiva → 404, sin listar vacantes', async () => {
    personActive = false;
    await expect(
      service.getVacanciesForNode('999', '4'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(vacancyRepo.find).not.toHaveBeenCalled();
  });

  it('las ubicaciones se leen con la versión resuelta como primer parámetro', async () => {
    await service.getVacanciesForNode('20', '7');
    const placementsCall = dataSource.query.mock.calls.find(([sql]: [string]) =>
      /FROM placements e/.test(sql),
    ) as [string, unknown[]] | undefined;
    expect(placementsCall?.[1]).toEqual(['7']);
  });

  it('la lista global sin parámetros conserva su contrato (solo items)', async () => {
    const res = await service.getVacancies();
    expect(Object.keys(res)).toEqual(['items']);
    expect(vacancyRepo.find).toHaveBeenCalledWith({
      where: { operation_status: 'requisition_sent' },
      order: { created_at: 'DESC' },
    });
  });
});
