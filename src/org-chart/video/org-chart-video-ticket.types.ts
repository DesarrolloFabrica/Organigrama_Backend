/**
 * Tipos del ticket temporal de stream (Fase 3B).
 */

export type PersonVideoStreamPurpose = 'person-video-stream';

export type PersonVideoStreamTicketVersion = 1;

/** Payload tipado tras verificación exitosa. */
export type PersonVideoStreamTicketPayload = {
  viewerPersonId: string;
  targetPersonId: string;
  personVideoId: string;
  purpose: PersonVideoStreamPurpose;
  issuedAt: number;
  expiresAt: number;
  version: PersonVideoStreamTicketVersion;
  jti?: string;
};

export type IssuePersonVideoStreamTicketInput = {
  viewerPersonId: string;
  targetPersonId: string;
  personVideoId: string;
  /** Override de TTL solo para tests. */
  ttlSeconds?: number;
  /** Override de reloj solo para tests (epoch segundos). */
  nowSeconds?: number;
};

export type IssuedPersonVideoStreamTicket = {
  ticket: string;
  expiresAt: Date;
  expiresAtUnix: number;
};

export type PersonVideoStreamTicketErrorCode =
  | 'MISSING_TICKET'
  | 'INVALID_SIGNATURE'
  | 'EXPIRED_TICKET'
  | 'INVALID_PURPOSE'
  | 'INVALID_VERSION'
  | 'INVALID_CLAIMS'
  | 'CONFIG_ERROR';

export class PersonVideoStreamTicketError extends Error {
  readonly code: PersonVideoStreamTicketErrorCode;

  constructor(code: PersonVideoStreamTicketErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PersonVideoStreamTicketError';
    this.code = code;
  }
}

/** Claims JWT internos (no se exponen crudos al cliente). */
export type PersonVideoStreamTicketJwtClaims = {
  sub: string;
  targetPersonId: string;
  personVideoId: string;
  purpose: PersonVideoStreamPurpose;
  v: PersonVideoStreamTicketVersion;
  jti?: string;
  iat: number;
  exp: number;
};
