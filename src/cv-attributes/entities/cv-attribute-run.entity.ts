import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AttributeRunStatus } from '../cv-attributes.types';

@Entity({ name: 'cv_attribute_run', schema: 'organigrama' })
export class CvAttributeRun {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  evidence_evaluation_id!: string;

  @Column({ type: 'bigint' })
  enrichment_id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'varchar', length: 64 })
  mapping_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  algorithm_version!: string;

  @Column({ type: 'varchar', length: 64 })
  config_version!: string;

  @Column({ type: 'varchar', length: 64 })
  config_hash!: string;

  @Column({ type: 'jsonb' })
  config_json!: Record<string, unknown>;

  @Column({ type: 'varchar', length: 20 })
  status!: AttributeRunStatus;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'int' })
  input_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  mapped_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  unmapped_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  contributing_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  ignored_none_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  subattributes_with_support_count!: number;

  @Column({ type: 'int', default: 0 })
  macroattributes_with_support_count!: number;

  @Column({ type: 'int', default: 0 })
  warnings_count!: number;

  @Column({ type: 'jsonb', nullable: true })
  metrics!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  errors!: string[] | null;

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
