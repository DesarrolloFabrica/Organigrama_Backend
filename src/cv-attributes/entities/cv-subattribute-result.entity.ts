import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  AttributeSupportLevel,
  SubattributeQualityFlag,
} from '../cv-attributes.types';

@Entity({ name: 'cv_subattribute_result', schema: 'organigrama' })
export class CvSubattributeResult {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  attribute_run_id!: string;

  @Column({ type: 'bigint' })
  subattribute_id!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  score!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  coverage!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: AttributeSupportLevel;

  @Column({ type: 'int' })
  supporting_skills_count!: number;

  @Column({ type: 'int' })
  contributing_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  strong_support_count!: number;

  @Column({ type: 'int', default: 0 })
  moderate_support_count!: number;

  @Column({ type: 'int', default: 0 })
  weak_support_count!: number;

  @Column({ type: 'int', default: 0 })
  none_support_count!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  quality_flags!: SubattributeQualityFlag[];

  @Column({ type: 'jsonb' })
  scoring_breakdown!: Record<string, unknown>;

  @Column({ type: 'text' })
  explanation!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
