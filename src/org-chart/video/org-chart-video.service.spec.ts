import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { OrgViewerContext } from '../org-viewer-context';
import {
  OrgChartVideoService,
  sanitizePersonVideoFileName,
} from './org-chart-video.service';
import { PERSON_VIDEO_GENERIC_FILE_NAME } from './org-chart-video.constants';
import { OrgChartVideoTicketService } from './org-chart-video-ticket.service';
import { PersonVideoStreamTicketError } from './org-chart-video-ticket.types';

describe('sanitizePersonVideoFileName', () => {
  it('oculta nombres solo-documento', () => {
    expect(sanitizePersonVideoFileName('1020841798.mp4')).toBe(
      PERSON_VIDEO_GENERIC_FILE_NAME,
    );
  });
});

describe('OrgChartVideoService', () => {
  let service: OrgChartVideoService;
  let dataSource: { query: jest.Mock };
  let ticketService: { issueStreamTicket: jest.Mock };

  const viewerReadAll: OrgViewerContext = {
    personId: '1',
    eduEmail: 'boss@cun.edu.co',
    permissions: ['ORG_READ_ALL'],
  };

  const viewerOtherBranch: OrgViewerContext = {
    personId: '99',
    eduEmail: 'peer@cun.edu.co',
    permissions: [],
  };

  const viewerSelf: OrgViewerContext = {
    personId: '10',
    eduEmail: 'self@cun.edu.co',
    permissions: [],
  };

  const issuedTicket = {
    ticket: 'eyJ.ticket.sig',
    expiresAt: new Date('2026-08-03T21:00:00.000Z'),
    expiresAtUnix: 1_775_000_000,
  };

  beforeEach(async () => {
    dataSource = { query: jest.fn() };
    ticketService = {
      issueStreamTicket: jest.fn().mockReturnValue(issuedTicket),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartVideoService,
        { provide: OrgChartVideoTicketService, useValue: ticketService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartVideoService);
  });

  function mockPerson(opts?: {
    vacancy?: boolean;
    missing?: boolean;
    inactive?: boolean;
  }) {
    if (opts?.missing) {
      dataSource.query.mockResolvedValueOnce([]);
      return;
    }
    dataSource.query.mockResolvedValueOnce([
      {
        is_active: opts?.inactive ? false : true,
        document: opts?.vacancy ? 'VAC-1' : '123',
        full_name: opts?.vacancy ? 'VACANTE - X' : 'Persona',
        role_id: '1',
        role_name: opts?.vacancy ? 'VACANTE' : 'ANALISTA',
      },
    ]);
  }

  function mockActiveVideo() {
    dataSource.query.mockResolvedValueOnce([
      {
        id: '9',
        drive_file_name: 'presentacion-equipo.mp4',
        mime_type: 'video/mp4',
        drive_file_size: 1000,
        synced_at: new Date('2026-08-03T00:00:00.000Z'),
      },
    ]);
  }

  it('contrato: streamUrl + ticket; sin drive_file_id', async () => {
    mockPerson();
    mockActiveVideo();

    const r = await service.getPersonVideo(viewerReadAll, '10', 'v1');
    expect(r).toEqual({
      hasVideo: true,
      fileName: 'presentacion-equipo.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 1000,
      lastSync: '2026-08-03T00:00:00.000Z',
      streamTicket: issuedTicket.ticket,
      streamTicketExpiresAt: '2026-08-03T21:00:00.000Z',
      streamUrl:
        '/api/org-chart/person/10/video/stream?ticket=eyJ.ticket.sig',
    });
    expect(r).not.toHaveProperty('streamReady');
    expect(JSON.stringify(r)).not.toMatch(/drive_file_id|videoId/i);
  });

  it('viewer otra rama (sin ficha completa) + video → hasVideo y ticket', async () => {
    mockPerson();
    mockActiveVideo();

    const r = await service.getPersonVideo(viewerOtherBranch, '10', 'v1');
    expect(r.hasVideo).toBe(true);
    if (r.hasVideo) {
      expect(r.streamTicket).toBe(issuedTicket.ticket);
    }
    expect(ticketService.issueStreamTicket).toHaveBeenCalledWith({
      viewerPersonId: '99',
      targetPersonId: '10',
      personVideoId: '9',
    });
  });

  it('self + video → hasVideo true', async () => {
    mockPerson();
    mockActiveVideo();
    const r = await service.getPersonVideo(viewerSelf, '10', 'v1');
    expect(r.hasVideo).toBe(true);
  });

  it('ORG_READ_ALL + video sigue funcionando', async () => {
    mockPerson();
    mockActiveVideo();
    const r = await service.getPersonVideo(viewerReadAll, '10', 'v1');
    expect(r.hasVideo).toBe(true);
  });

  it('sin video → false sin ticket', async () => {
    mockPerson();
    dataSource.query.mockResolvedValueOnce([]);
    const r = await service.getPersonVideo(viewerOtherBranch, '10', 'v1');
    expect(r).toEqual({ hasVideo: false });
    expect(ticketService.issueStreamTicket).not.toHaveBeenCalled();
  });

  it('vacante → false sin ticket (aunque hubiera video)', async () => {
    mockPerson({ vacancy: true });
    const r = await service.getPersonVideo(viewerOtherBranch, '10', 'v1');
    expect(r).toEqual({ hasVideo: false });
    expect(ticketService.issueStreamTicket).not.toHaveBeenCalled();
    // No consulta person_video tras vacante.
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('persona inexistente → 404', async () => {
    mockPerson({ missing: true });
    await expect(
      service.getPersonVideo(viewerOtherBranch, '404', 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ticketService.issueStreamTicket).not.toHaveBeenCalled();
  });

  it('persona inactiva → 404', async () => {
    mockPerson({ inactive: true });
    await expect(
      service.getPersonVideo(viewerOtherBranch, '10', 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(ticketService.issueStreamTicket).not.toHaveBeenCalled();
  });

  it('config ticket → 503', async () => {
    mockPerson();
    dataSource.query.mockResolvedValueOnce([
      {
        id: '9',
        drive_file_name: 'x.mp4',
        mime_type: 'video/mp4',
        drive_file_size: 1,
        synced_at: null,
      },
    ]);
    ticketService.issueStreamTicket.mockImplementation(() => {
      throw new PersonVideoStreamTicketError('CONFIG_ERROR', 'missing');
    });
    await expect(
      service.getPersonVideo(viewerOtherBranch, '10', 'v1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('no depende de OrgChartVisibilityService (sin provider de visibilidad)', () => {
    // Si el constructor inyectara VisibilityService, beforeEach fallaría al compilar.
    expect(service).toBeDefined();
  });
});
