/**
 * Guard LOCAL-ONLY para preview MC1.
 * Disponible solo fuera de production (404 en prod).
 */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

export function isMc1ProfilePreviewEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  if (process.env.MC1_PROFILE_PREVIEW_ENABLED === 'false') {
    return false;
  }
  return true;
}

@Injectable()
export class Mc1ProfilePreviewGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isMc1ProfilePreviewEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
