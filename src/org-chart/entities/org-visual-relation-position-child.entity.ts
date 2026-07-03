import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Hijos colgados de una POSICIÓN visual específica (arista), no de una persona.
 *
 * `org_visual_relation` conecta hijos por `parent_person_id`, lo que falla
 * cuando la misma persona aparece dos veces en una versión con posiciones/roles
 * distintos (p. ej. Dana Valbuena como LIDER bajo Andrés y como COORDINADORA
 * TEMPORAL bajo Raúl). Esta tabla permite que cada posición (identificada por
 * `org_visual_relation.id`) tenga su propio equipo.
 *
 * Regla de lectura del backend:
 *   1. Si el nodo tiene `relation_id` y existen hijos activos aquí para
 *      (version_id, parent_relation_id = node.relation_id), se usan esos hijos.
 *   2. Si no existen, se mantiene el comportamiento actual: hijos en
 *      `org_visual_relation` por `parent_person_id`.
 *
 * No modifica core.person ni reemplaza org_visual_relation.
 */
@Entity({ name: 'org_visual_relation_position_child', schema: 'organigrama' })
@Unique(['version_id', 'parent_relation_id', 'child_person_id'])
export class OrgVisualRelationPositionChild {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'bigint' })
  version_id!: string;

  /** Posición padre: `org_visual_relation.id` (no `person_id`). */
  @Column({ type: 'bigint' })
  parent_relation_id!: string;

  @Column({ type: 'bigint' })
  child_person_id!: string;

  @Column({ type: 'varchar', length: 50, default: 'DIRECT_REPORT' })
  relation_type!: string;

  @Column({ type: 'integer', nullable: true })
  visual_level!: number | null;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  @CreateDateColumn({ type: 'timestamp', default: () => 'NOW()' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'NOW()' })
  updated_at!: Date;
}
