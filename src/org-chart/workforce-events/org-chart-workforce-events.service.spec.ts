import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartVisibilityService } from '../org-chart-visibility.service';
import type { OrgNode } from '../types/org-node.type';
import type { OrgViewerContext } from '../org-viewer-context';
import {
  isMissingWorkforceEventsSchema,
  OrgChartWorkforceEventsService,
} from './org-chart-workforce-events.service';

function sampleNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: '10',
    document: '123',
    name: 'Ana',
    nodeKind: 'person',
    role_id: null,
    role: null,
    relation_id: null,
    parent_person_id: null,
    assignment_status: null,
    assignment_label: null,
    hierarchy_id: null,
    hierarchy: null,
    area_id: null,
    area: null,
    school_id: null,
    school: null,
    program_id: null,
    program: null,
    email: null,
    edu_email: null,
    phone: null,
    direct_reports_count: 0,
    children: [],
    city: null,
    campus: null,
    contract_type: null,
    region_id: null,
    location: null,
    photoUrl: null,
    current_workforce_event: null,
    current_workforce_event_count: 0,
    ...overrides,
  };
}

describe('OrgChartWorkforceEventsService', () => {
  let service: OrgChartWorkforceEventsService;
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
        OrgChartWorkforceEventsService,
        { provide: OrgChartVisibilityService, useValue: visibility },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartWorkforceEventsService);
  });

  it('sin permiso → items vacíos y no consulta BD', async () => {
    visibility.canViewFullProfile.mockResolvedValue(false);
    const result = await service.listByPersonId(viewer, '10', 'v1');
    expect(result.items).toEqual([]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('mapea filas del historial con isCurrent', async () => {
    dataSource.query.mockResolvedValue([
      {
        id: 'evt-1',
        person_id: '10',
        event_type_id: '6',
        event_type_name: 'INCAPACIDAD',
        observation: 'Gripe',
        status: 'TAKEN',
        start_date: '2026-08-18',
        end_date: '2099-08-22',
        start_time: '08:00:00',
        end_time: '17:00',
        created_at: new Date('2026-08-14T12:00:00.000Z'),
        updated_at: new Date('2026-08-14T12:00:00.000Z'),
        created_by_person_id: '12',
        created_by_person_name: 'Ana Pérez',
      },
    ]);

    const result = await service.listByPersonId(viewer, '10', 'v1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'evt-1',
      eventTypeName: 'INCAPACIDAD',
      startTime: '08:00',
      endTime: '17:00',
      isCurrent: true,
      createdByPerson: { id: '12', name: 'Ana Pérez' },
    });
  });

  it('schema ausente → lista vacía (no lanza)', async () => {
    const missing = Object.assign(new Error('relation "workforce_events.event" does not exist'), {
      code: '42P01',
    });
    dataSource.query.mockRejectedValue(missing);
    const result = await service.listByPersonId(viewer, '10', 'v1');
    expect(result.items).toEqual([]);

    dataSource.query.mockClear();
    const second = await service.listByPersonId(viewer, '10', 'v1');
    expect(second.items).toEqual([]);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('adjunta novedad vigente al árbol sin mutar el original', async () => {
    dataSource.query.mockResolvedValue([
      {
        id: 'evt-2',
        person_id: '10',
        event_type_name: 'LICENCIA',
        status: 'APPROVED',
        start_date: '2026-08-01',
        end_date: '2099-12-31',
        created_at: new Date('2026-08-01T00:00:00.000Z'),
      },
    ]);

    const original = sampleNode({
      children: [sampleNode({ id: '11', name: 'Luis' })],
    });
    const attached = await service.attachCurrentToTree(original);

    expect(original.current_workforce_event).toBeNull();
    expect(attached.current_workforce_event).toEqual({
      id: 'evt-2',
      eventTypeName: 'LICENCIA',
      status: 'APPROVED',
      startDate: '2026-08-01',
      endDate: '2099-12-31',
    });
    expect(attached.current_workforce_event_count).toBe(1);
    expect(attached.children[0]?.current_workforce_event).toBeNull();
  });
});

describe('isMissingWorkforceEventsSchema', () => {
  it('detecta 42P01 y mensaje de relación', () => {
    expect(
      isMissingWorkforceEventsSchema(Object.assign(new Error('x'), { code: '42P01' })),
    ).toBe(true);
    expect(
      isMissingWorkforceEventsSchema(
        new Error('relation "workforce_events.event" does not exist'),
      ),
    ).toBe(true);
    expect(isMissingWorkforceEventsSchema(new Error('syntax error'))).toBe(
      false,
    );
  });
});
