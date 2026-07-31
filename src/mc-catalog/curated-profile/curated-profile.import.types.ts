/**
 * Tipos de reporte dry-run / execute del importer curado.
 */

import type { CuratedIssue } from './curated-profile.types';
import type { CuratedSkillImportPlanItem } from './curated-profile.extract-builder';

export type CuratedImportOutcome =
  | 'READY'
  | 'BLOCKED'
  | 'NO_OP'
  | 'EXECUTED'
  | 'ROLLED_BACK'
  | 'FAILED';

export interface CuratedImportPlanReport {
  mode: 'DRY_RUN' | 'EXECUTE';
  outcome: CuratedImportOutcome;
  person: {
    personId: string | null;
    documentMasked: string;
    personCvId: string | null;
  };
  contentFingerprint: string | null;
  currentActiveExtractionId: string | null;
  plannedExtraction: {
    model: string;
    promptVersion: string;
    extractorVersion: string;
    pdfSha256: string | null;
    previousExtractionId: string | null;
  };
  domain: {
    declared: string | null;
    validatedStatus: string | null;
  };
  specialties: Array<{
    code: string;
    status: string;
  }>;
  skills: {
    existing: string[];
    aliases: string[];
    approvedForCreation: string[];
    omitted: string[];
    mappingsToCreate: Array<{
      skill: string;
      specialty: string;
      reason: string;
    }>;
  };
  skillPlans: CuratedSkillImportPlanItem[];
  evidenceCount: number;
  pa2: {
    domainCode: string | null;
    planned: boolean;
  };
  risks: string[];
  errors: CuratedIssue[];
  warnings: CuratedIssue[];
  execution?: {
    extractionId: string;
    enrichmentId: string;
    evidenceEvaluationId: string;
    profileEvaluationId: string | null;
    pa2DomainCode: string | null;
    pa2SpecialtyCodes: string[];
    previousExtractionId: string | null;
    verified: boolean;
  };
}
