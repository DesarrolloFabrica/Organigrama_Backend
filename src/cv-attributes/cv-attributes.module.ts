import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvAttributeCatalogService } from './cv-attributes-catalog.service';
import { CvAttributePersistenceService } from './cv-attributes-persistence.service';
import {
  CvAttributeCatalogVersion,
  CvAttributeResultSkill,
  CvAttributeRun,
  CvMacroattribute,
  CvMacroattributeResult,
  CvSkillAttributeMapping,
  CvSubattribute,
  CvSubattributeResult,
} from './entities';

export const CV_ATTRIBUTE_ENTITIES = [
  CvAttributeCatalogVersion,
  CvMacroattribute,
  CvSubattribute,
  CvSkillAttributeMapping,
  CvAttributeRun,
  CvSubattributeResult,
  CvMacroattributeResult,
  CvAttributeResultSkill,
] as const;

/**
 * Attribute Engine (Pipeline V2, Fase E6). Determinista. Sin Gemini/PDF.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...CV_ATTRIBUTE_ENTITIES])],
  providers: [CvAttributeCatalogService, CvAttributePersistenceService],
  exports: [
    CvAttributeCatalogService,
    CvAttributePersistenceService,
    TypeOrmModule,
  ],
})
export class CvAttributesModule {}
