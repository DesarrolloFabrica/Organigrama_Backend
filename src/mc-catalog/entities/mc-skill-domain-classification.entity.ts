import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { McSkillClassificationStatus } from '../mc-catalog.types';

@Entity({ name: 'mc_skill_domain_classification', schema: 'organigrama' })
export class McSkillDomainClassification {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'bigint' })
  domain_id!: string;

  @Column({ type: 'bigint' })
  skill_id!: string;

  @Column({ type: 'varchar', length: 40 })
  classification!: McSkillClassificationStatus;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
