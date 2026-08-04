import {
  contentRangeForUnsatisfiable,
  parseBytesRangeHeader,
} from './org-chart-video-range';

describe('parseBytesRangeHeader', () => {
  it('sin Range → none', () => {
    expect(parseBytesRangeHeader(undefined, 1000)).toEqual({ kind: 'none' });
    expect(parseBytesRangeHeader('', 1000)).toEqual({ kind: 'none' });
  });

  it('bytes=0-1023 cerrado', () => {
    expect(parseBytesRangeHeader('bytes=0-1023', 5000)).toEqual({
      kind: 'range',
      start: 0,
      end: 1023,
      headerValue: 'bytes=0-1023',
    });
  });

  it('bytes=0- abierto', () => {
    expect(parseBytesRangeHeader('bytes=0-', 5000)).toEqual({
      kind: 'range',
      start: 0,
      end: null,
      headerValue: 'bytes=0-',
    });
  });

  it('bytes=1024- abierto', () => {
    expect(parseBytesRangeHeader('bytes=1024-', 5000)).toEqual({
      kind: 'range',
      start: 1024,
      end: null,
      headerValue: 'bytes=1024-',
    });
  });

  it('multi-range rechazado', () => {
    expect(parseBytesRangeHeader('bytes=0-1,2-3', 100)).toEqual({
      kind: 'invalid',
      reason: 'MULTI_RANGE',
    });
  });

  it('suffix rechazado', () => {
    expect(parseBytesRangeHeader('bytes=-500', 1000)).toEqual({
      kind: 'invalid',
      reason: 'SUFFIX_UNSUPPORTED',
    });
  });

  it('unidad inválida', () => {
    expect(parseBytesRangeHeader('items=0-1', 10)).toEqual({
      kind: 'invalid',
      reason: 'BAD_UNIT',
    });
  });

  it('end < start', () => {
    expect(parseBytesRangeHeader('bytes=10-5', 100)).toEqual({
      kind: 'invalid',
      reason: 'END_BEFORE_START',
    });
  });

  it('fuera de tamaño', () => {
    expect(parseBytesRangeHeader('bytes=1000-', 100)).toEqual({
      kind: 'invalid',
      reason: 'OUT_OF_BOUNDS',
    });
  });

  it('end past EOF se recorta', () => {
    expect(parseBytesRangeHeader('bytes=0-9999', 100)).toEqual({
      kind: 'range',
      start: 0,
      end: 99,
      headerValue: 'bytes=0-99',
    });
  });

  it('tamaño null permite parseo sin OUT_OF_BOUNDS local', () => {
    expect(parseBytesRangeHeader('bytes=0-1023', null)).toEqual({
      kind: 'range',
      start: 0,
      end: 1023,
      headerValue: 'bytes=0-1023',
    });
  });

  it('contentRangeForUnsatisfiable', () => {
    expect(contentRangeForUnsatisfiable(2048)).toBe('bytes */2048');
  });
});
