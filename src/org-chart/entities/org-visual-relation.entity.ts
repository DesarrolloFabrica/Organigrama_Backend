import { Column, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

/**
 * Relación visual del organigrama.
 *
 * Esta tabla NO reemplaza a Core.
 * Solo define cómo el proyecto Organigrama interpreta la relación padre → hijo.
 */
@Entity({ name: 'org_visual_relation', schema: 'organigrama' })
@Unique(['parent_person_id', 'child_person_id'])
export class OrgVisualRelation {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  parent_person_id!: string;

  @Column({ type: 'bigint' })
  child_person_id!: string;

  @Column({ type: 'varchar', length: 50, default: 'DIRECT_REPORT' })
  relation_type!: string;

  @Column({ type: 'integer', nullable: true })
  visual_level!: number | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  created_at!: Date;

  @Column({ type: 'timestamp', default: () => 'NOW()' })
  updated_at!: Date;
}
