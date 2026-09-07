import { BadRequestException } from '@nestjs/common';

const POSITIVE_BIGINT_ID = /^[1-9]\d*$/;

/**
 * Conserva ids bigint como string y evita que valores visuales como
 * `personId::relationId` lleguen a PostgreSQL.
 */
export function requireOrgChartIdParam(
  value: string,
  paramName: string,
): string {
  const normalized = value?.trim();
  if (!normalized || !POSITIVE_BIGINT_ID.test(normalized)) {
    throw new BadRequestException(
      `${paramName} debe ser un identificador numérico positivo.`,
    );
  }
  return normalized;
}
