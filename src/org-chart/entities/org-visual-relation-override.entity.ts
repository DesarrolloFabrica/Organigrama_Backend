import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Override visual por RELACIÓN específica y versión del organigrama.
 *
 * A diferencia de `org_chart_person_override` (override por persona/versión),
 * este override aplica a una arista concreta `org_visual_relation.id`, por lo
 * que la misma persona puede mostrar rol/estado distinto según quién sea su
 * padre en esa versión. No modifica core.person ni org_chart_person_override.
 */
@Entity({ name: 'org_visual_relation_override', schema: 'organigrama' })
export class OrgVisualRelationOverride {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  version_id!: string;

  @Column({ type: 'bigint' })
  relation_id!: string;

  /** Cargo efectivo para esta relación. Si es NULL, se usa el rol base. */
  @Column({ type: 'bigint', nullable: true })
  role_id_override!: string | null;

  /** Estado de asignación visible, p. ej. PERMANENT | TEMPORAL | MATERNITY_LEAVE. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  assignment_status!: string | null;

  /** Etiqueta visible de la asignación para esta posición específica. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  assignment_label!: string | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
