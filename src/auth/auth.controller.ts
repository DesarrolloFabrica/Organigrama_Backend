import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  NotFoundException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import {
  assertDevLoginRouteEnabled,
  getDevLoginAvailability,
} from './auth.config';
import { AuthDevGuard } from './auth-dev.guard';
import { DevLoginSafetyService } from './dev-login-safety.service';
import { getAuthSessionFromRequest } from './auth-request.util';
import { Public } from './public.decorator';

type GoogleLoginBody = {
  idToken: string;
};

type DevLoginBody = {
  email: string;
};

@Controller('auth')
export class AuthController {
  private readonly log = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly devLoginSafety: DevLoginSafetyService,
  ) {}

  @Public()
  @Post('google')
  loginWithGoogle(@Body() body: GoogleLoginBody) {
    return this.authService.loginWithGoogleIdToken(body.idToken);
  }

  /**
   * ¿Acepta este backend el login dev? Solo informa: no autentica ni revela
   * datos. En producción responde 404 (como la propia ruta de login dev).
   * `enabled` exige además que la base conectada sea no productiva.
   */
  @Public()
  @Get('dev-login/status')
  getDevLoginStatus(): { enabled: boolean } {
    const { enabled } = getDevLoginAvailability();
    return { enabled: enabled && this.devLoginSafety.isAllowed() };
  }

  @Public()
  @UseGuards(AuthDevGuard)
  @HttpCode(200)
  @Post('dev-login')
  loginWithDevEmail(@Req() req: Request, @Body() body: DevLoginBody) {
    assertDevLoginRouteEnabled();
    // Defensa en profundidad (el guard ya lo exige).
    if (!this.devLoginSafety.isAllowed()) {
      throw new NotFoundException();
    }

    const email = body.email?.trim() ?? '';
    const ip =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
        : null) ??
      req.ip ??
      req.socket.remoteAddress ??
      'unknown';

    this.log.warn(
      `[DEV LOGIN] email=${email} ip=${ip} timestamp=${new Date().toISOString()}`,
    );

    return this.authService.loginWithDevEmail(email);
  }

  @Get('me')
  getMe(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.authService.getUserFromSession(session);
  }
}
