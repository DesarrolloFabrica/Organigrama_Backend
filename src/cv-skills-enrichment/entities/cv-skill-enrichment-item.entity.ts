import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type EnrichmentItemStatus = 'OK' | 'EMPTY' | 'FILLED_EMPTY' | 'FAILED';

@Entity({ name: 'cv_skill_enrichment_item', schema: 'organigrama' })
export class CvSkillEnrichmentItem {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  enrichment_id!: string;

  @Column({ type: 'bigint' })
  extraction_skill_id!: string;

  @Column({ type: 'varchar', length: 200 })
  normalized_name!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evidence_items!: Record<string, unknown>[];

  @Column({ type: 'int', default: 0 })
  evidence_count!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  source_types!: string[];

  @Column({ type: 'jsonb', nullable: true })
  warnings!: string[] | null;

  @Column({ type: 'varchar', length: 20 })
  status!: EnrichmentItemStatus;

  @Column({ type: 'boolean', default: false })
  was_filled_empty!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
