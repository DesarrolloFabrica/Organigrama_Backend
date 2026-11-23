import { CanActivate, Injectable, NotFoundException } from '@nestjs/common';
import { assertDevLoginRouteEnabled } from './auth.config';
import { DevLoginSafetyService } from './dev-login-safety.service';

/**
 * Login dev: exige la configuración existente (NODE_ENV=development +
 * DEV_LOGIN_ENABLED=true; en producción siempre 404) Y que la base conectada
 * esté clasificada como no productiva (DevLoginSafetyService). 404 en todo
 * caso de bloqueo para no revelar la ruta.
 */
@Injectable()
export class AuthDevGuard implements CanActivate {
  constructor(private readonly safety: DevLoginSafetyService) {}

  canActivate(): boolean {
    try {
      assertDevLoginRouteEnabled();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException();
    }

    if (!this.safety.isAllowed()) {
      throw new NotFoundException();
    }

    return true;
  }
}
