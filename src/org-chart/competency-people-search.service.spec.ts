import type { DataSource } from 'typeorm';
import type { Mc1PersonCompetenciesPresentationDto } from '../mc-pipeline/person-profile/mc1-person-profile.types';
import { CompetencyPeopleSearchService } from './competency-people-search.service';
import type { OrgViewerContext } from './org-viewer-context';
import type { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { PhotoUrlBuilder } from './photos/photo-url.builder';

type Field = Mc1PersonCompetenciesPresentationDto['fields'][number];
type Specialty = Field['specialties'][number];
type DataSourceQuery = (
  sql: string,
  parameters: [string[], boolean, string],
) => Promise<unknown[]>;

const globalViewer: OrgViewerContext = {
  personId: '900',
  eduEmail: 'admin@cun.edu.co',
  permissions: ['ORG_READ_ALL'],
};

const leaderViewer: OrgViewerContext = {
  personId: '10',
  eduEmail: 'leader@cun.edu.co',
  permissions: [],
};

function specialty(
  code: string,
  skills: Array<[string, string]> = [],
): Specialty {
  return {
    code,
    label: code,
    skills: skills.map(([skillCode, name]) => ({ code: skillCode, name })),
  };
}

function field(
  code: string,
  role: 'PRIMARY' | 'SECONDARY',
  specialties: Specialty[] = [],
): Field {
  return {
    code,
    label: code,
    role,
    specialties,
    tools: [],
    competencyMap: { dimensions: [] },
    evidenceVolume: 'MEDIUM',
  };
}

function payload(fields: Field[]): Mc1PersonCompetenciesPresentationDto {
  return {
    status: 'AVAILABLE',
    source: 'CLOUD_PRESENTATION_STORE',
    fields,
  };
}

function row(
  personId: string,
  displayName: string,
  fields: Field[],
  options: { jobTitle?: string | null; eduEmail?: string | null } = {},
) {
  return {
    person_id: personId,
    display_name: displayName,
    edu_email: options.eduEmail ?? `${personId}@cun.edu.co`,
    job_title: options.jobTitle ?? 'Profesional',
    payload_json: payload(fields),
  };
}

const softwareFrontend = (
  role: 'PRIMARY' | 'SECONDARY',
  skills: Array<[string, string]> = [],
) =>
  field('SOFTWARE_ENGINEERING', role, [
    specialty('FRONTEND_ENGINEERING', skills),
  ]);

describe('CompetencyPeopleSearchService', () => {
  let dataSource: { query: jest.MockedFunction<DataSourceQuery> };
  let visibility: { getVisibleDescendantIds: jest.Mock };
  let photoUrlBuilder: { buildPhotoUrl: jest.Mock };
  let service: CompetencyPeopleSearchService;

  beforeEach(() => {
    dataSource = {
      query: jest.fn<DataSourceQuery>().mockResolvedValue([]),
    };
    visibility = {
      getVisibleDescendantIds: jest.fn().mockResolvedValue(new Set<string>()),
    };
    photoUrlBuilder = {
      buildPhotoUrl: jest.fn(({ id }: { id: string }) => `/photos/${id}`),
    };
    service = new CompetencyPeopleSearchService(
      dataSource as unknown as DataSource,
      visibility as unknown as OrgChartVisibilityService,
      photoUrlBuilder as unknown as PhotoUrlBuilder,
    );
  });

  const search = (
    rows: unknown[],
    input: Parameters<CompetencyPeopleSearchService['search']>[2] = {},
    viewer: OrgViewerContext = globalViewer,
  ) => {
    dataSource.query.mockResolvedValue(rows);
    return service.search(viewer, 'version-1', input);
  };

  it('returns initial metadata with only present domains and distinct-person counts', async () => {
    const result = await search([
      row('1', 'Ana', [
        softwareFrontend('PRIMARY'),
        softwareFrontend('SECONDARY'),
      ]),
      row('2', 'Beto', [softwareFrontend('SECONDARY')]),
    ]);

    expect(result.people).toEqual([]);
    expect(result.authorizedUniverseTotal).toBe(2);
    expect(result.total).toBe(2);
    expect(result.facets.domains).toEqual([
      expect.objectContaining({ code: 'SOFTWARE_ENGINEERING', count: 2 }),
    ]);
  });

  it('builds AUTH before the profile read and passes self plus descendants', async () => {
    visibility.getVisibleDescendantIds.mockResolvedValue(new Set(['20', '30']));
    await search([], {}, leaderViewer);

    const visibilityOrder =
      visibility.getVisibleDescendantIds.mock.invocationCallOrder[0];
    const queryOrder = dataSource.query.mock.invocationCallOrder[0];
    expect(visibilityOrder).toBeLessThan(queryOrder);
    expect(dataSource.query.mock.calls[0][1][0]).toEqual(
      expect.arrayContaining(['10', '20', '30']),
    );
    expect(dataSource.query.mock.calls[0][1][1]).toBe(false);
  });

  it('global read access uses the unrestricted branch without descendant lookup', async () => {
    await search([]);
    expect(visibility.getVisibleDescendantIds).not.toHaveBeenCalled();
    expect(dataSource.query.mock.calls[0][1][1]).toBe(true);
  });

  it('reads active published profiles joined to active people in one query', async () => {
    await search([]);
    const sql = String(dataSource.query.mock.calls[0][0]);
    expect(sql).toMatch(/mc1_person_profile_presentation/);
    expect(sql).toMatch(/presentation\.is_active = TRUE/);
    expect(sql).toMatch(/p\.is_active = TRUE/);
    expect(dataSource.query).toHaveBeenCalledTimes(1);
  });

  it('skips malformed or unavailable presentation payloads defensively', async () => {
    const result = await search([
      { ...row('1', 'Ana', [softwareFrontend('PRIMARY')]), payload_json: null },
      {
        ...row('2', 'Beto', [softwareFrontend('PRIMARY')]),
        payload_json: { status: 'NOT_AVAILABLE' },
      },
    ]);
    expect(result.authorizedUniverseTotal).toBe(0);
  });

  it('matches both PRIMARY and SECONDARY fields', async () => {
    const result = await search(
      [
        row('1', 'Ana', [softwareFrontend('PRIMARY')]),
        row('2', 'Beto', [softwareFrontend('SECONDARY')]),
      ],
      { domain: 'SOFTWARE_ENGINEERING' },
    );
    expect(result.total).toBe(2);
    expect(result.people.map((person) => person.domainMatchRole)).toEqual([
      'PRIMARY',
      'SECONDARY',
    ]);
  });

  it('includes a published profile without a primary field through its secondary field', async () => {
    const result = await search(
      [row('2', 'Beto', [softwareFrontend('SECONDARY')])],
      { domain: 'SOFTWARE_ENGINEERING' },
    );
    expect(result.people[0]).toMatchObject({
      personId: '2',
      domainMatchRole: 'SECONDARY',
    });
  });

  it('ranks PRIMARY first, then Spanish display name, then stable person id', async () => {
    const result = await search(
      [
        row('9', 'Zoé', [softwareFrontend('SECONDARY')]),
        row('3', 'Álvaro', [softwareFrontend('PRIMARY')]),
        row('2', 'Alvaro', [softwareFrontend('PRIMARY')]),
      ],
      { domain: 'SOFTWARE_ENGINEERING' },
    );
    expect(result.people.map((person) => person.personId)).toEqual([
      '2',
      '3',
      '9',
    ]);
  });

  it('offers contextual specialties and counts each person once', async () => {
    const duplicateFrontend = field('SOFTWARE_ENGINEERING', 'PRIMARY', [
      specialty('FRONTEND_ENGINEERING'),
      specialty('FRONTEND_ENGINEERING'),
      specialty('BACKEND_ENGINEERING'),
    ]);
    const result = await search(
      [
        row('1', 'Ana', [duplicateFrontend]),
        row('2', 'Beto', [softwareFrontend('SECONDARY')]),
      ],
      { domain: 'SOFTWARE_ENGINEERING' },
    );
    expect(result.facets.specialties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FRONTEND_ENGINEERING', count: 2 }),
        expect.objectContaining({ code: 'BACKEND_ENGINEERING', count: 1 }),
      ]),
    );
  });

  it('filters specialty only inside the selected domain', async () => {
    const result = await search(
      [
        row('1', 'Ana', [softwareFrontend('PRIMARY')]),
        row('2', 'Beto', [
          field('VISUAL_DESIGN', 'PRIMARY', [specialty('GRAPHIC_DESIGN')]),
        ]),
      ],
      { domain: 'SOFTWARE_ENGINEERING', specialty: 'FRONTEND_ENGINEERING' },
    );
    expect(result.people.map((person) => person.personId)).toEqual(['1']);
  });

  it('applies multiple skills with AND semantics', async () => {
    const result = await search(
      [
        row('1', 'Ana', [
          softwareFrontend('PRIMARY', [
            ['ts', 'TypeScript'],
            ['react', 'React'],
          ]),
        ]),
        row('2', 'Beto', [softwareFrontend('PRIMARY', [['ts', 'TypeScript']])]),
      ],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: 'ts,react',
      },
    );
    expect(result.people.map((person) => person.personId)).toEqual(['1']);
  });

  it('uses exact domain-specialty-skill identity rather than a global skill code', async () => {
    const wrongContext = field('SOFTWARE_ENGINEERING', 'PRIMARY', [
      specialty('FRONTEND_ENGINEERING', [['react', 'React']]),
      specialty('BACKEND_ENGINEERING', [['node', 'Node.js']]),
    ]);
    const rightContext = softwareFrontend('SECONDARY', [['node', 'Node.js']]);
    const result = await search(
      [row('1', 'Ana', [wrongContext]), row('2', 'Beto', [rightContext])],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: 'node',
      },
    );
    expect(result.people.map((person) => person.personId)).toEqual(['2']);
  });

  it('returns 200 semantics with an empty result for a valid zero-match AND query', async () => {
    const result = await search(
      [
        row('1', 'Ana', [softwareFrontend('PRIMARY', [['ts', 'TypeScript']])]),
        row('2', 'Beto', [softwareFrontend('PRIMARY', [['react', 'React']])]),
      ],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: ['ts', 'react'],
      },
    );
    expect(result.query.skillCodes).toEqual(['ts', 'react']);
    expect(result.total).toBe(0);
    expect(result.people).toEqual([]);
  });

  it('returns prospective remaining-skill counts and excludes selected skills', async () => {
    const result = await search(
      [
        row('1', 'Ana', [
          softwareFrontend('PRIMARY', [
            ['ts', 'TypeScript'],
            ['react', 'React'],
          ]),
        ]),
        row('2', 'Beto', [
          softwareFrontend('PRIMARY', [
            ['ts', 'Typescript'],
            ['vue', 'Vue'],
          ]),
        ]),
        row('3', 'Cata', [softwareFrontend('PRIMARY', [['react', 'React']])]),
      ],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: 'ts',
      },
    );
    expect(result.facets.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'react', count: 1 }),
        expect.objectContaining({ code: 'vue', count: 1 }),
      ]),
    );
    expect(result.facets.skills.some((facet) => facet.code === 'ts')).toBe(
      false,
    );
  });

  it('deduplicates duplicate profile rows and people in all counts', async () => {
    const ana = row('1', 'Ana', [softwareFrontend('PRIMARY')]);
    const result = await search([ana, ana], { domain: 'SOFTWARE_ENGINEERING' });
    expect(result.authorizedUniverseTotal).toBe(1);
    expect(result.total).toBe(1);
    expect(result.people).toHaveLength(1);
  });

  it('supports a domain with no specialty', async () => {
    const result = await search(
      [row('1', 'Ana', [field('SOFTWARE_ENGINEERING', 'PRIMARY', [])])],
      { domain: 'SOFTWARE_ENGINEERING' },
    );
    expect(result.total).toBe(1);
    expect(result.facets.specialties).toEqual([]);
  });

  it('supports a selected specialty with no skills', async () => {
    const result = await search(
      [row('1', 'Ana', [softwareFrontend('PRIMARY')])],
      { domain: 'SOFTWARE_ENGINEERING', specialty: 'FRONTEND_ENGINEERING' },
    );
    expect(result.total).toBe(1);
    expect(result.facets.skills).toEqual([]);
  });

  it('ignores orphan domains and specialties from catalog drift', async () => {
    const drifted = row('1', 'Ana', [
      field('ORPHAN_DOMAIN', 'PRIMARY', [
        specialty('ORPHAN_SPECIALTY', [['x', 'X']]),
      ]),
      field('SOFTWARE_ENGINEERING', 'SECONDARY', [specialty('GRAPHIC_DESIGN')]),
    ]);
    const result = await search([drifted]);
    expect(result.facets.domains).toEqual([
      expect.objectContaining({ code: 'SOFTWARE_ENGINEERING', count: 1 }),
    ]);
    const domainResult = await search([drifted], {
      domain: 'SOFTWARE_ENGINEERING',
    });
    expect(domainResult.facets.specialties).toEqual([]);
  });

  it('canonicalizes an unknown domain and reports it explicitly', async () => {
    const result = await search([], {
      domain: 'NOT_A_DOMAIN',
      specialty: 'FRONTEND_ENGINEERING',
    });
    expect(result.query).toEqual({
      domainCode: null,
      specialtyCode: null,
      skillCodes: [],
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['DOMAIN_INVALID', 'SPECIALTY_REQUIRES_DOMAIN']),
    );
  });

  it('canonicalizes a specialty outside the selected domain and clears children', async () => {
    const result = await search([], {
      domain: 'SOFTWARE_ENGINEERING',
      specialty: 'GRAPHIC_DESIGN',
      skills: 'photoshop',
    });
    expect(result.query).toEqual({
      domainCode: 'SOFTWARE_ENGINEERING',
      specialtyCode: null,
      skillCodes: [],
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        'SPECIALTY_OUTSIDE_DOMAIN',
        'SKILLS_REQUIRE_SPECIALTY',
      ]),
    );
  });

  it('removes unknown contextual skills, preserves valid ones, and reports warnings', async () => {
    const result = await search(
      [row('1', 'Ana', [softwareFrontend('PRIMARY', [['ts', 'TypeScript']])])],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: 'missing,ts,missing',
      },
    );
    expect(result.query.skillCodes).toEqual(['ts']);
    expect(result.warnings).toEqual([
      expect.objectContaining({ code: 'SKILL_INVALID', value: 'missing' }),
    ]);
  });

  it('returns photo, effective job title, deterministic explanation and no scores', async () => {
    const result = await search(
      [
        row('1', 'Ana', [softwareFrontend('PRIMARY', [['ts', 'TypeScript']])], {
          jobTitle: 'Ingeniera',
        }),
      ],
      {
        domain: 'SOFTWARE_ENGINEERING',
        specialty: 'FRONTEND_ENGINEERING',
        skills: 'ts',
      },
    );
    expect(result.people[0]).toMatchObject({
      photoUrl: '/photos/1',
      jobTitle: 'Ingeniera',
      explanation: {
        domain: { code: 'SOFTWARE_ENGINEERING', role: 'PRIMARY' },
        specialty: { code: 'FRONTEND_ENGINEERING' },
        skills: [{ code: 'ts', label: 'TypeScript' }],
      },
    });
    expect(JSON.stringify(result.people[0])).not.toMatch(
      /confidence|percent|strength|score/i,
    );
  });

  it('paginates after deterministic ranking and clamps page size', async () => {
    const rows = Array.from({ length: 55 }, (_, index) =>
      row(String(index + 1), `Persona ${String(index + 1).padStart(2, '0')}`, [
        softwareFrontend('PRIMARY'),
      ]),
    );
    const result = await search(rows, {
      domain: 'SOFTWARE_ENGINEERING',
      page: 2,
      pageSize: 999,
    });
    expect(result.pagination).toEqual({ page: 2, pageSize: 50, totalPages: 2 });
    expect(result.people).toHaveLength(5);
  });
});
