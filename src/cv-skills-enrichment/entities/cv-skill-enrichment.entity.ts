import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CvSkillEnrichmentStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PARTIAL'
  | 'SUCCEEDED'
  | 'FAILED';

@Entity({ name: 'cv_skill_enrichment', schema: 'organigrama' })
export class CvSkillEnrichment {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'bigint' })
  person_cv_id!: string;

  @Column({ type: 'char', length: 64 })
  pdf_sha256!: string;

  @Column({ type: 'varchar', length: 64 })
  inventory_hash!: string;

  @Column({ type: 'varchar', length: 80 })
  model!: string;

  @Column({ type: 'varchar', length: 64 })
  prompt_version!: string;

  @Column({ type: 'varchar', length: 64 })
  enricher_version!: string;

  @Column({ type: 'varchar', length: 64 })
  block_config_version!: string;

  @Column({ type: 'jsonb' })
  block_config!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 64 })
  block_config_hash!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: CvSkillEnrichmentStatus;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'int' })
  input_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  output_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  skills_with_evidence_count!: number;

  @Column({ type: 'int', default: 0 })
  skills_without_evidence_count!: number;

  @Column({ type: 'int', default: 0 })
  evidence_items_count!: number;

  @Column({ type: 'int', default: 0 })
  missing_filled_empty_count!: number;

  @Column({ type: 'int' })
  blocks_total!: number;

  @Column({ type: 'int', default: 0 })
  blocks_succeeded!: number;

  @Column({ type: 'int', default: 0 })
  blocks_failed!: number;

  @Column({ type: 'int', default: 0 })
  attempts_total!: number;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metrics!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  validated_result_json!: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  error_stage!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  error_code!: string | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  started_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
