import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isGooglePhotoDiagEnabled } from './google-workspace.config';

/** Oculta el endpoint de diagnóstico salvo que el feature flag esté activo. */
@Injectable()
export class GoogleWorkspaceDiagnosticGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    if (!isGooglePhotoDiagEnabled()) {
      throw new NotFoundException();
    }
    return true;
  }
}
