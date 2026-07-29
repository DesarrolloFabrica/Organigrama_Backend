import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { McEvaluationSetStatus } from '../mc-evaluation-set.types';

/**
 * Agrupación explícita de Domain Evaluations de un mismo run comparable (MC1.2).
 * No determina dominio dominante ni Professional Classification.
 */
@Entity({ name: 'mc_evaluation_set', schema: 'organigrama' })
export class McEvaluationSet {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  person_id!: string;

  @Column({ type: 'bigint' })
  person_cv_id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'bigint' })
  enrichment_id!: string;

  @Column({ type: 'bigint' })
  evidence_evaluation_id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'varchar', length: 64 })
  source_hash!: string;

  @Column({ type: 'varchar', length: 32 })
  schema_version!: string;

  @Column({ type: 'varchar', length: 32 })
  qualification_policy_version!: string;

  /** Snapshot JSON canónico de candidatos (trazabilidad). Fuente autoritativa: filas domain. */
  @Column({ type: 'jsonb' })
  candidate_domains_snapshot!: unknown;

  @Column({ type: 'char', length: 64 })
  set_context_hash!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: McEvaluationSetStatus;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  failed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
