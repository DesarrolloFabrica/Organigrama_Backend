import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de niveles jerárquicos.
 *
 * El ID debe coincidir con el core:
 * 1 = Director, 2 = Coordinación alta, etc.
 */
@Entity('hierarchy')
export class Hierarchy {
  /** ID del nivel jerárquico compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible del nivel. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Descripción opcional del nivel. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Permite ocultar niveles sin borrarlos. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
