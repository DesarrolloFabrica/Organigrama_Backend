export type OrgSummaryNodeKind = 'person' | 'vacancy';

export interface OrgSummaryItemDto {
  id: string;
  name: string;
  roleName?: string | null;
  totalPeople: number;
  vacancies: number;
  nodeKind: OrgSummaryNodeKind;
}

export interface OrgSummaryResponseDto {
  general: OrgSummaryItemDto;
  /** Hijos directos que no son placeholders de vacante. */
  areas: OrgSummaryItemDto[];
  /**
   * Vacantes visibles según jerarquía: nivel visual 1 → todo el subárbol;
   * nivel 2+ → solo vacantes con reporte directo al nodo.
   */
  vacancyItems: OrgSummaryItemDto[];
}
