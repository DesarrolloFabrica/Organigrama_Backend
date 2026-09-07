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
 *   ORG_READ_ALL          — visibilidad total del organigrama sin redacción
 *   ORG_ADMIN             — permiso de administración técnica de la aplicación
 *   ORG_CONTACT_READ_ALL  — teléfono (`phone`) de cualquier persona visible en el
 *                           organigrama, SIN levantar el resto de la redacción.
 *                           No es alias ni subtipo de ORG_READ_ALL: quien solo lo
 *                           tenga sigue siendo usuario estándar para toda otra
 *                           política (ficha, CV, competencias, eventos, versiones).
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
  CONTACT_READ_ALL: 'ORG_CONTACT_READ_ALL',
} as const;

export type OrgPermissionCode =
  (typeof ORG_PERMISSION)[keyof typeof ORG_PERMISSION];
