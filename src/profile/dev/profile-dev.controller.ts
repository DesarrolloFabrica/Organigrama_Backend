import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/public.decorator';
import { isEmailAllowedForProfileDevReset } from '../profile.config';
import { ProfileService } from '../profile.service';
import { ProfileDevGuard } from './profile-dev.guard';

type ResetOnboardingBody = {
  edu_email: string;
};

@Public()
@UseGuards(ProfileDevGuard)
@Controller('dev/profile')
export class ProfileDevController {
  constructor(private readonly profileService: ProfileService) {}

  @Post('reset-onboarding')
  resetOnboarding(@Body() body: ResetOnboardingBody) {
    const eduEmail = body.edu_email?.trim();
    if (!eduEmail) {
      throw new BadRequestException('edu_email es requerido');
    }

    if (!isEmailAllowedForProfileDevReset(eduEmail)) {
      throw new ForbiddenException(
        'edu_email no autorizado para reset en este entorno',
      );
    }

    return this.profileService.resetOnboardingByEduEmail(eduEmail);
  }
}
