import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de regiones.
 * El `id` debe mantenerse compatible con el core.
 */
@Entity('region')
export class Region {
  /** ID de la región compatible con el core. */
  @PrimaryColumn({ type: 'integer' })
  id: number;

  /** Nombre visible de la región. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Permite ocultar regiones sin borrarlas. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
