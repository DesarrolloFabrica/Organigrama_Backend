import {
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Permisos técnicos de aplicación por persona.
 * Tabla: core.person_permission
 *
 * No relacionada con la jerarquía visual del organigrama.
 * Un usuario con permisos técnicos NO debe insertarse en
 * organigrama.org_visual_relation.
 *
 * Códigos válidos:
 *   ORG_READ_ALL  — visibilidad total del organigrama sin redacción
 *   ORG_ADMIN     — permiso de administración técnica de la aplicación
 */
@Entity({ name: 'person_permission', schema: 'core' })
export class PersonPermission {
  @PrimaryColumn({ name: 'person_id', type: 'bigint' })
  person_id: string;

  @PrimaryColumn({ name: 'permission_code', type: 'varchar', length: 100 })
  permission_code: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updated_at: Date;
}

export const ORG_PERMISSION = {
  READ_ALL: 'ORG_READ_ALL',
  ADMIN: 'ORG_ADMIN',
} as const;

export type OrgPermissionCode =
  (typeof ORG_PERMISSION)[keyof typeof ORG_PERMISSION];
