import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { getAuthSessionFromRequest } from './auth-request.util';
import { Public } from './public.decorator';

type GoogleLoginBody = {
  idToken: string;
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('google')
  loginWithGoogle(@Body() body: GoogleLoginBody) {
    return this.authService.loginWithGoogleIdToken(body.idToken);
  }

  @Get('me')
  getMe(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.authService.getUserFromSession(session);
  }
}
