/**
 * Planificador compartido de sincronización Drive → organigrama.person_cv.
 *
 * Solo clasifica; NO escribe en BD ni en Drive.
 * Usado por diag-drive-cv y sync-drive-cv para el mismo resultado.
 *
 * Política cutover: la carpeta oficial es la única fuente de verdad.
 * person_cv activos sin PDF válido/único/sincronizable → DEACTIVATE_*.
 */
import { DataSource } from 'typeorm';
import type { DriveCvFile } from './drive-cv-types';
import {
  folderLabelsEqual,
  resolveSubareaFilter,
  type DriveCvAreaFilter,
} from './drive-cv-folder-filter';

export type SyncPlanStatus =
  | 'INVALID_FILENAME'
  | 'DUPLICATE_DOCUMENT'
  | 'PERSON_NOT_FOUND'
  | 'CORE_DOCUMENT_DUPLICATED'
  | 'DB_INCONSISTENCY'
  | 'NEW'
  | 'UNCHANGED'
  | 'MOVED'
  | 'UPDATED'
  | 'MISSING_FROM_DRIVE';

export type SyncPlanAction =
  | 'NONE'
  | 'INSERT'
  | 'UPDATE_MOVED'
  | 'UPDATE_UPDATED'
  | 'DEACTIVATE_MISSING'
  | 'DEACTIVATE_DUPLICATE'
  | 'REPORT_ONLY';

export type MissingReason =
  | 'absent'
  | 'invalid_filename'
  | 'duplicate_document';

export type CorePersonRow = {
  id: string;
  document: string;
  full_name: string | null;
  edu_email: string | null;
  is_active: boolean | null;
};

export type PersonCvRow = {
  id: string;
  person_id: string;
  document: string;
  drive_file_id: string;
  drive_file_name: string;
  drive_web_url: string;
  mime_type: string | null;
  is_active: boolean;
  drive_parent_folder_id: string | null;
  drive_area_folder: string | null;
  drive_subarea_folder: string | null;
  drive_relative_path: string | null;
  drive_modified_time: Date | string | null;
  drive_md5_checksum: string | null;
  drive_file_size: string | number | null;
};

export type SyncPlanItem = {
  status: SyncPlanStatus;
  action: SyncPlanAction;
  document: string | null;
  reasons: string[];
  driveFiles: DriveCvFile[];
  person: CorePersonRow | null;
  personCv: PersonCvRow | null;
  /** Motivo principal de desactivación, si aplica. */
  deactivateReason?: MissingReason;
  /** Archivos inválidos cuya cédula probable coincide (solo evidencia). */
  invalidCandidates?: DriveCvFile[];
};

export type SyncPlanSummary = {
  byStatus: Record<SyncPlanStatus, number>;
  insertCount: number;
  updateMovedCount: number;
  updateUpdatedCount: number;
  unchangedCount: number;
  deactivateMissingCount: number;
  deactivateDuplicateCount: number;
  /** Desglose de DEACTIVATE_MISSING por motivo. */
  deactivateByReason: Record<MissingReason, number>;
  omittedCount: number;
  /** Activos que permanecerían tras apply+deactivate (proyección). */
  projectedActiveAfterFullApply: number | null;
};

export type SyncPlanResult = {
  items: SyncPlanItem[];
  summary: SyncPlanSummary;
  /** true si el inventario fue filtrado por área/escuela. */
  filtered: boolean;
  filter: DriveCvAreaFilter;
  /** Columnas de metadatos Drive presentes en person_cv (migración 012). */
  hasDriveMetaColumns: boolean;
  activePersonCvTotal: number;
  /** true si el plan incluye propuestas DEACTIVATE_* (solo inventario raíz). */
  deactivationsProposed: boolean;
};

const ALL_STATUSES: SyncPlanStatus[] = [
  'INVALID_FILENAME',
  'DUPLICATE_DOCUMENT',
  'PERSON_NOT_FOUND',
  'CORE_DOCUMENT_DUPLICATED',
  'DB_INCONSISTENCY',
  'NEW',
  'UNCHANGED',
  'MOVED',
  'UPDATED',
  'MISSING_FROM_DRIVE',
];

function emptyByStatus(): Record<SyncPlanStatus, number> {
  return Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<
    SyncPlanStatus,
    number
  >;
}

function actionForStatus(status: SyncPlanStatus): SyncPlanAction {
  switch (status) {
    case 'NEW':
      return 'INSERT';
    case 'MOVED':
      return 'UPDATE_MOVED';
    case 'UPDATED':
      return 'UPDATE_UPDATED';
    case 'UNCHANGED':
      return 'NONE';
    default:
      return 'REPORT_ONLY';
  }
}

function normStr(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function sameOptionalString(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  return normStr(a) === normStr(b);
}

function toIsoMaybe(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function sameOptionalTime(
  dbValue: Date | string | null | undefined,
  driveValue: string | null | undefined,
): boolean {
  const a = toIsoMaybe(dbValue);
  const b = toIsoMaybe(driveValue ?? null);
  if (a == null || b == null) return true;
  return a === b;
}

function sameOptionalMd5(
  dbValue: string | null | undefined,
  driveValue: string | null | undefined,
): boolean {
  const a = normStr(dbValue).toLowerCase();
  const b = normStr(driveValue).toLowerCase();
  if (!a || !b) return true;
  return a === b;
}

function sameOptionalSize(
  dbValue: string | number | null | undefined,
  driveValue: number | null | undefined,
): boolean {
  if (dbValue == null || dbValue === '' || driveValue == null) return true;
  const n = typeof dbValue === 'number' ? dbValue : Number(dbValue);
  if (!Number.isFinite(n)) return true;
  return n === driveValue;
}

/**
 * Extrae solo dígitos del nombre (sin validar la regla estricta).
 * Solo para evidenciar candidatos inválidos; NUNCA enlaza automáticamente.
 */
export function extractProbableDocumentDigits(
  fileName: string,
): string | null {
  const base = fileName.replace(/\.pdf$/i, '').trim();
  const digits = base.replace(/\D+/g, '');
  return digits.length > 0 ? digits : null;
}

/**
 * Clasifica UNCHANGED / MOVED / UPDATED comparando person_cv activo vs Drive.
 */
export function classifyExistingCv(
  cv: PersonCvRow,
  file: DriveCvFile,
): { status: 'UNCHANGED' | 'MOVED' | 'UPDATED'; reasons: string[] } {
  const reasons: string[] = [];

  const fileIdChanged = normStr(cv.drive_file_id) !== normStr(file.driveFileId);
  const nameChanged =
    normStr(cv.drive_file_name) !== normStr(file.driveFileName);
  const urlChanged = normStr(cv.drive_web_url) !== normStr(file.driveWebUrl);

  const md5Both =
    !!normStr(cv.drive_md5_checksum) && !!normStr(file.md5Checksum);
  const md5Changed =
    md5Both && !sameOptionalMd5(cv.drive_md5_checksum, file.md5Checksum);

  const sizeBoth =
    cv.drive_file_size != null &&
    cv.drive_file_size !== '' &&
    file.fileSize != null;
  const sizeChanged =
    sizeBoth && !sameOptionalSize(cv.drive_file_size, file.fileSize);

  if (fileIdChanged) reasons.push('drive_file_id_changed');
  if (nameChanged) reasons.push('drive_file_name_changed');
  if (urlChanged) reasons.push('drive_web_url_changed');
  if (md5Changed) reasons.push('drive_md5_checksum_changed');
  if (sizeChanged) reasons.push('drive_file_size_changed');

  const contentOrIdentityChanged =
    fileIdChanged || nameChanged || urlChanged || md5Changed || sizeChanged;

  if (contentOrIdentityChanged) {
    return { status: 'UPDATED', reasons };
  }

  const parentChanged = !sameOptionalString(
    cv.drive_parent_folder_id,
    file.parentFolderId,
  );
  const areaChanged = !sameOptionalString(
    cv.drive_area_folder,
    file.areaFolder,
  );
  const subareaChanged = !sameOptionalString(
    cv.drive_subarea_folder,
    file.subareaFolder,
  );
  const pathChanged = !sameOptionalString(
    cv.drive_relative_path,
    file.relativePath,
  );

  const timeBoth =
    toIsoMaybe(cv.drive_modified_time) != null &&
    toIsoMaybe(file.modifiedTime) != null;
  const timeChanged =
    timeBoth && !sameOptionalTime(cv.drive_modified_time, file.modifiedTime);

  if (parentChanged) reasons.push('parent_folder_changed');
  if (areaChanged) reasons.push('area_folder_changed');
  if (subareaChanged) reasons.push('subarea_folder_changed');
  if (pathChanged) reasons.push('relative_path_changed');
  if (timeChanged) reasons.push('modified_time_changed');

  const locationChanged =
    parentChanged || areaChanged || subareaChanged || pathChanged;

  if (locationChanged) {
    return { status: 'MOVED', reasons };
  }

  if (timeChanged) {
    return { status: 'UPDATED', reasons };
  }

  return { status: 'UNCHANGED', reasons: ['no_changes'] };
}

export function isAreaFilterActive(filter: DriveCvAreaFilter): boolean {
  return Boolean(filter.area?.trim());
}

/**
 * Filtra el inventario por área y opcionalmente escuela/subárea.
 */
export function filterInventoryByArea(
  files: DriveCvFile[],
  filter: DriveCvAreaFilter,
): { files: DriveCvFile[]; filtered: boolean } {
  const area = filter.area?.trim();
  if (!area) {
    return { files, filtered: false };
  }

  const areas = new Set(
    files
      .map((f) => f.areaFolder)
      .filter((a): a is string => !!a && a.trim().length > 0),
  );

  const areaMatch = [...areas].find((a) => folderLabelsEqual(a, area));
  if (!areaMatch) {
    const available = [...areas].sort((a, b) => a.localeCompare(b, 'es'));
    throw new Error(
      `El área "${area}" no existe en el inventario. Áreas disponibles: ${
        available.length ? available.join(', ') : '(ninguna)'
      }`,
    );
  }

  const subarea = resolveSubareaFilter(filter);
  let scoped = files.filter(
    (f) => f.areaFolder != null && folderLabelsEqual(f.areaFolder, areaMatch),
  );

  if (subarea) {
    const schools = new Set(
      scoped
        .map((f) => f.subareaFolder)
        .filter((s): s is string => !!s && s.trim().length > 0),
    );
    const schoolMatch = [...schools].find((s) =>
      folderLabelsEqual(s, subarea),
    );
    if (!schoolMatch) {
      const available = [...schools].sort((a, b) => a.localeCompare(b, 'es'));
      throw new Error(
        `La escuela/subárea "${subarea}" no existe dentro del área "${areaMatch}". ` +
          `Disponibles: ${available.length ? available.join(', ') : '(ninguna)'}`,
      );
    }
    scoped = scoped.filter(
      (f) =>
        f.subareaFolder != null &&
        folderLabelsEqual(f.subareaFolder, schoolMatch),
    );
  }

  return { files: scoped, filtered: true };
}

async function detectDriveMetaColumns(ds: DataSource): Promise<boolean> {
  const rows = await ds.query<{ column_name: string }[]>(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'organigrama'
        AND table_name = 'person_cv'
        AND column_name = 'drive_relative_path'`,
  );
  return rows.length > 0;
}

async function queryCorePersons(
  ds: DataSource,
  documents: string[],
): Promise<CorePersonRow[]> {
  if (documents.length === 0) return [];
  return ds.query<CorePersonRow[]>(
    `SELECT p.id, p.document, p.full_name, p.edu_email, p.is_active
       FROM core.person p
      WHERE p.document = ANY($1::text[])`,
    [documents],
  );
}

async function queryActivePersonCvs(
  ds: DataSource,
  hasMeta: boolean,
): Promise<PersonCvRow[]> {
  if (hasMeta) {
    return ds.query<PersonCvRow[]>(
      `SELECT id::text,
              person_id::text,
              document,
              drive_file_id,
              drive_file_name,
              drive_web_url,
              mime_type,
              is_active,
              drive_parent_folder_id,
              drive_area_folder,
              drive_subarea_folder,
              drive_relative_path,
              drive_modified_time,
              drive_md5_checksum,
              drive_file_size
         FROM organigrama.person_cv
        WHERE is_active = TRUE`,
    );
  }

  const rows = await ds.query<
    Omit<
      PersonCvRow,
      | 'drive_parent_folder_id'
      | 'drive_area_folder'
      | 'drive_subarea_folder'
      | 'drive_relative_path'
      | 'drive_modified_time'
      | 'drive_md5_checksum'
      | 'drive_file_size'
    >[]
  >(
    `SELECT id::text,
            person_id::text,
            document,
            drive_file_id,
            drive_file_name,
            drive_web_url,
            mime_type,
            is_active
       FROM organigrama.person_cv
      WHERE is_active = TRUE`,
  );

  return rows.map((r) => ({
    ...r,
    drive_parent_folder_id: null,
    drive_area_folder: null,
    drive_subarea_folder: null,
    drive_relative_path: null,
    drive_modified_time: null,
    drive_md5_checksum: null,
    drive_file_size: null,
  }));
}

async function queryInactiveCvCountsByPerson(
  ds: DataSource,
  personIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (personIds.length === 0) return map;
  const rows = await ds.query<{ person_id: string; n: string }[]>(
    `SELECT person_id::text AS person_id, COUNT(*)::int AS n
       FROM organigrama.person_cv
      WHERE is_active = FALSE
        AND person_id = ANY($1::bigint[])
      GROUP BY person_id`,
    [personIds],
  );
  for (const row of rows) {
    map.set(row.person_id, Number(row.n));
  }
  return map;
}

function buildSummary(
  items: SyncPlanItem[],
  activeTotal: number,
  filtered: boolean,
): SyncPlanSummary {
  const byStatus = emptyByStatus();
  let insertCount = 0;
  let updateMovedCount = 0;
  let updateUpdatedCount = 0;
  let unchangedCount = 0;
  let deactivateMissingCount = 0;
  let deactivateDuplicateCount = 0;
  let omittedCount = 0;
  const deactivateByReason: Record<MissingReason, number> = {
    absent: 0,
    invalid_filename: 0,
    duplicate_document: 0,
  };

  for (const item of items) {
    byStatus[item.status] += 1;
    if (item.action === 'INSERT') insertCount += 1;
    else if (item.action === 'UPDATE_MOVED') updateMovedCount += 1;
    else if (item.action === 'UPDATE_UPDATED') updateUpdatedCount += 1;
    else if (item.action === 'DEACTIVATE_MISSING') {
      deactivateMissingCount += 1;
      if (item.deactivateReason) {
        deactivateByReason[item.deactivateReason] += 1;
      } else {
        deactivateByReason.absent += 1;
      }
    } else if (item.action === 'DEACTIVATE_DUPLICATE') {
      deactivateDuplicateCount += 1;
      deactivateByReason.duplicate_document += 1;
    } else if (item.status === 'UNCHANGED') unchangedCount += 1;
    else if (item.action === 'REPORT_ONLY') omittedCount += 1;
  }

  const projectedActiveAfterFullApply = filtered
    ? null
    : activeTotal -
      deactivateMissingCount -
      deactivateDuplicateCount +
      insertCount;

  return {
    byStatus,
    insertCount,
    updateMovedCount,
    updateUpdatedCount,
    unchangedCount,
    deactivateMissingCount,
    deactivateDuplicateCount,
    deactivateByReason,
    omittedCount,
    projectedActiveAfterFullApply,
  };
}

/**
 * Construye el plan de sincronización a partir del inventario de Drive.
 */
export async function buildDriveCvSyncPlan(params: {
  dataSource: DataSource;
  files: DriveCvFile[];
  filter?: DriveCvAreaFilter;
  /**
   * Si true (default cuando no hay filtro), evalúa ausencias globales
   * y propone DEACTIVATE_* para person_cv activos no sincronizables.
   */
  includeMissingFromDrive?: boolean;
}): Promise<SyncPlanResult> {
  const filter = params.filter ?? {};
  const { files: scopedFiles, filtered } = filterInventoryByArea(
    params.files,
    filter,
  );

  const includeMissing = params.includeMissingFromDrive ?? !filtered;

  const hasDriveMetaColumns = await detectDriveMetaColumns(params.dataSource);
  const activeCvs = await queryActivePersonCvs(
    params.dataSource,
    hasDriveMetaColumns,
  );

  const items: SyncPlanItem[] = [];

  // Candidatos inválidos indexados por dígitos probables (solo evidencia).
  const invalidFiles = scopedFiles.filter((f) => f.document == null);
  const invalidByProbableDoc = new Map<string, DriveCvFile[]>();
  for (const file of invalidFiles) {
    items.push({
      status: 'INVALID_FILENAME',
      action: 'REPORT_ONLY',
      document: null,
      reasons: ['filename_not_digits_pdf'],
      driveFiles: [file],
      person: null,
      personCv: null,
    });
    const probable = extractProbableDocumentDigits(file.driveFileName);
    if (!probable) continue;
    const list = invalidByProbableDoc.get(probable) ?? [];
    list.push(file);
    invalidByProbableDoc.set(probable, list);
  }

  const byDocument = new Map<string, DriveCvFile[]>();
  for (const file of scopedFiles) {
    if (!file.document) continue;
    const list = byDocument.get(file.document) ?? [];
    list.push(file);
    byDocument.set(file.document, list);
  }

  const uniqueDocuments = [...byDocument.keys()];
  const docsForCore = [
    ...new Set([
      ...uniqueDocuments,
      ...activeCvs.map((c) => c.document),
    ]),
  ];
  const corePersons = await queryCorePersons(params.dataSource, docsForCore);
  const personsByDocument = new Map<string, CorePersonRow[]>();
  for (const person of corePersons) {
    const list = personsByDocument.get(person.document) ?? [];
    list.push(person);
    personsByDocument.set(person.document, list);
  }

  const activeByPersonId = new Map<string, PersonCvRow[]>();
  const activeByDocument = new Map<string, PersonCvRow[]>();
  for (const cv of activeCvs) {
    const byPerson = activeByPersonId.get(cv.person_id) ?? [];
    byPerson.push(cv);
    activeByPersonId.set(cv.person_id, byPerson);

    const byDoc = activeByDocument.get(cv.document) ?? [];
    byDoc.push(cv);
    activeByDocument.set(cv.document, byDoc);
  }

  /** Documentos con exactamente 1 PDF válido que se sincronizan (o intentan). */
  const syncableDocuments = new Set<string>();
  /** Documentos con duplicado Drive (bloquean sync y pueden desactivar). */
  const duplicateDocuments = new Set<string>();

  const newPersonIds: string[] = [];

  for (const document of uniqueDocuments) {
    const driveFiles = byDocument.get(document) ?? [];

    if (driveFiles.length > 1) {
      duplicateDocuments.add(document);
      const persons = personsByDocument.get(document) ?? [];
      const person = persons.length === 1 ? persons[0] : null;
      const cvsForPerson = person
        ? (activeByPersonId.get(person.id) ?? [])
        : (activeByDocument.get(document) ?? []);
      const personCv =
        cvsForPerson.length === 1 ? cvsForPerson[0] : cvsForPerson[0] ?? null;

      const canDeactivate =
        includeMissing &&
        person != null &&
        cvsForPerson.length === 1 &&
        personCv != null;

      items.push({
        status: 'DUPLICATE_DOCUMENT',
        action: canDeactivate ? 'DEACTIVATE_DUPLICATE' : 'REPORT_ONLY',
        document,
        reasons: canDeactivate
          ? [`duplicate_paths=${driveFiles.length}`, 'deactivate_while_unresolved']
          : [`duplicate_paths=${driveFiles.length}`],
        driveFiles,
        person,
        personCv: canDeactivate ? personCv : personCv,
        deactivateReason: canDeactivate ? 'duplicate_document' : undefined,
      });
      continue;
    }

    const file = driveFiles[0];
    const persons = personsByDocument.get(document) ?? [];

    if (persons.length === 0) {
      items.push({
        status: 'PERSON_NOT_FOUND',
        action: 'REPORT_ONLY',
        document,
        reasons: ['no_core_person'],
        driveFiles: [file],
        person: null,
        personCv: null,
      });
      continue;
    }

    if (persons.length > 1) {
      items.push({
        status: 'CORE_DOCUMENT_DUPLICATED',
        action: 'REPORT_ONLY',
        document,
        reasons: [`core_person_count=${persons.length}`],
        driveFiles: [file],
        person: null,
        personCv: null,
      });
      continue;
    }

    const person = persons[0];
    const cvsForPerson = activeByPersonId.get(person.id) ?? [];

    if (cvsForPerson.length > 1) {
      items.push({
        status: 'DB_INCONSISTENCY',
        action: 'REPORT_ONLY',
        document,
        reasons: [`active_person_cv_count=${cvsForPerson.length}`],
        driveFiles: [file],
        person,
        personCv: cvsForPerson[0] ?? null,
      });
      continue;
    }

    syncableDocuments.add(document);

    if (cvsForPerson.length === 0) {
      newPersonIds.push(person.id);
      items.push({
        status: 'NEW',
        action: 'INSERT',
        document,
        reasons: ['no_active_person_cv'], // se especializa abajo
        driveFiles: [file],
        person,
        personCv: null,
      });
      continue;
    }

    const personCv = cvsForPerson[0];
    const classified = classifyExistingCv(personCv, file);
    items.push({
      status: classified.status,
      action: actionForStatus(classified.status),
      document,
      reasons: classified.reasons,
      driveFiles: [file],
      person,
      personCv,
    });
  }

  // Especializar NEW: first_cv vs replacement_after_inactive
  if (newPersonIds.length > 0) {
    const inactiveCounts = await queryInactiveCvCountsByPerson(
      params.dataSource,
      newPersonIds,
    );
    for (const item of items) {
      if (item.status !== 'NEW' || !item.person) continue;
      const inactive = inactiveCounts.get(item.person.id) ?? 0;
      if (inactive > 0) {
        item.reasons = ['replacement_after_inactive', `inactive_rows=${inactive}`];
      } else {
        item.reasons = ['first_cv'];
      }
    }
  }

  // Ausencias globales: solo inventario raíz completo (sin filtros).
  if (includeMissing) {
    const handledPersonIds = new Set<string>();
    for (const item of items) {
      if (
        item.action === 'DEACTIVATE_DUPLICATE' &&
        item.personCv?.person_id
      ) {
        handledPersonIds.add(item.personCv.person_id);
      }
      if (
        (item.status === 'NEW' ||
          item.status === 'UNCHANGED' ||
          item.status === 'MOVED' ||
          item.status === 'UPDATED' ||
          item.status === 'DB_INCONSISTENCY') &&
        item.person
      ) {
        handledPersonIds.add(item.person.id);
      }
      // Anomalías Core/BD: no desactivar automáticamente a nadie ligado al documento.
      if (
        item.status === 'CORE_DOCUMENT_DUPLICATED' ||
        item.status === 'DB_INCONSISTENCY'
      ) {
        if (item.document) {
          for (const cv of activeByDocument.get(item.document) ?? []) {
            handledPersonIds.add(cv.person_id);
          }
        }
        if (item.personCv?.person_id) {
          handledPersonIds.add(item.personCv.person_id);
        }
      }
    }

    for (const cv of activeCvs) {
      if (handledPersonIds.has(cv.person_id)) continue;
      if (syncableDocuments.has(cv.document)) continue;
      if (duplicateDocuments.has(cv.document)) {
        // Ya cubierto (o no desactivable por multi-person); evitar doble item.
        continue;
      }

      const persons = personsByDocument.get(cv.document) ?? [];
      const person = persons.length === 1 ? persons[0] : null;
      const invalidCandidates = invalidByProbableDoc.get(cv.document) ?? [];
      const reasons: string[] = ['absent'];
      if (invalidCandidates.length > 0) {
        reasons.push('invalid_candidate_detected');
      }

      items.push({
        status: 'MISSING_FROM_DRIVE',
        action: 'DEACTIVATE_MISSING',
        document: cv.document,
        reasons,
        driveFiles: [],
        person,
        personCv: cv,
        deactivateReason:
          invalidCandidates.length > 0 ? 'invalid_filename' : 'absent',
        invalidCandidates,
      });
      handledPersonIds.add(cv.person_id);
    }
  }

  const statusOrder = new Map(ALL_STATUSES.map((s, i) => [s, i]));
  items.sort((a, b) => {
    const sa = statusOrder.get(a.status) ?? 99;
    const sb = statusOrder.get(b.status) ?? 99;
    if (sa !== sb) return sa - sb;
    return (a.document ?? '').localeCompare(b.document ?? '', 'es');
  });

  const summary = buildSummary(items, activeCvs.length, filtered);
  const deactivationsProposed =
    summary.deactivateMissingCount + summary.deactivateDuplicateCount > 0;

  return {
    items,
    summary,
    filtered,
    filter,
    hasDriveMetaColumns,
    activePersonCvTotal: activeCvs.length,
    deactivationsProposed,
  };
}

export function summarizeByArea(files: DriveCvFile[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of files) {
    const key = f.areaFolder ?? '(raíz)';
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

export function summarizeBySubarea(
  files: DriveCvFile[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const f of files) {
    if (!f.subareaFolder) continue;
    const key = `${f.areaFolder ?? '?'}/${f.subareaFolder}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
