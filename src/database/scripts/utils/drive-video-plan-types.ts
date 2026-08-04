/**
 * Tipos del planner dry-run Drive → person_video (Fase 2C).
 */

export type DriveVideoPlanAction =
  | 'NEW'
  | 'NO_CHANGE'
  | 'REPLACE'
  | 'METADATA_CHANGED'
  | 'DUPLICATE_DOCUMENT'
  | 'DRIVE_FILE_ALREADY_LINKED'
  | 'PERSON_NOT_FOUND'
  | 'PERSON_MATCH_MULTIPLE'
  | 'PERSON_INACTIVE'
  | 'VACANCY_NOT_ELIGIBLE'
  | 'INVALID_NAME'
  | 'UNSUPPORTED_FORMAT'
  | 'MIME_EXTENSION_MISMATCH'
  | 'REPORT_ONLY';

export type DriveVideoPlanPersonMatch =
  | 'PERSON_MATCH_UNIQUE'
  | 'PERSON_NOT_FOUND'
  | 'PERSON_MATCH_MULTIPLE'
  | 'PERSON_INACTIVE'
  | 'VACANCY_NOT_ELIGIBLE'
  | 'N/A';

export type DriveVideoPlanEligibility =
  | 'ELIGIBLE_PERSON'
  | 'VACANCY_NOT_ELIGIBLE'
  | 'N/A';

/** Fila mínima de core.person para el planner (sin PII de contacto). */
export type DriveVideoPlanPersonRow = {
  id: string;
  document: string;
  is_active: boolean;
  roleName: string | null;
  fullName: string | null;
  isVacancy: boolean;
};

/** Fila mínima de organigrama.person_video. */
export type DriveVideoPlanVideoRow = {
  id: string;
  person_id: string;
  document: string;
  drive_file_id: string;
  drive_file_name: string;
  mime_type: string;
  drive_modified_time: string | null;
  drive_md5_checksum: string | null;
  drive_file_size: number | null;
  drive_relative_path: string | null;
  is_active: boolean;
};

export type DriveVideoPlanItemInput = {
  driveFileId: string;
  driveFileName: string;
  mimeType: string;
  relativePath: string;
  modifiedTime: string | null;
  md5Checksum: string | null;
  size: number | null;
  document: string | null;
  extension: string | null;
  validName: boolean;
  nameReason: string | null;
  formatClass: string;
  mimeExtensionInconsistent: boolean;
};

export type DriveVideoPlanItem = {
  action: DriveVideoPlanAction;
  reasons: string[];
  personMatch: DriveVideoPlanPersonMatch;
  eligibility: DriveVideoPlanEligibility;
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
  activeVideoId: string | null;
  compared: {
    sameDriveFileId: boolean | null;
    sameChecksum: boolean | null;
    sameSize: boolean | null;
    sameModifiedTime: boolean | null;
    sameName: boolean | null;
    samePath: boolean | null;
  } | null;
  renameHint: string | null;
};

export type DriveVideoPlanSummary = {
  generatedAt: string;
  inventorySource: string;
  database: string;
  inventoryTotal: number;
  validNames: number;
  invalidNames: number;
  personsFound: number;
  personsNotFound: number;
  personsAmbiguous: number;
  personsInactive: number;
  vacanciesExcluded: number;
  byAction: Record<DriveVideoPlanAction, number>;
  writableWouldBe: {
    new: number;
    replace: number;
    metadataChanged: number;
  };
  blockedOrReportOnly: number;
  personVideoRowsBefore: number;
  personVideoRowsAfter: number;
};

export function emptyActionCounts(): Record<DriveVideoPlanAction, number> {
  return {
    NEW: 0,
    NO_CHANGE: 0,
    REPLACE: 0,
    METADATA_CHANGED: 0,
    DUPLICATE_DOCUMENT: 0,
    DRIVE_FILE_ALREADY_LINKED: 0,
    PERSON_NOT_FOUND: 0,
    PERSON_MATCH_MULTIPLE: 0,
    PERSON_INACTIVE: 0,
    VACANCY_NOT_ELIGIBLE: 0,
    INVALID_NAME: 0,
    UNSUPPORTED_FORMAT: 0,
    MIME_EXTENSION_MISMATCH: 0,
    REPORT_ONLY: 0,
  };
}
