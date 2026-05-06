import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de ciudades.
 * El `id` debe mantenerse compatible con el core.
 */
@Entity('city')
export class City {
  /** ID de ciudad compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible de la ciudad. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Permite ocultar ciudades sin borrarlas. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** ID de la región asociada. */
  @Column({ type: 'integer', nullable: true })
  region_id: number | null;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
