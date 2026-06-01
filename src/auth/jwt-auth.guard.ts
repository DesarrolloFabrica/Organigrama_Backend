import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { AUTH_SESSION_REQUEST_KEY } from './auth.types';
import type { JwtPayload } from './auth.types';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const token = extractAccessToken(req);
    if (!token) {
      throw new UnauthorizedException('Inicia sesión para continuar');
    }

    const session = this.authService.verifyAccessToken(token);
    (req as Request & Record<string, JwtPayload>)[AUTH_SESSION_REQUEST_KEY] =
      session;

    return true;
  }
}

function extractAccessToken(req: Request): string | null {
  const header = req.headers.authorization?.trim();
  if (header?.toLowerCase().startsWith('bearer ')) {
    const token = header.slice(7).trim();
    if (token) {
      return token;
    }
  }

  if (req.method === 'GET') {
    const queryToken = req.query.access_token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.trim();
    }
  }

  return null;
}
