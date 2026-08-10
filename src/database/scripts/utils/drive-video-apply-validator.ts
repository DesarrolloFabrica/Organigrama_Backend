/**
 * Validador del plan congelado antes de escribir person_video.
 * Sin I/O de red; coherencia interna del plan + integridad NEW.
 * Sin métricas fijas del primer despliegue (14/13/1/0).
 */
import { createHash } from 'node:crypto';
import {
  DRIVE_VIDEO_APPLY_DESTINATION,
  type DriveVideoApplyPlanFile,
  type DriveVideoApplyPlanItem,
  type DriveVideoApplyValidationIssue,
  type DriveVideoApplyValidationResult,
} from './drive-video-apply-types';
import { emptyActionCounts, type DriveVideoPlanAction } from './drive-video-plan-types';

/** Acciones que esta versión del writer no aplica (bloquean el plan entero). */
export const DRIVE_VIDEO_APPLY_FORBIDDEN_ACTIONS: ReadonlySet<string> = new Set([
  'REPLACE',
  'METADATA_CHANGED',
  'DUPLICATE_DOCUMENT',
  'DRIVE_FILE_ALREADY_LINKED',
  'PERSON_NOT_FOUND',
  'PERSON_MATCH_MULTIPLE',
  'PERSON_INACTIVE',
  'VACANCY_NOT_ELIGIBLE',
  'UNSUPPORTED_FORMAT',
  'MIME_EXTENSION_MISMATCH',
]);

/** Acciones no escribibles permitidas junto a NEW. */
export const DRIVE_VIDEO_APPLY_ALLOWED_NON_WRITABLE: ReadonlySet<string> = new Set([
  'INVALID_NAME',
  'NO_CHANGE',
  'REPORT_ONLY',
]);

const SECRET_KEY_RE =
  /^(password|passwd|secret|token|api[_-]?key|authorization|private[_-]?key|access[_-]?token|refresh[_-]?token)$/i;
const PUBLIC_URL_RE = /https?:\/\//i;

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

function isNonNegativeInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

function collectStringLeaves(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStringLeaves(v, out);
    return;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out.push(`__SECRET_KEY__:${k}`);
      }
      collectStringLeaves(v, out);
    }
  }
}

/**
 * Compara filas live de person_video vs snapshot del plan.
 * Solo conteos — sin PII.
 */
export function validatePersonVideoRowSnapshot(
  liveRowCount: number,
  planRowsBefore: number,
): DriveVideoApplyValidationIssue | null {
  if (liveRowCount !== planRowsBefore) {
    return issue(
      'PLAN_SNAPSHOT_STALE',
      `person_video filas live=${liveRowCount}, plan generado con filas=${planRowsBefore}`,
    );
  }
  return null;
}

/**
 * Valida estructura + coherencia interna del plan + integridad NEW.
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

  if (summary?.database !== DRIVE_VIDEO_APPLY_DESTINATION.database) {
    issues.push(
      issue(
        'DATABASE_MISMATCH',
        `database=${summary?.database} esperado=${DRIVE_VIDEO_APPLY_DESTINATION.database}`,
      ),
    );
  }

  if (summary && summary.inventoryTotal !== items.length) {
    issues.push(
      issue(
        'INVENTORY_TOTAL_MISMATCH',
        `inventoryTotal=${summary.inventoryTotal} items=${items.length}`,
      ),
    );
  }

  const actualByAction: Record<string, number> = {};
  for (const it of items) {
    actualByAction[it.action] = (actualByAction[it.action] ?? 0) + 1;
  }

  const declaredActions = new Set([
    ...Object.keys(summary?.byAction ?? {}),
    ...Object.keys(actualByAction),
    ...Object.keys(emptyActionCounts()),
  ]);
  for (const action of declaredActions) {
    const declared = summary?.byAction?.[action] ?? 0;
    const actual = actualByAction[action] ?? 0;
    if (declared !== actual) {
      issues.push(
        issue(
          'SUMMARY_BY_ACTION_MISMATCH',
          `byAction.${action}=${declared} items=${actual}`,
        ),
      );
    }
  }

  const newCount = countAction(items, 'NEW');
  const replaceCount = countAction(items, 'REPLACE');
  const metaCount = countAction(items, 'METADATA_CHANGED');
  const noChangeCount = countAction(items, 'NO_CHANGE');
  const invalidNameCount = countAction(items, 'INVALID_NAME');

  if (summary) {
    if (
      typeof summary.validNames !== 'number' ||
      typeof summary.invalidNames !== 'number' ||
      typeof summary.personsFound !== 'number' ||
      typeof summary.blockedOrReportOnly !== 'number' ||
      !summary.writableWouldBe
    ) {
      issues.push(
        issue(
          'SUMMARY_AGGREGATES_MISSING',
          'Faltan validNames/invalidNames/personsFound/blockedOrReportOnly/writableWouldBe',
        ),
      );
    } else {
      if (summary.validNames + summary.invalidNames !== summary.inventoryTotal) {
        issues.push(
          issue(
            'VALID_INVALID_SUM',
            `validNames+invalidNames=${summary.validNames + summary.invalidNames} inventoryTotal=${summary.inventoryTotal}`,
          ),
        );
      }
      if (summary.invalidNames !== invalidNameCount) {
        issues.push(
          issue(
            'INVALID_NAMES_MISMATCH',
            `invalidNames=${summary.invalidNames} INVALID_NAME items=${invalidNameCount}`,
          ),
        );
      }
      if (summary.validNames !== summary.inventoryTotal - invalidNameCount) {
        issues.push(
          issue(
            'VALID_NAMES_MISMATCH',
            `validNames=${summary.validNames} esperado=${summary.inventoryTotal - invalidNameCount}`,
          ),
        );
      }

      const personsFoundActual = items.filter((i) => i.personId != null).length;
      if (summary.personsFound !== personsFoundActual) {
        issues.push(
          issue(
            'PERSONS_FOUND_MISMATCH',
            `personsFound=${summary.personsFound} itemsConPersonId=${personsFoundActual}`,
          ),
        );
      }

      const blockedExpected =
        items.length - newCount - noChangeCount - replaceCount - metaCount;
      if (summary.blockedOrReportOnly !== blockedExpected) {
        issues.push(
          issue(
            'BLOCKED_OR_REPORT_MISMATCH',
            `blockedOrReportOnly=${summary.blockedOrReportOnly} esperado=${blockedExpected}`,
          ),
        );
      }

      const w = summary.writableWouldBe;
      if (w.new !== newCount) {
        issues.push(
          issue('WRITABLE_NEW_MISMATCH', `writableWouldBe.new=${w.new} NEW=${newCount}`),
        );
      }
      if (w.replace !== replaceCount) {
        issues.push(
          issue(
            'WRITABLE_REPLACE_MISMATCH',
            `writableWouldBe.replace=${w.replace} REPLACE=${replaceCount}`,
          ),
        );
      }
      if (w.metadataChanged !== metaCount) {
        issues.push(
          issue(
            'WRITABLE_META_MISMATCH',
            `writableWouldBe.metadataChanged=${w.metadataChanged} METADATA_CHANGED=${metaCount}`,
          ),
        );
      }
    }

    if (!isNonNegativeInt(summary.personVideoRowsBefore)) {
      issues.push(
        issue(
          'ROWS_BEFORE_INVALID',
          `personVideoRowsBefore debe ser entero >= 0`,
        ),
      );
    }
    if (!isNonNegativeInt(summary.personVideoRowsAfter)) {
      issues.push(
        issue(
          'ROWS_AFTER_INVALID',
          `personVideoRowsAfter debe ser entero >= 0`,
        ),
      );
    }
    // Dry-run no escribe: proyección coherente = after === before
    if (
      isNonNegativeInt(summary.personVideoRowsBefore) &&
      isNonNegativeInt(summary.personVideoRowsAfter) &&
      summary.personVideoRowsAfter !== summary.personVideoRowsBefore
    ) {
      issues.push(
        issue(
          'ROWS_AFTER_PROJECTION',
          `personVideoRowsAfter=${summary.personVideoRowsAfter} debe igualar personVideoRowsBefore=${summary.personVideoRowsBefore} (dry-run sin escritura)`,
        ),
      );
    }
  }

  if (newCount === 0) {
    issues.push(
      issue('NO_WRITABLE_NEW', 'Plan sin acciones NEW; nada que aplicar'),
    );
  }

  for (const it of items) {
    const action = it.action as string;
    if (action === 'NEW') continue;
    if (DRIVE_VIDEO_APPLY_ALLOWED_NON_WRITABLE.has(action)) continue;
    if (DRIVE_VIDEO_APPLY_FORBIDDEN_ACTIONS.has(action)) {
      issues.push(
        issue(
          'FORBIDDEN_ACTION',
          `Acción no aplicable en este writer: ${action}`,
        ),
      );
      continue;
    }
    issues.push(
      issue('UNKNOWN_ACTION', `Acción no reconocida para apply: ${action}`),
    );
  }

  const forbiddenWritable = items.filter((i) =>
    ['REPLACE', 'METADATA_CHANGED'].includes(i.action),
  );
  if (forbiddenWritable.length > 0) {
    issues.push(
      issue(
        'FORBIDDEN_WRITABLE',
        `Acciones escribibles no-NEW presentes: ${[
          ...new Set(forbiddenWritable.map((i) => i.action)),
        ].join(',')}`,
      ),
    );
  }

  const newItems = items.filter((i) => i.action === 'NEW');
  const omittedInvalidName = items.filter((i) => i.action === 'INVALID_NAME');

  const personIds = new Set<string>();
  const fileIds = new Set<string>();
  for (const it of newItems) {
    if (
      !it.personId ||
      it.document == null ||
      it.document === '' ||
      !it.driveFileId ||
      !it.driveFileName
    ) {
      issues.push(
        issue(
          'NEW_MISSING_FIELDS',
          `NEW incompleto fileIdPresent=${Boolean(it.driveFileId)}`,
        ),
      );
      continue;
    }
    if (typeof it.document !== 'string') {
      issues.push(
        issue('NEW_DOCUMENT_TYPE', `document debe ser string personId=${it.personId}`),
      );
    }
    if (it.formatClass !== 'SUPPORTED_MVP') {
      issues.push(
        issue('NEW_FORMAT', `formatClass=${it.formatClass} personId=${it.personId}`),
      );
    }
    if (it.mimeType !== 'video/mp4') {
      issues.push(
        issue('NEW_MIME', `mimeType=${it.mimeType} personId=${it.personId}`),
      );
    }
    if (it.eligibility != null && it.eligibility !== 'ELIGIBLE_PERSON') {
      issues.push(
        issue(
          'NEW_NOT_ELIGIBLE',
          `eligibility=${it.eligibility} personId=${it.personId}`,
        ),
      );
    }
    if (it.personMatch != null && it.personMatch !== 'PERSON_MATCH_UNIQUE') {
      issues.push(
        issue(
          'NEW_PERSON_MATCH',
          `personMatch=${it.personMatch} personId=${it.personId}`,
        ),
      );
    }
    if (it.activeVideoId) {
      issues.push(
        issue(
          'NEW_HAS_ACTIVE_HINT',
          `NEW no debe referenciar activeVideoId personId=${it.personId}`,
        ),
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
        issue('NEW_DUP_FILE', `driveFileId repetido en NEW`),
      );
    }
    fileIds.add(it.driveFileId);

    const leaves: string[] = [];
    collectStringLeaves(it, leaves);
    for (const leaf of leaves) {
      if (leaf.startsWith('__SECRET_KEY__:')) {
        issues.push(
          issue(
            'NEW_SECRET_FIELD',
            `Campo sensible no permitido en NEW: ${leaf.slice('__SECRET_KEY__:'.length)}`,
          ),
        );
      } else if (PUBLIC_URL_RE.test(leaf)) {
        issues.push(
          issue('NEW_PUBLIC_URL', `URL pública no permitida en ítem NEW`),
        );
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    newItems,
    omittedInvalidName,
    planHash,
  };
}

/** Acciones tipadas conocidas (útil en tests). */
export function knownPlanActions(): DriveVideoPlanAction[] {
  return Object.keys(emptyActionCounts()) as DriveVideoPlanAction[];
}
