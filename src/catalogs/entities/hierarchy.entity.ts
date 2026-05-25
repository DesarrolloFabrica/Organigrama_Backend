import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Niveles jerárquicos definidos en Core.
 * Core solo almacena: id, name, description, level.
 * No tiene is_active, created_at ni updated_at.
 */
@Entity({
  name: 'hierarchy',
  schema: 'core',
})
export class Hierarchy {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** Numero de nivel jerarquico (1 = mas alto). */
  @Column({ type: 'smallint', nullable: true })
  level: number | null;
}
