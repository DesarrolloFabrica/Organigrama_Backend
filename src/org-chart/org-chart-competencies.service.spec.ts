import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { OrgChartCompetenciesService } from './org-chart-competencies.service';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';

/** Snapshot validado MC1.3.3 (Camilo / extracción 206) — solo lectura. */
const CAMILO_ARTIFACT = {
  defaultSpecialtyCode: 'SOFTWARE_FRONTEND',
  activeCount: 5,
  emergentCount: 2,
  hiddenCount: 0,
  specialties: [
    {
      code: 'SOFTWARE_FRONTEND',
      name: 'Desarrollo frontend',
      presentationStatus: 'ACTIVE',
      rank: 1,
      isDefault: true,
      coverage: 1,
      confidence: 0.8307,
      strength: 31,
      mapped: 11,
      evidenced: 11,
    },
    {
      code: 'SOFTWARE_BACKEND',
      name: 'Desarrollo backend',
      presentationStatus: 'ACTIVE',
      rank: 2,
      isDefault: false,
      coverage: 1,
      confidence: 0.8537,
      strength: 48.1,
      mapped: 11,
      evidenced: 11,
    },
    {
      code: 'SOFTWARE_DATA',
      name: 'Bases de datos',
      presentationStatus: 'ACTIVE',
      rank: 3,
      isDefault: false,
      coverage: 0.75,
      confidence: 0.7839,
      strength: 36.77,
      mapped: 8,
      evidenced: 6,
    },
    {
      code: 'SOFTWARE_AI_APPLIED',
      name: 'IA aplicada',
      presentationStatus: 'ACTIVE',
      rank: 4,
      isDefault: false,
      coverage: 0.5,
      confidence: 0.86,
      strength: 87.6,
      mapped: 2,
      evidenced: 1,
    },
    {
      code: 'SOFTWARE_ENGINEERING_QUALITY',
      name: 'Ingeniería y calidad',
      presentationStatus: 'ACTIVE',
      rank: 5,
      isDefault: false,
      coverage: 0.6667,
      confidence: 0.7453,
      strength: 34.9,
      mapped: 6,
      evidenced: 4,
    },
    {
      code: 'SOFTWARE_API_INTEGRATION',
      name: 'Integración APIs',
      presentationStatus: 'EMERGENT',
      rank: 6,
      isDefault: false,
      coverage: 0.5,
      confidence: 0.86,
      strength: 70.72,
      mapped: 2,
      evidenced: 1,
    },
    {
      code: 'SOFTWARE_CLOUD_DEPLOY',
      name: 'Cloud y despliegue',
      presentationStatus: 'EMERGENT',
      rank: 7,
      isDefault: false,
      coverage: 0.375,
      confidence: 0.86,
      strength: 41.39,
      mapped: 8,
      evidenced: 3,
    },
  ],
};

function succeededEval(overrides: Record<string, unknown> = {}) {
  return {
    id: '10',
    status: 'SUCCEEDED',
    is_active: true,
    person_id: '100',
    extraction_id: '206',
    enrichment_id: '2',
    evidence_evaluation_id: '3',
    catalog_version_id: '1',
    domain_id: '1',
    domain_code: 'SOFTWARE',
    engine_rules_version: 'pa2-software-1.0.0',
    config_hash: 'abc',
    mapping_hash: 'def',
    default_specialty_code: CAMILO_ARTIFACT.defaultSpecialtyCode,
    active_count: CAMILO_ARTIFACT.activeCount,
    emergent_count: CAMILO_ARTIFACT.emergentCount,
    hidden_count: CAMILO_ARTIFACT.hiddenCount,
    warnings: [],
    completed_at: new Date('2026-07-27T00:00:00.000Z'),
    catalog_version: '1.0.0',
    catalog_is_active: true,
    domain_name: 'Desarrollo de Software',
    extraction_is_active: true,
    evidence_is_active: true,
    ...overrides,
  };
}

function specialtySummaryRows(
  includeHiddenRow = false,
): Array<Record<string, unknown>> {
  const rows = CAMILO_ARTIFACT.specialties.map((s) => ({
    specialty_code: s.code,
    specialty_name: s.name,
    presentation_status: s.presentationStatus,
    mapped_skill_count: s.mapped,
    evidenced_skill_count: s.evidenced,
    coverage: s.coverage,
    confidence: s.confidence,
    strength: s.strength,
    rank: s.rank,
    is_default: s.isDefault,
    warnings: [],
  }));
  if (includeHiddenRow) {
    rows.push({
      specialty_code: 'SOFTWARE_HIDDEN_X',
      specialty_name: 'Oculta',
      presentation_status: 'HIDDEN',
      mapped_skill_count: 1,
      evidenced_skill_count: 0,
      coverage: 0,
      confidence: 0,
      strength: 0,
      rank: 99,
      is_default: false,
      warnings: [],
    });
  }
  return rows;
}

describe('OrgChartCompetenciesService', () => {
  let service: OrgChartCompetenciesService;
  let visibility: { canViewFullProfile: jest.Mock };
  let dataSource: { query: jest.Mock };

  const selfViewer: OrgViewerContext = {
    personId: '100',
    eduEmail: 'self@cun.edu.co',
    permissions: [],
  };
  const leaderViewer: OrgViewerContext = {
    personId: '50',
    eduEmail: 'boss@cun.edu.co',
    permissions: [],
  };
  const strangerViewer: OrgViewerContext = {
    personId: '999',
    eduEmail: 'other@cun.edu.co',
    permissions: [],
  };

  beforeEach(async () => {
    visibility = { canViewFullProfile: jest.fn().mockResolvedValue(true) };
    dataSource = { query: jest.fn() };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OrgChartCompetenciesService,
        { provide: OrgChartVisibilityService, useValue: visibility },
        { provide: getDataSourceToken(), useValue: dataSource },
        { provide: DataSource, useValue: dataSource },
      ],
    }).compile();

    service = moduleRef.get(OrgChartCompetenciesService);
  });

  function mockPerson() {
    return [{ id: '100', full_name: 'Camilo Quintero', role_name: 'Desarrollador' }];
  }

  it('usuario consulta su propio Explorador (AVAILABLE)', async () => {
    visibility.canViewFullProfile.mockResolvedValue(true);
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(r.availabilityStatus).toBe('AVAILABLE');
    expect(r.person.fullName).toBe('Camilo Quintero');
    expect(r.domains[0].defaultSpecialtyCode).toBe('SOFTWARE_FRONTEND');
    expect(r.domains[0].activeSpecialtyCount).toBe(5);
    expect(r.domains[0].emergentSpecialtyCount).toBe(2);
    expect(visibility.canViewFullProfile).toHaveBeenCalledWith(
      selfViewer,
      '100',
      'v1',
    );
  });

  it('líder consulta un descendiente autorizado', async () => {
    visibility.canViewFullProfile.mockResolvedValue(true);
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(leaderViewer, '100', 'v1');
    expect(r.availabilityStatus).toBe('AVAILABLE');
    expect(visibility.canViewFullProfile).toHaveBeenCalledWith(
      leaderViewer,
      '100',
      'v1',
    );
  });

  it('tercero no autorizado recibe rechazo', async () => {
    visibility.canViewFullProfile.mockResolvedValue(false);
    await expect(
      service.getExplorerSummary(strangerViewer, '100', 'v1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('persona sin evaluación → 200 NOT_EVALUATED', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([]);

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(r.availabilityStatus).toBe('NOT_EVALUATED');
    expect(r.evaluation).toBeNull();
    expect(r.domains).toEqual([]);
    expect(r.warnings).toContain('COMPETENCY_EVALUATION_NOT_FOUND');
  });

  it('evaluación fallida → FAILED', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval({ status: 'FAILED' })]);

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(r.availabilityStatus).toBe('FAILED');
    expect(r.evaluation?.status).toBe('FAILED');
    expect(r.domains).toEqual([]);
  });

  it('evaluación desactualizada → STALE', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([
        succeededEval({ extraction_is_active: false }),
      ]);

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(r.availabilityStatus).toBe('STALE');
    expect(r.warnings).toContain('STALE_EXTRACTION_NOT_ACTIVE');
    expect(r.evaluation?.rulesVersion).toBe('pa2-software-1.0.0');
  });

  it('dominio inexistente → COMPETENCY_DOMAIN_NOT_FOUND', async () => {
    dataSource.query.mockResolvedValueOnce([]);
    await expect(
      service.getDomainDetail(selfViewer, '100', 'UNKNOWN_DOMAIN', 'v1'),
    ).rejects.toMatchObject({
      response: { code: 'COMPETENCY_DOMAIN_NOT_FOUND' },
    });
  });

  it('dominio con formato inválido → COMPETENCY_DOMAIN_INVALID', async () => {
    await expect(
      service.getDomainDetail(selfViewer, '100', '!!bad', 'v1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('especialidad inexistente en evaluación → COMPETENCY_SPECIALTY_NOT_FOUND', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ code: 'SOFTWARE', name: 'Desarrollo de Software' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce([]);

    await expect(
      service.getSpecialtyDetail(
        selfViewer,
        '100',
        'SOFTWARE',
        'SOFTWARE_UNKNOWN',
        'v1',
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETENCY_SPECIALTY_NOT_FOUND' },
    });
  });

  it('default único y orden por ranking; emergentes separadas de activas', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    const specs = r.domains[0].specialties;
    expect(specs.filter((s) => s.isDefault)).toHaveLength(1);
    expect(specs[0].code).toBe('SOFTWARE_FRONTEND');
    expect(specs.map((s) => s.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(
      specs.filter((s) => s.presentationStatus === 'ACTIVE'),
    ).toHaveLength(5);
    expect(
      specs.filter((s) => s.presentationStatus === 'EMERGENT'),
    ).toHaveLength(2);
  });

  it('ocultas no visibles por defecto; includeHidden las incluye', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows(false));

    const normal = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(
      normal.domains[0].specialties.some(
        (s) => s.presentationStatus === 'HIDDEN',
      ),
    ).toBe(false);

    dataSource.query.mockReset();
    visibility.canViewFullProfile.mockResolvedValue(true);
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows(true));

    const audit = await service.getExplorerSummary(selfViewer, '100', 'v1', {
      includeHidden: true,
    });
    expect(
      audit.domains[0].specialties.some(
        (s) => s.presentationStatus === 'HIDDEN',
      ),
    ).toBe(true);
    expect(dataSource.query.mock.calls[3][1][1]).toBe(true);
  });

  it('métricas preservadas correctamente (Camilo / Frontend)', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    const fe = r.domains[0].specialties[0];
    expect(fe.metrics.coverage).toBe(1);
    expect(fe.metrics.confidence).toBe(0.8307);
    expect(fe.metrics.strength).toBe(31);
    expect(fe.metrics.mappedSkillCount).toBe(11);
    expect(fe.metrics.evidencedSkillCount).toBe(11);
  });

  it('evidencias no cargadas en el resumen inicial', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(dataSource.query).toHaveBeenCalledTimes(4);
    const sqlJoined = dataSource.query.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(sqlJoined).not.toMatch(/cv_skill_enrichment_item/);
    expect(JSON.stringify(r)).not.toMatch(/evidenceText|evidence_items/);
  });

  it('detalle de especialidad con skills; mapping dual visible en FE y BE', async () => {
    const feBreakdown = [
      {
        skillId: '1',
        skillKey: 'typescript',
        skillName: 'TypeScript',
        skillType: 'TECHNOLOGY',
        mappingWeight: 0.6,
        mappingType: 'PRIMARY',
        evidenceLevel: 'STRONG',
        evidenceStrength: 90,
        evidenceConfidence: 0.9,
      },
    ];
    const beBreakdown = [
      {
        skillId: '1',
        skillKey: 'typescript',
        skillName: 'TypeScript',
        skillType: 'TECHNOLOGY',
        mappingWeight: 0.4,
        mappingType: 'SECONDARY',
        evidenceLevel: 'STRONG',
        evidenceStrength: 90,
        evidenceConfidence: 0.9,
      },
    ];

    const specialtyRow = (
      code: string,
      name: string,
      breakdown: typeof feBreakdown,
      isDefault: boolean,
    ) => [
      {
        specialty_code: code,
        specialty_name: name,
        lifecycle_status: 'ACTIVE',
        presentation_status: 'ACTIVE',
        mapped_skill_count: 11,
        evidenced_skill_count: 11,
        coverage: 1,
        confidence: 0.83,
        strength: 31,
        rank: 1,
        is_default: isDefault,
        reasons: [],
        warnings: [],
        skill_breakdown: breakdown,
      },
    ];

    dataSource.query
      .mockResolvedValueOnce([{ code: 'SOFTWARE', name: 'Desarrollo de Software' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(
        specialtyRow('SOFTWARE_FRONTEND', 'Desarrollo frontend', feBreakdown, true),
      )
      .mockResolvedValueOnce([
        {
          skill_id: '1',
          evidence_items: [
            {
              sourceType: 'SKILLS_SECTION',
              evidenceText: 'TypeScript en producción',
            },
          ],
        },
      ]);

    const fe = await service.getSpecialtyDetail(
      selfViewer,
      '100',
      'SOFTWARE',
      'SOFTWARE_FRONTEND',
      'v1',
      { includeAudit: true },
    );
    expect(fe.skills[0].mapping.role).toBe('PRIMARY');
    expect(fe.skills[0].evidence.items[0].text).toContain('TypeScript');
    expect(fe.evaluation.audit?.extractionId).toBe('206');
    expect(dataSource.query).toHaveBeenCalledTimes(4);

    dataSource.query.mockReset();
    visibility.canViewFullProfile.mockResolvedValue(true);
    dataSource.query
      .mockResolvedValueOnce([{ code: 'SOFTWARE', name: 'Desarrollo de Software' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(
        specialtyRow('SOFTWARE_BACKEND', 'Desarrollo backend', beBreakdown, false),
      )
      .mockResolvedValueOnce([]);

    const be = await service.getSpecialtyDetail(
      selfViewer,
      '100',
      'SOFTWARE',
      'SOFTWARE_BACKEND',
      'v1',
    );
    expect(be.skills[0].mapping.role).toBe('SECONDARY');
    expect(be.skills[0].code).toBe('typescript');
  });

  it('no exposición de entidades internas / no motor en GET', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const r = await service.getExplorerSummary(selfViewer, '100', 'v1');
    const payload = JSON.stringify(r);
    expect(payload).not.toMatch(/TypeORM|mc_profile_evaluation|__entity/);
    expect(payload).not.toMatch(/runMcPa2Engine/);
  });

  it('consultas sin patrón N+1 en resumen (3 queries fijas)', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    await service.getExplorerSummary(selfViewer, '100', 'v1');
    expect(dataSource.query).toHaveBeenCalledTimes(4);
  });

  it('resultado de Camilo consistente con artefacto MC1.3.3', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ domain_code: 'SOFTWARE' }])
      .mockResolvedValueOnce([succeededEval()])
      .mockResolvedValueOnce(specialtySummaryRows());

    const summary = await service.getExplorerSummary(selfViewer, '100', 'v1');
    const domain = summary.domains[0];
    expect(domain.defaultSpecialtyCode).toBe(
      CAMILO_ARTIFACT.defaultSpecialtyCode,
    );
    expect(domain.activeSpecialtyCount).toBe(5);
    expect(domain.emergentSpecialtyCount).toBe(2);
    expect(
      domain.specialties.filter((s) => s.presentationStatus === 'HIDDEN'),
    ).toHaveLength(0);

    const byCode = Object.fromEntries(
      domain.specialties.map((s) => [s.code, s.presentationStatus]),
    );
    expect(byCode.SOFTWARE_FRONTEND).toBe('ACTIVE');
    expect(byCode.SOFTWARE_BACKEND).toBe('ACTIVE');
    expect(byCode.SOFTWARE_DATA).toBe('ACTIVE');
    expect(byCode.SOFTWARE_AI_APPLIED).toBe('ACTIVE');
    expect(byCode.SOFTWARE_ENGINEERING_QUALITY).toBe('ACTIVE');
    expect(byCode.SOFTWARE_API_INTEGRATION).toBe('EMERGENT');
    expect(byCode.SOFTWARE_CLOUD_DEPLOY).toBe('EMERGENT');
  });

  it('professional-profile: dos dominios publicables; OUTSIDE excluido', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ id: '220' }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([
        {
          evaluation_id: '19',
          domain_code: 'VISUAL_DESIGN',
          domain_name: 'Diseño Visual',
          domain_sort_order: 20,
          extraction_id: '220',
          is_active: true,
          status: 'SUCCEEDED',
          domain_qualification: 'SECONDARY_SIGNAL',
          active_count: 0,
          emergent_count: 2,
          hidden_count: 3,
          default_specialty_code: null,
          engine_rules_version: 'pa2-visual-design-1.1.0',
          completed_at: new Date('2026-07-29T00:00:00.000Z'),
        },
        {
          evaluation_id: '20',
          domain_code: 'SOFTWARE',
          domain_name: 'Software',
          domain_sort_order: 10,
          extraction_id: '220',
          is_active: false,
          status: 'SUCCEEDED',
          domain_qualification: 'OUTSIDE',
          active_count: 0,
          emergent_count: 0,
          hidden_count: 7,
          default_specialty_code: null,
          engine_rules_version: 'pa2-software-1.0.0',
          completed_at: new Date('2026-07-29T00:00:00.000Z'),
        },
        {
          evaluation_id: '21',
          domain_code: 'SOFTWARE',
          domain_name: 'Software',
          domain_sort_order: 10,
          extraction_id: '220',
          is_active: false,
          status: 'SUCCEEDED',
          domain_qualification: 'SECONDARY_SIGNAL',
          active_count: 0,
          emergent_count: 1,
          hidden_count: 6,
          default_specialty_code: null,
          engine_rules_version: 'pa2-software-1.0.0',
          completed_at: new Date('2026-07-29T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]) // mvp capability skills
      .mockResolvedValueOnce([
        {
          specialty_code: 'VISUAL_GRAPHIC',
          specialty_name: 'Diseño gráfico',
          presentation_status: 'EMERGENT',
          mapped_skill_count: 2,
          evidenced_skill_count: 2,
          coverage: 1,
          confidence: 0.5,
          strength: 34,
          rank: 1,
          is_default: false,
          warnings: [],
        },
      ])
      .mockResolvedValueOnce([
        {
          specialty_code: 'SOFTWARE_FRONTEND',
          specialty_name: 'Frontend',
          presentation_status: 'EMERGENT',
          mapped_skill_count: 1,
          evidenced_skill_count: 1,
          coverage: 1,
          confidence: 0.5,
          strength: 20,
          rank: 1,
          is_default: false,
          warnings: [],
        },
      ]);

    const profile = await service.getProfessionalProfile(
      selfViewer,
      '100',
      'v1',
    );
    expect(profile.extractionId).toBe('220');
    expect(profile.mvpCapabilities).not.toBeNull();
    expect(profile.crossDomainClassification).toBeNull();
    expect(profile.evaluatedDomains.map((d) => d.code)).toEqual([
      'VISUAL_DESIGN',
      'SOFTWARE',
    ]);
    expect(profile.defaultDomainCode).toBe('VISUAL_DESIGN');
    expect(profile.evaluatedDomains[0].qualification).toBe('SECONDARY_SIGNAL');
    expect(profile.evaluatedDomains.some((d) => d.qualification === 'OUTSIDE')).toBe(
      false,
    );
  });

  it('professional-profile: un dominio; sin CDR', async () => {
    dataSource.query
      .mockResolvedValueOnce(mockPerson())
      .mockResolvedValueOnce([{ id: '219' }])
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([
        {
          evaluation_id: '18',
          domain_code: 'VISUAL_DESIGN',
          domain_name: 'Diseño Visual',
          domain_sort_order: 20,
          extraction_id: '219',
          is_active: true,
          status: 'SUCCEEDED',
          domain_qualification: 'PRIMARY_MATCH',
          active_count: 1,
          emergent_count: 2,
          hidden_count: 2,
          default_specialty_code: 'VISUAL_GRAPHIC',
          engine_rules_version: 'pa2-visual-design-1.1.0',
          completed_at: new Date('2026-07-29T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([]) // mvp
      .mockResolvedValueOnce(specialtySummaryRows());

    const profile = await service.getProfessionalProfile(
      selfViewer,
      '100',
      'v1',
    );
    expect(profile.evaluatedDomains).toHaveLength(1);
    expect(profile.defaultDomainCode).toBe('VISUAL_DESIGN');
    expect(profile.evaluatedDomains[0].qualification).toBe('PRIMARY_MATCH');
  });

  it('professional-profile niega acceso igual que competencias', async () => {
    visibility.canViewFullProfile.mockResolvedValue(false);
    await expect(
      service.getProfessionalProfile(selfViewer, '100', 'v1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('detalle specialty sin evaluación → 404 COMPETENCY_EVALUATION_NOT_FOUND', async () => {
    dataSource.query
      .mockResolvedValueOnce([{ code: 'SOFTWARE', name: 'Desarrollo de Software' }])
      .mockResolvedValueOnce([]);

    await expect(
      service.getSpecialtyDetail(
        selfViewer,
        '100',
        'SOFTWARE',
        'SOFTWARE_FRONTEND',
        'v1',
      ),
    ).rejects.toMatchObject({
      response: { code: 'COMPETENCY_EVALUATION_NOT_FOUND' },
    });
  });
});
