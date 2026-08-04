/**
 * Validador del plan congelado antes de escribir person_video.
 * Sin I/O de red; puro sobre el JSON cargado.
 */
import { createHash } from 'node:crypto';
import {
  DRIVE_VIDEO_APPROVED_PLAN_EXPECTATIONS as EXP,
  type DriveVideoApplyPlanFile,
  type DriveVideoApplyPlanItem,
  type DriveVideoApplyValidationIssue,
  type DriveVideoApplyValidationResult,
} from './drive-video-apply-types';

export function hashPlanPayload(rawText: string): string {
  return createHash('sha256').update(rawText).digest('hex');
}

function issue(code: string, message: string): DriveVideoApplyValidationIssue {
  return { code, message };
}

function countAction(
  items: DriveVideoApplyPlanItem[],
  action: string,
): number {
  return items.filter((i) => i.action === action).length;
}

/**
 * Valida estructura + métricas del dry-run aprobado + integridad NEW.
 */
export function validateApprovedDriveVideoPlan(
  plan: DriveVideoApplyPlanFile,
  planRawText: string,
): DriveVideoApplyValidationResult {
  const issues: DriveVideoApplyValidationIssue[] = [];
  const planHash = hashPlanPayload(planRawText);

  if (!plan || typeof plan !== 'object') {
    return {
      ok: false,
      issues: [issue('PLAN_INVALID', 'Plan raíz inválido')],
      newItems: [],
      omittedInvalidName: [],
      planHash,
    };
  }
  if (!plan.summary || !Array.isArray(plan.items)) {
    issues.push(issue('PLAN_STRUCTURE', 'Falta summary o items[]'));
  }

  const items = Array.isArray(plan.items) ? plan.items : [];
  const summary = plan.summary;

  if (summary?.database !== EXP.database) {
    issues.push(
      issue(
        'DATABASE_MISMATCH',
        `database=${summary?.database} esperado=${EXP.database}`,
      ),
    );
  }
  if (summary?.inventoryTotal !== EXP.inventoryTotal) {
    issues.push(
      issue(
        'INVENTORY_TOTAL_MISMATCH',
        `inventoryTotal=${summary?.inventoryTotal} esperado=${EXP.inventoryTotal}`,
      ),
    );
  }
  if ((summary?.personVideoRowsBefore ?? -1) !== EXP.personVideoRowsBefore) {
    issues.push(
      issue(
        'ROWS_BEFORE_MISMATCH',
        `personVideoRowsBefore=${summary?.personVideoRowsBefore} esperado=${EXP.personVideoRowsBefore}`,
      ),
    );
  }

  const newCount = countAction(items, 'NEW');
  const invalidCount = countAction(items, 'INVALID_NAME');
  const replaceCount = countAction(items, 'REPLACE');
  const metaCount = countAction(items, 'METADATA_CHANGED');
  const dupCount = countAction(items, 'DUPLICATE_DOCUMENT');
  const notFound = countAction(items, 'PERSON_NOT_FOUND');
  const multi = countAction(items, 'PERSON_MATCH_MULTIPLE');
  const inactive = countAction(items, 'PERSON_INACTIVE');
  const vacancy = countAction(items, 'VACANCY_NOT_ELIGIBLE');

  if (newCount !== EXP.newCount) {
    issues.push(issue('NEW_COUNT', `NEW=${newCount} esperado=${EXP.newCount}`));
  }
  if (invalidCount !== EXP.invalidNameCount) {
    issues.push(
      issue(
        'INVALID_NAME_COUNT',
        `INVALID_NAME=${invalidCount} esperado=${EXP.invalidNameCount}`,
      ),
    );
  }
  if (replaceCount !== EXP.replaceCount) {
    issues.push(issue('HAS_REPLACE', `REPLACE=${replaceCount} no permitido`));
  }
  if (metaCount !== EXP.metadataChangedCount) {
    issues.push(
      issue('HAS_METADATA_CHANGED', `METADATA_CHANGED=${metaCount} no permitido`),
    );
  }
  if (dupCount !== EXP.duplicateDocumentCount) {
    issues.push(issue('HAS_DUPLICATES', `DUPLICATE_DOCUMENT=${dupCount}`));
  }
  if (notFound !== EXP.personNotFoundCount) {
    issues.push(issue('HAS_NOT_FOUND', `PERSON_NOT_FOUND=${notFound}`));
  }
  if (multi !== EXP.personMatchMultipleCount) {
    issues.push(issue('HAS_MULTIPLE', `PERSON_MATCH_MULTIPLE=${multi}`));
  }
  if (inactive !== EXP.personInactiveCount) {
    issues.push(issue('HAS_INACTIVE', `PERSON_INACTIVE=${inactive}`));
  }
  if (vacancy !== EXP.vacancyCount) {
    issues.push(issue('HAS_VACANCY', `VACANCY_NOT_ELIGIBLE=${vacancy}`));
  }

  const writableOther = items.filter(
    (i) =>
      i.action !== 'NEW' &&
      i.action !== 'INVALID_NAME' &&
      i.action !== 'NO_CHANGE' &&
      i.action !== 'REPORT_ONLY',
  );
  // First execution: any writable besides NEW is forbidden
  const forbiddenWritable = items.filter((i) =>
    ['REPLACE', 'METADATA_CHANGED'].includes(i.action),
  );
  if (forbiddenWritable.length > 0) {
    issues.push(
      issue(
        'FORBIDDEN_WRITABLE',
        `Acciones escribibles no-NEW presentes: ${forbiddenWritable.map((i) => i.action).join(',')}`,
      ),
    );
  }
  void writableOther;

  const newItems = items.filter((i) => i.action === 'NEW');
  const omittedInvalidName = items.filter((i) => i.action === 'INVALID_NAME');

  const personIds = new Set<string>();
  const fileIds = new Set<string>();
  for (const it of newItems) {
    if (!it.personId || !it.document || !it.driveFileId) {
      issues.push(
        issue(
          'NEW_MISSING_FIELDS',
          `NEW incompleto file=${it.driveFileName}`,
        ),
      );
      continue;
    }
    if (it.formatClass !== 'SUPPORTED_MVP') {
      issues.push(
        issue('NEW_FORMAT', `formatClass=${it.formatClass} file=${it.driveFileName}`),
      );
    }
    if (it.mimeType !== 'video/mp4') {
      issues.push(
        issue('NEW_MIME', `mimeType=${it.mimeType} file=${it.driveFileName}`),
      );
    }
    if (personIds.has(it.personId)) {
      issues.push(
        issue('NEW_DUP_PERSON', `personId repetido en NEW: ${it.personId}`),
      );
    }
    personIds.add(it.personId);
    if (fileIds.has(it.driveFileId)) {
      issues.push(
        issue('NEW_DUP_FILE', `driveFileId repetido en NEW: ${it.driveFileId}`),
      );
    }
    fileIds.add(it.driveFileId);
  }

  return {
    ok: issues.length === 0,
    issues,
    newItems,
    omittedInvalidName,
    planHash,
  };
}
