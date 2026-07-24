import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  AttributeSupportLevel,
  MacroattributeQualityFlag,
} from '../cv-attributes.types';

@Entity({ name: 'cv_macroattribute_result', schema: 'organigrama' })
export class CvMacroattributeResult {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  attribute_run_id!: string;

  @Column({ type: 'bigint' })
  macroattribute_id!: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  score!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  confidence!: string;

  @Column({ type: 'numeric', precision: 5, scale: 4 })
  coverage!: string;

  @Column({ type: 'varchar', length: 20 })
  level!: AttributeSupportLevel;

  @Column({ type: 'int' })
  supported_subattributes_count!: number;

  @Column({ type: 'int' })
  total_subattributes_count!: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  quality_flags!: MacroattributeQualityFlag[];

  @Column({ type: 'jsonb' })
  scoring_breakdown!: Record<string, unknown>;

  @Column({ type: 'text' })
  explanation!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
