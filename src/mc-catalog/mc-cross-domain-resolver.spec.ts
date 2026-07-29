/**
 * CDR v0 — pruebas dry-run (sin I/O, sin writes).
 */

import { buildDomainAffinityVector } from './mc-cross-domain-affinity';
import {
  CDR_V0_FIXTURES,
  fixtureF01DominantSoftware,
  fixtureF03TwoPrimaryBalanced,
  fixtureF04TwoPrimaryUnbalanced,
  fixtureF15OrderReversed,
} from './mc-cross-domain-resolver.fixtures';
import { assessEvaluationSetResolverEligibility } from './mc-cross-domain-resolver.eligibility';
import { DEFAULT_CDR_V0_POLICY } from './mc-cross-domain-resolver.policy';
import {
  cdrV0UsesIsActive,
  resolveCrossDomainEvaluationSetDryRun,
  resolveCrossDomainEvaluationSetDryRunWithDefaults,
} from './mc-cross-domain-resolver';
import type { McEvaluationSetSnapshot } from './mc-cross-domain-resolver.types';

describe('mc-cross-domain-resolver (1C.4 CDR v0)', () => {
  describe('elegibilidad', () => {
    it('acepta COMPLETE válido', () => {
      const e = assessEvaluationSetResolverEligibility(
        fixtureF01DominantSoftware(),
        DEFAULT_CDR_V0_POLICY,
      );
      expect(e.eligible).toBe(true);
      expect(e.code).toBe('ELIGIBLE');
    });

    it('rechaza RUNNING', () => {
      const s = fixtureF01DominantSoftware();
      s.setStatus = 'RUNNING';
      const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(s);
      expect(r.status).toBe('UNRESOLVED');
      expect(r.decisiveRule).toBe('RUNNING_SET_NOT_ALLOWED');
      expect(r.classificationType).toBe('UNRESOLVED');
    });

    it('rechaza FAILED set', () => {
      const s = fixtureF01DominantSoftware();
      s.setStatus = 'FAILED';
      const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(s);
      expect(r.decisiveRule).toBe('FAILED_SET_NOT_ALLOWED');
      expect(r.status).toBe('UNRESOLVED');
    });

    it('rechaza PARTIAL por defecto', () => {
      const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
        CDR_V0_FIXTURES.F10(),
      );
      expect(r.decisiveRule).toBe('PARTIAL_SET_NOT_ALLOWED');
      expect(r.classificationType).toBe('UNRESOLVED');
      expect(r.confidenceBand).toBe('NOT_APPLICABLE');
    });
  });

  describe('fixtures F01–F15', () => {
    const expected: Record<
      string,
      { classification: string; confidence: string; rule: string }
    > = {
      F01: {
        classification: 'DOMINANT_PRACTICE',
        confidence: 'HIGH',
        rule: 'SINGLE_PRIMARY_REST_OUTSIDE',
      },
      F02: {
        classification: 'PRIMARY_WITH_COMPLEMENTARY',
        confidence: 'MEDIUM',
        rule: 'PRIMARY_WITH_SECONDARY_SUPPORT',
      },
      F03: {
        classification: 'HYBRID_PRACTICE',
        confidence: 'LOW',
        rule: 'MULTIPLE_PRIMARY_COMPARABLE',
      },
      F04: {
        classification: 'PRIMARY_WITH_COMPLEMENTARY',
        confidence: 'MEDIUM',
        rule: 'MULTIPLE_PRIMARY_UNBALANCED',
      },
      F05: {
        classification: 'AMBIGUOUS',
        confidence: 'LOW',
        rule: 'THREE_PRIMARY_UNRESOLVED',
      },
      F06: {
        classification: 'AMBIGUOUS',
        confidence: 'LOW',
        rule: 'ALL_SECONDARY_AMBIGUOUS',
      },
      F07: {
        classification: 'NO_SUPPORTED_DOMAIN',
        confidence: 'NOT_APPLICABLE',
        rule: 'ALL_OUTSIDE',
      },
      F08: {
        classification: 'INSUFFICIENT_EVIDENCE',
        confidence: 'NOT_APPLICABLE',
        rule: 'ALL_INSUFFICIENT',
      },
      F09: {
        classification: 'INSUFFICIENT_EVIDENCE',
        confidence: 'NOT_APPLICABLE',
        rule: 'MIXED_INSUFFICIENT_AND_OUTSIDE',
      },
      F10: {
        classification: 'UNRESOLVED',
        confidence: 'NOT_APPLICABLE',
        rule: 'PARTIAL_SET_NOT_ALLOWED',
      },
      F11: {
        classification: 'UNRESOLVED',
        confidence: 'NOT_APPLICABLE',
        rule: 'FAILED_DOMAIN_PRESENT',
      },
      F12: {
        classification: 'AMBIGUOUS',
        confidence: 'LOW',
        rule: 'QUALIFICATION_STRENGTH_CONFLICT',
      },
      F13: {
        classification: 'UNRESOLVED',
        confidence: 'NOT_APPLICABLE',
        rule: 'MISSING_CANDIDATE_OUTCOME',
      },
      F14: {
        classification: 'UNRESOLVED',
        confidence: 'NOT_APPLICABLE',
        rule: 'DUPLICATE_DOMAIN',
      },
      F15: {
        classification: 'DOMINANT_PRACTICE',
        confidence: 'HIGH',
        rule: 'SINGLE_PRIMARY_REST_OUTSIDE',
      },
    };

    for (const [name, exp] of Object.entries(expected)) {
      it(`${name} → ${exp.classification}`, () => {
        const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
          CDR_V0_FIXTURES[name](),
        );
        expect(r.classificationType).toBe(exp.classification);
        expect(r.confidenceBand).toBe(exp.confidence);
        expect(r.decisiveRule).toBe(exp.rule);
        expect(r.explanation.summaryCode).toBe(exp.rule);
      });
    }
  });

  it('híbrido conservador emite independencia no verificada', () => {
    const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF03TwoPrimaryBalanced(),
    );
    expect(r.classificationType).toBe('HYBRID_PRACTICE');
    expect(r.warnings).toContain('HYBRID_INDEPENDENCE_NOT_FULLY_VERIFIED');
    expect(r.diagnostics.independenceVerified).toBe(false);
  });

  it('dos PRIMARY no implican híbrido si hay desbalance', () => {
    const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF04TwoPrimaryUnbalanced(),
    );
    expect(r.classificationType).not.toBe('HYBRID_PRACTICE');
    expect(r.classificationType).toBe('PRIMARY_WITH_COMPLEMENTARY');
  });

  it('independencia respecto al orden de dominios', () => {
    const a = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF01DominantSoftware(),
    );
    const b = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF15OrderReversed(),
    );
    expect(b.classificationType).toBe(a.classificationType);
    expect(b.decisiveRule).toBe(a.decisiveRule);
    expect(b.confidenceBand).toBe(a.confidenceBand);
    expect(b.domainPositions.map((p) => p.domainCode)).toEqual(
      a.domainPositions.map((p) => p.domainCode),
    );
    expect(b.domainPositions.map((p) => p.position)).toEqual(
      a.domainPositions.map((p) => p.position),
    );
  });

  it('misma entrada produce misma salida (reproducibilidad)', () => {
    const input = fixtureF01DominantSoftware();
    const r1 = resolveCrossDomainEvaluationSetDryRunWithDefaults(input);
    const r2 = resolveCrossDomainEvaluationSetDryRunWithDefaults(input);
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it('explanation codes estables', () => {
    const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF01DominantSoftware(),
    );
    expect(r.explanation.summaryCode).toBe('SINGLE_PRIMARY_REST_OUTSIDE');
    expect(r.explanation.summary.length).toBeGreaterThan(10);
    expect(r.explanation.decisiveFactors[0].code).toBe(
      'SINGLE_PRIMARY_REST_OUTSIDE',
    );
  });

  it('no usa is_active para decidir', () => {
    expect(cdrV0UsesIsActive()).toBe(false);
    const base = fixtureF01DominantSoftware();
    const flipped: McEvaluationSetSnapshot = {
      ...base,
      domains: base.domains.map((d) => ({
        ...d,
        isActive: d.domainCode === 'VISUAL_DESIGN',
      })),
    };
    const r1 = resolveCrossDomainEvaluationSetDryRunWithDefaults(base);
    const r2 = resolveCrossDomainEvaluationSetDryRunWithDefaults(flipped);
    expect(r2.classificationType).toBe(r1.classificationType);
    expect(r2.decisiveRule).toBe(r1.decisiveRule);
  });

  it('no usa cargo/área/jefe en el contrato de entrada', () => {
    const s = fixtureF01DominantSoftware() as Record<string, unknown>;
    expect(s.jobTitle).toBeUndefined();
    expect(s.area).toBeUndefined();
    expect(s.manager).toBeUndefined();
    expect(s.cargo).toBeUndefined();
  });

  it('no realiza writes ni persiste classification', () => {
    const r = resolveCrossDomainEvaluationSetDryRunWithDefaults(
      fixtureF01DominantSoftware(),
    );
    expect((r as { persisted?: boolean }).persisted).toBeUndefined();
    expect(Object.keys(r)).not.toContain('writeCount');
  });

  it('vector marca dimensiones no disponibles', () => {
    const v = buildDomainAffinityVector(
      fixtureF01DominantSoftware().domains[0],
      DEFAULT_CDR_V0_POLICY,
    );
    expect(v.evidenceQuality.availability).toBe('NOT_AVAILABLE');
    expect(v.unmappedEvidenceRatio.availability).toBe('NOT_AVAILABLE');
    expect(v.activeSpecialtyRatio.availability).toBe('USABLE');
    expect(v.bestSpecialtyStrength.availability).toBe('USABLE');
  });

  it('no divide por cero en specialtyCount=0', () => {
    const v = buildDomainAffinityVector(
      {
        domainCode: 'SOFTWARE',
        domainStatus: 'SUCCEEDED',
        domainQualification: 'OUTSIDE',
        profileEvaluationId: 'e1',
        activeCount: 0,
        emergentCount: 0,
        hiddenCount: 0,
        specialtyCount: 0,
        inputSkillsCount: 0,
        specialties: [],
      },
      DEFAULT_CDR_V0_POLICY,
    );
    expect(v.activeSpecialtyRatio.value).toBeNull();
    expect(v.activeSpecialtyRatio.warning).toBe('zero_denominator');
  });

  it('normaliza cardinalidad vía activeSpecialtyRatio', () => {
    const v = buildDomainAffinityVector(
      {
        domainCode: 'SOFTWARE',
        domainStatus: 'SUCCEEDED',
        domainQualification: 'PRIMARY_MATCH',
        profileEvaluationId: 'e1',
        activeCount: 2,
        emergentCount: 0,
        hiddenCount: 6,
        specialtyCount: 8,
        inputSkillsCount: 10,
        specialties: [],
      },
      DEFAULT_CDR_V0_POLICY,
    );
    expect(v.activeSpecialtyRatio.value).toBeCloseTo(0.25);
    expect(v.activeSpecialtyCount.availability).toBe('DIAGNOSTIC_ONLY');
  });

  it('policy explícita en input', () => {
    const r = resolveCrossDomainEvaluationSetDryRun({
      evaluationSet: fixtureF01DominantSoftware(),
      policy: DEFAULT_CDR_V0_POLICY,
    });
    expect(r.resolverVersion).toBe('CDR-0.1.0');
    expect(r.policyVersion).toBe('CDRP-0.1.0');
  });
});
