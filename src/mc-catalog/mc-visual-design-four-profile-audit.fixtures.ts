/**
 * Fixtures MC1.6 — cuatro documentos objetivo.
 * HISTORICAL_DOC / PARTIAL reconstruidos desde docs (no live PG).
 * Sin dirección, teléfono, DOB ni datos sensibles.
 */

import type {
  McVdProfileSkill,
  McVdProfileSnapshot,
} from './mc-visual-design-four-profile-audit.types';

function sk(
  skillKey: string,
  skillName: string,
  skillType: string,
  evidenceLevel: McVdProfileSkill['evidenceLevel'],
  evidenceStrength: number,
  source: McVdProfileSkill['source'] = 'NORMALIZED',
  snippet: string | null = null,
): McVdProfileSkill {
  return {
    skillKey,
    skillName,
    skillType,
    evidenceLevel,
    evidenceStrength,
    evidenceConfidence: evidenceLevel === 'NONE' ? 0.1 : evidenceLevel === 'WEAK' ? 0.35 : 0.6,
    evidenceSnippet: snippet,
    source,
    originalName: skillName,
  };
}

const emptyChain = (
  overrides: Partial<McVdProfileSnapshot['chain']> = {},
): McVdProfileSnapshot['chain'] => ({
  cv: 'MISSING',
  extraction: 'NOT_EXECUTED',
  enrichment: 'NOT_EXECUTED',
  evidence: 'NOT_EXECUTED',
  visualEvaluation: 'NOT_EXECUTED',
  evaluationSet: 'NOT_EXECUTED',
  extractionId: null,
  enrichmentId: null,
  evidenceId: null,
  notes: [],
  ...overrides,
});

/** Nidia — inventario documentado en mc1.6.0 (extracción 207 / evidence 5). */
export function fixtureNidia1015482688(): McVdProfileSnapshot {
  return {
    document: '1015482688',
    personId: '1163',
    fullNameConfirm: 'NIDIA MARCELA PRADA RAMIREZ',
    found: true,
    dataSource: 'HISTORICAL_DOC',
    chain: emptyChain({
      cv: 'AVAILABLE',
      extraction: 'AVAILABLE',
      enrichment: 'AVAILABLE',
      evidence: 'AVAILABLE',
      visualEvaluation: 'AVAILABLE',
      evaluationSet: 'NOT_EXECUTED',
      extractionId: '207',
      enrichmentId: '5',
      evidenceId: '5',
      notes: [
        'Reconstruido desde docs/mc1.6.0-visual-design-domain-audit.md',
        'mc1.11.0: PRIMARY GRAPHIC (NO_CHANGE)',
      ],
    }),
    skills: [
      sk('diseno_grafico', 'Diseño Gráfico', 'PROFESSIONAL_KNOWLEDGE', 'MODERATE', 66, 'EXPLICIT', 'educación+trabajo+perfil'),
      sk('diseno_editorial', 'Diseño editorial', 'PROFESSIONAL_KNOWLEDGE', 'WEAK', 5, 'EXPLICIT', 'mención perfil'),
      sk('comunicacion_visual', 'Comunicación Visual', 'PROFESSIONAL_KNOWLEDGE', 'NONE', 0, 'EXPLICIT', 'listing skills'),
      sk('diseno_instruccional', 'Diseño instruccional', 'PROFESSIONAL_KNOWLEDGE', 'WEAK', 2, 'EXPLICIT', null),
      sk('control_de_calidad_(qa)', 'Control de Calidad (QA)', 'PROFESSIONAL_KNOWLEDGE', 'MODERATE', 50, 'EXPLICIT', null),
      sk('scorm', 'SCORM', 'TECHNOLOGY', 'MODERATE', 52, 'NORMALIZED', null),
      sk('lms', 'LMS', 'TECHNOLOGY', 'MODERATE', 52, 'NORMALIZED', null),
      sk('adobe_illustrator', 'Adobe Illustrator', 'TOOL', 'WEAK', 2, 'EXPLICIT', 'perfil+skills'),
      sk('adobe_photoshop', 'Adobe Photoshop', 'TOOL', 'WEAK', 2, 'EXPLICIT', 'perfil+skills'),
      sk('adobe_indesign', 'Adobe InDesign', 'TOOL', 'WEAK', 2, 'EXPLICIT', 'skills/perfil'),
      sk('adobe_premiere_pro', 'Adobe Premiere Pro', 'TOOL', 'NONE', 0, 'EXPLICIT', 'listing'),
      sk('adobe_after_effects', 'Adobe After Effects', 'TOOL', 'NONE', 0, 'EXPLICIT', 'listing'),
      sk('canva', 'Canva', 'TOOL', 'NONE', 0, 'EXPLICIT', 'listing'),
      sk('capcut', 'CapCut', 'TOOL', 'NONE', 0, 'EXPLICIT', 'listing'),
      sk('prompting', 'Prompting', 'METHODOLOGY', 'MODERATE', 50, 'NORMALIZED', null),
    ],
  };
}

/**
 * Molano — señales documentadas en mc1.11.0 (ALIAS_GAP → pack 1.2.0).
 * Inventario parcial; no es extracción completa live.
 */
export function fixtureMolano1000035262(): McVdProfileSnapshot {
  return {
    document: '1000035262',
    personId: null,
    fullNameConfirm: 'MOLANO (confirmación docs mc1.11.0)',
    found: true,
    dataSource: 'HISTORICAL_PARTIAL',
    chain: emptyChain({
      cv: 'AVAILABLE',
      extraction: 'AVAILABLE',
      enrichment: 'AVAILABLE',
      evidence: 'AVAILABLE',
      visualEvaluation: 'AVAILABLE',
      evaluationSet: 'NOT_EXECUTED',
      notes: [
        'Pre-1.2.0: OUTSIDE ALIAS_GAP; post-1.2.0: GRAPHIC+IDENTITY ACTIVE (#16)',
        'Skills reconstruidas desde diffs de pack 1.2.0 (parcial)',
      ],
    }),
    skills: [
      sk('diseno_de_marca', 'Diseño de Marca', 'PROFESSIONAL_KNOWLEDGE', 'MODERATE', 55, 'NORMALIZED', 'alias 1.2.0'),
      sk('ilustracion', 'Ilustración', 'PROFESSIONAL_KNOWLEDGE', 'WEAK', 30, 'NORMALIZED', null),
      sk('adobe_creative_suite', 'Adobe Creative Suite', 'TOOL', 'WEAK', 25, 'NORMALIZED', 'OUTSIDE pack policy'),
      sk('adobe_illustrator', 'Adobe Illustrator', 'TOOL', 'WEAK', 20, 'EXPLICIT', null),
      sk('adobe_photoshop', 'Adobe Photoshop', 'TOOL', 'WEAK', 20, 'EXPLICIT', null),
      sk('diseno_grafico', 'Diseño Gráfico', 'PROFESSIONAL_KNOWLEDGE', 'MODERATE', 48, 'EXPLICIT', null),
    ],
  };
}

/**
 * Documento sin evidencia en docs del repo — requiere lookup live.
 */
export function fixtureUnknown1000590473(): McVdProfileSnapshot {
  return {
    document: '1000590473',
    personId: null,
    fullNameConfirm: null,
    found: false,
    dataSource: 'FIXTURE_UNKNOWN',
    chain: emptyChain({
      notes: [
        'Sin inventario en docs del repo; requiere --i-confirm-readonly + PG local',
      ],
    }),
    skills: [],
  };
}

/**
 * Doris — documentado NEED_CV / extracción huérfana (mc1.10.2).
 */
export function fixtureDoris103154553(): McVdProfileSnapshot {
  return {
    document: '103154553',
    personId: null,
    fullNameConfirm: 'DORIS KATHERINE AVILA HERNANDEZ',
    found: true,
    dataSource: 'HISTORICAL_DOC',
    chain: emptyChain({
      cv: 'MISSING',
      extraction: 'OUTDATED',
      enrichment: 'MISSING',
      evidence: 'MISSING',
      visualEvaluation: 'NOT_EXECUTED',
      evaluationSet: 'NOT_EXECUTED',
      notes: [
        'mc1.10.2: extracción huérfana sin CV activo (NEED_CV)',
      ],
    }),
    skills: [],
  };
}

/** Caso sintético: skill visualish sin mapping (tests). */
export function fixtureSyntheticAliasGap(): McVdProfileSnapshot {
  return {
    document: 'SYNTHETIC_ALIAS',
    personId: '0',
    fullNameConfirm: null,
    found: true,
    dataSource: 'SYNTHETIC',
    chain: emptyChain({
      cv: 'AVAILABLE',
      extraction: 'AVAILABLE',
      enrichment: 'AVAILABLE',
      evidence: 'AVAILABLE',
      notes: ['fixture sintético ALIAS_GAP'],
    }),
    skills: [
      sk(
        'diseno_de_piezas_publicitarias',
        'Diseño de piezas publicitarias',
        'PROFESSIONAL_KNOWLEDGE',
        'MODERATE',
        60,
        'EXPLICIT',
        'pieza publicitaria',
      ),
      sk('figma', 'Figma', 'TOOL', 'MODERATE', 50, 'EXPLICIT', 'prototipos UI'),
      sk('after_effects', 'After Effects', 'TOOL', 'WEAK', 25, 'EXPLICIT', 'animación piezas'),
    ],
  };
}

export const MC_VD_FOUR_PROFILE_FIXTURES: Record<
  string,
  () => McVdProfileSnapshot
> = {
  '1015482688': fixtureNidia1015482688,
  '1000035262': fixtureMolano1000035262,
  '1000590473': fixtureUnknown1000590473,
  '103154553': fixtureDoris103154553,
  SYNTHETIC_ALIAS: fixtureSyntheticAliasGap,
};

export function loadFourProfileFixtures(
  documents: string[] = ['1015482688', '1000035262', '1000590473', '103154553'],
): McVdProfileSnapshot[] {
  return documents.map((d) => {
    const factory = MC_VD_FOUR_PROFILE_FIXTURES[d];
    if (!factory) {
      return {
        document: d,
        personId: null,
        fullNameConfirm: null,
        found: false,
        dataSource: 'FIXTURE_UNKNOWN',
        chain: emptyChain({ notes: [`fixture ausente para ${d}`] }),
        skills: [],
      };
    }
    return factory();
  });
}
