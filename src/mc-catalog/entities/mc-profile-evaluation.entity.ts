import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'mc_profile_evaluation', schema: 'organigrama' })
export class McProfileEvaluation {
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

  @Column({ type: 'bigint' })
  domain_id!: string;

  @Column({ type: 'varchar', length: 80 })
  domain_code!: string;

  @Column({ type: 'varchar', length: 64 })
  engine_rules_version!: string;

  @Column({ type: 'varchar', length: 64 })
  config_hash!: string;

  @Column({ type: 'varchar', length: 64 })
  mapping_hash!: string;

  /** Código estable del pack (p.ej. software-mappings). */
  @Column({ type: 'varchar', length: 80, nullable: true })
  mapping_pack_code!: string | null;

  /** Versión exacta del pack usada al evaluar. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  mapping_pack_version!: string | null;

  /** pdf_sha256 de la cadena al momento de evaluar. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  source_hash!: string | null;

  /** Identificador de algoritmo PA2 (p.ej. pa2-algo-lexico-v1). */
  @Column({ type: 'varchar', length: 64, nullable: true })
  algorithm_version!: string | null;

  /** Hash compuesto del contexto evaluativo. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  evaluation_context_hash!: string | null;

  @Column({ type: 'varchar', length: 20 })
  status!: 'DRAFT' | 'SUCCEEDED' | 'FAILED';

  /**
   * Calificación intra-dominio (MC1.1). NULL en evaluaciones históricas.
   * No indica práctica profesional dominante multidominio.
   */
  @Column({ type: 'varchar', length: 32, nullable: true })
  domain_qualification!: string | null;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'int' })
  input_skills_count!: number;

  @Column({ type: 'int', default: 0 })
  specialty_count!: number;

  @Column({ type: 'int', default: 0 })
  active_count!: number;

  @Column({ type: 'int', default: 0 })
  emergent_count!: number;

  @Column({ type: 'int', default: 0 })
  hidden_count!: number;

  @Column({ type: 'varchar', length: 80, nullable: true })
  default_specialty_code!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  metrics!: Record<string, unknown> | null;

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
