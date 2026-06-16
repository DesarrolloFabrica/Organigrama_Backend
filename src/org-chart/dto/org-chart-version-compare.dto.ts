export type OrgChartRelationRefDto = {
  parentPersonId: number;
  childPersonId: number;
  relationType: string;
  visualLevel: number | null;
};

export type OrgChartRelationMoveDto = {
  childPersonId: number;
  baseParentPersonId: number;
  targetParentPersonId: number;
};

export type OrgChartVersionCompareSummaryDto = {
  added: number;
  removed: number;
  moved: number;
  unchanged: number;
};

export type OrgChartVersionCompareDto = {
  baseVersion: {
    id: number;
    code: string;
    name: string;
  };
  targetVersion: {
    id: number;
    code: string;
    name: string;
  };
  summary: OrgChartVersionCompareSummaryDto;
  changes: {
    added: OrgChartRelationRefDto[];
    removed: OrgChartRelationRefDto[];
    moved: OrgChartRelationMoveDto[];
  };
};
