/**
 * Overrides de cargo que usan los exportadores
 * (`OrgChartService.getRoleNameOverridesForVersion`): con `manager` se leen
 * en ese momento por la conexión de la transacción, sin las cachés del mapa.
 * Datos 100 % sintéticos.
 */
import type { EntityManager } from 'typeorm';
import { Role } from '../catalogs/entities/role.entity';
import { OrgChartPersonOverride } from './entities/org-chart-person-override.entity';
import { OrgVisualRelationOverride } from './entities/org-visual-relation-override.entity';
import { OrgChartService } from './org-chart.service';
import {
  runWithOrgChartVersionReadPlan,
  type OrgChartVersionReadPlan,
} from './org-chart-version-read-plan';

type Row = Record<string, unknown>;

/** Repositorio mínimo: `find` filtra por las condiciones OR de `where`. */
function fakeRepo(rows: () => Row[]) {
  return {
    find: jest.fn((options?: { where?: Row | Row[] }) => {
      const where = options?.where;
      const ors = where == null ? [] : Array.isArray(where) ? where : [where];
      const all = rows();
      return Promise.resolve(
        ors.length === 0
          ? all
          : all.filter((row) =>
              ors.some((cond) =>
                Object.entries(cond).every(
                  ([key, value]) => String(row[key]) === String(value),
                ),
              ),
            ),
      );
    }),
  };
}

const PLAN: OrgChartVersionReadPlan = {
  globalVersionId: '7',
  overlays: [
    {
      versionId: '9',
      scopeCode: 'coord',
      scopeLabel: 'Coordinación',
      rootPersonId: '1',
    },
  ],
  applyPlanta: true,
  applyExceptions: false,
  cacheKey: 'g7|o9|planta',
};

const ROLES = [
  { id: '1', name: 'ANALISTA' },
  { id: '2', name: 'COORDINADOR' },
  { id: '3', name: 'LIDER SINTÉTICO' },
];

describe('OrgChartService.getRoleNameOverridesForVersion', () => {
  let personOverrides: Row[];
  let relationOverrides: Row[];
  let roles: Row[];
  let injected: {
    personOverrides: ReturnType<typeof fakeRepo>;
    relationOverrides: ReturnType<typeof fakeRepo>;
    roles: ReturnType<typeof fakeRepo>;
  };
  let service: OrgChartService;
  let manager: EntityManager;
  let managerRepos: Map<unknown, ReturnType<typeof fakeRepo>>;

  const read = (options?: { manager?: EntityManager }) =>
    runWithOrgChartVersionReadPlan(PLAN, () =>
      service.getRoleNameOverridesForVersion('7', options),
    );

  beforeEach(() => {
    roles = [...ROLES];
    personOverrides = [
      // Global y overlay para la misma persona: gana el overlay.
      { version_id: '7', person_id: '10', role_id_override: '1' },
      { version_id: '9', person_id: '10', role_id_override: '2' },
      // Otra versión: no aplica.
      { version_id: '99', person_id: '11', role_id_override: '3' },
    ];
    relationOverrides = [
      {
        version_id: '7',
        relation_id: '500',
        role_id_override: '3',
        is_active: true,
      },
      {
        version_id: '7',
        relation_id: '501',
        role_id_override: '2',
        is_active: false,
      },
      {
        version_id: '7',
        relation_id: '502',
        role_id_override: null,
        is_active: true,
      },
    ];

    injected = {
      personOverrides: fakeRepo(() => personOverrides),
      relationOverrides: fakeRepo(() => relationOverrides),
      roles: fakeRepo(() => roles),
    };
    const emptyRepo = fakeRepo(() => []);
    // Orden del constructor de OrgChartService.
    service = new OrgChartService(
      undefined as never, // treeEngine
      undefined as never, // photoUrlBuilder
      undefined as never, // profilePhotoLookup
      undefined as never, // dataSource
      undefined as never, // persons
      injected.personOverrides as never,
      injected.relationOverrides as never,
      injected.roles as never,
      emptyRepo as never, // hierarchies
      emptyRepo as never, // areas
      emptyRepo as never, // schools
      emptyRepo as never, // programs
      emptyRepo as never, // cities
      emptyRepo as never, // campuses
      emptyRepo as never, // contractTypes
      emptyRepo as never, // regions
      undefined as never, // profileService
      undefined as never, // visibility
      undefined as never, // workforceEvents
    );

    managerRepos = new Map<unknown, ReturnType<typeof fakeRepo>>([
      [Role, fakeRepo(() => roles)],
      [OrgChartPersonOverride, fakeRepo(() => personOverrides)],
      [OrgVisualRelationOverride, fakeRepo(() => relationOverrides)],
    ]);
    manager = {
      getRepository: (entity: unknown) => managerRepos.get(entity),
    } as unknown as EntityManager;
  });

  it('con manager: lee por la transacción con la precedencia del mapa', async () => {
    const result = await read({ manager });

    expect([...result.byPerson]).toEqual([['10', 'COORDINADOR']]);
    expect([...result.byRelation]).toEqual([['500', 'LIDER SINTÉTICO']]);
    // Nada por los repositorios inyectados (los de las cachés del mapa).
    expect(injected.personOverrides.find).not.toHaveBeenCalled();
    expect(injected.relationOverrides.find).not.toHaveBeenCalled();
    expect(injected.roles.find).not.toHaveBeenCalled();
    expect(managerRepos.get(OrgChartPersonOverride)!.find).toHaveBeenCalledWith(
      {
        where: [{ version_id: '7' }, { version_id: '9' }],
      },
    );
  });

  it('sin manager: mismo resultado (el mapa y los exportadores coinciden)', async () => {
    const cached = await read();
    const fresh = await read({ manager });

    expect([...cached.byPerson]).toEqual([...fresh.byPerson]);
    expect([...cached.byRelation]).toEqual([...fresh.byRelation]);
  });

  it('un cambio recién escrito se ve con manager aunque la caché del mapa siga vigente', async () => {
    const before = await read(); // llena las cachés del mapa (3 min)

    personOverrides = [
      { version_id: '7', person_id: '10', role_id_override: '3' },
    ];
    relationOverrides = [];
    roles = [...ROLES, { id: '4', name: 'CARGO RECIÉN CREADO' }];
    personOverrides.push({
      version_id: '7',
      person_id: '12',
      role_id_override: '4',
    });

    const mapView = await read();
    const exportView = await read({ manager });

    // El mapa conserva su caché (comportamiento existente, sin cambios)…
    expect([...mapView.byPerson]).toEqual([...before.byPerson]);
    // …el exportador ve el estado vigente, incluido un cargo nuevo del catálogo.
    expect([...exportView.byPerson]).toEqual([
      ['10', 'LIDER SINTÉTICO'],
      ['12', 'CARGO RECIÉN CREADO'],
    ]);
    expect([...exportView.byRelation]).toEqual([]);
  });

  it('la lectura con manager no escribe en las cachés del mapa', async () => {
    await read({ manager });
    personOverrides = [];

    const mapView = await read();

    // La primera lectura sin manager va a la base: la caché estaba vacía.
    expect(injected.personOverrides.find).toHaveBeenCalledTimes(1);
    expect([...mapView.byPerson]).toEqual([]);
  });
});
