import type { OrgChartVersionScopeType } from '../org-chart-version-scope.constants';

export type OrgChartVersionDto = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  periodLabel: string | null;
  isActive: boolean;
  isLocked: boolean;
  scopeType: OrgChartVersionScopeType;
  scopeCode: string | null;
  scopeLabel: string | null;
  scopeRootPersonId: number | null;
  createdAt: string;
  updatedAt: string;
};
