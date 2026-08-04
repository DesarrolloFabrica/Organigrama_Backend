import { Readable, Writable } from 'node:stream';
import type { Request, Response } from 'express';
import {
  OrgChartVideoStreamService,
  buildPersonVideoStreamUrl,
} from './org-chart-video-stream.service';
import { OrgChartVideoTicketService } from './org-chart-video-ticket.service';
import { OrgChartVideoDriveStreamClient } from './org-chart-video-drive-stream.client';
import { PersonVideoStreamHttpError } from './org-chart-video-stream.types';
import { PersonVideoStreamTicketError } from './org-chart-video-ticket.types';
import { PERSON_VIDEO_STREAM_PURPOSE } from './org-chart-video.constants';

function mockRes() {
  const headers: Record<string, string> = {};
  const chunks: Buffer[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    },
  });
  const res = dest as unknown as Response & {
    statusCode: number;
    headersSent: boolean;
    status: jest.Mock;
    setHeader: jest.Mock;
  };
  res.headersSent = false;
  res.statusCode = 200;
  res.setHeader = jest.fn((k: string, v: string) => {
    headers[k.toLowerCase()] = String(v);
  });
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    res.headersSent = true;
    return res;
  });
  return { res, headers, chunks };
}

function mockReq(): Request {
  return {
    on: jest.fn(),
    off: jest.fn(),
    headers: {},
  } as unknown as Request;
}

describe('buildPersonVideoStreamUrl', () => {
  it('construye URL relativa con ticket encodeado', () => {
    const url = buildPersonVideoStreamUrl('10', 'a+b/c');
    expect(url).toBe(
      '/api/org-chart/person/10/video/stream?ticket=a%2Bb%2Fc',
    );
    expect(url).not.toMatch(/drive_file_id|access_token/i);
  });
});

describe('OrgChartVideoStreamService', () => {
  let service: OrgChartVideoStreamService;
  let ticketService: { verifyStreamTicket: jest.Mock };
  let driveStream: { openMediaStream: jest.Mock };
  let dataSource: { query: jest.Mock };

  const payload = {
    viewerPersonId: '1',
    targetPersonId: '10',
    personVideoId: '99',
    purpose: PERSON_VIDEO_STREAM_PURPOSE,
    issuedAt: 1,
    expiresAt: 9999999999,
    version: 1 as const,
  };

  beforeEach(() => {
    ticketService = {
      verifyStreamTicket: jest.fn().mockReturnValue(payload),
    };
    driveStream = { openMediaStream: jest.fn() };
    dataSource = { query: jest.fn() };
    service = new OrgChartVideoStreamService(
      dataSource as never,
      ticketService as unknown as OrgChartVideoTicketService,
      driveStream as unknown as OrgChartVideoDriveStreamClient,
    );
  });

  function mockVideoRow(overrides?: Partial<Record<string, unknown>>) {
    dataSource.query.mockResolvedValueOnce([
      {
        id: '99',
        person_id: '10',
        is_active: true,
        drive_file_id: 'file-abc',
        mime_type: 'video/mp4',
        drive_file_size: 5000,
        ...overrides,
      },
    ]);
  }

  function mockPerson(overrides?: Partial<Record<string, unknown>>) {
    dataSource.query.mockResolvedValueOnce([
      {
        is_active: true,
        document: '123',
        full_name: 'Persona',
        role_id: '1',
        role_name: 'ANALISTA',
        ...overrides,
      },
    ]);
  }

  it('ticket ausente → STREAM_TICKET_INVALID', async () => {
    ticketService.verifyStreamTicket.mockImplementation(() => {
      throw new PersonVideoStreamTicketError('MISSING_TICKET');
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: undefined,
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({
      httpStatus: 401,
      code: 'STREAM_TICKET_INVALID',
    });
  });

  it('ticket expirado → STREAM_TICKET_EXPIRED', async () => {
    ticketService.verifyStreamTicket.mockImplementation(() => {
      throw new PersonVideoStreamTicketError('EXPIRED_TICKET');
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({
      httpStatus: 401,
      code: 'STREAM_TICKET_EXPIRED',
    });
  });

  it('target mismatch → 404', async () => {
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '999',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({
      httpStatus: 404,
      code: 'STREAM_TARGET_MISMATCH',
    });
  });

  it('video inactivo → 404', async () => {
    mockVideoRow({ is_active: false });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ code: 'STREAM_VIDEO_NOT_FOUND' });
  });

  it('video de otra persona → 404', async () => {
    mockVideoRow({ person_id: '55' });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ code: 'STREAM_VIDEO_NOT_FOUND' });
  });

  it('vacante → 404', async () => {
    mockVideoRow();
    mockPerson({
      document: 'VAC-1',
      full_name: 'VACANTE - X',
      role_name: 'VACANTE',
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ code: 'STREAM_VIDEO_NOT_FOUND' });
  });

  it('MIME incompatible → 404', async () => {
    mockVideoRow({ mime_type: 'application/pdf' });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ code: 'STREAM_VIDEO_NOT_FOUND' });
  });

  it('multi-range → 416', async () => {
    mockVideoRow();
    mockPerson();
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: 'bytes=0-1,2-3',
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({
      httpStatus: 416,
      code: 'STREAM_RANGE_INVALID',
    });
  });

  it('sin Range → 200 + headers + pipeline', async () => {
    mockVideoRow();
    mockPerson();
    const body = Readable.from([Buffer.from('abcdefghij')]);
    driveStream.openMediaStream.mockResolvedValue({
      ok: true,
      status: 200,
      body,
      contentType: 'video/mp4',
      contentLength: 10,
      contentRange: null,
      acceptRanges: 'bytes',
    });
    const { res, headers, chunks } = mockRes();

    await service.streamToResponse({
      personId: '10',
      ticket: 'x',
      rangeHeader: undefined,
      req: mockReq(),
      res,
    });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(headers['content-type']).toBe('video/mp4');
    expect(headers['accept-ranges']).toBe('bytes');
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-length']).toBe('10');
    expect(Buffer.concat(chunks).toString()).toBe('abcdefghij');
    expect(JSON.stringify(headers)).not.toMatch(/drive_file_id|file-abc/i);
  });

  it('Range cerrado → 206', async () => {
    mockVideoRow();
    mockPerson();
    const body = Readable.from([Buffer.from('0123')]);
    driveStream.openMediaStream.mockResolvedValue({
      ok: true,
      status: 206,
      body,
      contentType: 'video/mp4',
      contentLength: 4,
      contentRange: 'bytes 0-1023/5000',
      acceptRanges: 'bytes',
    });
    const { res, headers } = mockRes();
    await service.streamToResponse({
      personId: '10',
      ticket: 'x',
      rangeHeader: 'bytes=0-1023',
      req: mockReq(),
      res,
    });
    expect(res.status).toHaveBeenCalledWith(206);
    expect(headers['content-range']).toBe('bytes 0-1023/5000');
    expect(driveStream.openMediaStream).toHaveBeenCalledWith(
      expect.objectContaining({ rangeHeader: 'bytes=0-1023' }),
    );
  });

  it('Range abierto → 206', async () => {
    mockVideoRow();
    mockPerson();
    driveStream.openMediaStream.mockResolvedValue({
      ok: true,
      status: 206,
      body: Readable.from([Buffer.from('x')]),
      contentType: 'video/mp4',
      contentLength: 1,
      contentRange: 'bytes 1024-4999/5000',
      acceptRanges: 'bytes',
    });
    const { res } = mockRes();
    await service.streamToResponse({
      personId: '10',
      ticket: 'x',
      rangeHeader: 'bytes=1024-',
      req: mockReq(),
      res,
    });
    expect(res.status).toHaveBeenCalledWith(206);
    expect(driveStream.openMediaStream).toHaveBeenCalledWith(
      expect.objectContaining({ rangeHeader: 'bytes=1024-' }),
    );
  });

  it('Range fuera de tamaño → 416', async () => {
    mockVideoRow();
    mockPerson();
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: 'bytes=9000-',
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ httpStatus: 416 });
  });

  it('Drive 404 → STREAM_DRIVE_NOT_FOUND', async () => {
    mockVideoRow();
    mockPerson();
    driveStream.openMediaStream.mockResolvedValue({
      ok: false,
      code: 'DRIVE_NOT_FOUND',
      upstreamStatus: 404,
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({
      httpStatus: 404,
      code: 'STREAM_DRIVE_NOT_FOUND',
    });
  });

  it('Drive 403 → 502', async () => {
    mockVideoRow();
    mockPerson();
    driveStream.openMediaStream.mockResolvedValue({
      ok: false,
      code: 'DRIVE_FORBIDDEN',
      upstreamStatus: 403,
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toBeInstanceOf(PersonVideoStreamHttpError);
  });

  it('timeout Drive → 503', async () => {
    mockVideoRow();
    mockPerson();
    driveStream.openMediaStream.mockResolvedValue({
      ok: false,
      code: 'DRIVE_TIMEOUT',
    });
    const { res } = mockRes();
    await expect(
      service.streamToResponse({
        personId: '10',
        ticket: 'x',
        rangeHeader: undefined,
        req: mockReq(),
        res,
      }),
    ).rejects.toMatchObject({ httpStatus: 503, code: 'STREAM_DRIVE_TIMEOUT' });
  });
});
