import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'cv_extraction_skill', schema: 'organigrama' })
export class CvExtractionSkill {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'bigint' })
  skill_id!: string;

  @Column({ type: 'varchar', length: 200 })
  original_name!: string;

  @Column({ type: 'varchar', length: 200 })
  category!: string;

  @Column({ type: 'numeric', precision: 4, scale: 3 })
  confidence!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  level!: string | null;

  @Column({ type: 'text' })
  evidence!: string;

  /**
   * Citas por skill (Fase B). NULL en filas antiguas.
   * Forma: [{ sourceType, evidenceText, occurrenceIndex, isFallback? }]
   */
  @Column({ type: 'jsonb', nullable: true })
  evidence_items!: Record<string, unknown>[] | null;

  @Column({ type: 'boolean', default: true })
  is_explicit!: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
