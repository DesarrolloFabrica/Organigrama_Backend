import { INestApplication, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthDevGuard } from './auth-dev.guard';

describe('AuthController (dev-login)', () => {
  let app: INestApplication<App>;
  const authService = {
    loginWithDevEmail: jest.fn(),
  };

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    authService.loginWithDevEmail.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthDevGuard,
        { provide: AuthService, useValue: authService },
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
});
