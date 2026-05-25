export interface OrgSummaryItemDto {
  id: string;
  name: string;
  roleName?: string | null;
  totalPeople: number;
  vacancies: number;
}

export interface OrgSummaryResponseDto {
  general: OrgSummaryItemDto;
  areas: OrgSummaryItemDto[];
}
