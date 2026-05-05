import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EmployeeStatus } from './employee-status.enum';

/**
 * Tabla principal de colaboradores (`employees`).
 * `managerId` define la jerarquía: null = raíz del organigrama (ej. director).
 */
@Entity('employees')
@Index(['managerId'])
@Index(['status'])
export class Employee {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  documentNumber: string;

  @Column({ type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255 })
  roleName: string;

  @Column({ type: 'smallint' })
  level: number;

  /** Identificador de área en sistemas externos (opcional en esta fase). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  areaId: string | null;

  @Column({ type: 'varchar', length: 255 })
  areaName: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  schoolId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  schoolName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  programId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  programName: string | null;

  @Column({ type: 'uuid', nullable: true })
  managerId: string | null;

  @Column({
    type: 'enum',
    enum: EmployeeStatus,
    default: EmployeeStatus.ACTIVE,
  })
  status: EmployeeStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  contractType: string | null;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
