import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Programas academicos de Core.
 * Core no tiene columna 'description' en program.
 */
@Entity({
  name: 'program',
  schema: 'core',
})
export class Program {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /** No existe en Core — siempre null en lecturas. */
  description: string | null = null;

  @Column({ type: 'bigint', nullable: true })
  school_id: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_active: boolean | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
