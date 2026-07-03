/**
 * Script: npm run sync:drive-cv
 *
 * Sincroniza las hojas de vida (PDFs) de Google Drive hacia la tabla
 * organigrama.person_cv, SOLO para documentos que existen en core.person.
 *
 * Qué hace:
 *  - Lee los PDFs de la carpeta de Drive (utilidad google-drive-cv-client).
 *  - Extrae el "documento" (cédula) desde el nombre del archivo.
 *  - Busca las personas en core.person por document.
 *  - Hace UPSERT en organigrama.person_cv para los documentos que SÍ existen
 *    en Core (inserta si no hay registro activo, actualiza si ya existe).
 *  - Reporta pendientes (no existen en Core) e inconsistencias (doc duplicado
 *    en Core), sin sincronizarlos.
 *
 * Qué NO hace:
 *  - NO inserta nada para documentos que no existen en Core.
 *  - NO desactiva registros antiguos (regla explícita de esta fase).
 *  - NO borra registros.
 *  - NO toca endpoints ni frontend.
 *
 * Estrategia de UPSERT:
 *  La tabla tiene un índice único PARCIAL:
 *    ux_person_cv_person_active ON organigrama.person_cv(person_id) WHERE is_active = TRUE
 *  ON CONFLICT contra un índice parcial es frágil, así que, dentro de una
 *  transacción, hacemos: (a) buscar registro activo por person_id,
 *  (b) UPDATE si existe, (c) INSERT si no existe.
 */

// Cargamos el .env ANTES de leer cualquier variable de entorno.
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DataSource, QueryRunner } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  getDriveCvFolderId,
  listCvPdfFiles,
  type DriveCvPdfFile,
} from './utils/google-drive-cv-client';

const TAG = '[DriveCV:sync]';

/**
 * Extrae el documento (solo dígitos) desde el nombre del archivo.
 * Misma regla que el diagnóstico:
 *  - Se ignoran espacios al inicio/fin.
 *  - Válido solo si el nombre es "<dígitos>.pdf".
 */
function extractDocument(fileName: string): string | null {
  const trimmed = fileName.trim();
  const match = /^(\d+)\.pdf$/i.exec(trimmed);
  return match ? match[1] : null;
}

/** Fila mínima devuelta por la consulta a core.person. */
type CorePersonRow = {
  id: string;
  document: string;
};

/**
 * Candidato listo para sincronizar: documento que existe en Core (exactamente
 * una persona) y su archivo de Drive asociado.
 */
type SyncCandidate = {
  document: string;
  personId: string;
  file: DriveCvPdfFile;
};

/**
 * Consulta core.person por una lista de documentos.
 * Seguridad: `= ANY($1::text[])` con un único parámetro array (no concatena SQL).
 */
async function queryCorePersons(
  ds: DataSource,
  documents: string[],
): Promise<CorePersonRow[]> {
  if (documents.length === 0) return [];
  return ds.query<CorePersonRow[]>(
    `SELECT p.id, p.document
       FROM core.person p
      WHERE p.document = ANY($1::text[])`,
    [documents],
  );
}

/**
 * Cuenta los registros activos actuales en organigrama.person_cv.
 */
async function countActivePersonCv(ds: DataSource): Promise<number> {
  const rows = await ds.query<{ count: string }[]>(
    `SELECT COUNT(*)::int AS count
       FROM organigrama.person_cv
      WHERE is_active = TRUE`,
  );
  return rows[0]?.count ? Number(rows[0].count) : 0;
}

/**
 * UPSERT de un candidato dentro de la transacción.
 *
 * Devuelve 'inserted' o 'updated' según la operación realizada.
 *  - Busca registro ACTIVO por person_id (respeta el índice único parcial).
 *  - Si existe: UPDATE de los campos del archivo + synced_at = NOW().
 *  - Si no existe: INSERT de un registro nuevo activo.
 */
async function upsertPersonCv(
  qr: QueryRunner,
  candidate: SyncCandidate,
): Promise<'inserted' | 'updated'> {
  const { personId, document, file } = candidate;

  // (a) ¿Existe ya un registro activo para esta persona?
  // QueryRunner.query no admite genéricos, así que tipamos el resultado por cast.
  const existing = (await qr.query(
    `SELECT id
       FROM organigrama.person_cv
      WHERE person_id = $1 AND is_active = TRUE
      LIMIT 1`,
    [personId],
  )) as { id: string }[];

  if (existing.length > 0) {
    // (b) Existe: actualizamos los datos del archivo y la marca de sincronización.
    await qr.query(
      `UPDATE organigrama.person_cv
          SET document        = $2,
              drive_file_id   = $3,
              drive_file_name = $4,
              drive_web_url   = $5,
              mime_type       = $6,
              synced_at       = NOW()
        WHERE id = $1`,
      [
        existing[0].id,
        document,
        file.id,
        file.name,
        file.webViewLink,
        file.mimeType,
      ],
    );
    return 'updated';
  }

  // (c) No existe: insertamos un registro nuevo activo.
  await qr.query(
    `INSERT INTO organigrama.person_cv
        (person_id, document, drive_file_id, drive_file_name,
         drive_web_url, mime_type, is_active, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())`,
    [personId, document, file.id, file.name, file.webViewLink, file.mimeType],
  );
  return 'inserted';
}

async function main(): Promise<void> {
  // ----- 1) Lectura de Google Drive -----
  const folderId = getDriveCvFolderId();
  console.log(`${TAG} Folder ID: ${folderId}`);
  console.log(`${TAG} Conectando a Google Drive (solo lectura)...`);

  const files = await listCvPdfFiles();

  // Mapeamos documento -> archivo de Drive y clasificamos nombres.
  // Si un documento apareciera más de una vez en Drive, conservamos el primero
  // (escenario no esperado según el diagnóstico, pero lo dejamos determinista).
  const fileByDocument = new Map<string, DriveCvPdfFile>();
  let invalidNames = 0;
  for (const file of files) {
    const document = extractDocument(file.name);
    if (!document) {
      invalidNames++;
      continue;
    }
    if (!fileByDocument.has(document)) {
      fileByDocument.set(document, file);
    }
  }

  const validDocuments = [...fileByDocument.keys()];

  console.log('');
  console.log(`${TAG} Total PDFs encontrados: ${files.length}`);
  console.log(`${TAG} Documentos válidos: ${validDocuments.length}`);
  console.log(`${TAG} Nombres inválidos: ${invalidNames}`);

  // ----- 2) Conexión a la base de datos (mismo patrón que los demás scripts) -----
  console.log('');
  console.log(`${TAG} Conectando a la base de datos...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    // ----- 3) Buscar personas en Core -----
    const corePersons = await queryCorePersons(ds, validDocuments);

    // Agrupamos por documento para detectar duplicados en Core.
    const personsByDocument = new Map<string, CorePersonRow[]>();
    for (const person of corePersons) {
      const list = personsByDocument.get(person.document) ?? [];
      list.push(person);
      personsByDocument.set(person.document, list);
    }

    // ----- 4) Clasificación -----
    const candidates: SyncCandidate[] = []; // listos para UPSERT
    const pendingInCore: string[] = []; // no existen en Core
    const duplicatedInCore: string[] = []; // doc con más de una persona en Core

    for (const document of validDocuments) {
      const persons = personsByDocument.get(document);

      if (!persons || persons.length === 0) {
        // No existe en Core: no se inserta nada, se reporta como pendiente.
        pendingInCore.push(document);
        continue;
      }

      if (persons.length > 1) {
        // Inconsistencia: no podemos elegir a quién enlazar. Se omite.
        duplicatedInCore.push(document);
        continue;
      }

      // Exactamente una persona: candidato a sincronizar.
      const file = fileByDocument.get(document)!;
      candidates.push({ document, personId: persons[0].id, file });
    }

    console.log('');
    console.log(`${TAG} Personas encontradas en Core: ${candidates.length}`);
    console.log(`${TAG} Pendientes por crear en Core: ${pendingInCore.length}`);
    console.log(
      `${TAG} Inconsistencias por documento duplicado en Core: ${duplicatedInCore.length}`,
    );

    // ----- 5) UPSERT dentro de una transacción -----
    let inserted = 0;
    let updated = 0;

    const queryRunner = ds.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const candidate of candidates) {
        const result = await upsertPersonCv(queryRunner, candidate);
        if (result === 'inserted') inserted++;
        else updated++;
      }
      // Confirmamos todos los cambios de una sola vez.
      await queryRunner.commitTransaction();
    } catch (err) {
      // Ante cualquier error, revertimos TODO (no quedan cambios parciales).
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    // ----- 6) Conteo final de activos -----
    const totalActive = await countActivePersonCv(ds);

    // ----- 7) Resumen -----
    console.log('');
    console.log(`${TAG} ----- Resultado de la sincronización -----`);
    console.log(`${TAG} Registros insertados: ${inserted}`);
    console.log(`${TAG} Registros actualizados: ${updated}`);
    console.log(
      `${TAG} Total activos en organigrama.person_cv: ${totalActive}`,
    );

    // Muestras de pendientes/inconsistencias (primeros 20) para revisión.
    if (pendingInCore.length > 0) {
      console.log('');
      console.log(
        `${TAG} Pendientes por crear en Core (mostrando hasta 20):`,
      );
      for (const document of pendingInCore.slice(0, 20)) {
        console.log(`${TAG}   - ${document}`);
      }
    }
    if (duplicatedInCore.length > 0) {
      console.log('');
      console.log(
        `${TAG} Documentos duplicados en Core (mostrando hasta 20):`,
      );
      for (const document of duplicatedInCore.slice(0, 20)) {
        console.log(`${TAG}   - ${document}`);
      }
    }

    console.log('');
    console.log(`${TAG} Sincronización finalizada.`);
  } finally {
    await app.close();
  }
}

main().catch((err: unknown) => {
  // Códigos HTTP de Google (Drive) para mensajes más claros.
  const status =
    (err as { code?: number; response?: { status?: number } })?.code ??
    (err as { response?: { status?: number } })?.response?.status;

  console.error('');
  if (status === 403) {
    console.error(
      `${TAG} ERROR 403: Acceso denegado a Drive. Verifica permisos de la ` +
        'carpeta y el scope del token (drive.readonly).',
    );
  } else if (status === 404) {
    console.error(
      `${TAG} ERROR 404: Carpeta de Drive no encontrada. Verifica ` +
        'GOOGLE_DRIVE_CV_FOLDER_ID y el acceso de la cuenta OAuth.',
    );
  } else {
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  process.exit(1);
});
