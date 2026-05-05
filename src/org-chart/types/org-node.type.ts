/** Nodo del organigrama devuelto por GET /api/org-chart (contrato estable con el frontend). */
export interface OrgNode {
  id: string;
  name: string;
  role: string;
  level: number;
  area: string;
  children: OrgNode[];
}
