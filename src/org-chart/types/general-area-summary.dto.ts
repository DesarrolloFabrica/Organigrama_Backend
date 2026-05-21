export interface GeneralAreaSummaryDto {
  id: string;
  name: string;
  roleName?: string | null;
  totalPeople: number;
  vacancies: number;
}
