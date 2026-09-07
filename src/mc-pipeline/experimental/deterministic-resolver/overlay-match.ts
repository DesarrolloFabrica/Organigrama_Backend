import {
  differentialFor,
  EXPERIMENTAL_RESOLVER_POLICY,
  otherField,
  type CompetitorPair,
  type ExperimentalResolverPolicy,
} from './experimental-policy';
import {
  containsContiguousPhrase,
  containsStemTokens,
  joinSlots,
  normalizeText,
  stemSet,
  tokenize,
} from './text-normalize';
import type { ResolverEvidenceUnit } from './types';

export function practiceBlob(u: ResolverEvidenceUnit): string {
  return normalizeText(
    joinSlots([u.normalizedActivity, u.object, u.result, u.scope]),
  );
}

export function aliasHits(
  u: ResolverEvidenceUnit,
  aliases: string[],
): string[] {
  const blob = practiceBlob(u);
  if (!blob) return [];
  const stems = stemSet(tokenize(blob));
  const hits: string[] = [];
  for (const alias of aliases) {
    const n = normalizeText(alias);
    if (!n) continue;
    if (containsContiguousPhrase(blob, n)) {
      hits.push(alias);
      continue;
    }
    const toks = tokenize(n);
    if (toks.length >= 2 && containsStemTokens(stems, toks)) hits.push(alias);
  }
  return [...new Set(hits)];
}

export function differentialHits(
  units: ResolverEvidenceUnit[],
  pair: CompetitorPair,
  fieldCode: string,
): string[] {
  const signals = differentialFor(pair, fieldCode);
  const hits: string[] = [];
  for (const u of units) {
    hits.push(...aliasHits(u, signals));
  }
  return [...new Set(hits)];
}

export function sharedPracticeHits(
  units: ResolverEvidenceUnit[],
  pair: CompetitorPair,
): string[] {
  const hits: string[] = [];
  for (const u of units) {
    hits.push(...aliasHits(u, pair.sharedPractices));
  }
  return [...new Set(hits)];
}

export function fieldAliasHits(
  u: ResolverEvidenceUnit,
  fieldCode: string,
  policy: ExperimentalResolverPolicy = EXPERIMENTAL_RESOLVER_POLICY,
): string[] {
  const aliases = policy.fieldPracticeAliases[fieldCode] ?? [];
  return aliasHits(u, aliases);
}

export function specialtyAliasHits(
  u: ResolverEvidenceUnit,
  specialtyCode: string,
  policy: ExperimentalResolverPolicy = EXPERIMENTAL_RESOLVER_POLICY,
): string[] {
  const aliases = policy.specialtyPracticeAliases[specialtyCode] ?? [];
  return aliasHits(u, aliases);
}

export { otherField };
