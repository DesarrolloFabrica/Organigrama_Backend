import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Area } from '../catalogs/entities/area.entity';
import { Hierarchy } from '../catalogs/entities/hierarchy.entity';
import { Program } from '../catalogs/entities/program.entity';
import { Role } from '../catalogs/entities/role.entity';
import { School } from '../catalogs/entities/school.entity';
import {
  isCollaboratorEduEmail,
  normalizeInstitutionalEmail,
} from '../auth/auth-email.util';
import { Person } from '../person/entities/person.entity';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { PersonProfileState } from './entities/person-profile-state.entity';
import { ProfileCompletionService } from './profile-completion.service';
import type { AuthenticatedSessionContext } from '../auth/types/authenticated-session.context';
import { OrgChartService } from '../org-chart/org-chart.service';
import { PhotoCacheService } from '../org-chart/photos/photo-cache.service';
import { getApiPublicBaseUrl, isOrgChartPhotosEnabled } from '../org-chart/photos/photo.config';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from './profile-photo.constants';
import type {
  ProfileEmergencyContactResponse,
  ProfileMeResponse,
  ProfilePhotoResponse,
} from './types/profile-me.response';

@Injectable()
export class ProfileService {
  constructor(
    @InjectRepository(Person)
    private readonly persons: Repository<Person>,
    @InjectRepository(PersonProfileState)
    private readonly profileStates: Repository<PersonProfileState>,
    @InjectRepository(Role)
    private readonly roles: Repository<Role>,
    @InjectRepository(Hierarchy)
    private readonly hierarchies: Repository<Hierarchy>,
    @InjectRepository(Area)
    private readonly areas: Repository<Area>,
    @InjectRepository(School)
    private readonly schools: Repository<School>,
    @InjectRepository(Program)
    private readonly programs: Repository<Program>,
    private readonly completion: ProfileCompletionService,
    private readonly photoCache: PhotoCacheService,
    @Inject(forwardRef(() => OrgChartService))
    private readonly orgChartService: OrgChartService,
  ) {}

  async savePhotoFromGoogle(
    session: AuthenticatedSessionContext,
  ): Promise<ProfileMeResponse> {
    const pictureUrl = session.googlePictureUrl?.trim();
    if (!pictureUrl) {
      throw new BadRequestException(
        'No hay foto de Google en la sesión. Cierra sesión e inicia de nuevo con Google.',
      );
    }

    const personId = session.personId;
    const person = await this.requireActiveCollaborator(personId);
    const state = await this.ensureProfileState(personId);

    state.profile_photo_source = PROFILE_PHOTO_SOURCE_GOOGLE;
    state.profile_photo_url = pictureUrl;
    state.profile_updated_by_user_at = new Date();

    await this.profileStates.save(state);

    this.photoCache.invalidateForPerson(personId);
    this.orgChartService.clearResponseCaches();

    return this.buildProfileResponse(person, state);
  }

  async getProfileMe(personId: string): Promise<ProfileMeResponse> {
    const person = await this.requireActiveCollaborator(personId);
    const state = await this.ensureProfileState(personId);
    return this.buildProfileResponse(person, state);
  }

  async getEmergencyContactForPerson(
    personId: string,
  ): Promise<ProfileEmergencyContactResponse> {
    const person = await this.persons.findOne({ where: { id: personId } });
    return this.toEmergencyContact(person);
  }

  async updateProfileMe(
    personId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileMeResponse> {
    const person = await this.requireActiveCollaborator(personId);
    const state = await this.ensureProfileState(personId);

    if (dto.document !== undefined) {
      person.document = this.normalizeDocument(dto.document);
    }

    if (dto.phone !== undefined) {
      person.phone = this.normalizePhone(dto.phone);
    }

    if (dto.email !== undefined) {
      person.email = this.normalizeOptionalEmail(dto.email);
    }

    if (dto.address !== undefined) {
      person.address = this.normalizeOptionalText(dto.address, 250);
    }

    if (dto.emergency_contact_name !== undefined) {
      person.emergency_contact_name = this.normalizeRequiredText(
        dto.emergency_contact_name,
        150,
        'El nombre del contacto de emergencia es obligatorio',
        true,
      );
    }

    if (dto.emergency_contact_phone !== undefined) {
      person.emergency_contact_phone = this.normalizeRequiredText(
        dto.emergency_contact_phone,
        50,
        'El teléfono del contacto de emergencia es obligatorio',
        true,
      );
    }

    if (dto.emergency_contact_relationship !== undefined) {
      person.emergency_contact_relationship = this.normalizeRequiredText(
        dto.emergency_contact_relationship,
        80,
        'El parentesco del contacto de emergencia es obligatorio',
        true,
      );
    }

    await this.persons.save(person);

    state.profile_updated_by_user_at = new Date();

    if (dto.markCompleted === true) {
      if (!this.completion.canMarkProfileComplete(person)) {
        throw new BadRequestException({
          message: 'Completa los campos obligatorios antes de continuar',
          missingFields: this.completion.listMissingFields(person),
        });
      }

      state.profile_completed_at = new Date();
    }

    await this.profileStates.save(state);

    return this.buildProfileResponse(person, state);
  }

  async resetOnboardingByEduEmail(eduEmail: string): Promise<{ personId: string }> {
    const normalized = normalizeInstitutionalEmail(eduEmail);
    if (!normalized) {
      throw new BadRequestException('edu_email inválido');
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
      throw new NotFoundException(
        `No se encontró colaborador activo con edu_email equivalente a ${eduEmail}`,
      );
    }

    const personId = String(person.id);
    let state = await this.profileStates.findOne({
      where: { person_id: personId },
    });

    if (!state) {
      state = this.profileStates.create({ person_id: personId });
    }

    state.profile_completed_at = null;
    state.profile_updated_by_user_at = null;
    state.profile_photo_source = null;
    state.profile_photo_url = null;

    await this.profileStates.save(state);

    return { personId };
  }

  private async requireActiveCollaborator(personId: string): Promise<Person> {
    const person = await this.persons.findOne({
      where: { id: personId, is_active: true },
    });

    if (!person?.edu_email || !isCollaboratorEduEmail(person.edu_email)) {
      throw new UnauthorizedException('Sesión inválida para perfil');
    }

    return person;
  }

  private async ensureProfileState(personId: string): Promise<PersonProfileState> {
    const existing = await this.profileStates.findOne({
      where: { person_id: personId },
    });

    if (existing) {
      return existing;
    }

    return this.profileStates.save(
      this.profileStates.create({
        person_id: personId,
        profile_completed_at: null,
        profile_updated_by_user_at: null,
        profile_photo_source: null,
        profile_photo_url: null,
      }),
    );
  }

  private async buildProfileResponse(
    person: Person,
    state: PersonProfileState,
  ): Promise<ProfileMeResponse> {
    const [role, hierarchy, area, school, program] = await Promise.all([
      person.role_id
        ? this.roles.findOne({ where: { id: person.role_id } })
        : null,
      person.hierarchy_id
        ? this.hierarchies.findOne({ where: { id: person.hierarchy_id } })
        : null,
      person.area_id
        ? this.areas.findOne({ where: { id: person.area_id } })
        : null,
      person.school_id
        ? this.schools.findOne({ where: { id: person.school_id } })
        : null,
      person.program_id
        ? this.programs.findOne({ where: { id: person.program_id } })
        : null,
    ]);

    const missingFields = this.completion.listMissingFields(person);
    const profileCompleted =
      this.completion.isProfileCompleted(state.profile_completed_at) &&
      missingFields.length === 0;

    return {
      personId: String(person.id),
      profileCompleted,
      missingFields,
      profileUpdatedByUserAt: state.profile_updated_by_user_at
        ? state.profile_updated_by_user_at.toISOString()
        : null,
      profileCompletedAt: state.profile_completed_at
        ? state.profile_completed_at.toISOString()
        : null,
      photo: this.toProfilePhotoResponse(String(person.id), state),
      editable: {
        document: person.document ?? '',
        phone: person.phone,
        email: person.email,
        address: person.address,
        emergencyContact: this.toEmergencyContact(person),
      },
      readonly: {
        type_document: person.type_document,
        full_name: person.full_name,
        edu_email: person.edu_email,
        role: this.toCatalogRef(role),
        hierarchy: this.toCatalogRef(hierarchy),
        area: this.toCatalogRef(area),
        school: this.toCatalogRef(school),
        program: this.toCatalogRef(program),
      },
    };
  }

  private toProfilePhotoResponse(
    personId: string,
    state: PersonProfileState,
  ): ProfilePhotoResponse {
    const source = state.profile_photo_source;
    const hasGoogle =
      source === PROFILE_PHOTO_SOURCE_GOOGLE &&
      Boolean(state.profile_photo_url?.trim());

    if (!hasGoogle || !isOrgChartPhotosEnabled()) {
      return { source: hasGoogle ? PROFILE_PHOTO_SOURCE_GOOGLE : null, photoUrl: null };
    }

    return {
      source: PROFILE_PHOTO_SOURCE_GOOGLE,
      photoUrl: `${getApiPublicBaseUrl()}/api/org-chart/photos/${personId}`,
    };
  }

  private toEmergencyContact(
    person: Person | null,
  ): ProfileEmergencyContactResponse {
    return {
      name: person?.emergency_contact_name ?? null,
      phone: person?.emergency_contact_phone ?? null,
      relationship: person?.emergency_contact_relationship ?? null,
    };
  }

  private toCatalogRef(
    row: { id: string | number; name?: string | null } | null,
  ): ProfileMeResponse['readonly']['role'] {
    if (!row) {
      return null;
    }

    return {
      id: String(row.id),
      name: row.name ?? null,
    };
  }

  private normalizeDocument(value: string): string {
    const trimmed = value.trim();

    if (!this.completion.isDocumentValid(trimmed)) {
      throw new BadRequestException(
        'El documento debe contener solo números y al menos 6 dígitos',
      );
    }

    if (trimmed.length > 80) {
      throw new BadRequestException('El documento excede la longitud permitida');
    }

    return trimmed;
  }

  private normalizePhone(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new BadRequestException('El teléfono es obligatorio');
    }

    if (trimmed.length > 50) {
      throw new BadRequestException('El teléfono excede la longitud permitida');
    }

    return trimmed;
  }

  private normalizeOptionalEmail(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.length > 180) {
      throw new BadRequestException('El correo excede la longitud permitida');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new BadRequestException('Formato de correo inválido');
    }

    return trimmed.toLowerCase();
  }

  private normalizeOptionalText(value: string, maxLen: number): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.length > maxLen) {
      throw new BadRequestException('El texto excede la longitud permitida');
    }

    return trimmed;
  }

  private normalizeRequiredText(
    value: string,
    maxLen: number,
    emptyMessage: string,
    allowEmpty: boolean,
  ): string | null {
    const trimmed = value.trim();

    if (!trimmed) {
      if (allowEmpty) {
        return null;
      }
      throw new BadRequestException(emptyMessage);
    }

    if (trimmed.length > maxLen) {
      throw new BadRequestException('El texto excede la longitud permitida');
    }

    return trimmed;
  }
}
