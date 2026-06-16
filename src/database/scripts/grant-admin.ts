/**
 * Script: npm run org:grant-admin -- correo@cun.edu.co
 *
 * Otorga los permisos técnicos ORG_READ_ALL y ORG_ADMIN a la persona
 * identificada por el correo institucional dado.
 *
 * - Busca la persona en core.person por edu_email.
 * - Inserta ORG_READ_ALL y ORG_ADMIN en core.person_permission (ON CONFLICT DO NOTHING).
 * - Nunca inserta en organigrama.org_visual_relation.
 * - Sale con código 1 si la persona no existe o el email es inválido.
 *
 * Requiere que la migración 004_core_person_permission.sql haya sido aplicada.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';

const PERMISSIONS_TO_GRANT = ['ORG_READ_ALL', 'ORG_ADMIN'] as const;

async function main() {
  const targetEmail = process.argv[2]?.trim();

  if (!targetEmail) {
    console.error(
      '[grant-admin] ERROR: Debes proporcionar un correo como argumento.',
    );
    console.error(
      '[grant-admin] Uso: npm run org:grant-admin -- correo@cun.edu.co',
    );
    process.exit(1);
  }

  const emailLower = targetEmail.toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    // Buscar persona por edu_email (normalizado, insensible a mayúsculas)
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
        `[grant-admin] ERROR: No se encontró ninguna persona activa con edu_email = "${targetEmail}".`,
      );
      console.error(
        '[grant-admin] Verifica que el correo esté registrado en core.person con is_active = true.',
      );
      process.exit(1);
    }

    const person = rows[0];
    console.log(
      `[grant-admin] Persona encontrada: id=${person.id} | "${person.full_name}" | ${person.edu_email}`,
    );

    for (const code of PERMISSIONS_TO_GRANT) {
      await ds.query(
        `INSERT INTO core.person_permission (person_id, permission_code)
         VALUES ($1, $2)
         ON CONFLICT (person_id, permission_code) DO NOTHING`,
        [person.id, code],
      );
      console.log(`[grant-admin] Permiso "${code}" otorgado (o ya existia).`);
    }

    console.log(
      `[grant-admin] OK — ${person.full_name} (${person.edu_email}) tiene permisos: ${PERMISSIONS_TO_GRANT.join(', ')}.`,
    );
    console.log(
      '[grant-admin] AVISO: el usuario debe cerrar sesion y volver a iniciarla para que el nuevo JWT refleje los permisos.',
    );
    console.log(
      '[grant-admin] AVISO: NO insertar este usuario en organigrama.org_visual_relation.',
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('[grant-admin] Error inesperado:', err);
  process.exit(1);
});
