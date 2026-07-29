import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { McSpecialtyLifecycleStatus } from '../mc-catalog.types';
import type { McSpecialtyPresentationStatus } from '../mc-catalog.types';

@Entity({ name: 'mc_profile_specialty_result', schema: 'organigrama' })
export class McProfileSpecialtyResult {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  profile_evaluation_id!: string;

  @Column({ type: 'bigint' })
  specialty_id!: string;

  @Column({ type: 'varchar', length: 80 })
  specialty_code!: string;

  @Column({ type: 'varchar', length: 20 })
  lifecycle_status!: McSpecialtyLifecycleStatus;

  @Column({ type: 'varchar', length: 20 })
  presentation_status!: McSpecialtyPresentationStatus;

  @Column({ type: 'int' })
  mapped_skill_count!: number;

  @Column({ type: 'int' })
  evidenced_skill_count!: number;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  coverage!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  strength!: string;

  @Column({ type: 'int' })
  rank!: number;

  @Column({ type: 'boolean', default: false })
  is_default!: boolean;

  @Column({ type: 'numeric', precision: 10, scale: 4, default: 0 })
  ranking_score!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  reasons!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  warnings!: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  skill_breakdown!: unknown[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
