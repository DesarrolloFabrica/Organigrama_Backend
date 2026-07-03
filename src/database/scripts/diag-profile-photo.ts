/**
 * Script: npm run diag:profile-photo -- correo@cun.edu.co
 *
 * Diagnóstico de SOLO LECTURA del estado de la foto de perfil de una persona.
 *
 * - Lee la conexión a BD desde el .env del backend (vía ConfigModule/TypeORM).
 *   No recibe ni imprime credenciales.
 * - Busca la persona en core.person por edu_email (insensible a mayúsculas).
 * - Cruza con organigrama.person_profile_state para reportar:
 *     core.person.id, full_name, edu_email,
 *     profile_photo_source, profile_photo_url, person_profile_state.updated_at
 * - Indica claramente: si existe la persona, si existe person_profile_state,
 *   si profile_photo_url está null y si profile_photo_source es google.
 * - NO modifica datos.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { PROFILE_PHOTO_SOURCE_GOOGLE } from '../../profile/profile-photo.constants';

const TAG = '[diag:profile-photo]';

type DiagRow = {
  id: string;
  full_name: string;
  edu_email: string;
  profile_photo_source: string | null;
  profile_photo_url: string | null;
  state_person_id: string | null;
  state_updated_at: Date | null;
};

async function main() {
  const targetEmail = process.argv[2]?.trim();

  if (!targetEmail) {
    console.error(`${TAG} ERROR: Debes proporcionar un correo como argumento.`);
    console.error(
      `${TAG} Uso: npm run diag:profile-photo -- correo@cun.edu.co`,
    );
    process.exit(1);
  }

  const emailLower = targetEmail.toLowerCase();

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const ds = app.get(DataSource);

    const rows = await ds.query<DiagRow[]>(
      `SELECT
          p.id,
          p.full_name,
          p.edu_email,
          s.profile_photo_source,
          s.profile_photo_url,
          s.person_id  AS state_person_id,
          s.updated_at AS state_updated_at
        FROM core.person p
        LEFT JOIN organigrama.person_profile_state s
               ON s.person_id = p.id
        WHERE LOWER(p.edu_email) = $1
        LIMIT 1`,
      [emailLower],
    );

    console.log(`${TAG} Consultando edu_email = "${targetEmail}" (solo lectura)`);

    if (rows.length === 0) {
      console.log(`${TAG} Persona: NO existe en core.person con ese edu_email.`);
      process.exit(2);
    }

    const row = rows[0];
    const hasState = row.state_person_id !== null;
    const urlIsNull = !row.profile_photo_url?.trim();
    const isGoogle = row.profile_photo_source === PROFILE_PHOTO_SOURCE_GOOGLE;

    console.log('');
    console.log(`${TAG} ----- core.person -----`);
    console.log(`${TAG} Persona:                 EXISTE`);
    console.log(`${TAG} id:                      ${row.id}`);
    console.log(`${TAG} full_name:               ${row.full_name}`);
    console.log(`${TAG} edu_email:               ${row.edu_email}`);
    console.log('');
    console.log(`${TAG} ----- organigrama.person_profile_state -----`);
    console.log(
      `${TAG} person_profile_state:    ${hasState ? 'EXISTE' : 'NO existe (sin fila)'}`,
    );
    console.log(
      `${TAG} profile_photo_source:    ${row.profile_photo_source ?? 'null'}`,
    );
    console.log(
      `${TAG} profile_photo_url:       ${row.profile_photo_url ?? 'null'}`,
    );
    console.log(
      `${TAG} updated_at:              ${
        row.state_updated_at
          ? new Date(row.state_updated_at).toISOString()
          : 'null'
      }`,
    );
    console.log('');
    console.log(`${TAG} ----- diagnóstico -----`);
    console.log(`${TAG} ¿profile_photo_url está null? ${urlIsNull ? 'SÍ' : 'no'}`);
    console.log(
      `${TAG} ¿profile_photo_source es '${PROFILE_PHOTO_SOURCE_GOOGLE}'? ${isGoogle ? 'SÍ' : 'no'}`,
    );

    if (!hasState) {
      console.log(
        `${TAG} RESULTADO: aún no hay estado de perfil. La foto se sincroniza en el próximo login con Google.`,
      );
    } else if (isGoogle && !urlIsNull) {
      console.log(
        `${TAG} RESULTADO: OK — foto de Google persistida correctamente.`,
      );
    } else if (urlIsNull) {
      console.log(
        `${TAG} RESULTADO: PENDIENTE — sin foto. Tras login real con Google debería quedar source='${PROFILE_PHOTO_SOURCE_GOOGLE}'.`,
      );
    } else {
      console.log(
        `${TAG} RESULTADO: foto presente con source='${row.profile_photo_source}' (no Google). No se sobrescribe en login.`,
      );
    }
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(`${TAG} Error inesperado:`, err);
  process.exit(1);
});
