import { Module } from '@nestjs/common';
import { GoogleWorkspaceAuthService } from './google-workspace-auth.service';
import { GoogleWorkspaceDiagnosticController } from './google-workspace-diagnostic.controller';
import { GoogleWorkspaceDiagnosticGuard } from './google-workspace-diagnostic.guard';
import { GoogleWorkspacePhotoDiagnosticService } from './google-workspace-photo-diagnostic.service';

@Module({
  controllers: [GoogleWorkspaceDiagnosticController],
  providers: [
    GoogleWorkspaceAuthService,
    GoogleWorkspacePhotoDiagnosticService,
    GoogleWorkspaceDiagnosticGuard,
  ],
  exports: [GoogleWorkspaceAuthService, GoogleWorkspacePhotoDiagnosticService],
})
export class GoogleWorkspaceModule {}
