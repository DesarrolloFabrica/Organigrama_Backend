import {
  redactOrgNode,
  redactOrgNodeTreeForViewer,
} from './org-chart-visibility.mapper';
import type { OrgNode } from './types/org-node.type';

function sampleNode(overrides: Partial<OrgNode> = {}): OrgNode {
  return {
    id: '1',
    document: '123',
    name: 'Raúl',
    nodeKind: 'person',
    role_id: 'r1',
    role: { id: 'r1', name: 'COORDINADOR', description: null },
    hierarchy_id: 'h2',
    hierarchy: {
      id: 'h2',
      name: 'NIVEL 2',
      description: null,
    },
    area_id: 'a1',
    area: { id: 'a1', name: 'Ops', description: null },
    school_id: null,
    school: null,
    program_id: null,
    program: null,
    email: 'personal@example.com',
    edu_email: 'raul@edu.co',
    phone: '300',
    direct_reports_count: 2,
    children: [],
    city: null,
    campus: null,
    contract_type: null,
    region_id: null,
    location: null,
    photoUrl: 'https://example.com/p.jpg',
    ...overrides,
  };
}

describe('redactOrgNode', () => {
  it('preserves hierarchy and role for map colors when profile is restricted', () => {
    const redacted = redactOrgNode(sampleNode(), false);

    expect(redacted.hierarchy).toEqual({
      id: 'h2',
      name: 'NIVEL 2',
      description: null,
    });
    expect(redacted.hierarchy_id).toBe('h2');
    expect(redacted.role?.name).toBe('COORDINADOR');
    expect(redacted.document).toBe('');
    expect(redacted.email).toBeNull();
    expect(redacted.phone).toBeNull();
    expect(redacted.area).toBeNull();
    expect(redacted.location).toBeNull();
  });

  it('applies visibility per node in the tree', () => {
    const tree = sampleNode({
      id: 'viewer',
      hierarchy: { id: 'h1', name: 'NIVEL 1', description: null },
      children: [
        sampleNode({
          id: 'peer',
          hierarchy: { id: 'h2', name: 'NIVEL 2', description: null },
        }),
      ],
    });

    const result = redactOrgNodeTreeForViewer(
      tree,
      'viewer',
      new Set<string>(),
    );

    expect(result.hierarchy?.name).toBe('NIVEL 1');
    expect(result.children[0]?.hierarchy?.name).toBe('NIVEL 2');
    expect(result.children[0]?.email).toBeNull();
  });
});
