import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvSkillsEnrichmentOrchestratorService } from './cv-skills-enrichment-orchestrator.service';
import { CvSkillsEnrichmentPersistRunnerService } from './cv-skills-enrichment-persist-runner.service';
import { CvSkillsEnrichmentPersistenceService } from './cv-skills-enrichment-persistence.service';
import { CvSkillsEnrichmentService } from './cv-skills-enrichment.service';
import {
  CvSkillEnrichment,
  CvSkillEnrichmentBlock,
  CvSkillEnrichmentItem,
} from './entities';

export const CV_SKILLS_ENRICHMENT_ENTITIES = [
  CvSkillEnrichment,
  CvSkillEnrichmentBlock,
  CvSkillEnrichmentItem,
] as const;

/**
 * Skill Enricher (Pipeline V2). Independiente del extractor.
 * E3: dry-run + persistencia histórica versionada (sin proyectar inventario).
 */
@Module({
  imports: [TypeOrmModule.forFeature([...CV_SKILLS_ENRICHMENT_ENTITIES])],
  providers: [
    CvSkillsEnrichmentService,
    CvSkillsEnrichmentOrchestratorService,
    CvSkillsEnrichmentPersistenceService,
    CvSkillsEnrichmentPersistRunnerService,
  ],
  exports: [
    CvSkillsEnrichmentService,
    CvSkillsEnrichmentOrchestratorService,
    CvSkillsEnrichmentPersistenceService,
    CvSkillsEnrichmentPersistRunnerService,
    TypeOrmModule,
  ],
})
export class CvSkillsEnrichmentModule {}
