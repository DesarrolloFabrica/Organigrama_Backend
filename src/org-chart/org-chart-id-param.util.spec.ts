import { BadRequestException } from '@nestjs/common';
import { requireOrgChartIdParam } from './org-chart-id-param.util';

describe('requireOrgChartIdParam', () => {
  it('conserva un bigint válido como string', () => {
    expect(requireOrgChartIdParam('9223372036854775807', 'personId')).toBe(
      '9223372036854775807',
    );
  });

  it.each(['1082::8536', '601::11376', '0', '-1', 'abc', ''])(
    'rechaza %p antes de consultar PostgreSQL',
    (value) => {
      expect(() => requireOrgChartIdParam(value, 'personId')).toThrow(
        BadRequestException,
      );
    },
  );
});
