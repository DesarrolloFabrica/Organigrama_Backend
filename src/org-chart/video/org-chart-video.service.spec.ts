import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartVisibilityService } from '../org-chart-visibility.service';
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
  let visibility: { canViewFullProfile: jest.Mock };
  let dataSource: { query: jest.Mock };
  let ticketService: { issueStreamTicket: jest.Mock };

  const viewer: OrgViewerContext = {
    personId: '1',
    eduEmail: 'boss@cun.edu.co',
    permissions: ['ORG_READ_ALL'],
  };

  const issuedTicket = {
    ticket: 'eyJ.ticket.sig',
    expiresAt: new Date('2026-08-03T21:00:00.000Z'),
    expiresAtUnix: 1_775_000_000,
  };

  beforeEach(async () => {
    visibility = { canViewFullProfile: jest.fn().mockResolvedValue(true) };
    dataSource = { query: jest.fn() };
    ticketService = {
      issueStreamTicket: jest.fn().mockReturnValue(issuedTicket),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartVideoService,
        { provide: OrgChartVisibilityService, useValue: visibility },
        { provide: OrgChartVideoTicketService, useValue: ticketService },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartVideoService);
  });

  function mockPerson(opts?: { vacancy?: boolean; missing?: boolean }) {
    if (opts?.missing) {
      dataSource.query.mockResolvedValueOnce([]);
      return;
    }
    dataSource.query.mockResolvedValueOnce([
      {
        document: opts?.vacancy ? 'VAC-1' : '123',
        full_name: opts?.vacancy ? 'VACANTE - X' : 'Persona',
        role_id: '1',
        role_name: opts?.vacancy ? 'VACANTE' : 'ANALISTA',
      },
    ]);
  }

  it('contrato 3C: streamUrl sin streamReady/ticketReady', async () => {
    mockPerson();
    dataSource.query.mockResolvedValueOnce([
      {
        id: '9',
        drive_file_name: 'presentacion-equipo.mp4',
        mime_type: 'video/mp4',
        drive_file_size: 1000,
        synced_at: new Date('2026-08-03T00:00:00.000Z'),
      },
    ]);

    const r = await service.getPersonVideo(viewer, '10', 'v1');
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
    expect(r).not.toHaveProperty('ticketReady');
    expect(JSON.stringify(r)).not.toMatch(/drive_file_id|videoId/i);
  });

  it('no emite ticket sin permiso', async () => {
    visibility.canViewFullProfile.mockResolvedValue(false);
    const r = await service.getPersonVideo(viewer, '10', 'v1');
    expect(r).toEqual({ hasVideo: false });
    expect(ticketService.issueStreamTicket).not.toHaveBeenCalled();
  });

  it('vacante sin ticket', async () => {
    mockPerson({ vacancy: true });
    const r = await service.getPersonVideo(viewer, '10', 'v1');
    expect(r).toEqual({ hasVideo: false });
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
    await expect(service.getPersonVideo(viewer, '10', 'v1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('persona inexistente → 404', async () => {
    mockPerson({ missing: true });
    await expect(
      service.getPersonVideo(viewer, '404', 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
