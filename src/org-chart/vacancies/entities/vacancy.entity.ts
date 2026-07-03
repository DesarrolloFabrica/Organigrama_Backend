import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Vacante gestionada en el schema externo `vacancies`.
 *
 * Organigrama SOLO lee esta tabla (no inserta ni sincroniza).
 * La fuente de verdad de las vacantes vive en `vacancies.vacancy`.
 */
@Entity({
  name: 'vacancy',
  schema: 'vacancies',
})
export class Vacancy {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  /** Área asociada (referencia a core.area.id). */
  @Column({ type: 'bigint', nullable: true })
  area_id: string | null;

  /** Escuela asociada (referencia a core.school.id). */
  @Column({ type: 'bigint', nullable: true })
  school_id: string | null;

  /** Programa asociado (referencia a core.program.id). */
  @Column({ type: 'bigint', nullable: true })
  program_id: string | null;

  /** Nombre del cargo de la vacante. */
  @Column({ type: 'varchar', nullable: true })
  position_name: string | null;

  /** Línea curricular asociada a la vacante. */
  @Column({ type: 'varchar', nullable: true })
  curricular_line: string | null;

  /** Cantidad de vacantes solicitadas. */
  @Column({ type: 'int', nullable: true })
  quantity: number | null;

  /** Estado operativo del proceso de la vacante. */
  @Column({ type: 'varchar', nullable: true })
  operation_status: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
