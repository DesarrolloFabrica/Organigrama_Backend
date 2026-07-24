import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'cv_attribute_result_skill', schema: 'organigrama' })
export class CvAttributeResultSkill {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  attribute_run_id!: string;

  @Column({ type: 'bigint' })
  subattribute_result_id!: string;

  @Column({ type: 'bigint' })
  extraction_skill_id!: string;

  @Column({ type: 'bigint' })
  evidence_evaluation_item_id!: string;

  @Column({ type: 'bigint' })
  mapping_id!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  mapping_weight!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  evidence_strength!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  evidence_confidence!: string;

  @Column({ type: 'numeric', precision: 8, scale: 4 })
  raw_contribution!: string;

  @Column({ type: 'numeric', precision: 8, scale: 4 })
  normalized_contribution!: string;

  @Column({ type: 'int' })
  contribution_rank!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
