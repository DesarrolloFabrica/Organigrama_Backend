import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDevGuard } from './auth-dev.guard';
import { DevLoginSafetyService } from './dev-login-safety.service';

describe('AuthController (dev-login)', () => {
  let app: INestApplication<App>;
  const authService = {
    loginWithDevEmail: jest.fn(),
  };
  /** Base conectada: no productiva por defecto en estas pruebas. */
  const safety = { isAllowed: jest.fn(() => true) };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    authService.loginWithDevEmail.mockReset();
    safety.isAllowed.mockReset().mockReturnValue(true);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthDevGuard,
        { provide: AuthService, useValue: authService },
        { provide: DevLoginSafetyService, useValue: safety },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('caso 1: producción con DEV_LOGIN_ENABLED=true responde 404 sin llamar al servicio', async () => {
    process.env.NODE_ENV = 'production';
    process.env.DEV_LOGIN_ENABLED = 'true';

    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email: 'colaborador@cun.edu.co' })
      .expect(404);

    expect(authService.loginWithDevEmail).not.toHaveBeenCalled();
  });

  it('caso 2: development con DEV_LOGIN_ENABLED=false responde 404 sin llamar al servicio', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOGIN_ENABLED = 'false';

    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email: 'colaborador@cun.edu.co' })
      .expect(404);

    expect(authService.loginWithDevEmail).not.toHaveBeenCalled();
  });

  it('caso 3: development con DEV_LOGIN_ENABLED=true responde 200 si el correo existe en Core', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOGIN_ENABLED = 'true';

    authService.loginWithDevEmail.mockResolvedValue({
      accessToken: 'jwt-token',
      user: {
        personId: '1',
        fullName: 'Colaborador Test',
        eduEmail: 'colaborador@cun.edu.co',
        googleEmail: 'colaborador@cun.edu.co',
        pictureUrl: null,
        permissions: [],
      },
    });

    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email: 'colaborador@cun.edu.co' })
      .expect(200)
      .expect({
        accessToken: 'jwt-token',
        user: {
          personId: '1',
          fullName: 'Colaborador Test',
          eduEmail: 'colaborador@cun.edu.co',
          googleEmail: 'colaborador@cun.edu.co',
          pictureUrl: null,
          permissions: [],
        },
      });

    expect(authService.loginWithDevEmail).toHaveBeenCalledWith(
      'colaborador@cun.edu.co',
    );
  });

  it('propaga errores del servicio cuando el correo no existe en Core', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOGIN_ENABLED = 'true';

    authService.loginWithDevEmail.mockRejectedValue(
      new NotFoundException('No encontrado'),
    );

    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email: 'desconocido@cun.edu.co' })
      .expect(404);
  });

  it('base clasificada como producción: 404 aunque NODE_ENV=development y DEV_LOGIN_ENABLED=true', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOGIN_ENABLED = 'true';
    safety.isAllowed.mockReturnValue(false);

    await request(app.getHttpServer())
      .post('/auth/dev-login')
      .send({ email: 'colaborador@cun.edu.co' })
      .expect(404);
    expect(authService.loginWithDevEmail).not.toHaveBeenCalled();

    await request(app.getHttpServer())
      .get('/auth/dev-login/status')
      .expect(200)
      .expect({ enabled: false });
  });

  it('status: enabled=true solo con configuración y base no productiva', async () => {
    process.env.NODE_ENV = 'development';
    process.env.DEV_LOGIN_ENABLED = 'true';
    await request(app.getHttpServer())
      .get('/auth/dev-login/status')
      .expect(200)
      .expect({ enabled: true });

    process.env.DEV_LOGIN_ENABLED = 'false';
    await request(app.getHttpServer())
      .get('/auth/dev-login/status')
      .expect(200)
      .expect({ enabled: false });

    process.env.NODE_ENV = 'production';
    process.env.DEV_LOGIN_ENABLED = 'true';
    await request(app.getHttpServer())
      .get('/auth/dev-login/status')
      .expect(404);
  });
});
