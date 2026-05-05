import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  /**
   * Relación jerárquica propia del organigrama.
   *
   * Esta tabla permite definir quién depende de quién sin alterar la tabla `person`.
   * Más adelante podrá alimentarse desde el core o desde reglas de inferencia.
   */
  @Entity('org_relation')
  @Index(['parent_person_id'])
  @Index(['child_person_id'])
  @Index(['is_active'])
  export class OrgRelation {
    /** ID interno de la relación. */
    @PrimaryGeneratedColumn('increment', { type: 'bigint' })
    id: string;
  
    /** Persona jefe / nodo padre. */
    @Column({ type: 'bigint' })
    parent_person_id: string;
  
    /** Persona subordinada / nodo hijo. */
    @Column({ type: 'bigint' })
    child_person_id: string;
  
    /** Nivel jerárquico del subordinado dentro del árbol. */
    @Column({ type: 'bigint', nullable: true })
    hierarchy_id: string | null;
  
    /** Rol/cargo del subordinado al momento de crear la relación. */
    @Column({ type: 'bigint', nullable: true })
    role_id: string | null;
  
    /** Área asociada a la relación. */
    @Column({ type: 'bigint', nullable: true })
    area_id: string | null;
  
    /** Escuela asociada a la relación. */
    @Column({ type: 'bigint', nullable: true })
    school_id: string | null;
  
    /** Programa asociado a la relación. */
    @Column({ type: 'bigint', nullable: true })
    program_id: string | null;
  
    /** Indica si esta relación está vigente. */
    @Column({ type: 'boolean', default: true })
    is_active: boolean;
  
    /** Fecha desde la cual aplica esta relación. */
    @Column({ type: 'date', nullable: true })
    start_date: string | null;
  
    /** Fecha en la que dejó de aplicar esta relación. */
    @Column({ type: 'date', nullable: true })
    end_date: string | null;
  
    /** Motivo del cambio o cierre de la relación. */
    @Column({ type: 'varchar', length: 500, nullable: true })
    change_reason: string | null;
  
    /** Fecha de creación del registro. */
    @CreateDateColumn({ type: 'timestamptz' })
    created_at: Date;
  
    /** Fecha de última actualización del registro. */
    @UpdateDateColumn({ type: 'timestamptz' })
    updated_at: Date;
  }