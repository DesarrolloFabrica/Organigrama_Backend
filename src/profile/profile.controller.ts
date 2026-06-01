import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getAuthSessionFromRequest } from '../auth/auth-request.util';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getProfileMe(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.profileService.getProfileMe(session.personId);
  }

  @Patch('me')
  updateProfileMe(@Req() req: Request, @Body() body: UpdateProfileDto) {
    const session = getAuthSessionFromRequest(req)!;
    return this.profileService.updateProfileMe(session.personId, body);
  }

  @Post('me/photo-from-google')
  savePhotoFromGoogle(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.profileService.savePhotoFromGoogle(session);
  }
}
