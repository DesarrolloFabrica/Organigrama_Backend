import { parseCuratedValidateCliArgs } from '../../mc-catalog/curated-profile/curated-profile.cli-args';

describe('parseCuratedValidateCliArgs', () => {
  it('parsea file, document y out', () => {
    expect(
      parseCuratedValidateCliArgs([
        '--file=tmp/a.json',
        '--document=123',
        '--out=tmp/report.json',
      ]),
    ).toEqual({
      file: 'tmp/a.json',
      documentOverride: '123',
      out: 'tmp/report.json',
    });
  });

  it('rechaza --confirm', () => {
    expect(() =>
      parseCuratedValidateCliArgs(['--file=a.json', '--confirm']),
    ).toThrow(/no acepta --confirm/);
  });
});
