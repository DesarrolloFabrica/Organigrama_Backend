import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { McSpecialtyLifecycleStatus } from '../mc-catalog.types';

@Entity({ name: 'mc_specialty', schema: 'organigrama' })
export class McSpecialty {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'bigint' })
  domain_id!: string;

  @Column({ type: 'varchar', length: 80 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text' })
  purpose!: string;

  @Column({ type: 'text' })
  description!: string;

  /** Ciclo de vida de catálogo. No es presentación por perfil. */
  @Column({ type: 'varchar', length: 20 })
  lifecycle_status!: McSpecialtyLifecycleStatus;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
