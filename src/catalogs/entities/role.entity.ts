import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de roles/cargos.
 *
 * IMPORTANTE:
 * El `id` debe mantenerse compatible con el core.
 * Por eso NO usamos PrimaryGeneratedColumn.
 */
@Entity('role')
export class Role {
  /** ID del rol/cargo. Debe coincidir con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible del rol/cargo. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Descripción opcional del rol/cargo. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Permite ocultar roles sin borrarlos. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación del registro. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de última actualización del registro. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
