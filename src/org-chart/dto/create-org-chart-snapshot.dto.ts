export class CreateOrgChartSnapshotDto {
  sourceVersionId!: number;
  code!: string;
  name!: string;
  periodLabel?: string;
  description?: string;
  /** GLOBAL (defecto) o COORDINATION para un subárbol independiente. */
  scopeType?: 'GLOBAL' | 'COORDINATION';
  scopeCode?: string;
  scopeLabel?: string;
  scopeRootPersonId?: number;
}
