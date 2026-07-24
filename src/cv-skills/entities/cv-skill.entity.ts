import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SkillType } from '../cv-skills.types';

@Entity({ name: 'cv_skill', schema: 'organigrama' })
export class CvSkill {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 200 })
  normalized_name!: string;

  @Column({ type: 'varchar', length: 220 })
  normalized_key!: string;

  @Column({ type: 'varchar', length: 40 })
  skill_type!: SkillType;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
