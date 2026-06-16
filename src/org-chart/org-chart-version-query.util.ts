import { OrgChartVersionService } from './org-chart-version.service';
import type { OrgViewerContext } from './org-viewer-context';

export type OrgChartVersionQueryParams = {
  versionId?: string;
  versionCode?: string;
};

export async function resolveOrgChartVersionId(
  versionService: OrgChartVersionService,
  viewer: OrgViewerContext,
  params: OrgChartVersionQueryParams,
): Promise<string> {
  return versionService.resolveVersionForRequest(viewer, params);
}
