import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../../person/entities/person.entity';
import { PersonProfileState } from '../../profile/entities/person-profile-state.entity';
import { GoogleWorkspaceModule } from '../../google-workspace/google-workspace.module';
import { OrgChartPhotoController } from './org-chart-photo.controller';
import { OrgChartPhotoService } from './org-chart-photo.service';
import { PhotoCacheService } from './photo-cache.service';
import { PhotoResolverService } from './photo-resolver.service';
import { PhotoUrlBuilder } from './photo-url.builder';
import { DevMockPhotoProvider } from './providers/dev-mock-photo.provider';
import { GoogleWorkspaceDirectoryPhotoProvider } from './providers/google-workspace-directory-photo.provider';
import { PersistedGoogleProfilePhotoProvider } from './providers/persisted-google-profile-photo.provider';
import { SessionGoogleLoginPhotoProvider } from './providers/session-google-login-photo.provider';
import { ProfilePhotoLookupService } from './profile-photo-lookup.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, PersonProfileState]),
    GoogleWorkspaceModule,
  ],
  controllers: [OrgChartPhotoController],
  providers: [
    OrgChartPhotoService,
    PhotoCacheService,
    PhotoResolverService,
    PhotoUrlBuilder,
    ProfilePhotoLookupService,
    PersistedGoogleProfilePhotoProvider,
    DevMockPhotoProvider,
    GoogleWorkspaceDirectoryPhotoProvider,
    SessionGoogleLoginPhotoProvider,
  ],
  exports: [PhotoUrlBuilder, PhotoCacheService, ProfilePhotoLookupService],
})
export class OrgChartPhotosModule {}
