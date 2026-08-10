import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { P0ParseStatus } from '../p0/p0.types';

/**
 * Entidad TypeORM — organigrama.mc_cv_snapshot.
 * Inmutable: no hay setters de dominio; la BD bloquea UPDATE.
 */
@Entity({ name: 'mc_cv_snapshot', schema: 'organigrama' })
export class McCvSnapshot {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'bigint' })
  person_cv_id!: string;

  @Column({ type: 'text' })
  drive_file_id!: string;

  @Column({ type: 'text' })
  drive_file_name!: string;

  @Column({ type: 'text' })
  mime_type!: string;

  @Column({ type: 'char', length: 64 })
  source_hash!: string;

  @Column({ type: 'bigint' })
  source_size_bytes!: string;

  @Column({ type: 'timestamptz', nullable: true })
  source_modified_time!: Date | null;

  @Column({ type: 'text', nullable: true })
  raw_text!: string | null;

  @Column({ type: 'text', nullable: true })
  normalized_text!: string | null;

  @Column({ type: 'char', length: 64, nullable: true })
  normalized_text_hash!: string | null;

  @Column({ type: 'int', default: 0 })
  page_count!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  pages!: unknown;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  sectioned_content!: unknown;

  @Column({ type: 'text' })
  extractor_name!: string;

  @Column({ type: 'text' })
  extractor_version!: string;

  @Column({ type: 'text' })
  normalizer_name!: string;

  @Column({ type: 'text' })
  normalizer_version!: string;

  @Column({ type: 'text' })
  parse_status!: P0ParseStatus;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  parse_warnings!: unknown;

  @Column({ type: 'text', nullable: true })
  parse_error_code!: string | null;

  @Column({ type: 'text', nullable: true })
  parse_error_detail_safe!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
