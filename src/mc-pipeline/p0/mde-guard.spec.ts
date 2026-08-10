import { assertMdeTarget, isMdeTarget } from './mde-guard';
import { P0SnapshotError } from './p0.errors';

describe('assertMdeTarget', () => {
  it('acepta 127.0.0.1:5434 organigrama_mde', () => {
    expect(() =>
      assertMdeTarget({
        host: '127.0.0.1',
        port: 5434,
        database: 'organigrama_mde',
      }),
    ).not.toThrow();
  });

  it('rechaza host remoto', () => {
    expect(() =>
      assertMdeTarget({ host: '10.0.0.1', port: 5434, database: 'organigrama_mde' }),
    ).toThrow(P0SnapshotError);
  });

  it('rechaza puerto distinto de 5434', () => {
    expect(() =>
      assertMdeTarget({ host: '127.0.0.1', port: 5432, database: 'organigrama_mde' }),
    ).toThrow(P0SnapshotError);
  });

  it('rechaza database sin _mde', () => {
    expect(
      isMdeTarget({ host: '127.0.0.1', port: 5434, database: 'core' }),
    ).toBe(false);
  });
});
