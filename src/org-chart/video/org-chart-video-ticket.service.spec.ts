import * as jwt from 'jsonwebtoken';
import {
  PERSON_VIDEO_STREAM_PURPOSE,
  PERSON_VIDEO_STREAM_TICKET_ALG,
  PERSON_VIDEO_STREAM_TICKET_ENV_SECRET,
  PERSON_VIDEO_STREAM_TICKET_ENV_TTL,
  PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT,
} from './org-chart-video.constants';
import {
  resolvePersonVideoStreamTicketSecret,
  resolvePersonVideoStreamTicketTtlSeconds,
} from './org-chart-video-ticket.config';
import { OrgChartVideoTicketService } from './org-chart-video-ticket.service';
import { PersonVideoStreamTicketError } from './org-chart-video-ticket.types';

const MOCK_SECRET = 'phase3b-unit-test-secret-min-32-chars!!';
const OTHER_SECRET = 'phase3b-other-secret-also-min-32-chars!';

describe('resolvePersonVideoStreamTicketTtlSeconds', () => {
  const prev = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];

  afterEach(() => {
    if (prev === undefined) delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];
    else process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL] = prev;
  });

  it('default 120', () => {
    delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];
    expect(resolvePersonVideoStreamTicketTtlSeconds()).toBe(
      PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT,
    );
  });

  it('TTL fuera de rango → default', () => {
    expect(resolvePersonVideoStreamTicketTtlSeconds('10')).toBe(
      PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT,
    );
    expect(resolvePersonVideoStreamTicketTtlSeconds('900')).toBe(
      PERSON_VIDEO_STREAM_TICKET_TTL_DEFAULT,
    );
  });

  it('TTL válido en rango', () => {
    expect(resolvePersonVideoStreamTicketTtlSeconds('60')).toBe(60);
  });
});

describe('resolvePersonVideoStreamTicketSecret', () => {
  const prev = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET];

  afterEach(() => {
    if (prev === undefined) {
      delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET];
    } else {
      process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET] = prev;
    }
  });

  it('secreto demasiado corto lanza', () => {
    expect(() => resolvePersonVideoStreamTicketSecret('corto')).toThrow(
      /al menos 32/,
    );
  });

  it('ausente lanza', () => {
    expect(() => resolvePersonVideoStreamTicketSecret('')).toThrow(
      /no está configurado/,
    );
  });
});

describe('OrgChartVideoTicketService', () => {
  let service: OrgChartVideoTicketService;
  const prevSecret = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET];
  const prevTtl = process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];

  beforeEach(() => {
    process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET] = MOCK_SECRET;
    delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];
    service = new OrgChartVideoTicketService();
  });

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET];
    } else {
      process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET] = prevSecret;
    }
    if (prevTtl === undefined) {
      delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL];
    } else {
      process.env[PERSON_VIDEO_STREAM_TICKET_ENV_TTL] = prevTtl;
    }
  });

  const baseInput = {
    viewerPersonId: '10',
    targetPersonId: '20',
    personVideoId: '99',
  };

  it('emite y verifica ticket válido', () => {
    const issued = service.issueStreamTicket(baseInput);
    const payload = service.verifyStreamTicket(issued.ticket);
    expect(payload.viewerPersonId).toBe('10');
    expect(payload.targetPersonId).toBe('20');
    expect(payload.personVideoId).toBe('99');
    expect(payload.purpose).toBe(PERSON_VIDEO_STREAM_PURPOSE);
    expect(payload.version).toBe(1);
    expect(payload.jti).toBeTruthy();
  });

  it('TTL aproximado de 120 s', () => {
    const now = Math.floor(Date.now() / 1000);
    const issued = service.issueStreamTicket({
      ...baseInput,
      nowSeconds: now,
    });
    expect(issued.expiresAtUnix - now).toBe(120);
    const decoded = jwt.decode(issued.ticket) as jwt.JwtPayload;
    expect(decoded.exp! - decoded.iat!).toBe(120);
  });

  it('ticket alterado → INVALID_SIGNATURE', () => {
    const issued = service.issueStreamTicket(baseInput);
    const tampered = issued.ticket.slice(0, -4) + 'xxxx';
    expect(() => service.verifyStreamTicket(tampered)).toThrow(
      PersonVideoStreamTicketError,
    );
    try {
      service.verifyStreamTicket(tampered);
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('INVALID_SIGNATURE');
    }
  });

  it('secreto incorrecto → INVALID_SIGNATURE', () => {
    const issued = service.issueStreamTicket(baseInput);
    process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET] = OTHER_SECRET;
    expect(() => service.verifyStreamTicket(issued.ticket)).toThrow(
      /INVALID_SIGNATURE/,
    );
  });

  it('ticket expirado → EXPIRED_TICKET', () => {
    const now = 1_700_000_000;
    const issued = service.issueStreamTicket({
      ...baseInput,
      ttlSeconds: 5,
      nowSeconds: now,
    });
    // Verificar con reloj futuro: firmar con iat/exp pasados y verify normal
    const expired = jwt.sign(
      {
        sub: '10',
        targetPersonId: '20',
        personVideoId: '99',
        purpose: PERSON_VIDEO_STREAM_PURPOSE,
        v: 1,
        jti: 'x',
        iat: now - 100,
        exp: now - 10,
      },
      MOCK_SECRET,
      { algorithm: PERSON_VIDEO_STREAM_TICKET_ALG, noTimestamp: true },
    );
    try {
      service.verifyStreamTicket(expired);
      fail('expected expire');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('EXPIRED_TICKET');
    }
    expect(issued.expiresAtUnix).toBe(now + 5);
  });

  it('purpose incorrecto → INVALID_PURPOSE', () => {
    const bad = jwt.sign(
      {
        sub: '10',
        targetPersonId: '20',
        personVideoId: '99',
        purpose: 'other-purpose',
        v: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      MOCK_SECRET,
      { algorithm: PERSON_VIDEO_STREAM_TICKET_ALG, noTimestamp: true },
    );
    try {
      service.verifyStreamTicket(bad);
      fail('expected purpose');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('INVALID_PURPOSE');
    }
  });

  it('versión incorrecta → INVALID_VERSION', () => {
    const bad = jwt.sign(
      {
        sub: '10',
        targetPersonId: '20',
        personVideoId: '99',
        purpose: PERSON_VIDEO_STREAM_PURPOSE,
        v: 99,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      MOCK_SECRET,
      { algorithm: PERSON_VIDEO_STREAM_TICKET_ALG, noTimestamp: true },
    );
    try {
      service.verifyStreamTicket(bad);
      fail('expected version');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('INVALID_VERSION');
    }
  });

  it('claims incompletos → INVALID_CLAIMS', () => {
    const bad = jwt.sign(
      {
        sub: '10',
        purpose: PERSON_VIDEO_STREAM_PURPOSE,
        v: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      MOCK_SECRET,
      { algorithm: PERSON_VIDEO_STREAM_TICKET_ALG, noTimestamp: true },
    );
    try {
      service.verifyStreamTicket(bad);
      fail('expected claims');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('INVALID_CLAIMS');
    }
  });

  it('MISSING_TICKET', () => {
    try {
      service.verifyStreamTicket('');
      fail('expected missing');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('MISSING_TICKET');
    }
  });

  it('no emite sin secreto', () => {
    delete process.env[PERSON_VIDEO_STREAM_TICKET_ENV_SECRET];
    try {
      service.issueStreamTicket(baseInput);
      fail('expected config');
    } catch (e) {
      expect((e as PersonVideoStreamTicketError).code).toBe('CONFIG_ERROR');
    }
  });

  it('rechaza alg none', () => {
    const header = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(
      JSON.stringify({
        sub: '10',
        targetPersonId: '20',
        personVideoId: '99',
        purpose: PERSON_VIDEO_STREAM_PURPOSE,
        v: 1,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 60,
      }),
    ).toString('base64url');
    const noneToken = `${header}.${body}.`;
    expect(() => service.verifyStreamTicket(noneToken)).toThrow(
      PersonVideoStreamTicketError,
    );
  });
});
