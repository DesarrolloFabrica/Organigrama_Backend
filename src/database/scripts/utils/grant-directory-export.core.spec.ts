import { InMemoryPermissionDb } from '../../../../test/support/in-memory-permission-db';
import {
  maskEmail,
  parseGrantDirectoryExportArgs,
  runGrantDirectoryExport,
  type GrantDirectoryExportArgs,
} from './grant-directory-export.core';

/** Personas y correos sintéticos. */
const EMAIL = 'persona.sintetica@example.test';
const HTML = 'ORG_DIRECTORY_EXPORT_HTML';
const XLS = 'ORG_DIRECTORY_EXPORT_XLS';

function setup() {
  const db = new InMemoryPermissionDb([
    { id: '501', eduEmail: EMAIL, active: true },
    { id: '502', eduEmail: 'inactiva@example.test', active: false },
    { id: '503', eduEmail: 'duplicada@example.test', active: true },
    { id: '504', eduEmail: 'DUPLICADA@example.test', active: true },
  ]);
  const lines: string[] = [];
  const out = {
    info: (l: string) => lines.push(l),
    error: (l: string) => lines.push(l),
  };
  const run = (args: Partial<GrantDirectoryExportArgs>) =>
    runGrantDirectoryExport(
      db,
      { email: EMAIL, format: 'both', dryRun: false, revoke: false, ...args },
      out,
    );
  return { db, lines, run };
}

describe('parseGrantDirectoryExportArgs', () => {
  it('acepta la interfaz documentada', () => {
    expect(
      parseGrantDirectoryExportArgs([
        ' Persona@Example.test ',
        '--format=XLS',
        '--dry-run',
      ]),
    ).toEqual({
      ok: true,
      args: {
        email: 'persona@example.test',
        format: 'xls',
        dryRun: true,
        revoke: false,
      },
    });
    expect(
      parseGrantDirectoryExportArgs(['a@b.co', '--revoke', '--format=both']),
    ).toEqual({
      ok: true,
      args: { email: 'a@b.co', format: 'both', dryRun: false, revoke: true },
    });
  });

  it.each([
    [[], 'exactamente un correo'],
    [['a@b.co', 'c@d.co', '--format=html'], 'exactamente un correo'],
    [['no-es-correo', '--format=html'], 'formato válido'],
    [['a@b.co'], 'Falta --format'],
    [['a@b.co', '--format=pdf'], 'html, xls o both'],
    [['a@b.co', '--format=html', '--format=xls'], 'una vez'],
    [['a@b.co', '--format=html', '--force'], 'Opción desconocida'],
  ])('rechaza %j', (argv, message) => {
    const parsed = parseGrantDirectoryExportArgs(argv);
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toContain(message);
  });
});

describe('runGrantDirectoryExport', () => {
  it.each([
    ['html', [HTML]],
    ['xls', [XLS]],
    ['both', [HTML, XLS]],
  ] as const)('concede --format=%s', async (format, expected) => {
    const { db, run } = setup();
    const outcome = await run({ format });
    expect(outcome.exitCode).toBe(0);
    expect(outcome.changed).toEqual(expected);
    expect(db.codesOf('501')).toEqual([...expected].sort());
  });

  it('es idempotente: no duplica ni reescribe lo que ya existe', async () => {
    const { db, run, lines } = setup();
    db.grant('501', HTML);
    const outcome = await run({ format: 'both' });
    expect(outcome.changed).toEqual([XLS]);
    expect(lines.join('\n')).toContain(`Ya tenía: ${HTML}`);

    db.statements.length = 0;
    const again = await run({ format: 'both' });
    expect(again).toMatchObject({ exitCode: 0, changed: [] });
    expect(db.statements.some((s) => s.startsWith('INSERT'))).toBe(false);
    expect(db.codesOf('501')).toEqual([HTML, XLS]);
  });

  it('--dry-run no escribe nada', async () => {
    const { db, run, lines } = setup();
    const outcome = await run({ format: 'both', dryRun: true });
    expect(outcome).toMatchObject({ exitCode: 0, changed: [] });
    expect(db.codesOf('501')).toEqual([]);
    expect(db.statements.some((s) => /^(INSERT|DELETE)/.test(s))).toBe(false);
    expect(lines.join('\n')).toContain(`Se habría concedido: ${HTML}, ${XLS}`);
  });

  it('--revoke quita solo los códigos pedidos y conserva los demás permisos', async () => {
    const { db, run } = setup();
    db.grant(
      '501',
      HTML,
      XLS,
      'ORG_ADMIN',
      'ORG_READ_ALL',
      'ORG_CONTACT_READ_ALL',
    );
    const outcome = await run({ format: 'xls', revoke: true });
    expect(outcome).toMatchObject({ exitCode: 0, changed: [XLS] });
    expect(db.codesOf('501')).toEqual(
      ['ORG_ADMIN', 'ORG_CONTACT_READ_ALL', 'ORG_READ_ALL', HTML].sort(),
    );
  });

  it('--revoke sobre un permiso inexistente no hace nada', async () => {
    const { db, run } = setup();
    const outcome = await run({ format: 'html', revoke: true });
    expect(outcome).toMatchObject({ exitCode: 0, changed: [] });
    expect(db.statements.some((s) => s.startsWith('DELETE'))).toBe(false);
  });

  it('--revoke --dry-run informa sin borrar', async () => {
    const { db, run, lines } = setup();
    db.grant('501', HTML);
    await run({ format: 'html', revoke: true, dryRun: true });
    expect(db.codesOf('501')).toEqual([HTML]);
    expect(lines.join('\n')).toContain(`Se habría revocado: ${HTML}`);
  });

  it('conceder no altera ORG_ADMIN / ORG_READ_ALL / ORG_CONTACT_READ_ALL', async () => {
    const { db, run } = setup();
    db.grant('501', 'ORG_ADMIN', 'ORG_CONTACT_READ_ALL');
    await run({ format: 'html' });
    expect(db.codesOf('501')).toEqual([
      'ORG_ADMIN',
      'ORG_CONTACT_READ_ALL',
      HTML,
    ]);
  });

  it('si la escritura altera otros permisos, revierte toda la transacción', async () => {
    const { db, run, lines } = setup();
    db.tamperOnInsert = 'ORG_ADMIN';
    const outcome = await run({ format: 'both' });
    expect(outcome.exitCode).toBe(1);
    expect(db.codesOf('501')).toEqual([]);
    expect(lines.join('\n')).toContain('la transacción se revirtió');
  });

  it('rechaza personas inexistentes, inactivas o con correo duplicado', async () => {
    const { db, run } = setup();
    expect((await run({ email: 'nadie@example.test' })).exitCode).toBe(1);
    expect((await run({ email: 'inactiva@example.test' })).exitCode).toBe(1);
    expect((await run({ email: 'duplicada@example.test' })).exitCode).toBe(1);
    expect(db.permissions.size).toBe(0);
  });

  it('la salida no revela el correo completo', async () => {
    const { run, lines } = setup();
    await run({ format: 'both' });
    await run({ email: 'nadie@example.test' });
    const output = lines.join('\n');
    expect(output).not.toContain(EMAIL);
    expect(output).not.toContain('nadie@example.test');
    expect(output).toContain('person_id=501');
    expect(output).toContain(maskEmail(EMAIL));
  });
});

describe('maskEmail', () => {
  it('enmascara la parte local', () => {
    expect(maskEmail('persona.sintetica@example.test')).toBe(
      'pe***@example.test',
    );
    expect(maskEmail('sin-arroba')).toBe('***');
  });
});
