import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EvidenceEvaluationStatus } from '../cv-evidence.types';

@Entity({ name: 'cv_evidence_evaluation', schema: 'organigrama' })
export class CvEvidenceEvaluation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  enrichment_id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'varchar', length: 64 })
  evidence_rules_version!: string;

  @Column({ type: 'varchar', length: 64 })
  source_weight_version!: string;

  @Column({ type: 'varchar', length: 64 })
  algorithm_version!: string;

  @Column({ type: 'varchar', length: 64 })
  config_hash!: string;

  @Column({ type: 'jsonb' })
  config_json!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20 })
  status!: EvidenceEvaluationStatus;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'int' })
  input_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  output_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  strong_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  moderate_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  weak_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  no_evidence_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  applied_evidence_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  warnings_count!: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

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
