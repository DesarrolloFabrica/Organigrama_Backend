import { Logger } from '@nestjs/common';
import { DataSource, type DataSourceOptions } from 'typeorm';

export type PgPoolExtraOptions = {
  max: number;
  connectionTimeoutMillis: number;
  idleTimeoutMillis: number;
  keepAlive: boolean;
  keepAliveInitialDelayMillis: number;
};

export function buildPgPoolExtra(isProd: boolean): PgPoolExtraOptions {
  return {
    max: isProd ? 5 : 10,
    connectionTimeoutMillis: isProd ? 15_000 : 10_000,
    idleTimeoutMillis: 30_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
}

export function logPgPoolConfig(
  logger: Logger,
  pool: PgPoolExtraOptions,
): void {
  logger.log(
    `DB Pool configurado. max=${pool.max}, connectionTimeoutMillis=${pool.connectionTimeoutMillis}, idleTimeoutMillis=${pool.idleTimeoutMillis}, keepAlive=${pool.keepAlive}, keepAliveInitialDelayMillis=${pool.keepAliveInitialDelayMillis}`,
  );
}

/**
 * Inicializa TypeORM y registra errores del pool PostgreSQL en Cloud Logging.
 */
export async function createTypeOrmDataSource(
  options: DataSourceOptions,
  logger: Logger,
): Promise<DataSource> {
  const pool = (options.extra ?? {}) as Partial<PgPoolExtraOptions>;
  logPgPoolConfig(logger, {
    max: pool.max ?? 10,
    connectionTimeoutMillis: pool.connectionTimeoutMillis ?? 0,
    idleTimeoutMillis: pool.idleTimeoutMillis ?? 0,
    keepAlive: pool.keepAlive ?? false,
    keepAliveInitialDelayMillis: pool.keepAliveInitialDelayMillis ?? 0,
  });

  const dataSource = new DataSource(options);
  await dataSource.initialize();
  attachDataSourceErrorHandlers(dataSource, logger);
  return dataSource;
}

function attachDataSourceErrorHandlers(
  dataSource: DataSource,
  logger: Logger,
): void {
  const dataSourceWithEvents = dataSource as DataSource & {
    on?: (event: 'error', listener: (error: Error) => void) => void;
  };

  dataSourceWithEvents.on?.('error', (error: Error) => {
    logger.error(`[TypeORM DataSource] ${error.message}`, error.stack);
  });

  const master = (
    dataSource.driver as {
      master?: {
        on?: (event: string, listener: (error: Error) => void) => void;
      };
    }
  )?.master;

  master?.on?.('error', (error: Error) => {
    logger.error(`[PostgreSQL pool] ${error.message}`, error.stack);
  });
}
