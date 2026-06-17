import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'org_chart_person_override', schema: 'organigrama' })
export class OrgChartPersonOverride {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  version_id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'bigint', nullable: true })
  role_id_override!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'bigint', nullable: true })
  created_by_person_id!: string | null;
}
