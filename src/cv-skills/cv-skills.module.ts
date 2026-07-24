import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvSkillsExtractionService } from './cv-skills-extraction.service';
import { CvSkillsPersistenceService } from './cv-skills-persistence.service';
import {
  CvExtraction,
  CvExtractionCertification,
  CvExtractionLanguage,
  CvExtractionSkill,
  CvSkill,
  CvSkillAlias,
} from './entities';

export const CV_SKILLS_ENTITIES = [
  CvSkill,
  CvSkillAlias,
  CvExtraction,
  CvExtractionSkill,
  CvExtractionLanguage,
  CvExtractionCertification,
] as const;

/**
 * Módulo de extracción de skills (PDF → Gemini → JSON tipado)
 * y persistencia versionada en organigrama.cv_* (Fase 2).
 */
@Module({
  imports: [TypeOrmModule.forFeature([...CV_SKILLS_ENTITIES])],
  providers: [CvSkillsExtractionService, CvSkillsPersistenceService],
  exports: [
    CvSkillsExtractionService,
    CvSkillsPersistenceService,
    TypeOrmModule,
  ],
})
export class CvSkillsModule {}
