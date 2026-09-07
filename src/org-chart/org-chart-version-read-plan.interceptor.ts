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
    if (path.includes('/vacancies') || path.includes('/video/stream')) {
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