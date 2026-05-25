import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Catálogo provisional de tipos de contrato.
 * El `id` debe mantenerse compatible con el core.
 */
@Entity({
  name: 'contract_type',
  schema: 'core',
})
export class ContractType {
  /** ID del tipo de contrato compatible con el core. */
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  /** Nombre visible del tipo de contrato. */
  @Column({ type: 'varchar', length: 150 })
  name: string;

  /** Descripción opcional. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  /** Permite ocultar tipos de contrato sin borrarlos. */
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  /** Fecha de creación. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de actualización. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
