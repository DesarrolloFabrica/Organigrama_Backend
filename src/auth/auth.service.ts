import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import { normalizeInstitutionalEmail } from './auth-email.util';
import type {
  AuthUserResponse,
  GoogleLoginResponse,
  JwtPayload,
} from './auth.types';
import type { AuthenticatedSessionContext } from './types/authenticated-session.context';
import { CentralLoginLogService } from './central-login-log.service';
import { GoogleTokenService } from './google-token.service';
import { PersonPermissionService } from '../permissions/person-permission.service';
import { ProfilePhotoSyncService } from '../profile/profile-photo-sync.service';

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    private readonly googleTokenService: GoogleTokenService,
    private readonly jwtService: JwtService,
    private readonly permissionService: PersonPermissionService,
    private readonly profilePhotoSync: ProfilePhotoSyncService,
    private readonly centralLoginLogs: CentralLoginLogService,
  ) {}

  async loginWithGoogleIdToken(idToken: string): Promise<GoogleLoginResponse> {
    const identity = await this.googleTokenService.verifyIdToken(idToken);
    const person = await this.resolvePersonByInstitutionalEmail(identity.email);

    return this.issueLoginResponse(person, {
      googleSubject: identity.subject,
      googleEmail: identity.email,
      googlePictureUrl: identity.pictureUrl,
    });
  }

  async loginWithDevEmail(email: string): Promise<GoogleLoginResponse> {
    const trimmed = email?.trim();
    if (!trimmed) {
      throw new BadRequestException('El correo es obligatorio');
    }

    const person = await this.resolvePersonByInstitutionalEmail(trimmed);

    return this.issueLoginResponse(person, {
      googleSubject: `dev:${person.id}`,
      googleEmail: trimmed,
      googlePictureUrl: null,
    });
  }

  async getUserFromSession(
    session: AuthenticatedSessionContext,
  ): Promise<AuthUserResponse> {
    const person = await this.persons.findOne({
      where: { id: session.personId, is_active: true },
    });

    if (!person?.edu_email) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return this.toAuthUserResponse(
      person,
      session.googleEmail ?? person.edu_email,
      session.googlePictureUrl ?? null,
      session.permissions ?? [],
    );
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida');
    }
  }

  private async issueLoginResponse(
    person: Person,
    identity: {
      googleSubject: string;
      googleEmail: string;
      googlePictureUrl: string | null;
    },
  ): Promise<GoogleLoginResponse> {
    const permissions = await this.permissionService.getPermissionsForPerson(
      String(person.id),
      person.edu_email ?? '',
    );

    const session: JwtPayload = {
      personId: String(person.id),
      googleSubject: identity.googleSubject,
      googlePictureUrl: identity.googlePictureUrl,
      googleEmail: identity.googleEmail,
      eduEmail: person.edu_email,
      permissions,
    };

    await this.profilePhotoSync.syncGooglePhotoOnLogin(
      String(person.id),
      identity.googleEmail,
      identity.googlePictureUrl,
    );

    const accessToken = await this.jwtService.signAsync(session);

    this.centralLoginLogs.record(
      identity.googleEmail ?? person.edu_email ?? '',
      'organigrama',
    );

    return {
      accessToken,
      user: this.toAuthUserResponse(
        person,
        identity.googleEmail,
        identity.googlePictureUrl,
        permissions,
      ),
    };
  }

  private async resolvePersonByInstitutionalEmail(
    email: string,
  ): Promise<Person> {
    const normalized = normalizeInstitutionalEmail(email);
    if (!normalized) {
      throw new ForbiddenException(
        'Solo pueden acceder cuentas institucionales @cun.edu.co',
      );
    }

    const person = await this.persons
      .createQueryBuilder('p')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.edu_email IS NOT NULL')
      .andWhere(
        `LOWER(REPLACE(SPLIT_PART(p.edu_email, '@', 1), '.', '_') || '@' || SPLIT_PART(LOWER(p.edu_email), '@', 2)) = :normalized`,
        { normalized },
      )
      .getOne();

    if (!person) {
      throw new ForbiddenException(
        'No tienes acceso: tu correo no está registrado en el organigrama',
      );
    }

    return person;
  }

  private toAuthUserResponse(
    person: Person,
    googleEmail: string,
    pictureUrl: string | null,
    permissions: string[] = [],
  ): AuthUserResponse {
    return {
      personId: String(person.id),
      fullName: person.full_name,
      eduEmail: person.edu_email,
      googleEmail,
      pictureUrl,
      permissions,
    };
  }
}
