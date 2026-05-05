import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Employee } from '../employees/employee.entity';
import { EmployeeStatus } from '../employees/employee-status.enum';
import type { OrgNode } from './types/org-node.type';

@Injectable()
export class OrgChartService {
  constructor(
    @InjectRepository(Employee)
    private readonly employees: Repository<Employee>,
  ) {}

  /**
   * Construye el árbol esperado por el frontend a partir de filas activas.
   * Solo lectura: la jerarquía se infiere de `managerId` (null = raíz).
   */
  async getOrgChartTree(): Promise<OrgNode> {
    const rows = await this.employees.find({
      where: { status: EmployeeStatus.ACTIVE },
      order: { level: 'ASC', fullName: 'ASC' },
    });

    if (rows.length === 0) {
      throw new NotFoundException(
        'No hay colaboradores activos para mostrar el organigrama.',
      );
    }

    const byManager = new Map<string | null, Employee[]>();
    for (const row of rows) {
      const key = row.managerId;
      const bucket = byManager.get(key);
      if (bucket) bucket.push(row);
      else byManager.set(key, [row]);
    }

    const roots = byManager.get(null) ?? [];
    if (roots.length === 0) {
      throw new UnprocessableEntityException(
        'No hay nodo raíz (colaborador sin managerId). Revise los datos.',
      );
    }

    /**
     * Hoy el contrato HTTP devuelve un único objeto raíz.
     * Si hubiera varias raíces, se elige la de menor nivel y nombre (estable).
     */
    const root = [...roots].sort(
      (a, b) => a.level - b.level || a.fullName.localeCompare(b.fullName),
    )[0];

    return this.mapEmployeeToOrgNode(root, byManager);
  }

  private mapEmployeeToOrgNode(
    employee: Employee,
    byManager: Map<string | null, Employee[]>,
  ): OrgNode {
    const directReports = byManager.get(employee.id) ?? [];
    const children = [...directReports]
      .sort((a, b) => a.level - b.level || a.fullName.localeCompare(b.fullName))
      .map((child) => this.mapEmployeeToOrgNode(child, byManager));

    return {
      id: employee.id,
      name: employee.fullName,
      role: employee.roleName,
      level: employee.level,
      area: employee.areaName,
      children,
    };
  }
}
