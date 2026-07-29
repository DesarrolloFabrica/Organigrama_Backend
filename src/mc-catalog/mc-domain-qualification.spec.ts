import type { McPa2EngineRunResult } from './mc-pa2.types';
import {
  classifyDomainConceptually,
  selectPrimaryDomainCodeForApiSummary,
} from './mc-domain-qualification';

function pa2Result(
  partial: Partial<McPa2EngineRunResult> &
    Pick<McPa2EngineRunResult, 'activeCount' | 'emergentCount' | 'hiddenCount'>,
): McPa2EngineRunResult {
  return {
    domainCode: 'TEST',
    engineRulesVersion: 'pa2-test',
    configHash: 'abc',
    specialtyResults: partial.specialtyResults ?? [],
    defaultSpecialtyCode: null,
    warnings: [],
    ...partial,
  };
}

describe('classifyDomainConceptually (MC1.1A)', () => {
  it('activeCount >= 1 → PRIMARY_MATCH', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 1, emergentCount: 0, hiddenCount: 2 }),
        'HIGH',
      ),
    ).toBe('PRIMARY_MATCH');
  });

  it('qualityTier INSUFFICIENT → INSUFFICIENT_EVIDENCE (aunque activeCount≥1)', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 2, emergentCount: 0, hiddenCount: 0 }),
        'INSUFFICIENT',
      ),
    ).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('INSUFFICIENT_EVIDENCE ≠ OUTSIDE: OUTSIDE requiere evidencia evaluable', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 0, emergentCount: 0, hiddenCount: 3 }),
        'HIGH',
      ),
    ).toBe('OUTSIDE');
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 0, emergentCount: 0, hiddenCount: 3 }),
        'INSUFFICIENT',
      ),
    ).toBe('INSUFFICIENT_EVIDENCE');
  });

  it('emergent con aporte profesional → SECONDARY_SIGNAL', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({
          activeCount: 0,
          emergentCount: 1,
          hiddenCount: 1,
          specialtyResults: [
            {
              specialtyId: '1',
              specialtyCode: 'X',
              specialtyName: 'X',
              lifecycleStatus: 'ACTIVE',
              presentationStatus: 'EMERGENT',
              mappedSkillCount: 2,
              evidencedSkillCount: 1,
              coverage: 0.5,
              confidence: 0.5,
              strength: 30,
              rank: 1,
              isDefault: false,
              rankingScore: 0,
              primaryStrongCount: 0,
              dominanceShare: 0.5,
              professionalContribution: 10,
              toolContribution: 0,
              transversalContribution: 0,
              professionalEvidencedCount: 1,
              overrideApplied: false,
              reasons: [],
              warnings: [],
              skillBreakdown: [],
            },
          ],
        }),
        'MEDIUM',
      ),
    ).toBe('SECONDARY_SIGNAL');
  });

  it('emergent sin active → SECONDARY_SIGNAL', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({
          activeCount: 0,
          emergentCount: 2,
          hiddenCount: 0,
          specialtyResults: [],
        }),
        'MEDIUM',
      ),
    ).toBe('SECONDARY_SIGNAL');
  });

  it('solo hidden → OUTSIDE', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 0, emergentCount: 0, hiddenCount: 3 }),
        'HIGH',
      ),
    ).toBe('OUTSIDE');
  });

  it('sin señales → OUTSIDE', () => {
    expect(
      classifyDomainConceptually(
        pa2Result({ activeCount: 0, emergentCount: 0, hiddenCount: 0 }),
        'HIGH',
      ),
    ).toBe('OUTSIDE');
  });
});

describe('selectPrimaryDomainCodeForApiSummary (MC1.1B regresión API)', () => {
  it('elige eval activa más reciente entre dominios', () => {
    const code = selectPrimaryDomainCodeForApiSummary([
      {
        id: 10,
        domain_code: 'SOFTWARE',
        is_active: true,
        status: 'SUCCEEDED',
        catalog_is_active: true,
      },
      {
        id: 20,
        domain_code: 'VISUAL_DESIGN',
        is_active: true,
        status: 'SUCCEEDED',
        catalog_is_active: true,
      },
    ]);
    expect(code).toBe('VISUAL_DESIGN');
  });

  it('OUTSIDE insertado último con is_active=false no desplaza al publicado', () => {
    const code = selectPrimaryDomainCodeForApiSummary([
      {
        id: 100,
        domain_code: 'VISUAL_DESIGN',
        is_active: true,
        status: 'SUCCEEDED',
        catalog_is_active: true,
      },
      {
        id: 101,
        domain_code: 'SOFTWARE',
        is_active: false,
        status: 'SUCCEEDED',
        catalog_is_active: true,
      },
      {
        id: 102,
        domain_code: 'AUDIOVISUAL_PRODUCTION',
        is_active: false,
        status: 'SUCCEEDED',
        catalog_is_active: true,
      },
    ]);
    expect(code).toBe('VISUAL_DESIGN');
  });

  it('sin evaluaciones activas → null', () => {
    expect(
      selectPrimaryDomainCodeForApiSummary([
        {
          id: 1,
          domain_code: 'SOFTWARE',
          is_active: false,
          status: 'SUCCEEDED',
          catalog_is_active: true,
        },
      ]),
    ).toBeNull();
  });
});
