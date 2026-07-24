import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AttributeCatalogStatus } from '../cv-attributes.types';

@Entity({ name: 'cv_attribute_catalog_version', schema: 'organigrama' })
export class CvAttributeCatalogVersion {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', length: 64 })
  version!: string;

  @Column({ type: 'varchar', length: 20 })
  status!: AttributeCatalogStatus;

  @Column({ type: 'boolean', default: false })
  is_active!: boolean;

  @Column({ type: 'varchar', length: 64 })
  config_hash!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
