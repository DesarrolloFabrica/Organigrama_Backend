import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Ciudades de Core.
 * Core solo tiene: id, name, is_active.
 * No tiene region_id, created_at ni updated_at.
 */
@Entity({
  name: 'city',
  schema: 'core',
})
export class City {
  @PrimaryColumn({ type: 'bigint' })
  id: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'boolean', nullable: true })
  is_active: boolean | null;
}
