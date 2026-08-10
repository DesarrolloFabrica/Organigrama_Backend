/**
 * Tipos de aplicación controlada Drive video → person_video (Fase 2D).
 * Validaciones de apply se derivan del plan; no hay métricas fijas del primer despliegue.
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
  /** Presente en plan.private.json del planner. */
  personMatch?: string;
  eligibility?: string;
  activeVideoId?: string | null;
  compared?: unknown;
};

export type DriveVideoApplyPlanWritableWouldBe = {
  new: number;
  replace: number;
  metadataChanged: number;
};

export type DriveVideoApplyPlanSummary = {
  generatedAt: string;
  inventorySource: string;
  database: string;
  inventoryTotal: number;
  validNames: number;
  invalidNames: number;
  personsFound: number;
  personsNotFound?: number;
  personsAmbiguous?: number;
  personsInactive?: number;
  vacanciesExcluded?: number;
  byAction: Record<string, number>;
  writableWouldBe: DriveVideoApplyPlanWritableWouldBe;
  blockedOrReportOnly: number;
  personVideoRowsBefore: number;
  personVideoRowsAfter: number;
};

export type DriveVideoApplyPlanFile = {
  summary: DriveVideoApplyPlanSummary;
  items: DriveVideoApplyPlanItem[];
};

/**
 * Única expectativa estable de destino (no métricas del dry-run inicial).
 */
export const DRIVE_VIDEO_APPLY_DESTINATION = {
  database: 'core',
} as const;

/** @deprecated Usar DRIVE_VIDEO_APPLY_DESTINATION. Sin métricas 14/13/1/0. */
export const DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS = {
  database: DRIVE_VIDEO_APPLY_DESTINATION.database,
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
  planPersonVideoRowsBefore: number;
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
