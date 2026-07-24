import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { EvidenceLevel, EvidenceQualityFlag } from '../cv-evidence.types';

@Entity({ name: 'cv_evidence_evaluation_item', schema: 'organigrama' })
export class CvEvidenceEvaluationItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  evaluation_id!: string;

  @Column({ type: 'bigint' })
  enrichment_item_id!: string;

  @Column({ type: 'bigint' })
  extraction_skill_id!: string;

  @Column({ type: 'varchar', length: 200 })
  normalized_name!: string;

  @Column({ type: 'int' })
  evidence_count!: number;

  @Column({ type: 'int' })
  unique_evidence_count!: number;

  @Column({ type: 'int' })
  applied_evidence_count!: number;

  @Column({ type: 'int' })
  source_diversity!: number;

  @Column({ type: 'int' })
  repeated_mention_count!: number;

  @Column({ type: 'int', default: 0 })
  substantive_evidence_count!: number;

  @Column({ type: 'int', default: 0 })
  listing_evidence_count!: number;

  @Column({ type: 'int', default: 0 })
  ambiguous_evidence_count!: number;

  @Column({ type: 'boolean', default: false })
  has_work_experience!: boolean;

  @Column({ type: 'boolean', default: false })
  has_project!: boolean;

  @Column({ type: 'boolean', default: false })
  has_achievement!: boolean;

  @Column({ type: 'boolean', default: false })
  has_responsibility!: boolean;

  @Column({ type: 'boolean', default: false })
  has_certification!: boolean;

  @Column({ type: 'boolean', default: false })
  has_education!: boolean;

  @Column({ type: 'boolean', default: false })
  has_profile_summary!: boolean;

  @Column({ type: 'boolean', default: false })
  has_skills_section!: boolean;

  @Column({ type: 'boolean', default: false })
  has_other!: boolean;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  evidence_strength!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  evidence_confidence!: string;

  @Column({ type: 'varchar', length: 20 })
  evidence_level!: EvidenceLevel;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  quality_flags!: EvidenceQualityFlag[];

  @Column({ type: 'jsonb' })
  source_breakdown!: Record<string, number>;

  @Column({ type: 'jsonb' })
  scoring_breakdown!: Record<string, unknown>;

  @Column({ type: 'text' })
  explanation!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
