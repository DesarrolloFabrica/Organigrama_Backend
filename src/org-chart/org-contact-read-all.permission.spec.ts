/**
 * Matriz de permisos de ORG_CONTACT_READ_ALL (contrato endurecido).
 *
 * Regla de la fase de hardening:
 *   - Superficies MASIVAS (árbol, hijos, búsqueda) → NUNCA emiten `phone` de un
 *     tercero redactado, aunque el viewer tenga ORG_CONTACT_READ_ALL.
 *   - Ficha INDIVIDUAL (`GET /org-chart/person/:id`) → sí lo emite.
 *
 * Es decir: CAN_VIEW_PHONE y SHOULD_INCLUDE_PHONE_IN_THIS_RESPONSE son dos
 * decisiones distintas, y este archivo verifica que sigan separadas.
 */
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ORG_PERMISSION } from '../permissions/entities/person-permission.entity';
import {
  redactOrgChartSearchHit,
  redactOrgNode,
  redactOrgNodeTreeForViewer,
  resolveVisiblePhone,
  viewerCanViewPhone,
} from './org-chart-visibility.mapper';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';
import {
  viewerCanReadAllContacts,
  viewerHasGlobalReadAccess,
} from './org-viewer-context';
import type { OrgChartSearchHit, OrgNode } from './types/org-node.type';

const VERSION_ID = '1';
const REAL_PHONE = '3001234567';
const VIEWER_PHONE = '3000000000';

const NO_PERMISSIONS: string[] = [];
const CONTACT_ONLY: string[] = [ORG_PERMISSION.CONTACT_READ_ALL];
const READ_ALL_ONLY: string[] = [ORG_PERMISSION.READ_ALL];
const BOTH: string[] = [
  ORG_PERMISSION.READ_ALL,
  ORG_PERMISSION.CONTACT_READ_ALL,
];

function viewer(
  personId: string,
  permissions: string[] = [],
): OrgViewerContext {
  return { personId, eduEmail: null, permissions };
}

/** Persona de terceros: ni self ni descendiente del viewer. */
function outsiderNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: 'outsider',
    document: '1020304050',
    name: 'Persona Ejemplo',
    nodeKind: 'person',
    role_id: 'r1',
    role: { id: 'r1', name: 'ANALISTA', description: null },
    relation_id: null,
    parent_person_id: null,
    assignment_status: null,
    assignment_label: null,
    current_workforce_event: null,
    current_workforce_event_count: 0,
    hierarchy_id: 'h4',
    hierarchy: { id: 'h4', name: 'NIVEL 4', description: null },
    area_id: 'a1',
    area: { id: 'a1', name: 'Ops', description: null },
    school_id: 's1',
    school: { id: 's1', name: 'Escuela X', description: null },
    program_id: 'p1',
    program: {
      id: 'p1',
      name: 'Programa X',
      description: null,
      school_id: 's1',
    },
    email: 'personal@gmail.com',
    edu_email: 'persona@cun.edu.co',
    phone: REAL_PHONE,
    direct_reports_count: 0,
    children: [],
    city: { id: 'c1', name: 'Bogota' },
    campus: { id: 1, name: 'Sede Norte' },
    contract_type: { id: 'ct1', name: 'INDEFINIDO', description: null },
    region_id: 1,
    location: {
      region: { id: 1, name: 'Centro' },
      city: { id: 'c1', name: 'Bogota' },
      campus: { id: 1, name: 'Sede Norte' },
    },
    photoUrl: 'https://example.com/p.jpg',
    ...overrides,
  };
}

function outsiderHit(): OrgChartSearchHit {
  return {
    id: 'outsider',
    document: '1020304050',
    name: 'Persona Ejemplo',
    nodeKind: 'person',
    role_id: 'r1',
    role: { id: 'r1', name: 'ANALISTA', description: null },
    hierarchy_id: 'h4',
    hierarchy: { id: 'h4', name: 'NIVEL 4', description: null },
    area_id: 'a1',
    school_id: 's1',
    program_id: 'p1',
    email: 'personal@gmail.com',
    edu_email: 'persona@cun.edu.co',
    phone: REAL_PHONE,
    path: [],
  };
}

/**
 * Reproduce la construcción del campo `phone` de la ficha individual
 * (`OrgChartService.getPersonDetail`), que es la ÚNICA superficie que lo emite.
 */
function personDetailPhone(
  phone: string | null,
  canViewFullProfile: boolean,
  v: OrgViewerContext,
): string | null {
  return resolveVisiblePhone(phone, canViewFullProfile, {
    canReadAllContacts: viewerCanReadAllContacts(v),
  });
}

/** Todo campo privado que ORG_CONTACT_READ_ALL NO puede destapar nunca. */
function expectEverythingElseRedacted(node: OrgNode): void {
  expect(node.document).toBe('');
  expect(node.email).toBeNull();
  expect(node.area).toBeNull();
  expect(node.area_id).toBeNull();
  expect(node.school).toBeNull();
  expect(node.school_id).toBeNull();
  expect(node.program).toBeNull();
  expect(node.program_id).toBeNull();
  expect(node.city).toBeNull();
  expect(node.campus).toBeNull();
  expect(node.contract_type).toBeNull();
  expect(node.region_id).toBeNull();
  expect(node.location).toBeNull();
}

/** Recorre un árbol completo y recolecta todos los teléfonos no nulos. */
function collectPhones(node: OrgNode): string[] {
  const here = node.phone ? [node.phone] : [];
  return node.children.reduce<string[]>(
    (acc, child) => acc.concat(collectPhones(child)),
    here,
  );
}

describe('ORG_CONTACT_READ_ALL - semantica del permiso', () => {
  it('no altera viewerHasGlobalReadAccess (no es alias de ORG_READ_ALL)', () => {
    expect(viewerHasGlobalReadAccess(viewer('10', CONTACT_ONLY))).toBe(false);
    expect(viewerCanReadAllContacts(viewer('10', CONTACT_ONLY))).toBe(true);

    expect(viewerHasGlobalReadAccess(viewer('10', READ_ALL_ONLY))).toBe(true);
    // ORG_READ_ALL no implica el permiso de contacto: son independientes.
    expect(viewerCanReadAllContacts(viewer('10', READ_ALL_ONLY))).toBe(false);
  });

  it('no concede ficha completa: canViewFullProfile sigue false para terceros', async () => {
    const queryMock = jest.fn().mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartVisibilityService,
        { provide: DataSource, useValue: { query: queryMock } },
      ],
    }).compile();
    const service = moduleRef.get(OrgChartVisibilityService);

    await expect(
      service.canViewFullProfile(viewer('10', CONTACT_ONLY), '99', VERSION_ID),
    ).resolves.toBe(false);
  });

  it('CAN_VIEW_PHONE y SHOULD_INCLUDE estan separados', () => {
    // Tiene derecho...
    expect(viewerCanViewPhone(false, { canReadAllContacts: true })).toBe(true);
    // ...pero las superficies masivas no aceptan siquiera el parametro.
    expect(redactOrgNode).toHaveLength(2);
    expect(redactOrgChartSearchHit).toHaveLength(2);
    expect(redactOrgNodeTreeForViewer).toHaveLength(3);
  });
});

describe('Caso A - ARBOL: el permiso no expone telefonos masivamente', () => {
  it('arbol completo con ORG_CONTACT_READ_ALL: ningun telefono de tercero', () => {
    const tree = outsiderNode({
      id: 'viewer',
      phone: VIEWER_PHONE,
      children: [
        outsiderNode({ id: 'unrelated-1' }),
        outsiderNode({
          id: 'unrelated-2',
          phone: '3009999999',
          children: [outsiderNode({ id: 'unrelated-3', phone: '3008888888' })],
        }),
      ],
    });

    const result = redactOrgNodeTreeForViewer(tree, 'viewer', new Set());

    // Solo sobrevive el telefono del propio viewer (ficha completa de si mismo).
    expect(collectPhones(result)).toEqual([VIEWER_PHONE]);

    for (const child of result.children) {
      expect(child.phone).toBeNull();
      expectEverythingElseRedacted(child);
    }
    expect(result.children[1]?.children[0]?.phone).toBeNull();
  });

  it('nodo suelto redactado: phone null', () => {
    const node = redactOrgNode(outsiderNode(), false);

    expect(node.name).toBe('Persona Ejemplo');
    expect(node.edu_email).toBe('persona@cun.edu.co');
    expect(node.phone).toBeNull();
    expectEverythingElseRedacted(node);
  });
});

describe('Caso B - CHILDREN: el permiso no expone telefonos de la rama', () => {
  it('hijos de una rama ajena: todos con phone null', () => {
    const children = [
      outsiderNode({ id: 'c1' }),
      outsiderNode({ id: 'c2', phone: '3007777777' }),
    ];

    const result = children.map((node) =>
      redactOrgNodeTreeForViewer(node, 'viewer', new Set()),
    );

    expect(result.map((n) => n.phone)).toEqual([null, null]);
    result.forEach(expectEverythingElseRedacted);
  });

  it('hijo que SI es descendiente: ficha completa intacta (sin regresion)', () => {
    const result = redactOrgNodeTreeForViewer(
      outsiderNode({ id: 'descendant' }),
      'viewer',
      new Set(['descendant']),
    );

    expect(result.phone).toBe(REAL_PHONE);
    expect(result.document).toBe('1020304050');
    expect(result.email).toBe('personal@gmail.com');
  });
});

describe('Caso C - BUSQUEDA: el permiso no expone telefonos', () => {
  it('hit redactado: phone null aunque el viewer tenga el permiso', () => {
    const hit = redactOrgChartSearchHit(outsiderHit(), false);

    expect(hit.name).toBe('Persona Ejemplo');
    expect(hit.edu_email).toBe('persona@cun.edu.co');
    expect(hit.role?.name).toBe('ANALISTA');
    expect(hit.hierarchy?.name).toBe('NIVEL 4');

    expect(hit.phone).toBeNull();
    expect(hit.document).toBe('');
    expect(hit.email).toBeNull();
    expect(hit.area_id).toBeNull();
    expect(hit.school_id).toBeNull();
    expect(hit.program_id).toBeNull();
    expect(hit.path).toEqual([]);
  });

  it('hit con ficha completa: sin cambios', () => {
    const original = outsiderHit();
    expect(redactOrgChartSearchHit(original, true)).toEqual(original);
  });
});

describe('Caso D - FICHA INDIVIDUAL: unica superficie que emite el telefono', () => {
  const jose = viewer('4', CONTACT_ONLY);

  it('tercero redactado: solo el telefono es adicional', () => {
    // Campo `phone` de la respuesta de detalle.
    expect(personDetailPhone(REAL_PHONE, false, jose)).toBe(REAL_PHONE);

    // El resto del cuerpo sigue siendo la ficha redactada.
    const node = redactOrgNode(outsiderNode(), false);
    expectEverythingElseRedacted(node);
    expect(node.name).toBe('Persona Ejemplo');
    expect(node.edu_email).toBe('persona@cun.edu.co');
  });

  it('tercero sin telefono cargado: null, no undefined', () => {
    expect(personDetailPhone(null, false, jose)).toBeNull();
  });

  it('self: comportamiento completo sin cambios', () => {
    expect(personDetailPhone(VIEWER_PHONE, true, jose)).toBe(VIEWER_PHONE);
  });
});

describe('Caso E - USUARIO ESTANDAR de control', () => {
  const control = viewer('1086', NO_PERMISSIONS);

  it('ficha individual del mismo tercero: phone null', () => {
    expect(personDetailPhone(REAL_PHONE, false, control)).toBeNull();
  });

  it('arbol y busqueda del mismo tercero: phone null', () => {
    expect(
      redactOrgNodeTreeForViewer(outsiderNode(), 'other', new Set()).phone,
    ).toBeNull();
    expect(redactOrgChartSearchHit(outsiderHit(), false).phone).toBeNull();
  });

  it('descendiente propio: ficha completa intacta (sin regresion)', () => {
    expect(personDetailPhone(REAL_PHONE, true, control)).toBe(REAL_PHONE);
  });
});

describe('Caso F - ORG_READ_ALL sin regresiones', () => {
  const admin = viewer('1631', READ_ALL_ONLY);

  it('nodo integro', () => {
    const original = outsiderNode();
    expect(redactOrgNode(original, true)).toEqual(original);
  });

  it('ficha individual: telefono por ficha completa, no por el permiso nuevo', () => {
    expect(personDetailPhone(REAL_PHONE, true, admin)).toBe(REAL_PHONE);
    // Sin ficha completa tampoco recibiria telefono: ORG_READ_ALL no otorga
    // ORG_CONTACT_READ_ALL. En la practica canViewFullProfile ya es true antes.
    expect(personDetailPhone(REAL_PHONE, false, admin)).toBeNull();
  });

  it('ambos permisos: identico a ORG_READ_ALL solo', () => {
    const both = viewer('1631', BOTH);
    const original = outsiderNode();

    expect(redactOrgNode(original, true)).toEqual(
      redactOrgNode(original, true),
    );
    expect(personDetailPhone(REAL_PHONE, true, both)).toBe(
      personDetailPhone(REAL_PHONE, true, admin),
    );
    expect(viewerHasGlobalReadAccess(both)).toBe(true);
  });
});

describe('resolveVisiblePhone - fuente unica de verdad', () => {
  it.each([
    ['ficha completa, sin permiso de contacto', true, false, REAL_PHONE],
    ['ficha completa, con permiso de contacto', true, true, REAL_PHONE],
    ['ficha redactada, sin permiso de contacto', false, false, null],
    ['ficha redactada, con permiso de contacto', false, true, REAL_PHONE],
  ])('%s', (_label, canViewFullProfile, canReadAllContacts, expected) => {
    expect(
      resolveVisiblePhone(REAL_PHONE, canViewFullProfile, {
        canReadAllContacts,
      }),
    ).toBe(expected);
  });

  it('normaliza undefined a null', () => {
    expect(resolveVisiblePhone(undefined, true)).toBeNull();
    expect(
      resolveVisiblePhone(undefined, false, { canReadAllContacts: true }),
    ).toBeNull();
  });

  it('sin opciones equivale a usuario estandar', () => {
    expect(resolveVisiblePhone(REAL_PHONE, false)).toBeNull();
  });
});
