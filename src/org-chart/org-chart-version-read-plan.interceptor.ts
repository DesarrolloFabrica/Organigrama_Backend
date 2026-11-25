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
import { runWithOrgChartVersionReadPlan } from './org-chart-version-read-plan';
import { buildOrgViewerContext } from './org-chart-viewer.util';

const PLAN_REQUEST_KEY = 'orgChartVersionReadPlan';

@Injectable()
export class OrgChartVersionReadPlanInterceptor implements NestInterceptor {
  constructor(private readonly versionService: OrgChartVersionService) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest<Request>();
    if (!getAuthSessionFromRequest(req)) {
      return next.handle();
    }

    const path = `${req.baseUrl ?? ''}${req.path ?? ''}`;
    // `/vacancies` sin `personId` es la lista global: no depende de la versión.
    // Con `personId` el alcance se calcula sobre el mapa de la versión pedida,
    // así que necesita el mismo plan de lectura que el resumen del nodo.
    const vacanciesWithoutScope =
      path.includes('/vacancies') &&
      !Object.prototype.hasOwnProperty.call(req.query ?? {}, 'personId');
    if (
      vacanciesWithoutScope ||
      path.includes('/video/stream') ||
      path.includes('/change-token') ||
      // Exportadores: autorizan primero y resuelven su propio plan (siempre
      // la versión vigente). Nada se consulta antes del permiso.
      path.includes('/org-chart/export/')
    ) {
      return next.handle();
    }

    const viewer = buildOrgViewerContext(req);
    const plan = await this.versionService.resolveReadPlan(viewer, {
      versionId: firstQueryValue(req.query.versionId),
      versionCode: firstQueryValue(req.query.versionCode),
      scopeVersionId: firstQueryValue(req.query.scopeVersionId),
    });
    (req as Request & { [PLAN_REQUEST_KEY]?: typeof plan })[PLAN_REQUEST_KEY] =
      plan;

    return from(
      runWithOrgChartVersionReadPlan(plan, () =>
        lastValueFrom(next.handle(), { defaultValue: undefined }),
      ),
    );
  }
}

function firstQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}
