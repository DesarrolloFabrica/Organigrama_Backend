/**
 * Script: npm run diag:download-cv -- --document=<cedula>
 *
 * Diagnóstico de SOLO LECTURA (Fase A):
 *  - Valida exactamente un argumento --document=<cedula>.
 *  - Localiza la persona en core.person por document.
 *  - Lee el registro activo en organigrama.person_cv.
 *  - Descarga el PDF vía drive_file_id (google-drive-cv-client).
 *  - Reporta tamaño y firma del Buffer en consola.
 *
 * Qué NO hace:
 *  - NO escribe el PDF en disco.
 *  - NO llama a Gemini ni extrae skills.
 *  - NO modifica base de datos ni Drive.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { downloadCvPdfBuffer } from './utils/google-drive-cv-client';

const TAG = '[DriveCV:download]';

type CorePersonRow = {
  id: string;
  document: string;
  full_name: string;
};

type PersonCvRow = {
  id: string;
  person_id: string;
  document: string;
  drive_file_id: string | null;
  drive_file_name: string | null;
  mime_type: string | null;
  is_active: boolean;
  synced_at: Date | string | null;
};

/**
 * Parsea --document=<cedula> desde process.argv.
 * Exige exactamente un documento numérico; falla si falta o hay varios.
 */
function parseDocumentArg(argv: string[]): string {
  const docs: string[] = [];

  for (const arg of argv) {
    if (arg.startsWith('--document=')) {
      docs.push(arg.slice('--document='.length).trim());
    } else if (arg === '--document') {
      throw new Error(
        'Usa el formato --document=<cedula> (un solo valor, sin espacios).',
      );
    }
  }

  if (docs.length === 0) {
    throw new Error(
      'Falta --document=<cedula>. Ejemplo: npm run diag:download-cv -- --document=1010247929',
    );
  }
  if (docs.length > 1) {
    throw new Error(
      `Se recibieron ${docs.length} valores --document; solo se permite uno.`,
    );
  }

  const document = docs[0];
  if (!document || !/^\d+$/.test(document)) {
    throw new Error(
      `Documento inválido "${document}": se esperan solo dígitos (cédula).`,
    );
  }

  return document;
}

async function main(): Promise<void> {
  const document = parseDocumentArg(process.argv.slice(2));
  console.log(`${TAG} Procesando 1 documento: ${document}`);

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    // 1) Persona en Core (exactamente una).
    const persons = await ds.query<CorePersonRow[]>(
      `SELECT id, document, full_name
         FROM core.person
        WHERE document = $1`,
      [document],
    );

    if (persons.length === 0) {
      throw new Error(
        `No existe persona en core.person con document="${document}".`,
      );
    }
    if (persons.length > 1) {
      throw new Error(
        `Hay ${persons.length} personas en core.person con document="${document}"; se esperaba una.`,
      );
    }

    const person = persons[0];
    console.log(
      `${TAG} Persona: id=${person.id} name=${person.full_name}`,
    );

    // 2) Registro activo en person_cv (ruta principal).
    const cvs = await ds.query<PersonCvRow[]>(
      `SELECT id, person_id, document, drive_file_id, drive_file_name,
              mime_type, is_active, synced_at
         FROM organigrama.person_cv
        WHERE person_id = $1 AND is_active = TRUE
        LIMIT 2`,
      [person.id],
    );

    if (cvs.length === 0) {
      throw new Error(
        `La persona ${person.id} (document=${document}) no tiene registro activo en organigrama.person_cv. ` +
          'Ejecuta npm run sync:drive-cv si el PDF ya está en Drive.',
      );
    }
    if (cvs.length > 1) {
      throw new Error(
        `Hay ${cvs.length} registros activos en person_cv para person_id=${person.id}; se esperaba uno.`,
      );
    }

    const cv = cvs[0];
    if (!cv.drive_file_id?.trim()) {
      throw new Error(
        `person_cv.id=${cv.id} no tiene drive_file_id; no se puede descargar.`,
      );
    }

    console.log(
      `${TAG} person_cv: fileName=${cv.drive_file_name ?? '(null)'} ` +
        `fileId=${cv.drive_file_id} mime=${cv.mime_type ?? '(null)'}`,
    );

    // 3) Descarga por drive_file_id (sin escribir a disco).
    console.log(`${TAG} Descargando PDF desde Drive (solo lectura)...`);
    const buffer = await downloadCvPdfBuffer(cv.drive_file_id);

    const header = buffer.subarray(0, Math.min(5, buffer.length)).toString('utf8');
    const looksLikePdf = header.startsWith('%PDF');

    console.log(`${TAG} OK Buffer length=${buffer.length} bytes`);
    console.log(`${TAG} Signature (primeros bytes)=${JSON.stringify(header)}`);
    console.log(`${TAG} Looks like PDF=%PDF... → ${looksLikePdf}`);

    if (!looksLikePdf) {
      throw new Error(
        'El Buffer descargado no comienza con %PDF; posible archivo corrupto o no-PDF.',
      );
    }

    console.log(`${TAG} Fase A validada: descarga vía person_cv.drive_file_id OK.`);
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${TAG} ERROR: ${message}`);
  process.exitCode = 1;
});
