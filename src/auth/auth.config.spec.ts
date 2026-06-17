import { NotFoundException } from '@nestjs/common';
import {
  assertDevLoginRouteEnabled,
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
});
