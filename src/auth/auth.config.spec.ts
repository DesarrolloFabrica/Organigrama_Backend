import { NotFoundException } from '@nestjs/common';
import {
  assertDevLoginRouteEnabled,
  getDevLoginAvailability,
  isDevLoginRouteEnabled,
} from './auth.config';

describe('dev login config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isDevLoginRouteEnabled', () => {
    it('caso 1: NODE_ENV=production y DEV_LOGIN_ENABLED=true → deshabilitado', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(isDevLoginRouteEnabled()).toBe(false);
    });

    it('caso 2: NODE_ENV=development y DEV_LOGIN_ENABLED=false → deshabilitado', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'false';

      expect(isDevLoginRouteEnabled()).toBe(false);
    });

    it('caso 3: NODE_ENV=development y DEV_LOGIN_ENABLED=true → habilitado', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(isDevLoginRouteEnabled()).toBe(true);
    });
  });

  describe('assertDevLoginRouteEnabled', () => {
    it('caso 1: NODE_ENV=production y DEV_LOGIN_ENABLED=true → 404', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(() => assertDevLoginRouteEnabled()).toThrow(NotFoundException);
      expect(() => assertDevLoginRouteEnabled()).toThrow(
        'Dev login disabled in production',
      );
    });

    it('caso 2: NODE_ENV=development y DEV_LOGIN_ENABLED=false → 404', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'false';

      expect(() => assertDevLoginRouteEnabled()).toThrow(NotFoundException);
    });

    it('caso 3: NODE_ENV=development y DEV_LOGIN_ENABLED=true → no lanza', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(() => assertDevLoginRouteEnabled()).not.toThrow();
    });
  });

  describe('getDevLoginAvailability', () => {
    it('producción → 404 (no revela el mecanismo), aunque DEV_LOGIN_ENABLED=true', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(() => getDevLoginAvailability()).toThrow(NotFoundException);
    });

    it('development + DEV_LOGIN_ENABLED=false → { enabled: false }', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'false';

      expect(getDevLoginAvailability()).toEqual({ enabled: false });
    });

    it('development + DEV_LOGIN_ENABLED=true → { enabled: true }', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEV_LOGIN_ENABLED = 'true';

      expect(getDevLoginAvailability()).toEqual({ enabled: true });
    });

    it('coincide siempre con lo que acepta la ruta de login dev', () => {
      for (const nodeEnv of ['development', 'test', 'production']) {
        for (const flag of ['true', 'false', undefined]) {
          process.env.NODE_ENV = nodeEnv;
          if (flag === undefined) delete process.env.DEV_LOGIN_ENABLED;
          else process.env.DEV_LOGIN_ENABLED = flag;

          let routeAccepts = true;
          try {
            assertDevLoginRouteEnabled();
          } catch {
            routeAccepts = false;
          }
          let reported = false;
          try {
            reported = getDevLoginAvailability().enabled;
          } catch {
            reported = false;
          }
          expect(reported).toBe(routeAccepts);
        }
      }
    });
  });
});
