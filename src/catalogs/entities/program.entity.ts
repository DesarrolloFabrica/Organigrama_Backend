import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de programas.
 *
 * IMPORTANTE:
 * El ID debe mantenerse compatible con el core.
 */
@Entity('program')
export class Program {
  /** ID del programa compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible del programa. */
  @Column({ type: 'varchar', length: 180 })
  name: string;

  /** Descripción opcional. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** ID de la escuela a la que pertenece el programa. */
  @Column({ type: 'bigint', nullable: true })
  school_id: string | null;

  /** Permite ocultar programas sin borrarlos. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
