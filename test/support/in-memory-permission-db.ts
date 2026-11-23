/**
 * Doble en memoria de core.person, core.person_permission y la tabla de
 * auditoría de exportaciones. Solo para pruebas (fuera de src/: no entra en el
 * build). Interpreta únicamente las sentencias SQL que usan el script
 * org:grant-directory-export y OrgChartDirectoryExportAuditService; cualquier
 * otra sentencia falla para que una consulta inesperada no pase inadvertida.
 */
import type { FindOperator } from 'typeorm';

export type FakePerson = { id: string; eduEmail: string; active: boolean };

export type FakeAuditRow = {
  person_id: string;
  export_format: string;
  version_id: string | null;
  row_count: number | null;
  result: string;
  error_code: string | null;
  created_at: Date;
};

export class InMemoryPermissionDb {
  readonly permissions = new Set<string>();
  readonly audit: FakeAuditRow[] = [];
  readonly statements: string[] = [];
  failAuditWrites = false;
  failPermissionReads = false;
  /** Simula un efecto colateral indebido al conceder (para probar el ROLLBACK). */
  tamperOnInsert: string | null = null;

  constructor(readonly people: FakePerson[] = []) {}

  grant(personId: string, ...codes: string[]): void {
    for (const code of codes) this.permissions.add(`${personId}|${code}`);
  }

  codesOf(personId: string): string[] {
    return [...this.permissions]
      .filter((key) => key.startsWith(`${personId}|`))
      .map((key) => key.split('|')[1])
      .sort();
  }

  query = <T = unknown>(sql: string, params: unknown[] = []): Promise<T> => {
    const s = sql.replace(/\s+/g, ' ').trim();
    this.statements.push(s);

    if (/FROM core\.person WHERE LOWER\(edu_email\) = \$1 AND is_active = true/.test(s)) {
      const email = String(params[0]);
      const rows = this.people
        .filter((p) => p.active && p.eduEmail.toLowerCase() === email)
        .slice(0, 2)
        .map((p) => ({ id: p.id }));
      return Promise.resolve(rows as T);
    }

    if (/^SELECT permission_code FROM core\.person_permission WHERE person_id = \$1/.test(s)) {
      if (this.failPermissionReads) return Promise.reject(new Error('read failed'));
      const rows = this.codesOf(String(params[0])).map((permission_code) => ({
        permission_code,
      }));
      return Promise.resolve(rows as T);
    }

    if (/^INSERT INTO core\.person_permission/.test(s)) {
      const personId = String(params[0]);
      for (const code of params[1] as string[]) this.grant(personId, code);
      if (this.tamperOnInsert) this.grant(personId, this.tamperOnInsert);
      return Promise.resolve([] as T);
    }

    if (/^DELETE FROM core\.person_permission/.test(s)) {
      const personId = String(params[0]);
      const requested = params[1] as string[];
      const allowed = params[2] as string[];
      for (const code of requested) {
        if (allowed.includes(code)) this.permissions.delete(`${personId}|${code}`);
      }
      return Promise.resolve([] as T);
    }

    if (/^INSERT INTO organigrama\.org_chart_directory_export_audit/.test(s)) {
      if (this.failAuditWrites) {
        return Promise.reject(
          Object.assign(new Error('relation does not exist'), { code: '42P01' }),
        );
      }
      const [person_id, export_format, version_id, row_count, result, error_code] =
        params as [string, string, string | null, number | null, string, string | null];
      this.audit.push({
        person_id,
        export_format,
        version_id,
        row_count,
        result,
        error_code,
        created_at: new Date(),
      });
      return Promise.resolve([] as T);
    }

    return Promise.reject(new Error(`SQL no soportado por el doble: ${s.slice(0, 80)}`));
  };

  /** Transacción con ROLLBACK real sobre el estado en memoria. */
  transaction = async <T>(
    fn: (tx: { query: InMemoryPermissionDb['query'] }) => Promise<T>,
  ): Promise<T> => {
    const snapshot = new Set(this.permissions);
    try {
      return await fn({ query: this.query });
    } catch (error) {
      this.permissions.clear();
      for (const key of snapshot) this.permissions.add(key);
      throw error;
    }
  };

  /** Repositorio TypeORM mínimo para PersonPermissionService. */
  permissionRepository() {
    return {
      find: (options: {
        where: {
          person_id: string;
          permission_code?: string | FindOperator<string[]>;
        };
      }) => {
        if (this.failPermissionReads) return Promise.reject(new Error('read failed'));
        const personId = String(options.where.person_id);
        const filter = options.where.permission_code;
        const allowed =
          filter === undefined
            ? null
            : typeof filter === 'string'
              ? [filter]
              : (filter.value as string[]);
        return Promise.resolve(
          this.codesOf(personId)
            .filter((code) => !allowed || allowed.includes(code))
            .map((permission_code) => ({ person_id: personId, permission_code })),
        );
      },
    };
  }
}
