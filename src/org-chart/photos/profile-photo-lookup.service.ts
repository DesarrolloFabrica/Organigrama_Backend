import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from '../../profile/profile-photo.constants';
import { PersonProfileState } from '../../profile/entities/person-profile-state.entity';

@Injectable()
export class ProfilePhotoLookupService {
  constructor(
    @InjectRepository(PersonProfileState)
    private readonly profileStates: Repository<PersonProfileState>,
  ) {}

  async findGooglePhotoState(
    personId: string,
  ): Promise<PersonProfileState | null> {
    const state = await this.profileStates.findOne({
      where: { person_id: personId },
    });

    if (
      !state ||
      state.profile_photo_source !== PROFILE_PHOTO_SOURCE_GOOGLE ||
      !state.profile_photo_url?.trim()
    ) {
      return null;
    }

    return state;
  }

  async hasPersistedGooglePhoto(personId: string): Promise<boolean> {
    return (await this.findGooglePhotoState(personId)) != null;
  }

  /** Ids con foto Google persistida (una consulta por petición de árbol). */
  async findAllGooglePhotoPersonIds(): Promise<string[]> {
    const rows = await this.profileStates.find({
      where: { profile_photo_source: PROFILE_PHOTO_SOURCE_GOOGLE },
      select: ['person_id', 'profile_photo_url'],
    });

    return rows
      .filter((row) => Boolean(row.profile_photo_url?.trim()))
      .map((row) => String(row.person_id));
  }
}
