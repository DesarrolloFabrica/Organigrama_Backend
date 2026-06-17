import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { assertDevLoginRouteEnabled } from './auth.config';

@Injectable()
export class AuthDevGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    try {
      assertDevLoginRouteEnabled();
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new NotFoundException();
    }

    return true;
  }
}
