import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhotoCacheService } from '../org-chart/photos/photo-cache.service';
import { isBundledProfilePhotoPath } from '../org-chart/photos/profile-photo-url.util';
import { PersonProfileState } from './entities/person-profile-state.entity';
import {
  PROFILE_PHOTO_SOURCE_GOOGLE,
  PROFILE_PHOTO_SOURCE_UPLOAD,
} from './profile-photo.constants';

type PhotoSyncAction = 'created' | 'updated' | 'skipped';

/**
 * Sincroniza la foto de Google hacia organigrama.person_profile_state al
 * iniciar sesión. Es un flujo automático (no una acción explícita del usuario),
 * por eso NUNCA toca profile_completed_at ni profile_updated_by_user_at.
 */
@Injectable()
export class ProfilePhotoSyncService {
  private readonly log = new Logger('ProfilePhotoSync');

  constructor(
    @InjectRepository(PersonProfileState)
    private readonly profileStates: Repository<PersonProfileState>,
    private readonly photoCache: PhotoCacheService,
  ) {}

  /**
   * Reglas:
   * - Si Google trae picture y profile_photo_url está vacío => completar (source=google).
   * - Si source ya es google y Google trae una URL nueva => actualizar.
   * - Si la foto es un upload empaquetado (`/public/profile-photos/{id}.*`) =>
   *   tratarla como vacía: esa ruta solo funciona con el archivo en disco, y
   *   si falta produce imagen rota. El login de Google puede recuperarla.
   * - Si la foto es manual o institucional (CDN, etc.) => no sobrescribir.
   * La sincronización nunca debe bloquear el login: cualquier error se loguea y se ignora.
   */
  async syncGooglePhotoOnLogin(
    personId: string,
    email: string | null,
    googlePictureUrl: string | null,
  ): Promise<void> {
    const picture = googlePictureUrl?.trim() || null;

    try {
      const state = await this.profileStates.findOne({
        where: { person_id: personId },
      });

      const existingSource = state?.profile_photo_source ?? null;
      const existingUrl = this.effectiveExistingUrl(
        existingSource,
        state?.profile_photo_url,
      );
      const action = this.decideAction(picture, existingSource, existingUrl);

      this.log.log(
        `[ProfilePhotoSync] personId=${personId} email=${email ?? 'null'} googlePicture=${picture ?? 'null'} existingSource=${existingSource ?? 'null'} action=${action}`,
      );

      if (action === 'skipped') {
        return;
      }

      const target =
        state ??
        this.profileStates.create({
          person_id: personId,
          profile_completed_at: null,
          profile_updated_by_user_at: null,
          profile_photo_source: null,
          profile_photo_url: null,
        });

      target.profile_photo_source = PROFILE_PHOTO_SOURCE_GOOGLE;
      target.profile_photo_url = picture;

      await this.profileStates.save(target);
      this.photoCache.invalidateForPerson(personId);
    } catch (err) {
      this.log.error(
        `[ProfilePhotoSync] personId=${personId} email=${email ?? 'null'} googlePicture=${picture ?? 'null'} action=error message=${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private decideAction(
    picture: string | null,
    existingSource: string | null,
    existingUrl: string | null,
  ): PhotoSyncAction {
    if (!picture) {
      return 'skipped';
    }

    if (!existingUrl) {
      return 'created';
    }

    if (existingSource === PROFILE_PHOTO_SOURCE_GOOGLE) {
      return existingUrl === picture ? 'skipped' : 'updated';
    }

    return 'skipped';
  }

  /**
   * Uploads empaquetados se consideran ausentes: el archivo puede no estar
   * en el despliegue y Google no podía sobrescribir `source=upload`.
   */
  private effectiveExistingUrl(
    existingSource: string | null,
    rawUrl: string | null | undefined,
  ): string | null {
    const existingUrl = rawUrl?.trim() || null;
    if (!existingUrl) {
      return null;
    }
    if (
      existingSource === PROFILE_PHOTO_SOURCE_UPLOAD &&
      isBundledProfilePhotoPath(existingUrl)
    ) {
      return null;
    }
    return existingUrl;
  }
}
