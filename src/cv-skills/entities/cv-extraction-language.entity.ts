import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'cv_extraction_language', schema: 'organigrama' })
export class CvExtractionLanguage {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  extraction_id!: string;

  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'varchar', length: 140 })
  name_key!: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  level!: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_certified!: boolean | null;

  @Column({ type: 'text' })
  evidence!: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;
}
