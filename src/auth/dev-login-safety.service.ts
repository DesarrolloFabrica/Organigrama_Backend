import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { isLocalDatabaseHost } from '../database/local/assert-local-db-host';
import { isDevLoginRouteEnabled } from './auth.config';

/**
 * Marca que una base declara explícitamente ser NO productiva:
 *   ALTER DATABASE <qa_db> SET organigrama.environment = 'qa';
 * La base de producción no la tiene (y fijarla exigiría escribir en ella).
 */
export const DEV_LOGIN_DB_ENVIRONMENT_SETTING = 'organigrama.environment';
export const DEV_LOGIN_ALLOWED_DB_ENVIRONMENTS = [
  'qa',
  'development',
  'local',
] as const;

export type DevLoginSafetyReason =
  | 'PENDIENTE'
  | 'DESACTIVADO_POR_CONFIGURACION'
  | 'HOST_NO_LOCAL'
  | 'BASE_CLOUD_SQL'
  | 'BASE_SIN_MARCA_NO_PRODUCTIVA'
  | 'VERIFICACION_FALLIDA'
  | 'BASE_NO_PRODUCTIVA';

export type DevLoginSafety = {
  allowed: boolean;
  reason: DevLoginSafetyReason;
  /** Valor de organigrama.environment cuando se permitió (qa/development/local). */
  environment?: string;
};

/**
 * Clasificación pura (fail-closed). El login dev solo se permite si TODO se cumple:
 * 1. NODE_ENV=development y DEV_LOGIN_ENABLED=true (controles existentes);
 * 2. DB_HOST es un host local permitido (no la IP pública de Cloud SQL);
 * 3. el servidor NO es Cloud SQL (un proxy local a Cloud SQL también se bloquea);
 * 4. la base se declara no productiva con organigrama.environment.
 * Cualquier dato ausente o inesperado → bloqueado.
 */
export function classifyDevLoginDatabase(input: {
  configEnabled: boolean;
  dbHost: string | undefined | null;
  environmentSetting: string | null | undefined;
  cloudSqlSetting: string | null | undefined;
}): DevLoginSafety {
  if (!input.configEnabled) {
    return { allowed: false, reason: 'DESACTIVADO_POR_CONFIGURACION' };
  }
  if (!isLocalDatabaseHost(input.dbHost)) {
    return { allowed: false, reason: 'HOST_NO_LOCAL' };
  }
  if (input.cloudSqlSetting !== null && input.cloudSqlSetting !== undefined) {
    return { allowed: false, reason: 'BASE_CLOUD_SQL' };
  }
  const environment = String(input.environmentSetting ?? '')
    .trim()
    .toLowerCase();
  if (
    !(DEV_LOGIN_ALLOWED_DB_ENVIRONMENTS as readonly string[]).includes(
      environment,
    )
  ) {
    return { allowed: false, reason: 'BASE_SIN_MARCA_NO_PRODUCTIVA' };
  }
  return { allowed: true, reason: 'BASE_NO_PRODUCTIVA', environment };
}

/**
 * Decide una vez, al arrancar, si este backend puede ofrecer el login dev
 * según la base a la que REALMENTE está conectado. Mientras no termina la
 * verificación (o si falla) el login dev queda bloqueado.
 */
@Injectable()
export class DevLoginSafetyService implements OnApplicationBootstrap {
  private readonly log = new Logger(DevLoginSafetyService.name);
  private state: DevLoginSafety = { allowed: false, reason: 'PENDIENTE' };

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    this.state = await this.evaluate();
    const message = `[DevLogin] ${this.state.allowed ? 'habilitado' : 'bloqueado'}: ${this.state.reason}${
      this.state.environment ? ` (${this.state.environment})` : ''
    }`;
    if (this.state.allowed) this.log.warn(message);
    else this.log.log(message);
  }

  isAllowed(): boolean {
    return this.state.allowed;
  }

  getState(): DevLoginSafety {
    return { ...this.state };
  }

  async evaluate(): Promise<DevLoginSafety> {
    const configEnabled = isDevLoginRouteEnabled();
    const dbHost = process.env.DB_HOST;
    // Sin configuración o con host remoto no hace falta consultar la base.
    const early = classifyDevLoginDatabase({
      configEnabled,
      dbHost,
      environmentSetting: 'qa',
      cloudSqlSetting: null,
    });
    if (!early.allowed) return early;

    try {
      const rows = await this.dataSource.query<
        { environment: string | null; cloudsql: string | null }[]
      >(
        `SELECT current_setting('${DEV_LOGIN_DB_ENVIRONMENT_SETTING}', true) AS environment,
                current_setting('cloudsql.iam_authentication', true) AS cloudsql`,
      );
      return classifyDevLoginDatabase({
        configEnabled,
        dbHost,
        environmentSetting: rows?.[0]?.environment,
        cloudSqlSetting: rows?.[0]?.cloudsql,
      });
    } catch {
      return { allowed: false, reason: 'VERIFICACION_FALLIDA' };
    }
  }
}
