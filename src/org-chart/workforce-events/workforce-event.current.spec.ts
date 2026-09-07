import {
  isWorkforceEventCurrent,
  toDateOnly,
  todayDateOnly,
} from './workforce-event.current';

describe('toDateOnly', () => {
  it('conserva YYYY-MM-DD en strings', () => {
    expect(toDateOnly('2026-08-18')).toBe('2026-08-18');
    expect(toDateOnly('2026-08-18T12:00:00.000Z')).toBe('2026-08-18');
  });

  it('usa UTC para Date (columnas DATE a medianoche UTC)', () => {
    expect(toDateOnly(new Date('2026-08-18T00:00:00.000Z'))).toBe('2026-08-18');
  });

  it('devuelve null si no hay valor útil', () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly('')).toBeNull();
    expect(toDateOnly('no-date')).toBeNull();
  });
});

describe('isWorkforceEventCurrent', () => {
  const today = '2026-08-19';

  it('rechaza REJECTED y CANCELLED aunque las fechas cubran hoy', () => {
    expect(
      isWorkforceEventCurrent(
        { status: 'REJECTED', startDate: '2026-08-18', endDate: '2026-08-20' },
        today,
      ),
    ).toBe(false);
    expect(
      isWorkforceEventCurrent(
        { status: 'CANCELLED', startDate: null, endDate: null },
        today,
      ),
    ).toBe(false);
  });

  it('trata novedades sin fechas como vigentes', () => {
    expect(
      isWorkforceEventCurrent(
        { status: 'PENDING', startDate: null, endDate: null },
        today,
      ),
    ).toBe(true);
  });

  it('incluye el rango inclusive (hoy = inicio o fin)', () => {
    expect(
      isWorkforceEventCurrent(
        { status: 'TAKEN', startDate: '2026-08-19', endDate: '2026-08-22' },
        today,
      ),
    ).toBe(true);
    expect(
      isWorkforceEventCurrent(
        { status: 'APPROVED', startDate: '2026-08-10', endDate: '2026-08-19' },
        today,
      ),
    ).toBe(true);
  });

  it('excluye futuro y pasado', () => {
    expect(
      isWorkforceEventCurrent(
        { status: 'APPROVED', startDate: '2026-08-20', endDate: '2026-08-22' },
        today,
      ),
    ).toBe(false);
    expect(
      isWorkforceEventCurrent(
        { status: 'TAKEN', startDate: '2026-08-01', endDate: '2026-08-18' },
        today,
      ),
    ).toBe(false);
  });

  it('extremos nulos quedan abiertos', () => {
    expect(
      isWorkforceEventCurrent(
        { status: 'NOT_TAKEN', startDate: null, endDate: '2026-08-30' },
        today,
      ),
    ).toBe(true);
    expect(
      isWorkforceEventCurrent(
        { status: 'PENDING', startDate: '2026-08-01', endDate: null },
        today,
      ),
    ).toBe(true);
  });
});

describe('todayDateOnly', () => {
  it('formatea la fecha local YYYY-MM-DD', () => {
    expect(todayDateOnly(new Date(2026, 7, 19, 23, 15))).toBe('2026-08-19');
  });
});
