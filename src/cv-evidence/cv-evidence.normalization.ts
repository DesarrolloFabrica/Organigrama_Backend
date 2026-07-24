import {
  EVIDENCE_SOURCE_TYPES,
  type EvidenceSourceType,
} from '../cv-skills/cv-skills.types';
import { classifyEvidenceText } from './cv-evidence.classify';
import type {
  EvidenceEngineConfig,
  NormalizedEvidenceItem,
  RawEvidenceItemInput,
} from './cv-evidence.types';

const SOURCE_SET = new Set<string>(EVIDENCE_SOURCE_TYPES);

export function normalizeEvidenceText(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function normalizeSkillName(name: string): string {
  return normalizeEvidenceText(name);
}

export function coerceSourceType(raw: string): EvidenceSourceType {
  const t = String(raw || '').trim().toUpperCase();
  if (SOURCE_SET.has(t)) return t as EvidenceSourceType;
  return 'OTHER';
}

/**
 * Normaliza y clasifica evidencias sin mutar el enrichment original.
 * Dedup lógico: normalizedText + sourceType.
 */
export function normalizeEvidenceItems(
  items: RawEvidenceItemInput[],
  normalizedName: string,
  config: EvidenceEngineConfig,
): {
  all: NormalizedEvidenceItem[];
  unique: NormalizedEvidenceItem[];
  duplicateCount: number;
} {
  const seen = new Set<string>();
  const all: NormalizedEvidenceItem[] = [];
  const unique: NormalizedEvidenceItem[] = [];
  let duplicateCount = 0;

  for (const raw of items || []) {
    const sourceType = coerceSourceType(String(raw.sourceType || 'OTHER'));
    const originalText = String(raw.evidenceText ?? '');
    const normalizedText = normalizeEvidenceText(originalText);
    const key = `${sourceType}|${normalizedText}`;
    const isDuplicateOfEarlier = seen.has(key);
    if (isDuplicateOfEarlier) duplicateCount += 1;
    else seen.add(key);

    const classified = classifyEvidenceText({
      evidenceText: originalText,
      normalizedName,
      sourceType,
      shortMaxChars: config.shortEvidenceMaxChars,
    });

    const item: NormalizedEvidenceItem = {
      sourceType,
      originalText,
      normalizedText,
      isShort: classified.isShort,
      isNameOnly: classified.isNameOnly,
      isListing: classified.isListing,
      isAmbiguous: classified.isAmbiguous,
      isSubstantive: classified.isSubstantive,
      classifyReasons: classified.reasons,
      isDuplicateOfEarlier,
    };
    all.push(item);
    if (!isDuplicateOfEarlier) unique.push(item);
  }

  return { all, unique, duplicateCount };
}
