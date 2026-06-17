import {
  Body,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { assertDevLoginRouteEnabled } from './auth.config';
import { AuthDevGuard } from './auth-dev.guard';
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

  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  loginWithGoogle(@Body() body: GoogleLoginBody) {
    return this.authService.loginWithGoogleIdToken(body.idToken);
  }

  @Public()
  @UseGuards(AuthDevGuard)
  @HttpCode(200)
  @Post('dev-login')
  loginWithDevEmail(@Req() req: Request, @Body() body: DevLoginBody) {
    assertDevLoginRouteEnabled();

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
