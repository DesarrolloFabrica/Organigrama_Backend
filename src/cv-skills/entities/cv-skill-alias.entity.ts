import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'cv_skill_alias', schema: 'organigrama' })
export class CvSkillAlias {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  skill_id!: string;

  @Column({ type: 'varchar', length: 200 })
  alias_name!: string;

  @Column({ type: 'varchar', length: 220 })
  alias_key!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
