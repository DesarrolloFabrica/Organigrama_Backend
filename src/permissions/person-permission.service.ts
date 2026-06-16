import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonPermission } from './entities/person-permission.entity';

/**
 * Carga y expone los permisos técnicos de aplicación de una persona.
 *
 * Fuentes (se combinan y deduplicán):
 *  1. Tabla core.person_permission (persistente, gestionada con npm run org:grant-admin)
 *  2. Variable de entorno ORG_ADMIN_EMAILS (fallback de arranque, no persistente)
 *
 * IMPORTANTE: los permisos se incluyen en el JWT al hacer login. Si se modifican
 * en core.person_permission, el usuario debe cerrar sesión y volver a iniciar
 * para que el JWT y sessionStorage reflejen el cambio.
 *
 * La seguridad real vive en el backend. El frontend solo usa los permisos para
 * decisiones de UI.
 */
@Injectable()
export class PersonPermissionService {
  private readonly log = new Logger(PersonPermissionService.name);

  constructor(
    @InjectRepository(PersonPermission)
    private readonly repo: Repository<PersonPermission>,
    private readonly config: ConfigService,
  ) {}

  /**
   * Devuelve la lista deduplicada de permisos para la persona dada.
   * Combina los registros de core.person_permission con el fallback ORG_ADMIN_EMAILS.
   */
  async getPermissionsForPerson(
    personId: string,
    eduEmail: string,
  ): Promise<string[]> {
    const dbRows = await this.repo.find({
      where: { person_id: personId },
      select: ['permission_code'],
    });
    const dbCodes = dbRows.map((r) => r.permission_code);

    const envCodes = this.getEnvPermissions(eduEmail);

    const merged = Array.from(new Set([...dbCodes, ...envCodes]));

    if (merged.length > 0) {
      this.log.log(
        `[OrgAccess] user ${eduEmail} permissions=${merged.join(',')}`,
      );
    }

    return merged;
  }

  /** Comprueba si un array de permisos contiene el código dado. */
  static hasPermission(permissions: string[], code: string): boolean {
    return permissions.includes(code);
  }

  /** Devuelve los permisos concedidos vía ORG_ADMIN_EMAILS (fallback de arranque). */
  private getEnvPermissions(eduEmail: string): string[] {
    const raw = this.config.get<string>('ORG_ADMIN_EMAILS', '');
    if (!raw?.trim()) {
      return [];
    }

    const normalizedInput = eduEmail.trim().toLowerCase();
    const adminEmails = raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (!adminEmails.includes(normalizedInput)) {
      return [];
    }

    return ['ORG_READ_ALL', 'ORG_ADMIN'];
  }
}
