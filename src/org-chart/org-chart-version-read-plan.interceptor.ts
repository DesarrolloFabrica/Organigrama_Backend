import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { from, lastValueFrom } from 'rxjs';
import { getAuthSessionFromRequest } from '../auth/auth-request.util';
import { OrgChartVersionService } from './org-chart-version.service';
import {
  buildOrgChartVersionReadPlanCacheKey,
  isOrgChartPlantaEnabled,
  runWithOrgChartVersionReadPlan,
} from './org-chart-version-read-plan';
import { buildOrgViewerContext } from './org-chart-viewer.util';

/**
 * Activa la capa Planta de Orbit en la versión vigente, igual que la rama
 * remota release/2026-10-20-orbit-provisional. Sin esto el mapa solo lee
 * aristas activas y se pierden Nicolás, los analistas y el resto del equipo.
 */
@Injectable()
export class OrgChartVersionReadPlanInterceptor implements NestInterceptor {
  constructor(private readonly versionService: OrgChartVersionService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    if (!getAuthSessionFromRequest(req)) {
      return next.handle();
    }

    const path = `${req.baseUrl ?? ''}${req.path ?? ''}`;
    if (path.includes('/video/stream') || path.includes('/vacancies')) {
      return next.handle();
    }

    const viewer = buildOrgViewerContext(req);
    const versionId = await this.versionService.resolveVersionForRequest(
      viewer,
      {
        versionId: firstQueryValue(req.query.versionId),
        versionCode: firstQueryValue(req.query.versionCode),
      },
    );
    const version = await this.versionService.getVersionById(versionId);
    const applyPlanta = isOrgChartPlantaEnabled() && version.is_active;

    return from(
      runWithOrgChartVersionReadPlan(
        {
          globalVersionId: versionId,
          overlays: [],
          applyPlanta,
          applyExceptions: false,
          cacheKey: buildOrgChartVersionReadPlanCacheKey(
            versionId,
            [],
            applyPlanta,
            false,
          ),
        },
        () => lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}
