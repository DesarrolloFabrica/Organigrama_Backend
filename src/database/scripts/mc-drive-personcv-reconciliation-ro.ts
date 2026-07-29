/**
 * MC1 — Reconciliación READ-ONLY Drive ↔ person_cv ↔ cv_extraction.
 *
 * npm run mc:reconcile-drive-cv -- --export-json=tmp/mc-drive-personcv-reconciliation.json
 *
 * Usa inventoryCvPdfFiles (misma vía que sync-drive-cv).
 * Solo SELECT + lectura Drive. writes: 0.
 */
import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { inventoryCvPdfFiles } from './utils/google-drive-cv-client';
import type { DriveCvFile } from './utils/drive-cv-types';

const TAG = '[MC1 Drive↔CV reconcile RO]';
const OFFICIAL_FOLDER = '1ZNdLeKoR-KiUqoKnG4NBJT2-sWj6Yy5D';

type DrivePersonCvStatus =
  | 'ALIGNED'
  | 'MISSING_IN_DRIVE'
  | 'MISSING_IN_PERSON_CV'
  | 'FILE_ID_CHANGED'
  | 'DUPLICATE_IN_DRIVE'
  | 'INVALID_FILE_NAME'
  | 'MULTIPLE_MATCHES';

type CvExtractionStatus =
  | 'CURRENT'
  | 'STALE_FILE_ID'
  | 'NO_EXTRACTION'
  | 'MULTIPLE_ACTIVE_EXTRACTIONS'
  | 'FAILED_EXTRACTION';

type GlobalStatus =
  | 'HEALTHY'
  | 'ORPHAN_PERSON_CV'
  | 'ORPHAN_EXTRACTION'
  | 'STALE_EXTRACTION'
  | 'NEEDS_SYNC'
  | 'NEEDS_REEXTRACTION'
  | 'MANUAL_REVIEW';

type PersonCvRow = {
  person_cv_id: string;
  person_id: string;
  document: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  drive_web_url: string | null;
  synced_at: string | null;
  is_active: boolean;
};

type ExtractionRow = {
  extraction_id: string;
  person_id: string;
  document: string;
  drive_file_id: string | null;
  status: string;
  is_active: boolean;
  started_at: string | null;
  finished_at: string | null;
  model: string | null;
  prompt_version: string | null;
  extractor_version: string | null;
};

function esc(s: string | null | undefined): string {
  return String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function classifyDrivePersonCv(
  document: string | null,
  driveFiles: DriveCvFile[],
  cvs: PersonCvRow[],
): { status: DrivePersonCvStatus; observation: string } {
  const invalidOnly =
    driveFiles.length > 0 && driveFiles.every((f) => !f.document);
  if (invalidOnly && cvs.length === 0) {
    return {
      status: 'INVALID_FILE_NAME',
      observation: driveFiles.map((f) => f.driveFileName).join(', '),
    };
  }

  if (!document) {
    return {
      status: 'INVALID_FILE_NAME',
      observation: driveFiles.map((f) => f.relativePath).join(', '),
    };
  }

  const validDrive = driveFiles.filter((f) => f.document === document);
  if (validDrive.length > 1) {
    return {
      status: 'DUPLICATE_IN_DRIVE',
      observation: `${validDrive.length} PDFs: ${validDrive.map((f) => f.relativePath).join(' | ')}`,
    };
  }
  if (cvs.length > 1) {
    return {
      status: 'MULTIPLE_MATCHES',
      observation: `${cvs.length} person_cv activos`,
    };
  }
  if (validDrive.length === 1 && cvs.length === 0) {
    return {
      status: 'MISSING_IN_PERSON_CV',
      observation: `Drive ${validDrive[0].relativePath}`,
    };
  }
  if (validDrive.length === 0 && cvs.length === 1) {
    return {
      status: 'MISSING_IN_DRIVE',
      observation: `person_cv file_id=${cvs[0].drive_file_id}`,
    };
  }
  if (validDrive.length === 1 && cvs.length === 1) {
    const d = validDrive[0];
    const c = cvs[0];
    if ((c.drive_file_id ?? '').trim() !== d.driveFileId) {
      return {
        status: 'FILE_ID_CHANGED',
        observation: `Drive=${d.driveFileId} person_cv=${c.drive_file_id}`,
      };
    }
    return { status: 'ALIGNED', observation: d.relativePath };
  }
  if (validDrive.length === 0 && cvs.length === 0) {
    return { status: 'MULTIPLE_MATCHES', observation: 'sin lados' };
  }
  return {
    status: 'MULTIPLE_MATCHES',
    observation: `drive=${validDrive.length} cv=${cvs.length}`,
  };
}

function classifyCvExtraction(
  cv: PersonCvRow | null,
  exts: ExtractionRow[],
): { status: CvExtractionStatus; observation: string; primary: ExtractionRow | null } {
  const active = exts.filter((e) => e.is_active);
  const activeSucceeded = active.filter((e) => e.status === 'SUCCEEDED');
  const activeFailed = active.filter((e) => e.status === 'FAILED');

  if (active.length > 1) {
    return {
      status: 'MULTIPLE_ACTIVE_EXTRACTIONS',
      observation: `activas=${active.length} ids=${active.map((e) => e.extraction_id).join(',')}`,
      primary: activeSucceeded[0] ?? active[0] ?? null,
    };
  }
  if (activeSucceeded.length === 0 && activeFailed.length > 0) {
    return {
      status: 'FAILED_EXTRACTION',
      observation: `FAILED id=${activeFailed[0].extraction_id}`,
      primary: activeFailed[0],
    };
  }
  if (activeSucceeded.length === 0) {
    return {
      status: 'NO_EXTRACTION',
      observation: exts.length
        ? `solo históricas (${exts.length})`
        : 'sin extracciones',
      primary: null,
    };
  }
  const ext = activeSucceeded[0];
  if (!cv) {
    return {
      status: 'NO_EXTRACTION',
      observation: 'sin person_cv activo',
      primary: ext,
    };
  }
  const cvFid = (cv.drive_file_id ?? '').trim();
  const extFid = (ext.drive_file_id ?? '').trim();
  if (cvFid && extFid && cvFid !== extFid) {
    return {
      status: 'STALE_FILE_ID',
      observation: `cv=${cvFid} ext=${extFid}`,
      primary: ext,
    };
  }
  return {
    status: 'CURRENT',
    observation: `extraction=${ext.extraction_id}`,
    primary: ext,
  };
}

function classifyGlobal(params: {
  driveStatus: DrivePersonCvStatus;
  extStatus: CvExtractionStatus;
  inDrive: boolean;
  inCv: boolean;
  inExt: boolean;
}): { status: GlobalStatus; action: string } {
  const { driveStatus, extStatus, inDrive, inCv, inExt } = params;

  if (driveStatus === 'ALIGNED' && extStatus === 'CURRENT') {
    return { status: 'HEALTHY', action: 'Ninguna' };
  }

  if (inCv && !inDrive) {
    return {
      status: 'ORPHAN_PERSON_CV',
      action: 'Revisar: desactivar person_cv o restaurar PDF en Drive',
    };
  }
  if (inExt && !inCv && !inDrive) {
    return {
      status: 'ORPHAN_EXTRACTION',
      action: 'Revisar extracción activa huérfana',
    };
  }
  if (driveStatus === 'MISSING_IN_PERSON_CV') {
    return {
      status: 'NEEDS_SYNC',
      action: 'Sincronizar Drive → person_cv (cuando se autorice)',
    };
  }
  if (driveStatus === 'FILE_ID_CHANGED') {
    return {
      status: 'NEEDS_SYNC',
      action: 'Actualizar person_cv.drive_file_id al de Drive (cuando se autorice)',
    };
  }
  if (extStatus === 'STALE_FILE_ID') {
    return {
      status: 'STALE_EXTRACTION',
      action: 'Reextracción sobre person_cv actual (cuando se autorice)',
    };
  }
  if (extStatus === 'NO_EXTRACTION' && inCv && inDrive) {
    return {
      status: 'NEEDS_REEXTRACTION',
      action: 'Ejecutar extracción nueva (cuando se autorice)',
    };
  }
  if (extStatus === 'FAILED_EXTRACTION') {
    return {
      status: 'NEEDS_REEXTRACTION',
      action: 'Reintentar extracción FAILED',
    };
  }
  if (
    driveStatus === 'DUPLICATE_IN_DRIVE' ||
    driveStatus === 'MULTIPLE_MATCHES' ||
    driveStatus === 'INVALID_FILE_NAME' ||
    extStatus === 'MULTIPLE_ACTIVE_EXTRACTIONS'
  ) {
    return {
      status: 'MANUAL_REVIEW',
      action: 'Resolver duplicados / nombres / múltiples activos manualmente',
    };
  }
  if (inExt && inCv && !inDrive) {
    return {
      status: 'ORPHAN_PERSON_CV',
      action: 'CV/extracción sin PDF en Drive',
    };
  }
  // ALIGNED Drive+CV but no extraction already handled; ALIGNED + other
  if (driveStatus === 'ALIGNED' && extStatus === 'NO_EXTRACTION') {
    return {
      status: 'NEEDS_REEXTRACTION',
      action: 'Ejecutar extracción nueva (cuando se autorice)',
    };
  }
  return {
    status: 'MANUAL_REVIEW',
    action: 'Revisar combinación Drive/CV/Extraction',
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const jsonArg = argv.find((a) => a.startsWith('--export-json='));
  const mdArg = argv.find((a) => a.startsWith('--export-md='));
  const jsonPath = resolve(
    process.cwd(),
    jsonArg?.slice('--export-json='.length) ??
      'tmp/mc-drive-personcv-reconciliation.json',
  );
  const mdPath = resolve(
    process.cwd(),
    mdArg?.slice('--export-md='.length) ??
      'docs/mc1-drive-personcv-reconciliation-report.md',
  );

  const envFolder = process.env.GOOGLE_DRIVE_CV_FOLDER_ID?.trim() ?? '';
  if (envFolder && envFolder !== OFFICIAL_FOLDER) {
    console.warn(
      `${TAG} AVISO: .env folder=${envFolder} ≠ oficial ${OFFICIAL_FOLDER}. Se usa el oficial confirmado.`,
    );
  }

  console.log(`${TAG} Inventario Drive (recursivo, RO) folder=${OFFICIAL_FOLDER}`);
  const inventory = await inventoryCvPdfFiles(OFFICIAL_FOLDER);
  console.log(
    `${TAG} Drive OK name=${inventory.rootFolderName} pdfs=${inventory.pdfCount} folders=${inventory.foldersVisited}`,
  );

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });

  try {
    const ds = app.get(DataSource);

    const personCvs = (await ds.query(
      `SELECT id::text AS person_cv_id,
              person_id::text AS person_id,
              document,
              drive_file_id,
              drive_file_name,
              drive_web_url,
              synced_at::text AS synced_at,
              is_active
         FROM organigrama.person_cv
        WHERE is_active = TRUE
        ORDER BY document ASC NULLS LAST, id ASC`,
    )) as PersonCvRow[];

    const extractions = (await ds.query(
      `SELECT id::text AS extraction_id,
              person_id::text AS person_id,
              document,
              drive_file_id,
              status,
              is_active,
              started_at::text AS started_at,
              finished_at::text AS finished_at,
              model,
              prompt_version,
              extractor_version
         FROM organigrama.cv_extraction
        WHERE is_active = TRUE
        ORDER BY document ASC NULLS LAST, id ASC`,
    )) as ExtractionRow[];

    // All extractions for stale/history context on active CV persons
    const allExtForActiveCvPersons = (await ds.query(
      `SELECT e.id::text AS extraction_id,
              e.person_id::text AS person_id,
              e.document,
              e.drive_file_id,
              e.status,
              e.is_active,
              e.started_at::text AS started_at,
              e.finished_at::text AS finished_at,
              e.model,
              e.prompt_version,
              e.extractor_version
         FROM organigrama.cv_extraction e
        WHERE e.person_id IN (
          SELECT person_id FROM organigrama.person_cv WHERE is_active = TRUE
        )
        ORDER BY e.person_id, e.is_active DESC, e.id DESC`,
    )) as ExtractionRow[];

    console.log(
      `${TAG} person_cv activos=${personCvs.length} extractions activas=${extractions.length}`,
    );

    const driveByDoc = new Map<string, DriveCvFile[]>();
    const invalidFiles: DriveCvFile[] = [];
    for (const f of inventory.files) {
      if (!f.document) {
        invalidFiles.push(f);
        continue;
      }
      const list = driveByDoc.get(f.document) ?? [];
      list.push(f);
      driveByDoc.set(f.document, list);
    }

    const cvByDoc = new Map<string, PersonCvRow[]>();
    for (const cv of personCvs) {
      const doc = String(cv.document ?? '').trim();
      if (!doc) continue;
      const list = cvByDoc.get(doc) ?? [];
      list.push(cv);
      cvByDoc.set(doc, list);
    }

    const activeExtByPerson = new Map<string, ExtractionRow[]>();
    for (const e of extractions) {
      const list = activeExtByPerson.get(e.person_id) ?? [];
      list.push(e);
      activeExtByPerson.set(e.person_id, list);
    }

    const allExtByPerson = new Map<string, ExtractionRow[]>();
    for (const e of allExtForActiveCvPersons) {
      const list = allExtByPerson.get(e.person_id) ?? [];
      list.push(e);
      allExtByPerson.set(e.person_id, list);
    }

    const allDocuments = new Set<string>([
      ...driveByDoc.keys(),
      ...cvByDoc.keys(),
    ]);

    type DriveCvRow = {
      document: string;
      drive: string;
      personCv: string;
      status: DrivePersonCvStatus;
      observation: string;
    };
    const driveCvRows: DriveCvRow[] = [];

    for (const doc of [...allDocuments].sort((a, b) => a.localeCompare(b))) {
      const driveFiles = driveByDoc.get(doc) ?? [];
      const cvs = cvByDoc.get(doc) ?? [];
      const { status, observation } = classifyDrivePersonCv(
        doc,
        driveFiles,
        cvs,
      );
      driveCvRows.push({
        document: doc,
        drive:
          driveFiles.length === 0
            ? '—'
            : driveFiles.map((f) => f.relativePath).join(' · '),
        personCv:
          cvs.length === 0
            ? '—'
            : cvs
                .map((c) => `id=${c.person_cv_id} file=${c.drive_file_id}`)
                .join(' · '),
        status,
        observation,
      });
    }

    for (const f of invalidFiles) {
      driveCvRows.push({
        document: `(invalid)${f.driveFileName}`,
        drive: f.relativePath,
        personCv: '—',
        status: 'INVALID_FILE_NAME',
        observation: f.driveFileName,
      });
    }

    type ExtRowOut = {
      document: string;
      personCv: string;
      extraction: string;
      status: CvExtractionStatus;
      observation: string;
    };
    const cvExtRows: ExtRowOut[] = [];

    type ConsolRow = {
      document: string;
      inDrive: boolean;
      inPersonCv: boolean;
      inExtraction: boolean;
      globalStatus: GlobalStatus;
      action: string;
      driveStatus: DrivePersonCvStatus | 'N/A';
      extStatus: CvExtractionStatus | 'N/A';
      observation: string;
    };
    const consolidated: ConsolRow[] = [];

    for (const doc of [...allDocuments].sort((a, b) => a.localeCompare(b))) {
      const driveFiles = driveByDoc.get(doc) ?? [];
      const cvs = cvByDoc.get(doc) ?? [];
      const driveClass = classifyDrivePersonCv(doc, driveFiles, cvs);
      const cv = cvs[0] ?? null;
      const personId = cv?.person_id;
      const activeExts = personId
        ? (activeExtByPerson.get(personId) ?? [])
        : [];
      // Also catch active extractions keyed by document without matching cv person
      const activeExtsByDoc = extractions.filter(
        (e) => String(e.document) === doc,
      );
      const extsForClassify =
        activeExts.length > 0 ? activeExts : activeExtsByDoc;

      const extClass = classifyCvExtraction(cv, extsForClassify);
      cvExtRows.push({
        document: doc,
        personCv: cv
          ? `id=${cv.person_cv_id} file=${cv.drive_file_id}`
          : '—',
        extraction: extClass.primary
          ? `id=${extClass.primary.extraction_id} status=${extClass.primary.status} file=${extClass.primary.drive_file_id}`
          : '—',
        status: extClass.status,
        observation: extClass.observation,
      });

      const inDrive = driveFiles.some((f) => f.document === doc);
      const inPersonCv = cvs.length > 0;
      const inExtraction = extsForClassify.some(
        (e) => e.is_active && e.status === 'SUCCEEDED',
      );
      const g = classifyGlobal({
        driveStatus: driveClass.status,
        extStatus: extClass.status,
        inDrive,
        inCv: inPersonCv,
        inExt: inExtraction,
      });

      consolidated.push({
        document: doc,
        inDrive,
        inPersonCv,
        inExtraction,
        globalStatus: g.status,
        action: g.action,
        driveStatus: driveClass.status,
        extStatus: extClass.status,
        observation: `${driveClass.observation} || ${extClass.observation}`,
      });
    }

    // Orphan active extractions whose document is not in drive nor active cv
    for (const e of extractions) {
      const doc = String(e.document ?? '').trim();
      if (!doc) continue;
      if (allDocuments.has(doc)) continue;
      consolidated.push({
        document: doc,
        inDrive: false,
        inPersonCv: false,
        inExtraction: true,
        globalStatus: 'ORPHAN_EXTRACTION',
        action: 'Revisar extracción activa sin CV/Drive',
        driveStatus: 'N/A',
        extStatus: e.status === 'FAILED' ? 'FAILED_EXTRACTION' : 'CURRENT',
        observation: `extraction=${e.extraction_id} file=${e.drive_file_id}`,
      });
      cvExtRows.push({
        document: doc,
        personCv: '—',
        extraction: `id=${e.extraction_id} status=${e.status}`,
        status:
          e.status === 'FAILED' ? 'FAILED_EXTRACTION' : 'NO_EXTRACTION',
        observation: 'extracción activa sin person_cv activo',
      });
    }

    const countBy = <T extends string>(
      rows: Array<{ status?: T; globalStatus?: T }>,
      key: 'status' | 'globalStatus',
    ) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = String((r as Record<string, unknown>)[key] ?? '');
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      return Object.fromEntries([...m.entries()].sort((a, b) => a[0].localeCompare(b[0])));
    };

    const uniqueDocs = allDocuments.size;
    const healthy = consolidated.filter((c) => c.globalStatus === 'HEALTHY');
    const critical = consolidated.filter((c) => c.globalStatus !== 'HEALTHY');

    const metrics = {
      pdfsInDrive: inventory.pdfCount,
      foldersVisited: inventory.foldersVisited,
      uniqueDocumentsDrive: driveByDoc.size,
      invalidFileNames: invalidFiles.length,
      uniqueDocumentsUniverse: uniqueDocs,
      activePersonCv: personCvs.length,
      activeExtractions: extractions.length,
      fullyAlignedHealthy: healthy.length,
      orphanPersonCv: consolidated.filter((c) => c.globalStatus === 'ORPHAN_PERSON_CV')
        .length,
      orphanExtraction: consolidated.filter(
        (c) => c.globalStatus === 'ORPHAN_EXTRACTION',
      ).length,
      needsSync: consolidated.filter((c) => c.globalStatus === 'NEEDS_SYNC')
        .length,
      needsReextraction: consolidated.filter(
        (c) =>
          c.globalStatus === 'NEEDS_REEXTRACTION' ||
          c.globalStatus === 'STALE_EXTRACTION',
      ).length,
      staleFileIdExtractions: cvExtRows.filter((r) => r.status === 'STALE_FILE_ID')
        .length,
      manualReview: consolidated.filter((c) => c.globalStatus === 'MANUAL_REVIEW')
        .length,
      drivePersonCvAligned: driveCvRows.filter((r) => r.status === 'ALIGNED')
        .length,
      missingInPersonCv: driveCvRows.filter(
        (r) => r.status === 'MISSING_IN_PERSON_CV',
      ).length,
      missingInDrive: driveCvRows.filter((r) => r.status === 'MISSING_IN_DRIVE')
        .length,
      fileIdChanged: driveCvRows.filter((r) => r.status === 'FILE_ID_CHANGED')
        .length,
      duplicateInDrive: driveCvRows.filter(
        (r) => r.status === 'DUPLICATE_IN_DRIVE',
      ).length,
    };

    const payload = {
      generatedAt: new Date().toISOString(),
      writes: 0 as const,
      folderId: OFFICIAL_FOLDER,
      rootFolderName: inventory.rootFolderName,
      metrics,
      drivePersonCvStatusCounts: countBy(driveCvRows, 'status'),
      cvExtractionStatusCounts: countBy(cvExtRows, 'status'),
      globalStatusCounts: countBy(consolidated, 'globalStatus'),
      driveCvRows,
      cvExtRows,
      consolidated,
      critical,
      invalidFiles: invalidFiles.map((f) => ({
        name: f.driveFileName,
        path: f.relativePath,
        fileId: f.driveFileId,
      })),
      driveInventorySample: inventory.files.slice(0, 5).map((f) => ({
        document: f.document,
        fileId: f.driveFileId,
        path: f.relativePath,
        size: f.fileSize,
        modifiedTime: f.modifiedTime,
        md5: f.md5Checksum,
      })),
    };

    mkdirSync(resolve(jsonPath, '..'), { recursive: true });
    writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`${TAG} JSON=${jsonPath}`);

    const md = buildMarkdown(payload);
    mkdirSync(resolve(mdPath, '..'), { recursive: true });
    writeFileSync(mdPath, md, 'utf8');
    console.log(`${TAG} MD=${mdPath}`);
    console.log(
      `${TAG} HEALTHY=${metrics.fullyAlignedHealthy} CRITICAL=${critical.length} writes=0`,
    );
  } finally {
    await app.close();
  }
}

function buildMarkdown(payload: {
  generatedAt: string;
  folderId: string;
  rootFolderName: string | null;
  metrics: Record<string, number>;
  drivePersonCvStatusCounts: Record<string, number>;
  cvExtractionStatusCounts: Record<string, number>;
  globalStatusCounts: Record<string, number>;
  driveCvRows: Array<{
    document: string;
    drive: string;
    personCv: string;
    status: string;
    observation: string;
  }>;
  cvExtRows: Array<{
    document: string;
    personCv: string;
    extraction: string;
    status: string;
    observation: string;
  }>;
  consolidated: Array<{
    document: string;
    inDrive: boolean;
    inPersonCv: boolean;
    inExtraction: boolean;
    globalStatus: string;
    action: string;
    observation: string;
  }>;
  critical: Array<{
    document: string;
    inDrive: boolean;
    inPersonCv: boolean;
    inExtraction: boolean;
    globalStatus: string;
    action: string;
    observation: string;
    driveStatus?: string;
    extStatus?: string;
  }>;
  invalidFiles: Array<{ name: string; path: string; fileId: string }>;
}): string {
  const m = payload.metrics;
  const lines: string[] = [];
  lines.push('# MC1 — Reconciliación Drive ↔ person_cv ↔ cv_extraction');
  lines.push('');
  lines.push(`**Estado:** AUDITORÍA DE RECONCILIACIÓN COMPLETADA / WRITES 0`);
  lines.push(`**Generado:** ${payload.generatedAt}`);
  lines.push(
    `**Folder oficial:** \`${payload.folderId}\` (${payload.rootFolderName ?? 'sin nombre'})`,
  );
  lines.push(`**Modo:** READ ONLY · sin sync · sin extracciones · sin UPDATE`);
  lines.push('');
  lines.push('## 1. Resumen ejecutivo');
  lines.push('');
  lines.push(
    `De un universo de **${m.uniqueDocumentsUniverse}** documentos (unión Drive válido + person_cv activos), **${m.fullyAlignedHealthy}** están **HEALTHY** (Drive ↔ person_cv alineados y extracción activa con el mismo \`drive_file_id\`). **${payload.critical.length}** requieren intervención o revisión.`,
  );
  lines.push('');
  lines.push('Hallazgos principales:');
  lines.push('');
  lines.push(
    `- PDFs en Drive sin \`person_cv\` (NEED SYNC): **${m.missingInPersonCv}**`,
  );
  lines.push(
    `- \`person_cv\` activos sin PDF en Drive (huérfanos): **${m.missingInDrive}** / global ORPHAN_PERSON_CV **${m.orphanPersonCv}**`,
  );
  lines.push(
    `- Extracciones con \`drive_file_id\` distinto al CV actual (STALE): **${m.staleFileIdExtractions}**`,
  );
  lines.push(`- Duplicados en Drive: **${m.duplicateInDrive}**`);
  lines.push(`- Nombres inválidos: **${m.invalidFileNames}**`);
  lines.push('');
  lines.push('## 2. Métricas');
  lines.push('');
  lines.push('| Métrica | Valor |');
  lines.push('| ------- | ----: |');
  lines.push(`| PDFs en Drive | ${m.pdfsInDrive} |`);
  lines.push(`| Carpetas visitadas | ${m.foldersVisited} |`);
  lines.push(`| Documentos únicos (Drive válidos) | ${m.uniqueDocumentsDrive} |`);
  lines.push(`| Documentos universo (Drive∪person_cv) | ${m.uniqueDocumentsUniverse} |`);
  lines.push(`| person_cv activos | ${m.activePersonCv} |`);
  lines.push(`| Extracciones activas | ${m.activeExtractions} |`);
  lines.push(`| Registros completamente alineados (HEALTHY) | ${m.fullyAlignedHealthy} |`);
  lines.push(`| Drive↔person_cv ALIGNED | ${m.drivePersonCvAligned} |`);
  lines.push(`| person_cv huérfanos (MISSING_IN_DRIVE) | ${m.missingInDrive} |`);
  lines.push(`| ORPHAN_PERSON_CV (global) | ${m.orphanPersonCv} |`);
  lines.push(`| Extracciones huérfanas (global) | ${m.orphanExtraction} |`);
  lines.push(`| Requieren sincronización (NEEDS_SYNC) | ${m.needsSync} |`);
  lines.push(`| Requieren reextracción / stale | ${m.needsReextraction} |`);
  lines.push(`| STALE_FILE_ID (person_cv↔extraction) | ${m.staleFileIdExtractions} |`);
  lines.push(`| Revisión manual | ${m.manualReview} |`);
  lines.push(`| FILE_ID_CHANGED | ${m.fileIdChanged} |`);
  lines.push(`| MISSING_IN_PERSON_CV | ${m.missingInPersonCv} |`);
  lines.push(`| DUPLICATE_IN_DRIVE | ${m.duplicateInDrive} |`);
  lines.push(`| INVALID_FILE_NAME | ${m.invalidFileNames} |`);
  lines.push('');
  lines.push('### Conteos por estado');
  lines.push('');
  lines.push('**Drive ↔ person_cv**');
  lines.push('');
  lines.push('| Estado | n |');
  lines.push('| ------ | -: |');
  for (const [k, v] of Object.entries(payload.drivePersonCvStatusCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('**person_cv ↔ cv_extraction**');
  lines.push('');
  lines.push('| Estado | n |');
  lines.push('| ------ | -: |');
  for (const [k, v] of Object.entries(payload.cvExtractionStatusCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('**Global**');
  lines.push('');
  lines.push('| Estado | n |');
  lines.push('| ------ | -: |');
  for (const [k, v] of Object.entries(payload.globalStatusCounts)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');

  lines.push('## 3. Drive ↔ person_cv (solo no ALIGNED)');
  lines.push('');
  lines.push('| Documento | Drive | person_cv | Estado | Observación |');
  lines.push('| --------- | ----- | --------- | ------ | ----------- |');
  for (const r of payload.driveCvRows.filter((x) => x.status !== 'ALIGNED')) {
    lines.push(
      `| ${esc(r.document)} | ${esc(r.drive)} | ${esc(r.personCv)} | ${r.status} | ${esc(r.observation)} |`,
    );
  }
  lines.push('');

  lines.push('## 4. person_cv ↔ cv_extraction (solo no CURRENT)');
  lines.push('');
  lines.push('| Documento | person_cv | extraction | Estado | Observación |');
  lines.push('| --------- | --------- | ---------- | ------ | ----------- |');
  for (const r of payload.cvExtRows.filter((x) => x.status !== 'CURRENT')) {
    lines.push(
      `| ${esc(r.document)} | ${esc(r.personCv)} | ${esc(r.extraction)} | ${r.status} | ${esc(r.observation)} |`,
    );
  }
  lines.push('');

  lines.push('## 5. Consolidado (solo no HEALTHY)');
  lines.push('');
  lines.push(
    '| Documento | En Drive | En person_cv | En Extraction | Estado global | Acción sugerida |',
  );
  lines.push(
    '| --------- | -------- | ------------ | ------------- | ------------- | --------------- |',
  );
  for (const r of payload.critical.sort((a, b) =>
    a.document.localeCompare(b.document),
  )) {
    lines.push(
      `| ${esc(r.document)} | ${r.inDrive ? 'Sí' : 'No'} | ${r.inPersonCv ? 'Sí' : 'No'} | ${r.inExtraction ? 'Sí' : 'No'} | ${r.globalStatus} | ${esc(r.action)} |`,
    );
  }
  lines.push('');

  lines.push('## 6. Casos críticos');
  lines.push('');
  lines.push('| Documento | Problema | Causa probable | Acción recomendada |');
  lines.push('| --------- | -------- | -------------- | ------------------ |');
  for (const r of payload.critical) {
    const problem = `${r.globalStatus}${r.driveStatus && r.driveStatus !== 'N/A' ? ` / Drive:${r.driveStatus}` : ''}${r.extStatus && r.extStatus !== 'N/A' ? ` / Ext:${r.extStatus}` : ''}`;
    const cause =
      r.globalStatus === 'NEEDS_SYNC'
        ? 'PDF en Drive sin reflejo actualizado en person_cv'
        : r.globalStatus === 'STALE_EXTRACTION'
          ? 'Extracción activa apunta a drive_file_id anterior'
          : r.globalStatus === 'ORPHAN_PERSON_CV'
            ? 'CV visible/sincronizado pero PDF ya no está en carpeta oficial'
            : r.globalStatus === 'NEEDS_REEXTRACTION'
              ? 'Hay CV alineado pero falta extracción usable'
              : r.globalStatus === 'MANUAL_REVIEW'
                ? 'Duplicados, nombres inválidos o múltiples activos'
                : 'Desalineación multi-capa';
    lines.push(
      `| ${esc(r.document)} | ${esc(problem)} | ${esc(cause)} | ${esc(r.action)} |`,
    );
  }
  lines.push('');

  if (payload.invalidFiles.length) {
    lines.push('### PDFs con nombre inválido');
    lines.push('');
    lines.push('| Nombre | Ruta | file_id |');
    lines.push('| ------ | ---- | ------- |');
    for (const f of payload.invalidFiles) {
      lines.push(`| ${esc(f.name)} | ${esc(f.path)} | \`${f.fileId}\` |`);
    }
    lines.push('');
  }

  lines.push('## 7. Diagnóstico');
  lines.push('');
  lines.push(
    `1. **¿BD alineada con Drive?** Parcialmente: ${m.drivePersonCvAligned} ALIGNED de ${m.uniqueDocumentsUniverse} documentos en universo; ${m.missingInPersonCv} faltan en person_cv y ${m.missingInDrive} person_cv sin PDF.`,
  );
  lines.push(
    `2. **¿CV visibles en Organigrama inexistentes en Drive?** Sí, **${m.missingInDrive}** (MISSING_IN_DRIVE / ORPHAN_PERSON_CV).`,
  );
  lines.push(
    `3. **¿PDFs en Drive nunca sincronizados?** Sí, **${m.missingInPersonCv}** (MISSING_IN_PERSON_CV).`,
  );
  lines.push(
    `4. **¿Extracciones con drive_file_id antiguo?** **${m.staleFileIdExtractions}** (STALE_FILE_ID).`,
  );
  lines.push(
    '5. **Problema principal:** mixto — primero **sincronización** (huecos Drive→person_cv y huérfanos), luego **reextracción** (STALE_FILE_ID / sin extracción), y en menor medida **datos** (duplicados / nombres inválidos).',
  );
  lines.push('');
  lines.push('### Causas por impacto');
  lines.push('');
  lines.push('1. Desfase sync Drive → `person_cv` (faltantes y huérfanos).');
  lines.push(
    '2. Extracciones activas con `drive_file_id` histórico ≠ `person_cv` actual.',
  );
  lines.push('3. Ausencia de extracción sobre CVs ya alineados.');
  lines.push('4. Duplicados / nombres inválidos en Drive (ruido operativo).');
  lines.push('');

  lines.push('## 8. Plan recomendado (no ejecutado)');
  lines.push('');
  lines.push('| Fase | Acción | Resultado esperado | Riesgo |');
  lines.push('| ---- | ------ | ------------------ | ------ |');
  lines.push(
    '| R1 | Dry-run `sync:drive-cv` sobre folder oficial | Plan INSERT/UPDATE/DEACTIVATE | Bajo |',
  );
  lines.push(
    '| R2 | Aplicar sync solo faltantes + file_id changed (con confirmación) | person_cv alineado a Drive | Medio |',
  );
  lines.push(
    '| R3 | Revisar ORPHAN_PERSON_CV (desactivar o restaurar PDF) | Organigrama no muestra CV fantasma | Medio |',
  );
  lines.push(
    '| R4 | Reextracción de STALE_FILE_ID + NO_EXTRACTION | Extracciones CURRENT | Medio-alto |',
  );
  lines.push(
    '| R5 | Resolver DUPLICATE_IN_DRIVE / INVALID_FILE_NAME | Inventario unívoco | Bajo |',
  );
  lines.push(
    '| R6 | Re-correr esta auditoría RO | HEALTHY ↑, críticos ↓ | Nulo |',
  );
  lines.push('');
  lines.push('## 9. Confirmación');
  lines.push('');
  lines.push('```text');
  lines.push('No se modificó Google Drive.');
  lines.push('No se modificó person_cv.');
  lines.push('No se modificó cv_extraction.');
  lines.push('No se ejecutó sync.');
  lines.push('No se crearon extracciones.');
  lines.push('No se actualizaron registros.');
  lines.push('No commit.');
  lines.push('No push.');
  lines.push('writes: 0.');
  lines.push('```');
  lines.push('');
  lines.push('## 10. Artefacto JSON');
  lines.push('');
  lines.push('`tmp/mc-drive-personcv-reconciliation.json` (inventario detallado).');
  lines.push('');

  return lines.join('\n');
}

main().catch((err) => {
  console.error(TAG, err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
