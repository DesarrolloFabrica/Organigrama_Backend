import {
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { getAuthSessionFromRequest } from '../auth/auth-request.util';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  private readonly log = new Logger(ProfileController.name);

  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getProfileMe(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.profileService.getProfileMe(session.personId);
  }

  @Patch('me')
  async updateProfileMe(@Req() req: Request, @Body() body: UpdateProfileDto) {
    const session = getAuthSessionFromRequest(req)!;
    const timingEnabled = process.env.PROFILE_PATCH_TIMING === 'true';
    const startedAt = timingEnabled ? Date.now() : 0;

    try {
      const result = await this.profileService.updateProfileMe(
        session.personId,
        body,
        { timing: timingEnabled },
      );

      if (timingEnabled) {
        const elapsedMs = Date.now() - startedAt;
        this.log.log(
          `[Profile] PATCH /me completado en ${elapsedMs}ms personId=${session.personId}`,
        );
        if (elapsedMs > 1000) {
          this.log.warn(
            `[Profile] PATCH /me lento (${elapsedMs}ms > 1000ms) personId=${session.personId}`,
          );
        }
      }

      return result;
    } catch (error) {
      if (timingEnabled) {
        this.log.warn(
          `[Profile] PATCH /me falló tras ${Date.now() - startedAt}ms personId=${session.personId}`,
        );
      }
      throw error;
    }
  }

  @Post('me/photo-from-google')
  savePhotoFromGoogle(@Req() req: Request) {
    const session = getAuthSessionFromRequest(req)!;
    return this.profileService.savePhotoFromGoogle(session);
  }
}
