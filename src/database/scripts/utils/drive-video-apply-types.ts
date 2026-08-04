/**
 * Tipos de aplicación controlada Drive video → person_video (Fase 2D).
 */

import type { DriveVideoPlanAction } from './drive-video-plan-types';

export type DriveVideoApplyPlanItem = {
  action: DriveVideoPlanAction;
  reasons: string[];
  document: string | null;
  personId: string | null;
  driveFileId: string;
  driveFileName: string;
  relativePath: string;
  mimeType: string;
  formatClass: string;
  size: number | null;
  md5Checksum: string | null;
  modifiedTime: string | null;
  renameHint?: string | null;
};

export type DriveVideoApplyPlanFile = {
  summary: {
    generatedAt: string;
    inventorySource: string;
    database: string;
    inventoryTotal: number;
    byAction: Record<string, number>;
    personVideoRowsBefore: number;
    personVideoRowsAfter: number;
  };
  items: DriveVideoApplyPlanItem[];
};

/** Expectativas congeladas del dry-run aprobado (Fase 2C). */
export const DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS = {
  database: 'core',
  inventoryTotal: 14,
  newCount: 13,
  invalidNameCount: 1,
  replaceCount: 0,
  metadataChangedCount: 0,
  duplicateDocumentCount: 0,
  personNotFoundCount: 0,
  personMatchMultipleCount: 0,
  personInactiveCount: 0,
  vacancyCount: 0,
  personVideoRowsBefore: 0,
} as const;

export type DriveVideoApplyValidationIssue = {
  code: string;
  message: string;
};

export type DriveVideoApplyValidationResult = {
  ok: boolean;
  issues: DriveVideoApplyValidationIssue[];
  newItems: DriveVideoApplyPlanItem[];
  omittedInvalidName: DriveVideoApplyPlanItem[];
  planHash: string;
};

export type DriveVideoApplyPrecheckSummary = {
  generatedAt: string;
  planPath: string;
  planHash: string;
  inventorySource: string;
  database: string;
  user: string;
  serverAddrMasked: string | null;
  serverPort: number | null;
  schemas: string[];
  personVideoExists: true;
  personVideoRowCount: number;
  constraintsOk: boolean;
  indexesOk: boolean;
  newCandidates: number;
  personsStillActiveEligible: number;
  personsWithoutActiveVideo: number;
  driveFileIdsAbsent: number;
  validationOk: boolean;
  issues: DriveVideoApplyValidationIssue[];
  status: 'READY_FOR_AUTHORIZATION' | 'BLOCKED';
  writeExecuted: false;
};

export type DriveVideoApplySummary = {
  generatedAt: string;
  planHash: string;
  database: string;
  expectedNew: number;
  inserted: number;
  omittedInvalidName: number;
  errors: string[];
  rowsBefore: number;
  rowsAfter: number;
  status: 'APPLIED' | 'ROLLED_BACK' | 'DRY_RUN' | 'BLOCKED';
};
