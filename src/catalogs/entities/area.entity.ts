import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de áreas organizacionales.
 *
 * IMPORTANTE:
 * El ID debe mantenerse compatible con el core.
 */
@Entity('area')
export class Area {
  /** ID del área compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible del área. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Descripción opcional del área. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Permite ocultar áreas sin borrarlas. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
