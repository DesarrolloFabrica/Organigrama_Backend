import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de escuelas.
 *
 * IMPORTANTE:
 * El ID debe mantenerse compatible con el core.
 */
@Entity('school')
export class School {
  /** ID de la escuela compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible de la escuela. */
  @Column({ type: 'varchar', length: 180 })
  name: string;

  /** Descripción opcional. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Permite ocultar escuelas sin borrarlas. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
