import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  updated_at!: Date;

  @Column({ type: 'bigint', nullable: true })
  created_by_person_id!: string | null;

  @Column({ type: 'bigint', nullable: true })
  updated_by_person_id!: string | null;
}
