/**
 * Script: npm run diag:drive-cv
 *
 * Diagnóstico de SOLO LECTURA que cruza las hojas de vida (PDFs) de Google Drive
 * contra la base de datos (core.person y organigrama.person_cv).
 *
 * Qué hace:
 *  - Carga variables de entorno desde .env (igual que el resto del backend).
 *  - Se conecta a Drive vía OAuth usando la utilidad google-drive-cv-client.
 *  - Lista todos los PDFs ubicados directamente en la carpeta configurada.
 *  - Extrae el "documento" (cédula) desde el nombre del archivo.
 *  - Se conecta a PostgreSQL con el MISMO patrón que los demás scripts
 *    (NestFactory + DataSource de TypeORM) para reutilizar la config del backend.
 *  - Cruza los documentos válidos contra core.person y organigrama.person_cv.
 *  - Reporta el estado de enlace: encontrados, no encontrados, ya enlazados, etc.
 *
 * Qué NO hace:
 *  - NO inserta, actualiza ni borra nada en la base de datos (solo SELECT).
 *  - NO toca organigrama.person_cv (escritura), endpoints ni frontend.
 *  - NO modifica nada en Drive (acceso de solo lectura).
 *  - NO sincroniza: es solo diagnóstico.
 */

// Cargamos el .env ANTES de leer cualquier variable de entorno.
import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import {
  getDriveCvFolderId,
  listCvPdfFiles,
  type DriveCvPdfFile,
} from './utils/google-drive-cv-client';

const TAG = '[DriveCV]';

/**
 * Extrae el documento (solo dígitos) desde el nombre del archivo.
 *
 * Regla inicial:
 *  - Se ignoran espacios al inicio y al final del nombre.
 *  - Es válido solo si el nombre es "<dígitos>.pdf" (ej: "1015424212.pdf").
 *  - Se toman únicamente los dígitos que están antes de ".pdf".
 *
 * Devuelve el documento como string si es válido, o null si el nombre no cumple.
 */
function extractDocument(fileName: string): string | null {
  const trimmed = fileName.trim();
  // ^\d+   -> uno o más dígitos al inicio
  // \.pdf$ -> termina en .pdf (insensible a mayúsculas/minúsculas)
  const match = /^(\d+)\.pdf$/i.exec(trimmed);
  return match ? match[1] : null;
}

/** Resultado agregado del análisis de los nombres de archivo. */
type DiagSummary = {
  totalFiles: number;
  validPdfNames: string[]; // documentos válidos (puede tener repetidos)
  invalidPdfNames: string[]; // nombres de archivo que no cumplen la regla
  duplicatedDocuments: string[]; // documentos que aparecen más de una vez
};

/** Fila devuelta por la consulta a core.person. */
type CorePersonRow = {
  id: string;
  full_name: string;
  document: string;
  edu_email: string | null;
  is_active: boolean;
};

/** Fila devuelta por la consulta a organigrama.person_cv. */
type PersonCvRow = {
  person_id: string | null;
  document: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  is_active: boolean;
  synced_at: Date | null;
};

/**
 * Analiza la lista de PDFs y construye el resumen del diagnóstico de Drive.
 */
function analyzeFiles(files: DriveCvPdfFile[]): DiagSummary {
  const validPdfNames: string[] = [];
  const invalidPdfNames: string[] = [];

  // Contamos cuántas veces aparece cada documento para detectar duplicados.
  const documentCounts = new Map<string, number>();

  for (const file of files) {
    const document = extractDocument(file.name);
    if (document) {
      validPdfNames.push(document);
      documentCounts.set(document, (documentCounts.get(document) ?? 0) + 1);
    } else {
      invalidPdfNames.push(file.name);
    }
  }

  // Un documento está duplicado si aparece 2 o más veces.
  const duplicatedDocuments = [...documentCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([document]) => document);

  return {
    totalFiles: files.length,
    validPdfNames,
    invalidPdfNames,
    duplicatedDocuments,
  };
}

/**
 * Imprime en consola los primeros N elementos de una lista, con un encabezado.
 */
function printSample(label: string, items: string[], limit = 20): void {
  console.log('');
  console.log(`${TAG} ${label} (mostrando hasta ${limit}):`);
  if (items.length === 0) {
    console.log(`${TAG}   (ninguno)`);
    return;
  }
  for (const item of items.slice(0, limit)) {
    console.log(`${TAG}   - ${item}`);
  }
}

/**
 * Consulta core.person por una lista de documentos.
 *
 * Seguridad: usamos `= ANY($1::text[])` con un único parámetro de tipo array.
 * Esto evita concatenar SQL y escala bien aunque la lista crezca (no genera
 * un placeholder por cada documento).
 */
async function queryCorePersons(
  ds: DataSource,
  documents: string[],
): Promise<CorePersonRow[]> {
  if (documents.length === 0) return [];
  return ds.query<CorePersonRow[]>(
    `SELECT
        p.id,
        p.full_name,
        p.document,
        p.edu_email,
        p.is_active
      FROM core.person p
      WHERE p.document = ANY($1::text[])`,
    [documents],
  );
}

/**
 * Consulta organigrama.person_cv por una lista de documentos.
 * Mismo patrón seguro con ANY($1::text[]).
 */
async function queryPersonCv(
  ds: DataSource,
  documents: string[],
): Promise<PersonCvRow[]> {
  if (documents.length === 0) return [];
  return ds.query<PersonCvRow[]>(
    `SELECT
        pc.person_id,
        pc.document,
        pc.drive_file_id,
        pc.drive_file_name,
        pc.is_active,
        pc.synced_at
      FROM organigrama.person_cv pc
      WHERE pc.document = ANY($1::text[])`,
    [documents],
  );
}

async function main(): Promise<void> {
  // ----- 1) Lectura de Google Drive -----
  // Validamos el folder ID temprano para dar un error claro si falta.
  const folderId = getDriveCvFolderId();
  console.log(`${TAG} Folder ID: ${folderId}`);
  console.log(`${TAG} Conectando a Google Drive (solo lectura)...`);

  // Listamos todos los PDFs de la carpeta (la utilidad maneja la paginación).
  const files = await listCvPdfFiles();

  // Construimos el resumen a partir de los nombres de archivo.
  const summary = analyzeFiles(files);

  // Lista de documentos válidos ÚNICOS (deduplicados) para cruzar contra BD.
  const uniqueValidDocuments = [...new Set(summary.validPdfNames)];

  // Resumen de Drive.
  console.log('');
  console.log(`${TAG} Total PDFs encontrados: ${summary.totalFiles}`);
  console.log(`${TAG} Nombres válidos: ${summary.validPdfNames.length}`);
  console.log(`${TAG} Nombres inválidos: ${summary.invalidPdfNames.length}`);
  console.log(
    `${TAG} Documentos duplicados: ${summary.duplicatedDocuments.length}`,
  );

  // ----- 2) Conexión a PostgreSQL (mismo patrón que los demás scripts) -----
  // NestFactory levanta el AppModule, que configura TypeORM con la misma
  // conexión del backend. Solo leemos: no se ejecuta ninguna escritura.
  console.log('');
  console.log(`${TAG} Conectando a la base de datos (solo lectura)...`);
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    // ----- 3) Consultas de cruce -----
    const corePersons = await queryCorePersons(ds, uniqueValidDocuments);
    const personCvRows = await queryPersonCv(ds, uniqueValidDocuments);

    // Agrupamos las personas de Core por documento para detectar:
    //  - documentos encontrados
    //  - documentos con más de una persona (posible inconsistencia en Core)
    const personsByDocument = new Map<string, CorePersonRow[]>();
    for (const person of corePersons) {
      const list = personsByDocument.get(person.document) ?? [];
      list.push(person);
      personsByDocument.set(person.document, list);
    }

    // Conjunto de documentos ya enlazados en person_cv (los que existen ahí).
    const linkedDocuments = new Set(personCvRows.map((row) => row.document));

    // ----- 4) Clasificación de documentos -----
    const foundInCore: string[] = []; // existen en core.person (al menos 1 persona)
    const notFoundInCore: string[] = []; // no existen en core.person
    const duplicatedInCore: string[] = []; // existen con más de una persona
    const alreadyLinked: string[] = []; // ya están en organigrama.person_cv
    const readyToLink: string[] = []; // existen en Core y aún NO enlazados

    for (const document of uniqueValidDocuments) {
      const persons = personsByDocument.get(document);
      const existsInCore = !!persons && persons.length > 0;
      const isLinked = linkedDocuments.has(document);

      if (existsInCore) {
        foundInCore.push(document);
        if (persons.length > 1) duplicatedInCore.push(document);
      } else {
        notFoundInCore.push(document);
      }

      if (isLinked) {
        alreadyLinked.push(document);
      } else if (existsInCore) {
        // "Listo para enlazar" = existe la persona en Core y todavía no hay
        // registro en person_cv. (No se enlaza nada: solo se reporta.)
        readyToLink.push(document);
      }
    }

    // ----- 5) Resumen del cruce -----
    console.log('');
    console.log(`${TAG} ----- Cruce contra base de datos -----`);
    console.log(`${TAG} Documentos válidos únicos: ${uniqueValidDocuments.length}`);
    console.log(`${TAG} Personas encontradas en Core: ${foundInCore.length}`);
    console.log(
      `${TAG} Documentos no encontrados en Core: ${notFoundInCore.length}`,
    );
    console.log(
      `${TAG} Documentos con más de una persona en Core: ${duplicatedInCore.length}`,
    );
    console.log(`${TAG} Ya enlazados en person_cv: ${alreadyLinked.length}`);
    console.log(`${TAG} Listos para enlazar: ${readyToLink.length}`);
    console.log(
      `${TAG} Pendientes por crear en Core: ${notFoundInCore.length}`,
    );

    // ----- 6) Muestras (primeros 20 de cada categoría) -----
    // Documentos encontrados en Core: mostramos id y full_name.
    console.log('');
    console.log(
      `${TAG} Primeros documentos encontrados en Core (mostrando hasta 20):`,
    );
    if (foundInCore.length === 0) {
      console.log(`${TAG}   (ninguno)`);
    } else {
      for (const document of foundInCore.slice(0, 20)) {
        const persons = personsByDocument.get(document) ?? [];
        // Si hubiera más de una persona, las listamos todas para visibilidad.
        const detail = persons
          .map((p) => `id=${p.id} full_name="${p.full_name}"`)
          .join(' | ');
        console.log(`${TAG}   - ${document} -> ${detail}`);
      }
    }

    printSample('Primeros documentos no encontrados en Core', notFoundInCore);
    printSample('Primeros documentos ya enlazados', alreadyLinked);
    printSample('Primeros documentos listos para enlazar', readyToLink);

    console.log('');
    console.log(
      `${TAG} Diagnóstico finalizado (solo lectura: no se modificó la base de datos).`,
    );
  } finally {
    // Cerramos el contexto de Nest para liberar la conexión a la BD.
    await app.close();
  }
}

main().catch((err: unknown) => {
  // Intentamos extraer el código de estado HTTP que devuelve Google.
  const status =
    (err as { code?: number; response?: { status?: number } })?.code ??
    (err as { response?: { status?: number } })?.response?.status;

  console.error('');
  if (status === 403) {
    console.error(
      `${TAG} ERROR 403: Acceso denegado. Probablemente la cuenta OAuth no tiene ` +
        'permiso para leer esta carpeta, o el token fue emitido sin el scope ' +
        'de Drive (drive.readonly). Comparte la carpeta con la cuenta OAuth y ' +
        'verifica los scopes del token.',
    );
  } else if (status === 404) {
    console.error(
      `${TAG} ERROR 404: Carpeta no encontrada. Probablemente el GOOGLE_DRIVE_CV_FOLDER_ID ` +
        'es incorrecto, o la cuenta OAuth no tiene acceso a esa carpeta.',
    );
  } else {
    // Errores de configuración (env faltante, token inexistente) y cualquier otro.
    console.error(
      `${TAG} ERROR: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  process.exit(1);
});
