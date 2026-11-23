/**
 * Lógica de `npm run org:grant-directory-export` separada del arranque de Nest
 * para poder probarla con un cliente SQL simulado.
 *
 * Solo puede conceder/revocar ORG_DIRECTORY_EXPORT_HTML y
 * ORG_DIRECTORY_EXPORT_XLS. Cualquier otro código queda intacto y se verifica
 * dentro de la misma transacción (si algo más cambiara, se hace ROLLBACK).
 *
 * Salida sin datos personales innecesarios: person_id y correo enmascarado;
 * nunca el nombre completo.
 */
import { ORG_PERMISSION } from '../../../permissions/entities/person-permission.entity';

export const GRANT_DIRECTORY_EXPORT_TAG = '[grant-directory-export]';
export const GRANT_DIRECTORY_EXPORT_USAGE =
  'Uso: npm run org:grant-directory-export -- correo@cun.edu.co --format=html|xls|both [--dry-run] [--revoke]';

export type GrantDirectoryExportFormat = 'html' | 'xls' | 'both';

export type GrantDirectoryExportArgs = {
  email: string;
  format: GrantDirectoryExportFormat;
  dryRun: boolean;
  revoke: boolean;
};

/** Únicos códigos que este script puede tocar. */
export const DIRECTORY_EXPORT_CODES = [
  ORG_PERMISSION.DIRECTORY_EXPORT_HTML,
  ORG_PERMISSION.DIRECTORY_EXPORT_XLS,
] as const;

export type SqlRunner = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
};

export type GrantDirectoryExportDb = SqlRunner & {
  transaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>;
};

export type GrantDirectoryExportOutput = {
  info(line: string): void;
  error(line: string): void;
};

export type GrantDirectoryExportOutcome = {
  exitCode: 0 | 1;
  personId?: string;
  before?: string[];
  after?: string[];
  changed?: string[];
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KNOWN_FLAGS = new Set(['--dry-run', '--revoke']);

export function parseGrantDirectoryExportArgs(
  argv: readonly string[],
): { ok: true; args: GrantDirectoryExportArgs } | { ok: false; error: string } {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flags = argv.filter((a) => a.startsWith('--'));

  if (positional.length !== 1) {
    return { ok: false, error: 'Debes indicar exactamente un correo.' };
  }
  const email = positional[0].trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    return { ok: false, error: 'El correo no tiene un formato válido.' };
  }

  let format: GrantDirectoryExportFormat | undefined;
  for (const flag of flags) {
    if (flag.startsWith('--format=')) {
      const value = flag.slice('--format='.length).trim().toLowerCase();
      if (value !== 'html' && value !== 'xls' && value !== 'both') {
        return { ok: false, error: '--format debe ser html, xls o both.' };
      }
      if (format)
        return { ok: false, error: '--format solo puede indicarse una vez.' };
      format = value;
    } else if (!KNOWN_FLAGS.has(flag)) {
      return { ok: false, error: `Opción desconocida: ${flag}` };
    }
  }
  if (!format) {
    return { ok: false, error: 'Falta --format=html|xls|both.' };
  }

  return {
    ok: true,
    args: {
      email,
      format,
      dryRun: flags.includes('--dry-run'),
      revoke: flags.includes('--revoke'),
    },
  };
}

export function codesForFormat(format: GrantDirectoryExportFormat): string[] {
  if (format === 'html') return [ORG_PERMISSION.DIRECTORY_EXPORT_HTML];
  if (format === 'xls') return [ORG_PERMISSION.DIRECTORY_EXPORT_XLS];
  return [...DIRECTORY_EXPORT_CODES];
}

/** `ana.perez@cun.edu.co` → `an***@cun.edu.co`. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

async function listPermissions(
  db: SqlRunner,
  personId: string,
): Promise<string[]> {
  const rows = await db.query<{ permission_code: string }[]>(
    `SELECT permission_code
       FROM core.person_permission
      WHERE person_id = $1
      ORDER BY permission_code`,
    [personId],
  );
  return rows.map((r) => r.permission_code);
}

const fmt = (codes: string[]) =>
  codes.length > 0 ? codes.join(', ') : '(ninguno)';

export async function runGrantDirectoryExport(
  db: GrantDirectoryExportDb,
  args: GrantDirectoryExportArgs,
  out: GrantDirectoryExportOutput,
): Promise<GrantDirectoryExportOutcome> {
  const TAG = GRANT_DIRECTORY_EXPORT_TAG;
  const action = args.revoke ? 'revocar' : 'conceder';
  const codes = codesForFormat(args.format);

  // Defensa en profundidad: nunca tocar otros códigos.
  if (
    codes.some(
      (c) => !(DIRECTORY_EXPORT_CODES as readonly string[]).includes(c),
    )
  ) {
    out.error(`${TAG} ERROR: configuración inválida del script.`);
    return { exitCode: 1 };
  }

  // 1) Persona activa por correo institucional (debe ser única).
  const people = await db.query<{ id: string }[]>(
    `SELECT id::text AS id
       FROM core.person
      WHERE LOWER(edu_email) = $1
        AND is_active = true
      LIMIT 2`,
    [args.email],
  );
  if (people.length === 0) {
    out.error(
      `${TAG} ERROR: no hay una persona activa con el correo ${maskEmail(args.email)}.`,
    );
    return { exitCode: 1 };
  }
  if (people.length > 1) {
    out.error(
      `${TAG} ERROR: el correo ${maskEmail(args.email)} corresponde a más de una persona activa. No se modifica nada.`,
    );
    return { exitCode: 1 };
  }
  const personId = people[0].id;
  out.info(`${TAG} Persona: person_id=${personId} (${maskEmail(args.email)})`);

  // 2) Estado previo y plan.
  const before = await listPermissions(db, personId);
  out.info(`${TAG} PERMISOS PREVIOS = ${fmt(before)}`);

  const changed = args.revoke
    ? codes.filter((c) => before.includes(c))
    : codes.filter((c) => !before.includes(c));
  const unchanged = codes.filter((c) => !changed.includes(c));
  if (unchanged.length > 0) {
    out.info(
      `${TAG} ${args.revoke ? 'No tenía' : 'Ya tenía'}: ${unchanged.join(', ')} (idempotente).`,
    );
  }

  if (args.dryRun) {
    out.info(
      `${TAG} --dry-run: no se escribió nada. Se habría ${args.revoke ? 'revocado' : 'concedido'}: ${fmt(changed)}.`,
    );
    return { exitCode: 0, personId, before, after: before, changed: [] };
  }

  if (changed.length === 0) {
    out.info(`${TAG} Nada que ${action}.`);
    return { exitCode: 0, personId, before, after: before, changed: [] };
  }

  // 3) Escritura + verificación en una sola transacción.
  let after: string[];
  try {
    after = await db.transaction(async (tx) => {
      if (args.revoke) {
        await tx.query(
          `DELETE FROM core.person_permission
            WHERE person_id = $1
              AND permission_code = ANY($2::text[])
              AND permission_code = ANY($3::text[])`,
          [personId, changed, [...DIRECTORY_EXPORT_CODES]],
        );
      } else {
        await tx.query(
          `INSERT INTO core.person_permission (person_id, permission_code)
           SELECT $1, code FROM unnest($2::text[]) AS code
           ON CONFLICT (person_id, permission_code) DO NOTHING`,
          [personId, changed],
        );
      }

      const result = await listPermissions(tx, personId);

      const others = (list: string[]) =>
        list.filter(
          (c) => !(DIRECTORY_EXPORT_CODES as readonly string[]).includes(c),
        );
      const othersBefore = others(before);
      const othersAfter = others(result);
      if (
        othersBefore.length !== othersAfter.length ||
        othersBefore.some((c) => !othersAfter.includes(c))
      ) {
        throw new Error('Se alteraron permisos ajenos a la exportación.');
      }
      const reached = args.revoke
        ? codes.every((c) => !result.includes(c))
        : codes.every((c) => result.includes(c));
      if (!reached) {
        throw new Error('El estado final no coincide con lo solicitado.');
      }
      return result;
    });
  } catch (error) {
    out.error(
      `${TAG} ERROR: no se pudo ${action}; la transacción se revirtió (${error instanceof Error ? error.message : 'error desconocido'}).`,
    );
    return { exitCode: 1, personId, before };
  }

  out.info(`${TAG} PERMISOS FINALES = ${fmt(after)}`);
  out.info(
    `${TAG} OK — person_id=${personId}: ${args.revoke ? 'revocado' : 'concedido'} ${changed.join(', ')}.`,
  );
  out.info(
    `${TAG} El backend aplica el cambio de inmediato (consulta core.person_permission en cada descarga).`,
  );
  out.info(
    `${TAG} Los botones del frontend se actualizan al volver a iniciar sesión o tras un intento rechazado.`,
  );
  return { exitCode: 0, personId, before, after, changed };
}
