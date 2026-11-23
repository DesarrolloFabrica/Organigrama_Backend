/**
 * Emisión y verificación de tickets temporales de stream (Fase 3B).
 *
 * JWT HS256 con propósito `person-video-stream`, secreto dedicado.
 * No consulta BD. No loguea el ticket. No acepta alg `none`.
 */
import { Injectable, Logger } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import {
  PERSON_VIDEO_STREAM_PURPOSE,
  PERSON_VIDEO_STREAM_TICKET_ALG,
  PERSON_VIDEO_STREAM_TICKET_VERSION,
} from './org-chart-video.constants';
import {
  loadPersonVideoStreamTicketConfig,
  resolvePersonVideoStreamTicketSecret,
  resolvePersonVideoStreamTicketTtlSeconds,
} from './org-chart-video-ticket.config';
import {
  IssuedPersonVideoStreamTicket,
  IssuePersonVideoStreamTicketInput,
  PersonVideoStreamTicketError,
  PersonVideoStreamTicketJwtClaims,
  PersonVideoStreamTicketPayload,
} from './org-chart-video-ticket.types';

@Injectable()
export class OrgChartVideoTicketService {
  private readonly logger = new Logger(OrgChartVideoTicketService.name);

  /**
   * Emite un ticket firmado vinculado a viewer + target + personVideoId.
   * @throws PersonVideoStreamTicketError CONFIG_ERROR si falta secreto
   * @throws PersonVideoStreamTicketError INVALID_CLAIMS si faltan ids
   */
  issueStreamTicket(
    input: IssuePersonVideoStreamTicketInput,
  ): IssuedPersonVideoStreamTicket {
    const viewerPersonId = requireNonEmptyId(input.viewerPersonId, 'viewerPersonId');
    const targetPersonId = requireNonEmptyId(input.targetPersonId, 'targetPersonId');
    const personVideoId = requireNonEmptyId(input.personVideoId, 'personVideoId');

    let secret: string;
    let ttlSeconds: number;
    try {
      secret = resolvePersonVideoStreamTicketSecret();
      ttlSeconds =
        input.ttlSeconds ?? resolvePersonVideoStreamTicketTtlSeconds();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ticket config error';
      this.logger.error(`[OrgChartVideoTicket] emit blocked: ${msg}`);
      throw new PersonVideoStreamTicketError('CONFIG_ERROR', msg);
    }

    if (
      input.ttlSeconds != null &&
      (input.ttlSeconds < 1 || !Number.isFinite(input.ttlSeconds))
    ) {
      throw new PersonVideoStreamTicketError(
        'INVALID_CLAIMS',
        'ttlSeconds inválido',
      );
    }

    const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    const expiresAtUnix = nowSeconds + ttlSeconds;
    const jti = randomUUID();

    const claims: Omit<PersonVideoStreamTicketJwtClaims, 'iat' | 'exp'> & {
      iat?: number;
      exp?: number;
    } = {
      sub: viewerPersonId,
      targetPersonId,
      personVideoId,
      purpose: PERSON_VIDEO_STREAM_PURPOSE,
      v: PERSON_VIDEO_STREAM_TICKET_VERSION,
      jti,
    };

    // Reloj fijo (tests): iat/exp absolutos. Producción: expiresIn relativo.
    const ticket =
      input.nowSeconds != null
        ? jwt.sign(
            { ...claims, iat: nowSeconds, exp: expiresAtUnix },
            secret,
            { algorithm: PERSON_VIDEO_STREAM_TICKET_ALG },
          )
        : jwt.sign(claims, secret, {
            algorithm: PERSON_VIDEO_STREAM_TICKET_ALG,
            expiresIn: ttlSeconds,
          });

    this.logger.debug(
      `[OrgChartVideoTicket] issued jtiHash=${hashShort(jti)} ` +
        `viewer=${viewerPersonId} target=${targetPersonId} video=${personVideoId} ttl=${ttlSeconds}s`,
    );

    return {
      ticket,
      expiresAt: new Date(expiresAtUnix * 1000),
      expiresAtUnix,
    };
  }

  /**
   * Verifica firma, expiración, purpose, versión y claims requeridos.
   * No consulta BD (la revalidación de video activo es Fase 3C).
   */
  verifyStreamTicket(ticket: string): PersonVideoStreamTicketPayload {
    if (ticket == null || String(ticket).trim() === '') {
      throw new PersonVideoStreamTicketError('MISSING_TICKET');
    }

    let secret: string;
    try {
      secret = resolvePersonVideoStreamTicketSecret();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'ticket config error';
      throw new PersonVideoStreamTicketError('CONFIG_ERROR', msg);
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.verify(String(ticket).trim(), secret, {
        algorithms: [PERSON_VIDEO_STREAM_TICKET_ALG],
        clockTolerance: 0,
      }) as jwt.JwtPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new PersonVideoStreamTicketError('EXPIRED_TICKET');
      }
      if (err instanceof jwt.JsonWebTokenError) {
        throw new PersonVideoStreamTicketError('INVALID_SIGNATURE');
      }
      throw new PersonVideoStreamTicketError('INVALID_SIGNATURE');
    }

    return mapVerifiedClaims(decoded);
  }
}

/** Helpers exportados para tests de config sin Nest. */
export {
  loadPersonVideoStreamTicketConfig,
  resolvePersonVideoStreamTicketSecret,
  resolvePersonVideoStreamTicketTtlSeconds,
};

function requireNonEmptyId(value: string, field: string): string {
  const v = value?.trim() ?? '';
  if (!v) {
    throw new PersonVideoStreamTicketError(
      'INVALID_CLAIMS',
      `${field} es obligatorio`,
    );
  }
  return v;
}

function mapVerifiedClaims(
  decoded: jwt.JwtPayload,
): PersonVideoStreamTicketPayload {
  const sub = typeof decoded.sub === 'string' ? decoded.sub.trim() : '';
  const targetPersonId =
    typeof decoded.targetPersonId === 'string'
      ? decoded.targetPersonId.trim()
      : '';
  const personVideoId =
    typeof decoded.personVideoId === 'string'
      ? decoded.personVideoId.trim()
      : '';
  const purpose = decoded.purpose;
  const version = decoded.v;
  const iat = decoded.iat;
  const exp = decoded.exp;

  if (!sub || !targetPersonId || !personVideoId) {
    throw new PersonVideoStreamTicketError('INVALID_CLAIMS');
  }
  if (purpose !== PERSON_VIDEO_STREAM_PURPOSE) {
    throw new PersonVideoStreamTicketError('INVALID_PURPOSE');
  }
  if (version !== PERSON_VIDEO_STREAM_TICKET_VERSION) {
    throw new PersonVideoStreamTicketError('INVALID_VERSION');
  }
  if (
    typeof iat !== 'number' ||
    typeof exp !== 'number' ||
    !Number.isFinite(iat) ||
    !Number.isFinite(exp)
  ) {
    throw new PersonVideoStreamTicketError('INVALID_CLAIMS');
  }

  const jti =
    typeof decoded.jti === 'string' && decoded.jti.trim()
      ? decoded.jti.trim()
      : undefined;

  return {
    viewerPersonId: sub,
    targetPersonId,
    personVideoId,
    purpose: PERSON_VIDEO_STREAM_PURPOSE,
    issuedAt: iat,
    expiresAt: exp,
    version: PERSON_VIDEO_STREAM_TICKET_VERSION,
    jti,
  };
}

function hashShort(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}
