import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { OrgChartVersionScopeType } from '../org-chart-version-scope.constants';
import { ORG_CHART_SCOPE_GLOBAL } from '../org-chart-version-scope.constants';

@Entity({ name: 'org_chart_version', schema: 'organigrama' })
export class OrgChartVersion {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  period_label!: string | null;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'boolean', default: false })
  is_locked!: boolean;

  @Column({ type: 'varchar', length: 20, default: ORG_CHART_SCOPE_GLOBAL })
  scope_type!: OrgChartVersionScopeType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  scope_code!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  scope_label!: string | null;

  @Column({ type: 'bigint', nullable: true })
  scope_root_person_id!: string | null;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  updated_at!: Date;

  @Column({ type: 'bigint', nullable: true })
  created_by_person_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  updated_by_person_id!: string | null;
}
