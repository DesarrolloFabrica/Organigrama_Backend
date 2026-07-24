import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CvEvidencePersistenceService } from './cv-evidence-persistence.service';
import {
  CvEvidenceEvaluation,
  CvEvidenceEvaluationItem,
} from './entities';

export const CV_EVIDENCE_ENTITIES = [
  CvEvidenceEvaluation,
  CvEvidenceEvaluationItem,
] as const;

/**
 * Evidence Engine (Pipeline V2). Determinista. Sin Gemini/PDF.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...CV_EVIDENCE_ENTITIES])],
  providers: [CvEvidencePersistenceService],
  exports: [CvEvidencePersistenceService, TypeOrmModule],
})
export class CvEvidenceModule {}
