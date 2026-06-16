export class CreateOrgChartSnapshotDto {
  sourceVersionId!: number;
  code!: string;
  name!: string;
  periodLabel?: string;
  description?: string;
}
