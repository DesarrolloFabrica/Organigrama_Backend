import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Escuelas de Core.
 * Core no tiene columna 'description' en school.
 */
@Entity('school')
export class School {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /** No existe en Core — siempre null en lecturas. */
  description: string | null = null;

  @Column({ type: 'boolean', nullable: true })
  is_active: boolean | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
