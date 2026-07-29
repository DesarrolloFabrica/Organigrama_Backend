/**
 * Fixtures CDR v0 — Evaluation Set snapshots sintéticos (sin PII).
 */

import type {
  McCdrDomainEvaluationSnapshot,
  McCdrSpecialtySnapshot,
  McEvaluationSetSnapshot,
} from './mc-cross-domain-resolver.types';
import type { McDomainQualification } from './mc-domain-qualification';
import type { McEvaluationSetDomainStatus } from './mc-evaluation-set.types';

function spec(
  code: string,
  status: 'ACTIVE' | 'EMERGENT' | 'HIDDEN',
  strength: number,
  coverage: number,
  confidence: number,
  mapped = 4,
  evidenced = 3,
  rank = 1,
): McCdrSpecialtySnapshot {
  return {
    specialtyCode: code,
    presentationStatus: status,
    mappedSkillCount: mapped,
    evidencedSkillCount: evidenced,
    coverage,
    confidence,
    strength,
    rank,
  };
}

function domain(partial: {
  domainCode: string;
  qualification: McDomainQualification | null;
  status?: McEvaluationSetDomainStatus;
  active: number;
  emergent: number;
  hidden: number;
  specialties: McCdrSpecialtySnapshot[];
  evalId?: string | null;
}): McCdrDomainEvaluationSnapshot {
  const status = partial.status ?? 'SUCCEEDED';
  return {
    domainCode: partial.domainCode,
    domainStatus: status,
    domainQualification: partial.qualification,
    profileEvaluationId:
      status === 'SUCCEEDED' ? (partial.evalId ?? `e-${partial.domainCode}`) : null,
    activeCount: partial.active,
    emergentCount: partial.emergent,
    hiddenCount: partial.hidden,
    specialtyCount: partial.active + partial.emergent + partial.hidden,
    inputSkillsCount: 10,
    specialties: partial.specialties,
    isActive: false,
  };
}

function set(
  id: string,
  domains: McCdrDomainEvaluationSnapshot[],
  status: McEvaluationSetSnapshot['setStatus'] = 'COMPLETE',
  candidates?: string[],
): McEvaluationSetSnapshot {
  const codes = candidates ?? domains.map((d) => d.domainCode);
  return {
    evaluationSetId: id,
    personId: '900001',
    setStatus: status,
    schemaVersion: 'es-1.0.0',
    qualificationPolicyVersion: 'DQ-1.0.0',
    contextHash: 'a'.repeat(64),
    candidateDomains: codes,
    domains,
    warnings: [],
  };
}

const CAND = ['SOFTWARE', 'VISUAL_DESIGN', 'AUDIOVISUAL_PRODUCTION'];

/** F01 — Dominante puro SOFTWARE */
export function fixtureF01DominantSoftware(): McEvaluationSetSnapshot {
  return set('F01', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'PRIMARY_MATCH',
      active: 2,
      emergent: 0,
      hidden: 2,
      specialties: [
        spec('BACKEND', 'ACTIVE', 70, 0.7, 0.7),
        spec('FRONTEND', 'ACTIVE', 60, 0.6, 0.65),
        spec('MOBILE', 'HIDDEN', 10, 0.1, 0.2),
        spec('DATA', 'HIDDEN', 5, 0.05, 0.1),
      ],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 4,
      specialties: [spec('BRAND', 'HIDDEN', 5, 0.05, 0.1)],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 3,
      specialties: [spec('EDIT', 'HIDDEN', 5, 0.05, 0.1)],
    }),
  ], 'COMPLETE', CAND);
}

/** F02 — VISUAL primary + AV secondary */
export function fixtureF02PrimaryComplementary(): McEvaluationSetSnapshot {
  return set('F02', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 4,
      specialties: [spec('BACKEND', 'HIDDEN', 5, 0.05, 0.1)],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'PRIMARY_MATCH',
      active: 2,
      emergent: 1,
      hidden: 5,
      specialties: [
        spec('UI', 'ACTIVE', 65, 0.65, 0.6),
        spec('BRAND', 'ACTIVE', 55, 0.55, 0.55),
        spec('ILLUSTRATION', 'EMERGENT', 35, 0.4, 0.4),
      ],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'SECONDARY_SIGNAL',
      active: 0,
      emergent: 1,
      hidden: 2,
      specialties: [spec('EDIT', 'EMERGENT', 40, 0.45, 0.4)],
    }),
  ], 'COMPLETE', CAND);
}

/** F03 — dos PRIMARY balanceados VISUAL + AV */
export function fixtureF03TwoPrimaryBalanced(): McEvaluationSetSnapshot {
  return set('F03', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 4,
      specialties: [spec('BACKEND', 'HIDDEN', 5, 0.05, 0.1)],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'PRIMARY_MATCH',
      active: 2,
      emergent: 0,
      hidden: 6,
      specialties: [
        spec('UI', 'ACTIVE', 62, 0.6, 0.6),
        spec('BRAND', 'ACTIVE', 58, 0.58, 0.55),
      ],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'PRIMARY_MATCH',
      active: 1,
      emergent: 0,
      hidden: 2,
      specialties: [
        spec('EDIT', 'ACTIVE', 61, 0.59, 0.58),
        spec('MOTION', 'HIDDEN', 10, 0.1, 0.2),
        spec('SOUND', 'HIDDEN', 8, 0.08, 0.15),
      ],
    }),
  ], 'COMPLETE', CAND);
}

/** F04 — dos PRIMARY desbalanceados: SOFTWARE fuerte, VISUAL débil */
export function fixtureF04TwoPrimaryUnbalanced(): McEvaluationSetSnapshot {
  return set('F04', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'PRIMARY_MATCH',
      active: 3,
      emergent: 0,
      hidden: 1,
      specialties: [
        spec('BACKEND', 'ACTIVE', 85, 0.85, 0.8),
        spec('FRONTEND', 'ACTIVE', 80, 0.8, 0.78),
        spec('DATA', 'ACTIVE', 75, 0.75, 0.7),
        spec('MOBILE', 'HIDDEN', 10, 0.1, 0.1),
      ],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'PRIMARY_MATCH',
      active: 1,
      emergent: 0,
      hidden: 7,
      specialties: [
        spec('UI', 'ACTIVE', 42, 0.35, 0.35),
        spec('BRAND', 'HIDDEN', 10, 0.1, 0.1),
      ],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 3,
      specialties: [spec('EDIT', 'HIDDEN', 5, 0.05, 0.1)],
    }),
  ], 'COMPLETE', CAND);
}

/** F05 — tres PRIMARY */
export function fixtureF05ThreePrimary(): McEvaluationSetSnapshot {
  return set(
    'F05',
    CAND.map((code) =>
      domain({
        domainCode: code,
        qualification: 'PRIMARY_MATCH',
        active: 1,
        emergent: 0,
        hidden: 2,
        specialties: [spec(`${code}_S1`, 'ACTIVE', 50, 0.5, 0.5)],
      }),
    ),
    'COMPLETE',
    CAND,
  );
}

/** F06 — todos SECONDARY */
export function fixtureF06AllSecondary(): McEvaluationSetSnapshot {
  return set(
    'F06',
    CAND.map((code) =>
      domain({
        domainCode: code,
        qualification: 'SECONDARY_SIGNAL',
        active: 0,
        emergent: 1,
        hidden: 2,
        specialties: [spec(`${code}_E`, 'EMERGENT', 35, 0.4, 0.4)],
      }),
    ),
    'COMPLETE',
    CAND,
  );
}

/** F07 — todos OUTSIDE */
export function fixtureF07AllOutside(): McEvaluationSetSnapshot {
  return set(
    'F07',
    CAND.map((code) =>
      domain({
        domainCode: code,
        qualification: 'OUTSIDE',
        active: 0,
        emergent: 0,
        hidden: 3,
        specialties: [spec(`${code}_H`, 'HIDDEN', 5, 0.05, 0.1)],
      }),
    ),
    'COMPLETE',
    CAND,
  );
}

/** F08 — todos INSUFFICIENT */
export function fixtureF08AllInsufficient(): McEvaluationSetSnapshot {
  return set(
    'F08',
    CAND.map((code) =>
      domain({
        domainCode: code,
        qualification: 'INSUFFICIENT_EVIDENCE',
        active: 0,
        emergent: 0,
        hidden: 3,
        specialties: [],
      }),
    ),
    'COMPLETE',
    CAND,
  );
}

/** F09 — mezcla OUTSIDE + INSUFFICIENT */
export function fixtureF09MixedOutsideInsufficient(): McEvaluationSetSnapshot {
  return set('F09', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'INSUFFICIENT_EVIDENCE',
      active: 0,
      emergent: 0,
      hidden: 0,
      specialties: [],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 4,
      specialties: [spec('UI', 'HIDDEN', 5, 0.05, 0.1)],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 3,
      specialties: [spec('EDIT', 'HIDDEN', 5, 0.05, 0.1)],
    }),
  ], 'COMPLETE', CAND);
}

/** F10 — PARTIAL */
export function fixtureF10Partial(): McEvaluationSetSnapshot {
  const s = fixtureF01DominantSoftware();
  return { ...s, evaluationSetId: 'F10', setStatus: 'PARTIAL' };
}

/** F11 — dominio FAILED */
export function fixtureF11FailedDomain(): McEvaluationSetSnapshot {
  return set('F11', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'PRIMARY_MATCH',
      active: 1,
      emergent: 0,
      hidden: 2,
      specialties: [spec('BACKEND', 'ACTIVE', 70, 0.7, 0.7)],
    }),
    {
      domainCode: 'VISUAL_DESIGN',
      domainStatus: 'FAILED',
      domainQualification: null,
      profileEvaluationId: null,
      activeCount: null,
      emergentCount: null,
      hiddenCount: null,
      specialtyCount: null,
      inputSkillsCount: null,
      specialties: [],
    },
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 3,
      specialties: [spec('EDIT', 'HIDDEN', 5, 0.05, 0.1)],
    }),
  ], 'COMPLETE', CAND);
}

/** F12 — PRIMARY débil SOFTWARE vs SECONDARY fuerte VISUAL */
export function fixtureF12WeakPrimaryStrongSecondary(): McEvaluationSetSnapshot {
  return set('F12', [
    domain({
      domainCode: 'SOFTWARE',
      qualification: 'PRIMARY_MATCH',
      active: 1,
      emergent: 0,
      hidden: 3,
      specialties: [
        spec('BACKEND', 'ACTIVE', 30, 0.25, 0.3, 8, 2),
        spec('FRONTEND', 'HIDDEN', 5, 0.05, 0.1),
        spec('DATA', 'HIDDEN', 5, 0.05, 0.1),
        spec('MOBILE', 'HIDDEN', 5, 0.05, 0.1),
      ],
    }),
    domain({
      domainCode: 'VISUAL_DESIGN',
      qualification: 'SECONDARY_SIGNAL',
      active: 0,
      emergent: 2,
      hidden: 2,
      specialties: [
        spec('UI', 'EMERGENT', 70, 0.65, 0.7),
        spec('BRAND', 'EMERGENT', 60, 0.55, 0.6),
      ],
    }),
    domain({
      domainCode: 'AUDIOVISUAL_PRODUCTION',
      qualification: 'OUTSIDE',
      active: 0,
      emergent: 0,
      hidden: 3,
      specialties: [spec('EDIT', 'HIDDEN', 5, 0.05, 0.1)],
    }),
  ], 'COMPLETE', CAND);
}

/** F13 — candidate faltante */
export function fixtureF13MissingCandidate(): McEvaluationSetSnapshot {
  const s = fixtureF01DominantSoftware();
  return {
    ...s,
    evaluationSetId: 'F13',
    domains: s.domains.filter((d) => d.domainCode !== 'AUDIOVISUAL_PRODUCTION'),
  };
}

/** F14 — dominio duplicado */
export function fixtureF14DuplicateDomain(): McEvaluationSetSnapshot {
  const s = fixtureF01DominantSoftware();
  return {
    ...s,
    evaluationSetId: 'F14',
    domains: [
      ...s.domains,
      domain({
        domainCode: 'SOFTWARE',
        qualification: 'OUTSIDE',
        active: 0,
        emergent: 0,
        hidden: 1,
        specialties: [],
        evalId: 'e-SOFTWARE-dup',
      }),
    ],
  };
}

/** F15 — mismo que F01 con dominios invertidos */
export function fixtureF15OrderReversed(): McEvaluationSetSnapshot {
  const s = fixtureF01DominantSoftware();
  return {
    ...s,
    evaluationSetId: 'F15',
    candidateDomains: [...s.candidateDomains].reverse(),
    domains: [...s.domains].reverse(),
  };
}

export const CDR_V0_FIXTURES: Record<
  string,
  () => McEvaluationSetSnapshot
> = {
  F01: fixtureF01DominantSoftware,
  F02: fixtureF02PrimaryComplementary,
  F03: fixtureF03TwoPrimaryBalanced,
  F04: fixtureF04TwoPrimaryUnbalanced,
  F05: fixtureF05ThreePrimary,
  F06: fixtureF06AllSecondary,
  F07: fixtureF07AllOutside,
  F08: fixtureF08AllInsufficient,
  F09: fixtureF09MixedOutsideInsufficient,
  F10: fixtureF10Partial,
  F11: fixtureF11FailedDomain,
  F12: fixtureF12WeakPrimaryStrongSecondary,
  F13: fixtureF13MissingCandidate,
  F14: fixtureF14DuplicateDomain,
  F15: fixtureF15OrderReversed,
};
