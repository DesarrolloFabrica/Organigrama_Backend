import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { McSkillMappingType } from '../mc-catalog.types';

@Entity({ name: 'mc_skill_specialty_mapping', schema: 'organigrama' })
export class McSkillSpecialtyMapping {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'bigint' })
  skill_id!: string;

  @Column({ type: 'bigint' })
  specialty_id!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  weight!: string;

  @Column({ type: 'varchar', length: 20 })
  mapping_type!: McSkillMappingType;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
