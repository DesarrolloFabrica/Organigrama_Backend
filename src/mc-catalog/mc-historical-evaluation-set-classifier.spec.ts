import {
  classifyHistoricalEvaluationSetCandidates,
  currentOperativeUniverseSnapshot,
  isProhibitedPrimaryGroupingKey,
  summarizeHistoricalCandidates,
} from './mc-historical-evaluation-set-classifier';
import {
  fixtureAlreadyInSet,
  fixtureDuplicateDomain,
  fixtureIsolated,
  fixtureMissingChain,
  fixtureMixedExtraction,
  fixturePreMultidomain,
  fixtureQualificationNull,
  fixtureStrongUnique,
  fixtureTwoPlausibleGroups,
  fixtureUnknownUniverse,
} from './mc-historical-evaluation-set.fixtures';

const ERA = currentOperativeUniverseSnapshot();

describe('mc-historical-evaluation-set-classifier (1C.3)', () => {
  it('clasifica EXACT solo cuando ya hay Evaluation Set moderno', () => {
    const c = classifyHistoricalEvaluationSetCandidates(fixtureAlreadyInSet(), {
      eraCandidateUniverse: ERA,
    });
    const exact = c.filter((x) => x.eligibility === 'EXACT');
    expect(exact).toHaveLength(1);
    expect(exact[0].recommendedAction).toBe('ALREADY_IN_SET');
    expect(exact[0].conflicts.some((x) => x.code === 'ALREADY_LINKED_TO_SET')).toBe(
      true,
    );
  });

  it('clasifica STRONG con cadena única y universo de época', () => {
    const c = classifyHistoricalEvaluationSetCandidates(fixtureStrongUnique(), {
      eraCandidateUniverse: ERA,
    });
    expect(c).toHaveLength(1);
    expect(c[0].eligibility).toBe('STRONG');
    expect(c[0].recommendedAction).toBe('REVIEW_REQUIRED');
    expect(c[0].domainCodes).toEqual([...ERA].sort());
  });

  it('clasifica AMBIGUOUS con dos grupos plausibles', () => {
    const c = classifyHistoricalEvaluationSetCandidates(
      fixtureTwoPlausibleGroups(),
      { eraCandidateUniverse: ERA },
    );
    const ambiguous = c.filter((x) => x.eligibility === 'AMBIGUOUS');
    expect(ambiguous.length).toBeGreaterThanOrEqual(2);
    expect(
      ambiguous.every((x) =>
        x.conflicts.some((c) => c.code === 'ALTERNATIVE_GROUPING_EXISTS'),
      ),
    ).toBe(true);
  });

  it('clasifica UNRECOVERABLE aislada / cadena faltante', () => {
    const isolated = classifyHistoricalEvaluationSetCandidates(
      fixtureIsolated(),
      { eraCandidateUniverse: ERA },
    );
    expect(isolated[0].eligibility).toBe('UNRECOVERABLE');

    const missing = classifyHistoricalEvaluationSetCandidates(
      fixtureMissingChain(),
      { eraCandidateUniverse: ERA },
    );
    expect(missing[0].eligibility).toBe('UNRECOVERABLE');
    expect(
      missing[0].conflicts.some((c) => c.code === 'MISSING_CHAIN_CONTEXT'),
    ).toBe(true);
  });

  it('no usa timestamps ni IDs consecutivos como clave; marca señal ignorada', () => {
    expect(isProhibitedPrimaryGroupingKey('created_at_window')).toBe(true);
    expect(isProhibitedPrimaryGroupingKey('consecutive_ids')).toBe(true);
    expect(isProhibitedPrimaryGroupingKey('is_active')).toBe(true);
    expect(isProhibitedPrimaryGroupingKey('person_id')).toBe(true);

    const c = classifyHistoricalEvaluationSetCandidates(fixtureStrongUnique(), {
      eraCandidateUniverse: ERA,
    });
    // IDs 201,202,203 consecutivos → evidencia NO_UTILIZABLE si se detecta
    const ignored = c[0].evidence.find(
      (e) => e.code === 'CONSECUTIVE_IDS_IGNORED',
    );
    expect(ignored?.strength).toBe('NO_UTILIZABLE');
  });

  it('detecta mixed extraction como buckets separados (no un solo set)', () => {
    const c = classifyHistoricalEvaluationSetCandidates(
      fixtureMixedExtraction(),
      { eraCandidateUniverse: ERA },
    );
    expect(c.length).toBeGreaterThanOrEqual(2);
    expect(c.every((x) => x.eligibility === 'UNRECOVERABLE' || x.eligibility === 'AMBIGUOUS')).toBe(
      true,
    );
  });

  it('detecta MULTIPLE_DOMAIN_EVALUATIONS', () => {
    const c = classifyHistoricalEvaluationSetCandidates(
      fixtureDuplicateDomain(),
      { eraCandidateUniverse: ERA },
    );
    expect(
      c.some((x) =>
        x.conflicts.some((c) => c.code === 'MULTIPLE_DOMAIN_EVALUATIONS'),
      ),
    ).toBe(true);
    expect(c.every((x) => x.eligibility !== 'STRONG')).toBe(true);
  });

  it('detecta UNKNOWN_CANDIDATE_UNIVERSE', () => {
    const c = classifyHistoricalEvaluationSetCandidates(
      fixtureUnknownUniverse(),
      { eraCandidateUniverse: ERA },
    );
    expect(
      c[0].conflicts.some((x) => x.code === 'UNKNOWN_CANDIDATE_UNIVERSE'),
    ).toBe(true);
    expect(c[0].eligibility).toBe('AMBIGUOUS');
  });

  it('preserva qualification NULL (no rellena)', () => {
    const c = classifyHistoricalEvaluationSetCandidates(
      fixtureQualificationNull(),
      { eraCandidateUniverse: ERA },
    );
    expect(c[0].eligibility).toBe('STRONG');
    // El clasificador no muta filas; solo agrupa ids
    expect(fixtureQualificationNull().every((r) => r.domainQualification === null)).toBe(
      true,
    );
  });

  it('excluye de backfill las ya asociadas; pre-multidomain → REEVALUATE', () => {
    const mixed = [
      ...fixtureAlreadyInSet(),
      ...fixturePreMultidomain(),
    ];
    const c = classifyHistoricalEvaluationSetCandidates(mixed, {
      eraCandidateUniverse: ERA,
    });
    expect(c.some((x) => x.recommendedAction === 'ALREADY_IN_SET')).toBe(true);
    const legacy = c.find((x) => x.personId === '9009');
    expect(legacy?.recommendedAction).toBe('REEVALUATE');
  });

  it('salida determinística', () => {
    const rows = [
      ...fixtureStrongUnique(),
      ...fixtureIsolated(),
      ...fixtureAlreadyInSet(),
    ];
    const a = classifyHistoricalEvaluationSetCandidates(rows, {
      eraCandidateUniverse: ERA,
    });
    const b = classifyHistoricalEvaluationSetCandidates([...rows].reverse(), {
      eraCandidateUniverse: ERA,
    });
    expect(a.map((x) => x.historicalContextFingerprint)).toEqual(
      b.map((x) => x.historicalContextFingerprint),
    );
  });

  it('summary no implica writes; fingerprint ≠ hash moderno completo', () => {
    const rows = fixtureStrongUnique();
    const c = classifyHistoricalEvaluationSetCandidates(rows, {
      eraCandidateUniverse: ERA,
    });
    const s = summarizeHistoricalCandidates(c, rows);
    expect(s.withoutSet).toBe(3);
    expect(s.candidatesStrong).toBe(1);
    expect(c[0].inferredContext.qualificationPolicyVersion.kind).toBe(
      'unknown',
    );
    // modern compatible flag embedded → fingerprint schema has-1.0.0
    expect(c[0].historicalContextFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
});
