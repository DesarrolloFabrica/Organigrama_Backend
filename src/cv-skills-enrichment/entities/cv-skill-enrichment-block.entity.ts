import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type EnrichmentBlockAttemptType = 'BLOCK' | 'MICRO_RETRY';

export type EnrichmentBlockAttemptStatus =
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'IDENTITY_ERROR'
  | 'TRANSIENT_ERROR';

@Entity({ name: 'cv_skill_enrichment_block', schema: 'organigrama' })
export class CvSkillEnrichmentBlock {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  enrichment_id!: string;

  @Column({ type: 'int' })
  block_number!: number;

  @Column({ type: 'int' })
  attempt_number!: number;

  @Column({ type: 'varchar', length: 20 })
  attempt_type!: EnrichmentBlockAttemptType;

  @Column({ type: 'jsonb' })
  input_skill_ids!: string[];

  @Column({ type: 'int' })
  input_skills_count!: number;

  @Column({ type: 'varchar', length: 20 })
  status!: EnrichmentBlockAttemptStatus;

  @Column({ type: 'jsonb', nullable: true })
  raw_response_json!: unknown | null;

  @Column({ type: 'boolean', default: false })
  raw_truncated!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  validation_errors!: unknown[] | null;

  @Column({ type: 'jsonb', nullable: true })
  validation_warnings!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  model_usage!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  duration_ms!: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
