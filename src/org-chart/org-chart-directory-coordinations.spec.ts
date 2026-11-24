/**
 * Agrupación por coordinación del Excel. Estructura sintética que replica la
 * forma real verificada en producción: Director → Coordinador General (misma
 * área de Dirección, con staff) → cabezas de coordinación de otras áreas.
 */
import {
  areaKey,
  buildCoordinationSheets,
  EXCEL_SHEET_NAME_MAX,
  groupDirectoryByCoordination,
  uniqueSheetNames,
  type CoordinationPlacement,
} from './org-chart-directory-coordinations';
import type { DirectoryExportRow } from './org-chart-directory-export.util';

const DIR = 'DIRECCIÓN SINTÉTICA';
const ROOT = '1';

function p(
  personId: string,
  bossId: string | null,
  areaName: string,
  fullName = `Persona ${personId}`,
): CoordinationPlacement {
  return { personId, bossId, areaName, fullName };
}

/**
 *  1 Director (DIR)
 *  └ 2 Coordinador General (DIR)
 *     ├ 3 Analista operativo (DIR)               → Dirección, sin coordinación
 *     ├ 10 Cabeza B2B (B2B) ─ 11 (B2B)
 *     ├ 20 Cabeza Fábrica (FÁBRICA)
 *     │   ├ 21 Líder (FÁBRICA) ─ 22, 23 (FÁBRICA)
 *     │   └ 24 (OTRA ÁREA: sigue en Fábrica por jerarquía)
 *     └ 30 Cabeza Especializaciones (ESP)
 *         └ 31 Docente LITE (no elegible) ─ 32 (ESP, elegible)
 */
function realisticPlacements(): CoordinationPlacement[] {
  return [
    p('1', null, DIR, 'Director'),
    p('2', '1', DIR, 'Coordinador General'),
    p('3', '2', DIR, 'Analista Operativo'),
    p('10', '2', 'B2B', 'Supervisor B2B'),
    p('11', '10', 'B2B', 'Auxiliar B2B'),
    p('20', '2', 'FÁBRICA Y DESARROLLO', 'Coordinador Fábrica'),
    p('21', '20', 'FÁBRICA Y DESARROLLO', 'Líder Contenidos'),
    p('22', '21', 'FÁBRICA Y DESARROLLO', 'Analista B'),
    p('23', '21', 'FÁBRICA Y DESARROLLO', 'Analista A'),
    p('24', '20', 'PROYECCIÓN SOCIAL', 'Auxiliar de otra área'),
    p('30', '2', 'ESPECIALIZACIONES', 'Coordinadora Especializaciones'),
    p('31', '30', 'ESPECIALIZACIONES', 'Docente LITE'),
    p('32', '31', 'ESPECIALIZACIONES', 'Monitora'),
  ];
}

const byArea = (placements: CoordinationPlacement[], root = ROOT) =>
  new Map(
    groupDirectoryByCoordination(placements, root).coordinations.map((c) => [
      c.areaName,
      c,
    ]),
  );

describe('groupDirectoryByCoordination', () => {
  it('cabezas = quienes cuelgan de la Dirección con otra área; Dirección aparte', () => {
    const grouping = groupDirectoryByCoordination(realisticPlacements(), ROOT);

    expect(grouping.coordinations.map((c) => c.areaName)).toEqual([
      'B2B',
      'ESPECIALIZACIONES',
      'FÁBRICA Y DESARROLLO',
    ]);
    expect(grouping.coordinations.map((c) => c.headIds)).toEqual([
      ['10'],
      ['30'],
      ['20'],
    ]);
    // La Dirección es su propio grupo: raíz, Coordinador General y su staff.
    expect(grouping.directions).toEqual([
      { areaName: DIR, headIds: ['1'], memberIds: ['1', '2', '3'] },
    ]);
  });

  it('incluye todo el subárbol en orden jerárquico (cabeza, líder y su equipo)', () => {
    const fabrica = byArea(realisticPlacements()).get('FÁBRICA Y DESARROLLO')!;
    // Primero el staff sin equipo (24), luego cada líder seguido de su equipo.
    expect(fabrica.memberIds).toEqual(['20', '24', '21', '23', '22']);
  });

  it('cada equipo (p. ej. una escuela) queda en un bloque contiguo tras su responsable', () => {
    // Operación Académica: coordinadora con staff directo y dos escuelas.
    const placements = [
      p('1', null, DIR, 'Director'),
      p('70', '1', 'OPERACION ACADEMICA', 'Coordinadora OA'),
      p('71', '70', 'OPERACION ACADEMICA', 'Zoe staff directa'),
      p('72', '70', 'OPERACION ACADEMICA', 'Alba coordinadora escuela A'),
      p('73', '72', 'OPERACION ACADEMICA', 'Ana de la escuela A'),
      p('74', '70', 'OPERACION ACADEMICA', 'Beto coordinador escuela B'),
      p('75', '74', 'OPERACION ACADEMICA', 'Bruno de la escuela B'),
      p('76', '72', 'OPERACION ACADEMICA', 'Carla de la escuela A'),
    ];
    const oa = byArea(placements).get('OPERACION ACADEMICA')!;
    expect(oa.memberIds).toEqual(['70', '71', '72', '73', '76', '74', '75']);
  });

  it('la jerarquía manda sobre el área del miembro', () => {
    const coordinations = byArea(realisticPlacements());
    expect(coordinations.get('FÁBRICA Y DESARROLLO')!.memberIds).toContain(
      '24',
    );
    expect(coordinations.has('PROYECCIÓN SOCIAL')).toBe(false);
  });

  it('atraviesa a quien no es elegible para llegar a sus subordinados', () => {
    const esp = byArea(realisticPlacements()).get('ESPECIALIZACIONES')!;
    expect(esp.memberIds).toEqual(['30', '31', '32']);
  });

  it('dos cabezas de la misma área forman una sola coordinación', () => {
    const placements = [
      ...realisticPlacements(),
      p('40', '2', 'b2b ', 'Vendedora B2B'),
      p('41', '40', 'B2B', 'Equipo de la segunda cabeza'),
    ];
    const b2b = byArea(placements).get('B2B')!;
    expect(b2b.headIds).toEqual(['10', '40']);
    expect(b2b.memberIds).toEqual(['10', '11', '40', '41']);
  });

  it('varios jefes en DOS coordinaciones: figura en ambas, una vez en cada una', () => {
    const placements = [
      ...realisticPlacements(),
      p('22', '10', 'FÁBRICA Y DESARROLLO'),
    ];
    const coordinations = byArea(placements);
    expect(coordinations.get('B2B')!.memberIds).toContain('22');
    const fabrica = coordinations.get('FÁBRICA Y DESARROLLO')!.memberIds;
    expect(fabrica.filter((id) => id === '22')).toHaveLength(1);
  });

  it('varios jefes dentro de la MISMA coordinación: una sola vez', () => {
    const placements = [
      ...realisticPlacements(),
      p('22', '20', 'FÁBRICA Y DESARROLLO'),
    ];
    const fabrica = byArea(placements).get('FÁBRICA Y DESARROLLO')!.memberIds;
    expect(fabrica.filter((id) => id === '22')).toHaveLength(1);
  });

  it('quien cuelga de un jefe inactivo (sin fila) no entra en ningún grupo', () => {
    // 99 es un jefe inactivo: no tiene ubicación propia.
    const placements = [...realisticPlacements(), p('50', '99', 'B2B')];
    const grouping = groupDirectoryByCoordination(placements, ROOT);
    const all = [...grouping.directions, ...grouping.coordinations].flatMap(
      (c) => c.memberIds,
    );
    expect(all).not.toContain('50');
  });

  it('una coordinación nueva genera su grupo y una que se va desaparece', () => {
    const nueva = [
      ...realisticPlacements(),
      p('60', '2', 'SABER PRO', 'Coord Saber'),
    ];
    expect(byArea(nueva).has('SABER PRO')).toBe(true);

    const sinB2B = realisticPlacements().filter(
      (x) => !['10', '11'].includes(x.personId),
    );
    expect(byArea(sinB2B).has('B2B')).toBe(false);
  });

  it('un cambio de jefe mueve a la persona de coordinación', () => {
    const placements = realisticPlacements().map((x) =>
      x.personId === '11' ? { ...x, bossId: '30' } : x,
    );
    const coordinations = byArea(placements);
    expect(coordinations.get('B2B')!.memberIds).toEqual(['10']);
    expect(coordinations.get('ESPECIALIZACIONES')!.memberIds).toContain('11');
  });

  it('sin la raíz configurada usa las raíces del grafo', () => {
    const coordinations = byArea(realisticPlacements(), '1144');
    expect([...coordinations.keys()]).toEqual([
      'B2B',
      'ESPECIALIZACIONES',
      'FÁBRICA Y DESARROLLO',
    ]);
  });

  it('no se cuelga con ciclos', () => {
    const placements = [
      ...realisticPlacements(),
      p('20', '22', 'FÁBRICA Y DESARROLLO'),
    ];
    const fabrica = byArea(placements).get('FÁBRICA Y DESARROLLO')!;
    expect(new Set(fabrica.memberIds).size).toBe(fabrica.memberIds.length);
  });

  it('areaKey ignora tildes, mayúsculas y espacios', () => {
    expect(areaKey(' Fábrica  y desarrollo ')).toBe(
      areaKey('FABRICA Y DESARROLLO'),
    );
    expect(areaKey(null)).toBe('');
  });
});

describe('uniqueSheetNames', () => {
  it('quita caracteres inválidos, recorta a 31 y evita repetidos', () => {
    const names = uniqueSheetNames([
      'Base general',
      'base GENERAL',
      'Ventas/Compras [B2B]: ¿qué? *',
      'X'.repeat(40),
      'X'.repeat(40),
      "'Comillas'",
      '   ',
      'History',
      // 32 caracteres: se quitan artículos y preposiciones.
      'DIRECCION GENERAL DE OPERACIONES',
      // Aún largo sin preposiciones: se corta en el último espacio.
      'COORDINACION ACADEMICA VIRTUAL DE POSGRADOS',
    ]);
    expect(names[0]).toBe('Base general');
    expect(names[1]).toBe('base GENERAL (2)');
    expect(names[2]).toBe('Ventas Compras B2B ¿qué');
    expect(names[3]).toHaveLength(EXCEL_SHEET_NAME_MAX);
    expect(names[4]).toBe(`${'X'.repeat(27)} (2)`);
    expect(names[5]).toBe('Comillas');
    expect(names[6]).toBe('Hoja');
    expect(names[7]).toBe('History (hoja)');
    expect(names[8]).toBe('DIRECCION GENERAL OPERACIONES');
    expect(names[9]).toBe('COORDINACION ACADEMICA VIRTUAL');
    for (const name of names) {
      expect(name.length).toBeLessThanOrEqual(EXCEL_SHEET_NAME_MAX);
      expect(name).not.toMatch(/[\\/?*:[\]]/);
    }
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
  });
});

describe('buildCoordinationSheets', () => {
  const row = (fullName: string): DirectoryExportRow =>
    ({ fullName }) as unknown as DirectoryExportRow;

  it('solo elegibles, en orden jerárquico, sin hojas vacías y con los no asignados', () => {
    const placements = realisticPlacements();
    // No elegibles: el docente LITE (31). Todos los demás tienen fila.
    const rowById = new Map(
      placements
        .filter((x) => x.personId !== '31')
        .map((x) => [x.personId, row(x.fullName)]),
    );
    const grouping = groupDirectoryByCoordination(placements, ROOT);
    const { sheets, directionSheetCount, unassignedIds, areaMismatchIds } =
      buildCoordinationSheets(
        grouping,
        placements,
        rowById,
        'Versión · v4 (activa)',
      );

    // Dirección primero; luego las coordinaciones en orden alfabético.
    expect(sheets.map((s) => s.name)).toEqual([
      DIR,
      'B2B',
      'ESPECIALIZACIONES',
      'FÁBRICA Y DESARROLLO',
    ]);
    expect(directionSheetCount).toBe(1);
    expect(sheets.every((s) => s.layout === 'coordinacion')).toBe(true);
    expect(sheets[0].rows.map((r) => r.fullName)).toEqual([
      'Director',
      'Coordinador General',
      'Analista Operativo',
    ]);
    expect(sheets[0].title).toBe(
      `Dirección: ${DIR} — Responsable: Director — Versión · v4 (activa) — 3 personas`,
    );
    expect(sheets[2].rows.map((r) => r.fullName)).toEqual([
      'Coordinadora Especializaciones',
      'Monitora',
    ]);
    expect(sheets[2].title).toBe(
      'Coordinación: ESPECIALIZACIONES — Responsable: Coordinadora Especializaciones — Versión · v4 (activa) — 2 personas',
    );
    // Todas las personas elegibles quedan en alguna pestaña.
    expect(unassignedIds).toEqual([]);
    // 24 sale en Fábrica (su jefe) con área PROYECCIÓN SOCIAL: se reporta.
    expect(areaMismatchIds).toEqual(['24']);
  });

  it('quien cuelga de un jefe inactivo queda solo en la base general', () => {
    const placements = [
      ...realisticPlacements(),
      p('50', '99', 'B2B', 'Huérfana'),
    ];
    const rowById = new Map(
      placements.map((x) => [x.personId, row(x.fullName)]),
    );
    const { unassignedIds } = buildCoordinationSheets(
      groupDirectoryByCoordination(placements, ROOT),
      placements,
      rowById,
      'v',
    );
    expect(unassignedIds).toEqual(['50']);
  });

  it('una coordinación sin personas elegibles no genera hoja', () => {
    const placements = realisticPlacements();
    const rowById = new Map(
      placements
        .filter((x) => !['10', '11'].includes(x.personId))
        .map((x) => [x.personId, row(x.fullName)]),
    );
    const { sheets } = buildCoordinationSheets(
      groupDirectoryByCoordination(placements, ROOT),
      placements,
      rowById,
      'v',
    );
    expect(sheets.map((s) => s.name)).not.toContain('B2B');
  });

  it('un área llamada como la base general no la pisa', () => {
    const placements = [p('1', null, DIR), p('2', '1', 'Base General')];
    const rowById = new Map(
      placements.map((x) => [x.personId, row(x.fullName)]),
    );
    const { sheets } = buildCoordinationSheets(
      groupDirectoryByCoordination(placements, ROOT),
      placements,
      rowById,
      'v',
    );
    expect(sheets.map((s) => s.name)).toEqual([DIR, 'Base General (2)']);
  });
});
