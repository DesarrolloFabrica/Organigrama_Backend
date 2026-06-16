export type OrgChartVersionDto = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  periodLabel: string | null;
  isActive: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
};
