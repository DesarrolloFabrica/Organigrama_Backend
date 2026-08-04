/**
 * Parser HTTP Range para video stream (MVP: un solo rango bytes=start-end).
 * No soporta suffix ranges (bytes=-N) ni multi-range.
 */

export type ParsedByteRange =
  | { kind: 'none' }
  | {
      kind: 'range';
      start: number;
      /** Inclusive end; null = hasta EOF (bytes=start-). */
      end: number | null;
      /** Header normalizado a reenviar a Drive. */
      headerValue: string;
    };

export type RangeParseFailure = {
  kind: 'invalid';
  reason:
    | 'MULTI_RANGE'
    | 'BAD_UNIT'
    | 'BAD_SYNTAX'
    | 'NEGATIVE'
    | 'END_BEFORE_START'
    | 'OUT_OF_BOUNDS'
    | 'SUFFIX_UNSUPPORTED';
};

export type RangeParseResult = ParsedByteRange | RangeParseFailure;

/**
 * Parsea el header Range.
 * @param totalSize tamaño conocido (drive_file_size) o null si desconocido
 */
export function parseBytesRangeHeader(
  raw: string | undefined | null,
  totalSize: number | null,
): RangeParseResult {
  if (raw == null || String(raw).trim() === '') {
    return { kind: 'none' };
  }

  const value = String(raw).trim();
  if (!value.toLowerCase().startsWith('bytes=')) {
    return { kind: 'invalid', reason: 'BAD_UNIT' };
  }

  const spec = value.slice('bytes='.length).trim();
  if (!spec) {
    return { kind: 'invalid', reason: 'BAD_SYNTAX' };
  }

  if (spec.includes(',')) {
    return { kind: 'invalid', reason: 'MULTI_RANGE' };
  }

  // Suffix: bytes=-500 — no soportado en MVP
  if (spec.startsWith('-')) {
    return { kind: 'invalid', reason: 'SUFFIX_UNSUPPORTED' };
  }

  const m = /^(\d+)-(\d+)?$/.exec(spec);
  if (!m) {
    return { kind: 'invalid', reason: 'BAD_SYNTAX' };
  }

  const start = Number(m[1]);
  const endRaw = m[2];
  const end = endRaw === undefined ? null : Number(endRaw);

  if (!Number.isSafeInteger(start) || start < 0) {
    return { kind: 'invalid', reason: 'NEGATIVE' };
  }
  if (end != null && (!Number.isSafeInteger(end) || end < 0)) {
    return { kind: 'invalid', reason: 'NEGATIVE' };
  }
  if (end != null && end < start) {
    return { kind: 'invalid', reason: 'END_BEFORE_START' };
  }

  if (totalSize != null && Number.isFinite(totalSize) && totalSize >= 0) {
    if (totalSize === 0) {
      return { kind: 'invalid', reason: 'OUT_OF_BOUNDS' };
    }
    if (start >= totalSize) {
      return { kind: 'invalid', reason: 'OUT_OF_BOUNDS' };
    }
    if (end != null && end >= totalSize) {
      // Clamp end to last byte (RFC permite end past EOF → clip)
      // Preferencia MVP: si end >= size, tratar como hasta EOF-1 si start válido
      const clippedEnd = totalSize - 1;
      if (clippedEnd < start) {
        return { kind: 'invalid', reason: 'OUT_OF_BOUNDS' };
      }
      return {
        kind: 'range',
        start,
        end: clippedEnd,
        headerValue: `bytes=${start}-${clippedEnd}`,
      };
    }
  }

  const headerValue =
    end == null ? `bytes=${start}-` : `bytes=${start}-${end}`;

  return {
    kind: 'range',
    start,
    end,
    headerValue,
  };
}

export function contentRangeForUnsatisfiable(totalSize: number): string {
  return `bytes */${totalSize}`;
}
