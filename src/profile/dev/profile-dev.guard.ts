import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isProfileDevResetEnabled } from '../profile.config';

@Injectable()
export class ProfileDevGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isProfileDevResetEnabled()) {
      throw new NotFoundException();
    }

    return true;
  }
}
