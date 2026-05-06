import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de campus/sedes.
 * El `id` debe mantenerse compatible con el core.
 */
@Entity('campus')
export class Campus {
  /** ID del campus compatible con el core. */
  @PrimaryColumn({ type: 'integer' })
  id: number;

  /** Nombre visible del campus. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Permite ocultar campus sin borrarlos. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** ID de la ciudad asociada. */
  @Column({ type: 'bigint', nullable: true })
  city_id: string | null;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
