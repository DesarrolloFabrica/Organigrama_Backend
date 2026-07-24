import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { CvExtractionStatus } from '../cv-skills.constants';

@Entity({ name: 'cv_extraction', schema: 'organigrama' })
export class CvExtraction {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  /** FK formal a organigrama.person_cv(id) ON DELETE RESTRICT. NOT NULL. */
  @Column({ type: 'bigint' })
  person_cv_id!: string;

  @Column({ type: 'varchar', length: 80 })
  document!: string;

  @Column({ type: 'varchar', length: 255 })
  drive_file_id!: string;

  @Column({ type: 'varchar', length: 255 })
  drive_file_name!: string;

  @Column({ type: 'char', length: 64 })
  pdf_sha256!: string;

  /** Tamaño del PDF en bytes (BIGINT en SQL). */
  @Column({ type: 'bigint' })
  pdf_byte_size!: string;

  @Column({ type: 'varchar', length: 80 })
  model!: string;

  @Column({ type: 'varchar', length: 64 })
  prompt_version!: string;

  @Column({ type: 'varchar', length: 64 })
  extractor_version!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: CvExtractionStatus;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'timestamptz' })
  started_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  error_message!: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  warnings!: string[];

  @Column({ type: 'jsonb', nullable: true })
  raw_result!: Record<string, unknown> | null;

  @Column({ type: 'int', nullable: true })
  skills_count!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
