import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../person/entities/person.entity';
import {
  isCollaboratorEduEmail,
  normalizeInstitutionalEmail,
} from './auth-email.util';
import type { AuthUserResponse, GoogleLoginResponse, JwtPayload } from './auth.types';
import type { AuthenticatedSessionContext } from './types/authenticated-session.context';
import { GoogleTokenService } from './google-token.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    private readonly googleTokenService: GoogleTokenService,
    private readonly jwtService: JwtService,
  ) {}

  async loginWithGoogleIdToken(idToken: string): Promise<GoogleLoginResponse> {
    const identity = await this.googleTokenService.verifyIdToken(idToken);
    const person = await this.resolveCollaboratorByGoogleEmail(identity.email);

    const session: JwtPayload = {
      personId: String(person.id),
      googleSubject: identity.subject,
      googlePictureUrl: identity.pictureUrl,
      googleEmail: identity.email,
    };

    const accessToken = await this.jwtService.signAsync(session);

    return {
      accessToken,
      user: this.toAuthUserResponse(person, identity.email, identity.pictureUrl),
    };
  }

  async getUserFromSession(
    session: AuthenticatedSessionContext,
  ): Promise<AuthUserResponse> {
    const person = await this.persons.findOne({
      where: { id: session.personId, is_active: true },
    });

    if (!person?.edu_email || !isCollaboratorEduEmail(person.edu_email)) {
      throw new UnauthorizedException('Sesión inválida');
    }

    return this.toAuthUserResponse(
      person,
      session.googleEmail ?? person.edu_email,
      session.googlePictureUrl ?? null,
    );
  }

  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Sesión expirada o inválida');
    }
  }

  private async resolveCollaboratorByGoogleEmail(
    googleEmail: string,
  ): Promise<Person> {
    const normalized = normalizeInstitutionalEmail(googleEmail);
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

    if (!isCollaboratorEduEmail(person.edu_email!)) {
      throw new ForbiddenException(
        'Acceso restringido a colaboradores registrados en el organigrama',
      );
    }

    return person;
  }

  private toAuthUserResponse(
    person: Person,
    googleEmail: string,
    pictureUrl: string | null,
  ): AuthUserResponse {
    return {
      personId: String(person.id),
      fullName: person.full_name,
      eduEmail: person.edu_email,
      googleEmail,
      pictureUrl,
    };
  }
}
