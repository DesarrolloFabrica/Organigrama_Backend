/**
 * Planner puro Drive video → person_video (dry-run).
 * Sin I/O, sin PostgreSQL, sin Drive.
 */
import { isVacancyPerson } from '../../../org-chart/org-chart-vacancy';
import type {
  DriveVideoPlanAction,
  DriveVideoPlanEligibility,
  DriveVideoPlanItem,
  DriveVideoPlanItemInput,
  DriveVideoPlanPersonMatch,
  DriveVideoPlanPersonRow,
  DriveVideoPlanSummary,
  DriveVideoPlanVideoRow,
} from './drive-video-plan-types';
import { emptyActionCounts } from './drive-video-plan-types';

function sameMeta(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

function contentLooksSame(
  item: DriveVideoPlanItemInput,
  active: DriveVideoPlanVideoRow,
): boolean {
  if (item.driveFileId !== active.drive_file_id) return false;
  if (item.md5Checksum && active.drive_md5_checksum) {
    return item.md5Checksum === active.drive_md5_checksum;
  }
  return (
    sameMeta(item.size, active.drive_file_size) &&
    sameMeta(item.modifiedTime, active.drive_modified_time)
  );
}

function buildCompared(
  item: DriveVideoPlanItemInput,
  active: DriveVideoPlanVideoRow | null,
): DriveVideoPlanItem['compared'] {
  if (!active) return null;
  return {
    sameDriveFileId: item.driveFileId === active.drive_file_id,
    sameChecksum:
      item.md5Checksum != null && active.drive_md5_checksum != null
        ? item.md5Checksum === active.drive_md5_checksum
        : null,
    sameSize: sameMeta(item.size, active.drive_file_size),
    sameModifiedTime: sameMeta(item.modifiedTime, active.drive_modified_time),
    sameName: item.driveFileName === active.drive_file_name,
    samePath: sameMeta(item.relativePath, active.drive_relative_path),
  };
}

function renameHint(item: DriveVideoPlanItemInput): string | null {
  if (item.validName) return null;
  // Solo sugerir si el nombre es solo dígitos (evidencia de documento).
  const onlyDigits = /^(\d+)$/.exec(item.driveFileName.trim());
  if (onlyDigits) {
    return `${onlyDigits[1]}-presentacion.mp4`;
  }
  return 'Renombrar a <documento>-presentacion.mp4 (documento no inferido sin evidencia)';
}

function baseItem(
  item: DriveVideoPlanItemInput,
  partial: Partial<DriveVideoPlanItem> & {
    action: DriveVideoPlanAction;
    reasons: string[];
  },
): DriveVideoPlanItem {
  return {
    action: partial.action,
    reasons: partial.reasons,
    personMatch: partial.personMatch ?? 'N/A',
    eligibility: partial.eligibility ?? 'N/A',
    document: partial.document ?? item.document,
    personId: partial.personId ?? null,
    driveFileId: item.driveFileId,
    driveFileName: item.driveFileName,
    relativePath: item.relativePath,
    mimeType: item.mimeType,
    formatClass: item.formatClass,
    size: item.size,
    md5Checksum: item.md5Checksum,
    modifiedTime: item.modifiedTime,
    activeVideoId: partial.activeVideoId ?? null,
    compared: partial.compared ?? null,
    renameHint: partial.renameHint ?? null,
  };
}

export type BuildDriveVideoPlanParams = {
  items: DriveVideoPlanItemInput[];
  /** document → personas (exact match). */
  personsByDocument: Map<string, DriveVideoPlanPersonRow[]>;
  videos: DriveVideoPlanVideoRow[];
  inventorySource: string;
  database: string;
  personVideoRowsBefore: number;
};

export type BuildDriveVideoPlanResult = {
  items: DriveVideoPlanItem[];
  summary: DriveVideoPlanSummary;
};

/**
 * Construye el plan dry-run. No escribe nada.
 */
export function buildDriveVideoPlan(
  params: BuildDriveVideoPlanParams,
): BuildDriveVideoPlanResult {
  const { items, personsByDocument, videos } = params;

  const videosByPerson = new Map<string, DriveVideoPlanVideoRow[]>();
  const videoByDriveFileId = new Map<string, DriveVideoPlanVideoRow[]>();
  for (const v of videos) {
    const list = videosByPerson.get(v.person_id) ?? [];
    list.push(v);
    videosByPerson.set(v.person_id, list);
    const byId = videoByDriveFileId.get(v.drive_file_id) ?? [];
    byId.push(v);
    videoByDriveFileId.set(v.drive_file_id, byId);
  }

  // Documentos con >1 archivo válido + SUPPORTED_MVP en inventario
  const docCounts = new Map<string, number>();
  for (const it of items) {
    if (
      it.validName &&
      it.document &&
      it.formatClass === 'SUPPORTED_MVP' &&
      !it.mimeExtensionInconsistent
    ) {
      docCounts.set(it.document, (docCounts.get(it.document) ?? 0) + 1);
    }
  }
  const duplicateDocs = new Set(
    [...docCounts.entries()].filter(([, n]) => n > 1).map(([d]) => d),
  );

  const planItems: DriveVideoPlanItem[] = [];

  for (const item of items) {
    if (item.formatClass === 'NON_VIDEO') {
      planItems.push(
        baseItem(item, {
          action: 'REPORT_ONLY',
          reasons: ['NON_VIDEO'],
        }),
      );
      continue;
    }

    if (item.mimeExtensionInconsistent) {
      planItems.push(
        baseItem(item, {
          action: 'MIME_EXTENSION_MISMATCH',
          reasons: ['MIME_EXTENSION_MISMATCH'],
        }),
      );
      continue;
    }

    if (!item.validName) {
      planItems.push(
        baseItem(item, {
          action: 'INVALID_NAME',
          reasons: [item.nameReason ?? 'INVALID_PATTERN'],
          renameHint: renameHint(item),
        }),
      );
      continue;
    }

    if (item.formatClass !== 'SUPPORTED_MVP') {
      planItems.push(
        baseItem(item, {
          action: 'UNSUPPORTED_FORMAT',
          reasons: [`FORMAT_${item.formatClass}`],
          document: item.document,
        }),
      );
      continue;
    }

    const document = item.document!;
    if (duplicateDocs.has(document)) {
      planItems.push(
        baseItem(item, {
          action: 'DUPLICATE_DOCUMENT',
          reasons: ['DUPLICATE_DOCUMENT_IN_INVENTORY'],
          document,
          personMatch: 'N/A',
        }),
      );
      continue;
    }

    const matches = personsByDocument.get(document) ?? [];
    if (matches.length === 0) {
      planItems.push(
        baseItem(item, {
          action: 'PERSON_NOT_FOUND',
          reasons: ['NO_CORE_PERSON_FOR_DOCUMENT'],
          document,
          personMatch: 'PERSON_NOT_FOUND',
        }),
      );
      continue;
    }

    if (matches.length > 1) {
      planItems.push(
        baseItem(item, {
          action: 'PERSON_MATCH_MULTIPLE',
          reasons: [`MATCH_COUNT_${matches.length}`],
          document,
          personMatch: 'PERSON_MATCH_MULTIPLE',
        }),
      );
      continue;
    }

    const person = matches[0];
    if (person.isVacancy) {
      planItems.push(
        baseItem(item, {
          action: 'VACANCY_NOT_ELIGIBLE',
          reasons: ['VACANCY_ROLE_OR_PLACEHOLDER'],
          document,
          personId: person.id,
          personMatch: 'VACANCY_NOT_ELIGIBLE',
          eligibility: 'VACANCY_NOT_ELIGIBLE',
        }),
      );
      continue;
    }

    if (!person.is_active) {
      planItems.push(
        baseItem(item, {
          action: 'PERSON_INACTIVE',
          reasons: ['PERSON_IS_ACTIVE_FALSE'],
          document,
          personId: person.id,
          personMatch: 'PERSON_INACTIVE',
          eligibility: 'ELIGIBLE_PERSON',
        }),
      );
      continue;
    }

    const linked = videoByDriveFileId.get(item.driveFileId) ?? [];
    const linkedOther = linked.filter((v) => v.person_id !== person.id);
    if (linkedOther.length > 0) {
      planItems.push(
        baseItem(item, {
          action: 'DRIVE_FILE_ALREADY_LINKED',
          reasons: ['DRIVE_FILE_ID_OWNED_BY_OTHER_PERSON'],
          document,
          personId: person.id,
          personMatch: 'PERSON_MATCH_UNIQUE',
          eligibility: 'ELIGIBLE_PERSON',
        }),
      );
      continue;
    }

    const personVideos = videosByPerson.get(person.id) ?? [];
    const active = personVideos.find((v) => v.is_active) ?? null;
    const compared = buildCompared(item, active);

    if (!active) {
      planItems.push(
        baseItem(item, {
          action: 'NEW',
          reasons: ['NO_ACTIVE_PERSON_VIDEO'],
          document,
          personId: person.id,
          personMatch: 'PERSON_MATCH_UNIQUE',
          eligibility: 'ELIGIBLE_PERSON',
          compared,
        }),
      );
      continue;
    }

    if (item.driveFileId === active.drive_file_id) {
      const pathOrNameChanged =
        item.driveFileName !== active.drive_file_name ||
        !sameMeta(item.relativePath, active.drive_relative_path) ||
        !sameMeta(item.modifiedTime, active.drive_modified_time) ||
        !sameMeta(item.size, active.drive_file_size);

      if (contentLooksSame(item, active) && !pathOrNameChanged) {
        planItems.push(
          baseItem(item, {
            action: 'NO_CHANGE',
            reasons: ['ACTIVE_SAME_FILE_AND_META'],
            document,
            personId: person.id,
            personMatch: 'PERSON_MATCH_UNIQUE',
            eligibility: 'ELIGIBLE_PERSON',
            activeVideoId: active.id,
            compared,
          }),
        );
        continue;
      }

      planItems.push(
        baseItem(item, {
          action: 'METADATA_CHANGED',
          reasons: ['SAME_DRIVE_FILE_ID_META_DIFF'],
          document,
          personId: person.id,
          personMatch: 'PERSON_MATCH_UNIQUE',
          eligibility: 'ELIGIBLE_PERSON',
          activeVideoId: active.id,
          compared,
        }),
      );
      continue;
    }

    planItems.push(
      baseItem(item, {
        action: 'REPLACE',
        reasons: ['ACTIVE_DIFFERENT_DRIVE_FILE_ID'],
        document,
        personId: person.id,
        personMatch: 'PERSON_MATCH_UNIQUE',
        eligibility: 'ELIGIBLE_PERSON',
        activeVideoId: active.id,
        compared,
      }),
    );
  }

  const byAction = emptyActionCounts();
  for (const it of planItems) {
    byAction[it.action] += 1;
  }

  const summary: DriveVideoPlanSummary = {
    generatedAt: new Date().toISOString(),
    inventorySource: params.inventorySource,
    database: params.database,
    inventoryTotal: items.length,
    validNames: items.filter((i) => i.validName).length,
    invalidNames: items.filter((i) => !i.validName).length,
    personsFound: planItems.filter((i) => i.personId != null).length,
    personsNotFound: byAction.PERSON_NOT_FOUND,
    personsAmbiguous: byAction.PERSON_MATCH_MULTIPLE,
    personsInactive: byAction.PERSON_INACTIVE,
    vacanciesExcluded: byAction.VACANCY_NOT_ELIGIBLE,
    byAction,
    writableWouldBe: {
      new: byAction.NEW,
      replace: byAction.REPLACE,
      metadataChanged: byAction.METADATA_CHANGED,
    },
    blockedOrReportOnly:
      items.length -
      byAction.NEW -
      byAction.NO_CHANGE -
      byAction.REPLACE -
      byAction.METADATA_CHANGED,
    personVideoRowsBefore: params.personVideoRowsBefore,
    personVideoRowsAfter: params.personVideoRowsBefore,
  };

  return { items: planItems, summary };
}

/** Helper para tests/CLI: marca vacante con la misma regla del organigrama. */
export function toPlanPersonRow(input: {
  id: string;
  document: string;
  is_active: boolean;
  roleName: string | null;
  fullName: string | null;
}): DriveVideoPlanPersonRow {
  const isVacancy = isVacancyPerson(
    {
      document: input.document,
      full_name: input.fullName ?? '',
      role_id: null,
    },
    input.roleName ? { name: input.roleName } : null,
  );
  return {
    id: input.id,
    document: input.document,
    is_active: input.is_active,
    roleName: input.roleName,
    fullName: input.fullName,
    isVacancy,
  };
}

export type { DriveVideoPlanPersonMatch, DriveVideoPlanEligibility };
