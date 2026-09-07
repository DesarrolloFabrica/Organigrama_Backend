/**
 * Matching de práctica: kind + slots vs léxico de catálogo.
 * toolOrMethod nunca origina identidad por sí solo.
 */
import {
  isDataAssetText,
  TOOL_TOKEN_DENYLIST,
  type CompiledFieldLexicon,
  type CompiledSpecialtyLexicon,
} from './catalog-lexicon';
import { isOriginKind, isReinforceKind } from './evidence';
import {
  containsContiguousPhrase,
  containsStemTokens,
  joinSlots,
  normalizeText,
  stemSet,
  tokenize,
} from './text-normalize';
import type { EvidenceRole, ResolverEvidenceUnit, SignalMatch } from './types';

const PRACTICE_VERBS = new Set(
  [
    'construir',
    'desarrollar',
    'implementar',
    'disenar',
    'administrar',
    'consolidar',
    'producir',
    'editar',
    'ensenar',
    'facilitar',
    'planear',
    'planificar',
    'capturar',
    'crear',
    'liderar',
    'optimizar',
    'automatizar',
    'entrenar',
    'desplegar',
    'modelar',
    'diagramar',
    'componer',
    'reportar',
    'comunicar',
    'gestionar',
    'monitorear',
    'analizar',
    'transformar',
    'ejecutar',
    'consultar',
    'obtener',
    'estructurar',
    'integrar',
  ].map((v) => v),
);

function practiceText(u: ResolverEvidenceUnit): string {
  return joinSlots([u.normalizedActivity, u.object, u.result, u.scope]);
}

function toolText(u: ResolverEvidenceUnit): string {
  return normalizeText(u.toolOrMethod);
}

function hasPracticeVerb(activityNorm: string): boolean {
  const tokens = tokenize(activityNorm);
  return tokens.some((t) => PRACTICE_VERBS.has(t) || PRACTICE_VERBS.has(t.replace(/ar$|er$|ir$/, '')));
}

function phraseHits(
  practiceNorm: string,
  practiceStems: Set<string>,
  phrases: string[],
  nouns: string[],
): string[] {
  const hits: string[] = [];
  for (const p of phrases) {
    const pn = normalizeText(p);
    if (!pn) continue;
    if (containsContiguousPhrase(practiceNorm, pn)) {
      hits.push(p);
      continue;
    }
    const toks = tokenize(pn);
    if (toks.length >= 2 && containsStemTokens(practiceStems, toks)) {
      hits.push(p);
    }
  }
  const activityHasVerb = hasPracticeVerb(practiceNorm);
  if (activityHasVerb) {
    for (const n of nouns) {
      const nn = normalizeText(n);
      if (nn.length < 3) continue;
      if (containsContiguousPhrase(practiceNorm, nn)) hits.push(n);
    }
  }
  return [...new Set(hits)];
}

function toolOnlySignal(u: ResolverEvidenceUnit, practiceHits: string[]): boolean {
  if (practiceHits.length > 0) return false;
  const tool = toolText(u);
  if (!tool) return false;
  return TOOL_TOKEN_DENYLIST.some(
    (t) => tool === t || tool.includes(t) || t.includes(tool),
  );
}

function outcomeHits(resultNorm: string, atoms: string[]): string[] {
  const hits: string[] = [];
  for (const a of atoms) {
    const an = normalizeText(a);
    if (an && containsContiguousPhrase(resultNorm, an)) hits.push(a);
  }
  return hits;
}

function isolatedQualityBlocked(
  u: ResolverEvidenceUnit,
  resultNorm: string,
  assetNorm: string,
): boolean {
  if (!containsContiguousPhrase(resultNorm, 'calidad')) return false;
  if (
    containsContiguousPhrase(resultNorm, 'calidad del dato') ||
    containsContiguousPhrase(resultNorm, 'calidad de datos') ||
    containsContiguousPhrase(resultNorm, 'calidad de la informacion')
  ) {
    return false;
  }
  const obj = normalizeText(u.object);
  if (
    containsContiguousPhrase(obj, 'tablero') ||
    containsContiguousPhrase(obj, 'dashboard') ||
    containsContiguousPhrase(obj, 'reporte')
  ) {
    return true;
  }
  return !isDataAssetText(assetNorm);
}

function unitAssetText(u: ResolverEvidenceUnit): string {
  return normalizeText(joinSlots([u.normalizedActivity, u.object, u.scope]));
}

function isTechWithoutGovernanceOutcome(
  u: ResolverEvidenceUnit,
  assetNorm: string,
  resultNorm: string,
  hasOutcome: boolean,
): boolean {
  if (hasOutcome) return false;
  if (!isOriginKind(u.evidenceKind)) return false;
  const tool = toolText(u);
  const blob = `${assetNorm} ${tool}`;
  return (
    isDataAssetText(assetNorm) ||
    /\betl\b|\bpipeline|\bsql\b|\bgcp\b|\baws\b|\bazure\b|\bcloud\b/.test(blob)
  );
}

export function matchUnitToField(
  u: ResolverEvidenceUnit,
  field: CompiledFieldLexicon,
): SignalMatch {
  const practiceNorm = normalizeText(practiceText(u));
  const practiceStems = stemSet(tokenize(practiceNorm));
  const hits = phraseHits(
    practiceNorm,
    practiceStems,
    field.practicePhrases,
    field.uniquePracticeNouns,
  );
  const exclusions: string[] = [];
  if (toolOnlySignal(u, hits)) {
    exclusions.push('TOOL_ONLY_IGNORED');
  }
  let role: EvidenceRole = 'NONE';
  if (exclusions.includes('TOOL_ONLY_IGNORED')) role = 'EXCLUDED';
  else if (hits.length > 0 && isOriginKind(u.evidenceKind)) role = 'ORIGIN';
  else if (hits.length > 0 && isReinforceKind(u.evidenceKind)) role = 'REINFORCE';
  return {
    evidenceId: u.evidenceId,
    candidateId: u.candidateId,
    role,
    positiveSignalsMatched: hits,
    exclusionsTriggered: exclusions,
    matchedPractices: hits,
  };
}

export function matchUnitToSpecialty(
  u: ResolverEvidenceUnit,
  spec: CompiledSpecialtyLexicon,
): SignalMatch {
  const practiceNorm = normalizeText(practiceText(u));
  const practiceStems = stemSet(tokenize(practiceNorm));
  const resultNorm = normalizeText(u.result);
  const hits = phraseHits(
    practiceNorm,
    practiceStems,
    spec.practicePhrases,
    spec.practiceNouns,
  );
  const exclusions: string[] = [];
  const matchedPractices = [...hits];
  const assetNorm = unitAssetText(u);

  if (toolOnlySignal(u, hits) && !spec.requiresOutcomeForOrigin) {
    exclusions.push('TOOL_ONLY_IGNORED');
  }

  if (u.evidenceKind === 'KNOWLEDGE_STATEMENT') {
    const knowledgeHits = phraseHits(
      practiceNorm,
      practiceStems,
      spec.practicePhrases,
      spec.practiceNouns,
    );
    const outcomeInKnowledge = outcomeHits(practiceNorm, spec.outcomeAtoms);
    if (spec.requiresOutcomeForOrigin) {
      exclusions.push('KNOWLEDGE_CANNOT_ORIGINATE');
      return {
        evidenceId: u.evidenceId,
        candidateId: u.candidateId,
        role: knowledgeHits.length || outcomeInKnowledge.length ? 'REINFORCE' : 'NONE',
        positiveSignalsMatched: [...knowledgeHits, ...outcomeInKnowledge],
        exclusionsTriggered: exclusions,
        matchedPractices: [...knowledgeHits, ...outcomeInKnowledge],
      };
    }
    if (knowledgeHits.length > 0) {
      return {
        evidenceId: u.evidenceId,
        candidateId: u.candidateId,
        role: 'REINFORCE',
        positiveSignalsMatched: knowledgeHits,
        exclusionsTriggered: [],
        matchedPractices: knowledgeHits,
      };
    }
  }

  if (spec.requiresOutcomeForOrigin) {
    const outcomes = [...outcomeHits(resultNorm, spec.outcomeAtoms)];
    const calidadBlocked = isolatedQualityBlocked(u, resultNorm, assetNorm);
    if (calidadBlocked) {
      exclusions.push('ISOLATED_QUALITY_OF_DELIVERABLE');
    }
    const hasAsset = isDataAssetText(assetNorm);
    if (
      hasAsset &&
      !calidadBlocked &&
      containsContiguousPhrase(resultNorm, 'calidad') &&
      !outcomes.some((o) => o.includes('calidad'))
    ) {
      outcomes.push('calidad (data-asset context)');
    }
    if (
      isTechWithoutGovernanceOutcome(u, assetNorm, resultNorm, outcomes.length > 0)
    ) {
      exclusions.push('TECH_WITHOUT_GOVERNANCE_OUTCOME');
    }
    if (
      toolOnlySignal(u, [...hits, ...outcomes]) &&
      !hasAsset &&
      outcomes.length === 0
    ) {
      exclusions.push('TOOL_ONLY_IGNORED');
    }
    const originOk =
      isOriginKind(u.evidenceKind) &&
      outcomes.length > 0 &&
      hasAsset &&
      !calidadBlocked;

    if (originOk) {
      matchedPractices.push(...outcomes);
      return {
        evidenceId: u.evidenceId,
        candidateId: u.candidateId,
        role: 'ORIGIN',
        positiveSignalsMatched: [...hits, ...outcomes],
        exclusionsTriggered: exclusions.filter(
          (e) => e !== 'TECH_WITHOUT_GOVERNANCE_OUTCOME',
        ),
        matchedPractices: [...new Set(matchedPractices)],
      };
    }

    if (outcomes.length > 0 && u.evidenceKind === 'RESULT' && hasAsset) {
      return {
        evidenceId: u.evidenceId,
        candidateId: u.candidateId,
        role: 'REINFORCE',
        positiveSignalsMatched: outcomes,
        exclusionsTriggered: exclusions,
        matchedPractices: outcomes,
      };
    }

    return {
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      role: exclusions.length ? 'EXCLUDED' : 'NONE',
      positiveSignalsMatched: hits,
      exclusionsTriggered: exclusions,
      matchedPractices: hits,
    };
  }

  if (exclusions.includes('TOOL_ONLY_IGNORED')) {
    return {
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      role: 'EXCLUDED',
      positiveSignalsMatched: [],
      exclusionsTriggered: exclusions,
      matchedPractices: [],
    };
  }

  if (hits.length === 0) {
    return {
      evidenceId: u.evidenceId,
      candidateId: u.candidateId,
      role: 'NONE',
      positiveSignalsMatched: [],
      exclusionsTriggered: [],
      matchedPractices: [],
    };
  }

  const role: EvidenceRole = isOriginKind(u.evidenceKind)
    ? 'ORIGIN'
    : isReinforceKind(u.evidenceKind)
      ? 'REINFORCE'
      : 'NONE';

  return {
    evidenceId: u.evidenceId,
    candidateId: u.candidateId,
    role,
    positiveSignalsMatched: hits,
    exclusionsTriggered: exclusions,
    matchedPractices: hits,
  };
}

export function strengthFromOriginCount(n: number): 'NONE' | 'THIN' | 'MODERATE' | 'STRONG' {
  if (n <= 0) return 'NONE';
  if (n === 1) return 'THIN';
  if (n === 2) return 'MODERATE';
  return 'STRONG';
}
