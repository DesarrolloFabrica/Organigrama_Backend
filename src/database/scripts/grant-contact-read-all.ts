/**
 * Script: npm run org:grant-contact-read-all -- correo@cun.edu.co [--dry-run]
 *
 * Otorga ÚNICAMENTE el permiso técnico ORG_CONTACT_READ_ALL a la persona
 * identificada por su correo institucional.
 *
 * ORG_CONTACT_READ_ALL permite leer el teléfono de cualquier persona visible en
 * el organigrama, sin levantar el resto de la redacción de la ficha. NO es un
 * alias de ORG_READ_ALL.
 *
 * Garantías de la operación:
 *  - Busca la persona en core.person por edu_email y exige is_active = true.
 *  - Muestra los permisos previos ANTES de escribir (traza de auditoría).
 *  - INSERT idempotente con ON CONFLICT DO NOTHING.
 *  - NUNCA elimina ni modifica permisos preexistentes.
 *  - NUNCA otorga ORG_READ_ALL, ORG_ADMIN ni ningún otro código.
 *  - NUNCA inserta en organigrama.org_visual_relation.
 *
 * Con --dry-run ejecuta solo las verificaciones y no escribe nada.
 *
 * Requiere la migración 004_core_person_permission.sql aplicada.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { ORG_PERMISSION } from '../../permissions/entities/person-permission.entity';

const TAG = '[grant-contact-read-all]';
const PERMISSION_TO_GRANT = ORG_PERMISSION.CONTACT_READ_ALL;

/** Códigos que este script tiene prohibido conceder, pase lo que pase. */
const FORBIDDEN_TO_GRANT = [
  ORG_PERMISSION.READ_ALL,
  ORG_PERMISSION.ADMIN,
] as const;

async function listPermissions(
  ds: DataSource,
  personId: string,
): Promise<string[]> {
  const rows = await ds.query<{ permission_code: string }[]>(
    `SELECT permission_code
       FROM core.person_permission
      WHERE person_id = $1
      ORDER BY permission_code`,
    [personId],
  );
  return rows.map((r) => r.permission_code);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetEmail = args.find((a) => !a.startsWith('--'))?.trim();

  if (!targetEmail) {
    console.error(`${TAG} ERROR: Debes proporcionar un correo como argumento.`);
    console.error(
      `${TAG} Uso: npm run org:grant-contact-read-all -- correo@cun.edu.co [--dry-run]`,
    );
    process.exit(1);
  }

  if (FORBIDDEN_TO_GRANT.includes(PERMISSION_TO_GRANT as never)) {
    console.error(`${TAG} ERROR: configuración inválida del script.`);
    process.exit(1);
  }

  const emailLower = targetEmail.toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    // 1-3) Localizar a la persona y confirmar que existe y está activa.
    const rows = await ds.query<
      { id: string; full_name: string; edu_email: string }[]
    >(
      `SELECT id, full_name, edu_email
         FROM core.person
        WHERE LOWER(edu_email) = $1
          AND is_active = true
        LIMIT 1`,
      [emailLower],
    );

    if (rows.length === 0) {
      console.error(
        `${TAG} ERROR: No se encontró ninguna persona activa con edu_email = "${targetEmail}".`,
      );
      process.exit(1);
    }

    // 4) person_id.
    const person = rows[0];
    console.log(
      `${TAG} Persona: person_id=${person.id} | "${person.full_name}" | ${person.edu_email} | is_active=true`,
    );

    // 5) Permisos previos (no se modifican).
    const before = await listPermissions(ds, person.id);
    console.log(
      `${TAG} PERMISOS PREVIOS = ${before.length > 0 ? before.join(', ') : '(ninguno)'}`,
    );

    if (before.includes(PERMISSION_TO_GRANT)) {
      console.log(
        `${TAG} La persona ya tenía "${PERMISSION_TO_GRANT}". Nada que hacer (idempotente).`,
      );
    }

    if (dryRun) {
      console.log(
        `${TAG} --dry-run: no se escribió nada. Se habría otorgado "${PERMISSION_TO_GRANT}".`,
      );
      return;
    }

    // 6) INSERT idempotente. No borra ni actualiza nada.
    await ds.query(
      `INSERT INTO core.person_permission (person_id, permission_code)
       VALUES ($1, $2)
       ON CONFLICT (person_id, permission_code) DO NOTHING`,
      [person.id, PERMISSION_TO_GRANT],
    );

    const after = await listPermissions(ds, person.id);
    console.log(`${TAG} PERMISOS FINALES = ${after.join(', ')}`);

    const lost = before.filter((code) => !after.includes(code));
    if (lost.length > 0) {
      console.error(
        `${TAG} ERROR: se perdieron permisos preexistentes (${lost.join(', ')}).`,
      );
      process.exit(1);
    }

    const unexpected = after.filter(
      (code) => !before.includes(code) && code !== PERMISSION_TO_GRANT,
    );
    if (unexpected.length > 0) {
      console.error(
        `${TAG} ERROR: se concedieron permisos no solicitados (${unexpected.join(', ')}).`,
      );
      process.exit(1);
    }

    console.log(
      `${TAG} OK — ${person.full_name} (${person.edu_email}) tiene "${PERMISSION_TO_GRANT}".`,
    );
    console.log(
      `${TAG} AVISO: los permisos van embutidos en el JWT. El usuario DEBE cerrar sesión`,
    );
    console.log(
      `${TAG}        y volver a iniciarla; recargar la página no es suficiente.`,
    );
    console.log(
      `${TAG} AVISO: NO insertar a esta persona en organigrama.org_visual_relation.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`${TAG} Error inesperado:`, err);
  process.exit(1);
});
