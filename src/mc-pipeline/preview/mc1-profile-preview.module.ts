import { Module } from '@nestjs/common';
import { Mc1ProfilePreviewController } from './mc1-profile-preview.controller';

/**
 * Preview LOCAL de perfiles MC1 — no forma parte del pipeline ni de org-chart productivo.
 */
@Module({
  controllers: [Mc1ProfilePreviewController],
})
export class Mc1ProfilePreviewModule {}
