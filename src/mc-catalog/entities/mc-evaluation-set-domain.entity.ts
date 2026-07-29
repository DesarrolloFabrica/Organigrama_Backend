import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { McEvaluationSetDomainStatus } from '../mc-evaluation-set.types';

/**
 * Outcome operativo de un dominio candidato dentro de un Evaluation Set.
 * Relación autoritativa evaluación↔set: profile_evaluation_id (Opción B).
 */
@Entity({ name: 'mc_evaluation_set_domain', schema: 'organigrama' })
export class McEvaluationSetDomain {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  evaluation_set_id!: string;

  @Column({ type: 'varchar', length: 80 })
  domain_code!: string;

  @Column({ type: 'varchar', length: 20 })
  domain_status!: McEvaluationSetDomainStatus;

  @Column({ type: 'bigint', nullable: true })
  profile_evaluation_id!: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  domain_qualification!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  mapping_pack_code!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mapping_pack_version!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  mapping_hash!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  engine_rules_version!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  algorithm_version!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  config_hash!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  failure_code!: string | null;

  @Column({ type: 'text', nullable: true })
  failure_message!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  skip_reason!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  completed_at!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
