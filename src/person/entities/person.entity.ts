import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Tabla espejo provisional del core.
 *
 * IMPORTANTE:
 * La nomenclatura de columnas respeta el core de información
 * para facilitar la integración futura.
 */
@Entity('person')
@Index(['document'])
@Index(['hierarchy_id'])
@Index(['role_id'])
@Index(['area_id', 'school_id', 'program_id'])
export class Person {
  /**
   * ID interno de la persona.
   * En esta fase se genera como identidad numérica.
   */
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id: string;

  /** ID del tipo de contrato asociado a la persona. */
  @Column({ type: 'bigint', nullable: true })
  contract_type_id: string | null;

  /** ID del área organizacional. */
  @Column({ type: 'bigint', nullable: true })
  area_id: string | null;

  /** ID de la escuela asociada. */
  @Column({ type: 'bigint', nullable: true })
  school_id: string | null;

  /** ID del programa asociado. */
  @Column({ type: 'bigint', nullable: true })
  program_id: string | null;

  /** ID de la ciudad asociada. */
  @Column({ type: 'bigint', nullable: true })
  city_id: string | null;

  /** Nivel jerárquico: 1 director, 2 coordinador, etc. */
  @Column({ type: 'bigint', nullable: true })
  hierarchy_id: string | null;

  /** Nivel jerárquico temporal o alternativo, si aplica. */
  @Column({ type: 'bigint', nullable: true })
  hierarchy_temp_id: string | null;

  /** ID del rol/cargo. */
  @Column({ type: 'bigint', nullable: true })
  role_id: string | null;

  /** Género de la persona. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  gender: string | null;

  /** Fecha de nacimiento. */
  @Column({ type: 'date', nullable: true })
  born_date: string | null;

  /** Ciudad de nacimiento. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  born_city: string | null;

  /** Correo personal o principal. */
  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  /** Correo institucional educativo. */
  @Column({ type: 'varchar', length: 180, nullable: true })
  edu_email: string | null;

  /** Tipo de documento. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  type_document: string | null;

  /** Número de documento. Dato visible e identificador institucional. */
  @Column({ type: 'varchar', length: 80, nullable: false })
  document: string;

  /** Teléfono de contacto. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  phone: string | null;

  /** Dirección de residencia o contacto. */
  @Column({ type: 'varchar', length: 250, nullable: true })
  address: string | null;

  /** Nombre completo de la persona. */
  @Column({ type: 'varchar', length: 250, nullable: false })
  full_name: string;

  /** Estado civil. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  marital_status: string | null;

  /** ID de la región. */
  @Column({ type: 'integer', nullable: true })
  region_id: number | null;

  /** ID del campus. */
  @Column({ type: 'integer', nullable: true })
  campus_id: number | null;

  /** Fecha de creación del registro en esta BD provisional. */
  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  /** Fecha de última actualización del registro. */
  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}
