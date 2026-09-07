import { ProfilePhotoSyncService } from './profile-photo-sync.service';
import { PersonProfileState } from './entities/person-profile-state.entity';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from './profile-photo.constants';

describe('ProfilePhotoSyncService', () => {
  const googleUrl = 'https://lh3.googleusercontent.com/a/heidy';
  let saved: PersonProfileState | null;
  let service: ProfilePhotoSyncService;
  let invalidateForPerson: jest.Mock;

  function createService(existing: Partial<PersonProfileState> | null) {
    saved = null;
    invalidateForPerson = jest.fn();
    const repo = {
      findOne: jest.fn().mockResolvedValue(existing),
      create: jest.fn((row: PersonProfileState) => row),
      save: jest.fn(async (row: PersonProfileState) => {
        saved = row;
        return row;
      }),
    };
    service = new ProfilePhotoSyncService(repo as never, {
      invalidateForPerson,
    } as never);
  }

  it('overwrites a packaged upload path so Google can restore the photo', async () => {
    createService({
      person_id: '1141',
      profile_photo_source: 'upload',
      profile_photo_url: '/public/profile-photos/1141.webp',
    });

    await service.syncGooglePhotoOnLogin(
      '1141',
      'heidy_quiroga@cun.edu.co',
      googleUrl,
    );

    expect(saved?.profile_photo_source).toBe(PROFILE_PHOTO_SOURCE_GOOGLE);
    expect(saved?.profile_photo_url).toBe(googleUrl);
    expect(invalidateForPerson).toHaveBeenCalledWith('1141');
  });

  it('does not overwrite a real CDN upload', async () => {
    const cdnUrl =
      'https://organigrama-frontend-550902908078.us-central1.run.app/img/Iron.webp';
    createService({
      person_id: '1144',
      profile_photo_source: 'upload',
      profile_photo_url: cdnUrl,
    });

    await service.syncGooglePhotoOnLogin(
      '1144',
      'iron_fuentes@cun.edu.co',
      googleUrl,
    );

    expect(saved).toBeNull();
    expect(invalidateForPerson).not.toHaveBeenCalled();
  });
});
