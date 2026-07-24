import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { AttributeMappingType } from '../cv-attributes.types';

@Entity({ name: 'cv_skill_attribute_mapping', schema: 'organigrama' })
export class CvSkillAttributeMapping {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  catalog_version_id!: string;

  @Column({ type: 'bigint' })
  skill_id!: string;

  @Column({ type: 'bigint' })
  subattribute_id!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  weight!: string;

  @Column({ type: 'varchar', length: 20 })
  mapping_type!: AttributeMappingType;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
