import {
  DevLoginSafetyService,
  classifyDevLoginDatabase,
} from './dev-login-safety.service';

describe('classifyDevLoginDatabase', () => {
  const base = {
    configEnabled: true,
    dbHost: '127.0.0.1',
    environmentSetting: 'qa',
    cloudSqlSetting: null,
  };

  it('permite solo con configuración, host local, sin Cloud SQL y base marcada', () => {
    expect(classifyDevLoginDatabase(base)).toEqual({
      allowed: true,
      reason: 'BASE_NO_PRODUCTIVA',
      environment: 'qa',
    });
    for (const env of ['development', 'LOCAL', ' qa ']) {
      expect(
        classifyDevLoginDatabase({ ...base, environmentSetting: env }).allowed,
      ).toBe(true);
    }
  });

  it('configuración desactivada → bloqueado', () => {
    expect(
      classifyDevLoginDatabase({ ...base, configEnabled: false }),
    ).toMatchObject({
      allowed: false,
      reason: 'DESACTIVADO_POR_CONFIGURACION',
    });
  });

  it.each([
    '136.113.128.135',
    'mi-instancia.cloudsql.googleapis.com',
    '10.0.0.5',
    '',
    undefined,
    null,
  ])('host %p (no local) → bloqueado aunque la base esté marcada', (dbHost) => {
    expect(classifyDevLoginDatabase({ ...base, dbHost })).toMatchObject({
      allowed: false,
      reason: 'HOST_NO_LOCAL',
    });
  });

  it.each(['on', 'off', ''])(
    'servidor Cloud SQL (cloudsql.iam_authentication=%p) → bloqueado aunque el host sea local (proxy) y esté marcada',
    (cloudSqlSetting) => {
      expect(
        classifyDevLoginDatabase({ ...base, cloudSqlSetting }),
      ).toMatchObject({ allowed: false, reason: 'BASE_CLOUD_SQL' });
    },
  );

  it.each([null, undefined, '', 'production', 'prod', 'staging', 'qa2'])(
    'marca de entorno %p → bloqueado',
    (environmentSetting) => {
      expect(
        classifyDevLoginDatabase({ ...base, environmentSetting }),
      ).toMatchObject({
        allowed: false,
        reason: 'BASE_SIN_MARCA_NO_PRODUCTIVA',
      });
    },
  );
});

describe('DevLoginSafetyService', () => {
  const originalEnv = process.env;
  let query: jest.Mock<Promise<unknown>, [string]>;
  let service: DevLoginSafetyService;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'development',
      DEV_LOGIN_ENABLED: 'true',
      DB_HOST: '127.0.0.1',
    };
    query = jest.fn<Promise<unknown>, [string]>();
    service = new DevLoginSafetyService({ query } as never);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('bloqueado mientras no termina la verificación de arranque', () => {
    expect(service.isAllowed()).toBe(false);
    expect(service.getState().reason).toBe('PENDIENTE');
  });

  it('base QA marcada y local → permitido tras el arranque', async () => {
    query.mockResolvedValue([{ environment: 'qa', cloudsql: null }]);
    await service.onApplicationBootstrap();
    expect(service.isAllowed()).toBe(true);
    expect(query.mock.calls[0][0]).toContain(
      "current_setting('organigrama.environment', true)",
    );
  });

  it('producción (host Cloud SQL) → bloqueado sin consultar la base', async () => {
    process.env.DB_HOST = '136.113.128.135';
    await service.onApplicationBootstrap();
    expect(service.getState()).toMatchObject({
      allowed: false,
      reason: 'HOST_NO_LOCAL',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('DEV_LOGIN_ENABLED=false → bloqueado sin consultar la base', async () => {
    process.env.DEV_LOGIN_ENABLED = 'false';
    await service.onApplicationBootstrap();
    expect(service.getState().reason).toBe('DESACTIVADO_POR_CONFIGURACION');
    expect(query).not.toHaveBeenCalled();
  });

  it('NODE_ENV=production → bloqueado', async () => {
    process.env.NODE_ENV = 'production';
    await service.onApplicationBootstrap();
    expect(service.isAllowed()).toBe(false);
  });

  it('proxy local hacia Cloud SQL → bloqueado', async () => {
    query.mockResolvedValue([{ environment: 'qa', cloudsql: 'on' }]);
    await service.onApplicationBootstrap();
    expect(service.getState().reason).toBe('BASE_CLOUD_SQL');
  });

  it('base local sin marca → bloqueado', async () => {
    query.mockResolvedValue([{ environment: null, cloudsql: null }]);
    await service.onApplicationBootstrap();
    expect(service.getState().reason).toBe('BASE_SIN_MARCA_NO_PRODUCTIVA');
  });

  it('si la verificación falla → bloqueado (fail-closed)', async () => {
    query.mockRejectedValue(new Error('connection refused'));
    await service.onApplicationBootstrap();
    expect(service.getState()).toMatchObject({
      allowed: false,
      reason: 'VERIFICACION_FALLIDA',
    });
  });
});
