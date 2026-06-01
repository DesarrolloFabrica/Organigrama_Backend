import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { GoogleWorkspacePhotoDiagnosticService } from './google-workspace-photo-diagnostic.service';
import { isGooglePhotoDiagEnabled } from './google-workspace.config';

/**
 * CLI Fase 0: valida acceso a fotos Google Workspace por edu_email.
 *
 * Uso:
 *   GOOGLE_WORKSPACE_PHOTO_DIAG_ENABLED=true npm run diag:google-photo -- user@institucion.edu
 */
async function main() {
  if (!isGooglePhotoDiagEnabled()) {
    console.error(
      '[diag:google-photo] GOOGLE_WORKSPACE_PHOTO_DIAG_ENABLED debe ser true',
    );
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.GOOGLE_WORKSPACE_PHOTO_DIAG_ALLOW_IN_PRODUCTION !== 'true'
    ) {
      console.error(
        '[diag:google-photo] En producción también requiere GOOGLE_WORKSPACE_PHOTO_DIAG_ALLOW_IN_PRODUCTION=true',
      );
    }
    process.exit(1);
  }

  const eduEmail = process.argv[2]?.trim();
  if (!eduEmail) {
    console.error(
      'Uso: npm run diag:google-photo -- <edu_email>\nEjemplo: npm run diag:google-photo -- persona@institucion.edu',
    );
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const diagnostic = app.get(GoogleWorkspacePhotoDiagnosticService);
    const result = await diagnostic.diagnose(eduEmail);
    console.log(JSON.stringify(result, null, 2));

    if (!result.summary.canFetchPhotoBytes) {
      process.exitCode = 2;
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[diag:google-photo] error', err);
  process.exit(1);
});
