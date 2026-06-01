import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { GoogleWorkspaceDiagnosticGuard } from './google-workspace-diagnostic.guard';
import { GoogleWorkspacePhotoDiagnosticService } from './google-workspace-photo-diagnostic.service';

/**
 * Fase 0 — diagnóstico temporal de fotos Google Workspace.
 * Solo accesible con GOOGLE_WORKSPACE_PHOTO_DIAG_ENABLED=true (y no en producción
 * salvo GOOGLE_WORKSPACE_PHOTO_DIAG_ALLOW_IN_PRODUCTION=true).
 */
@Public()
@Controller('google-workspace/diagnostic')
@UseGuards(GoogleWorkspaceDiagnosticGuard)
export class GoogleWorkspaceDiagnosticController {
  constructor(
    private readonly photoDiagnostic: GoogleWorkspacePhotoDiagnosticService,
  ) {}

  @Get('photo')
  diagnosePhoto(@Query('edu_email') eduEmail?: string) {
    const normalized = eduEmail?.trim();
    if (!normalized) {
      throw new BadRequestException(
        'Query param edu_email es requerido (correo institucional Workspace)',
      );
    }

    return this.photoDiagnostic.diagnose(normalized);
  }
}
