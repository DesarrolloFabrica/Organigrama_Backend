/**
 * Evidencia por skill (Fase B): parseo, dedupe, prioridad sourceType, consolidación.
 */
import {
  EVIDENCE_SOURCE_TYPE_PRIORITY,
  EVIDENCE_SOURCE_TYPES,
  MAX_EVIDENCE_ITEMS_PER_SKILL,
  type EvidenceSourceType,
  type SkillEvidenceItem,
} from './cv-skills.types';

const MAX_EVIDENCE_TEXT = 2000;

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function evidenceTextKey(text: string): string {
  return collapseWhitespace(text)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

export function isEvidenceSourceType(
  value: unknown,
): value is EvidenceSourceType {
  return (
    typeof value === 'string' &&
    (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

function sourceTypeRank(sourceType: EvidenceSourceType): number {
  const idx = EVIDENCE_SOURCE_TYPE_PRIORITY.indexOf(sourceType);
  return idx >= 0 ? idx : EVIDENCE_SOURCE_TYPE_PRIORITY.length;
}

/**
 * Une, deduplica, prioriza y reindexa evidenceItems (máx. 5).
 * Usado en validación y en consolidación de persistencia.
 */
export function mergeEvidenceItems(
  items: SkillEvidenceItem[],
): SkillEvidenceItem[] {
  const byKey = new Map<string, SkillEvidenceItem>();

  for (const item of items) {
    const text = collapseWhitespace(item.evidenceText);
    if (!text) continue;
    if (!isEvidenceSourceType(item.sourceType)) continue;

    const key = evidenceTextKey(text);
    const candidate: SkillEvidenceItem = {
      sourceType: item.sourceType,
      evidenceText:
        text.length > MAX_EVIDENCE_TEXT
          ? text.slice(0, MAX_EVIDENCE_TEXT)
          : text,
      occurrenceIndex: item.occurrenceIndex,
      ...(item.isFallback ? { isFallback: true } : {}),
    };

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }

    // Preferir no-fallback y mejor prioridad de sourceType.
    const preferCandidate =
      (!candidate.isFallback && existing.isFallback) ||
      (Boolean(candidate.isFallback) === Boolean(existing.isFallback) &&
        sourceTypeRank(candidate.sourceType) <
          sourceTypeRank(existing.sourceType));

    if (preferCandidate) {
      byKey.set(key, candidate);
    }
  }

  const merged = [...byKey.values()].sort((a, b) => {
    const rankDiff = sourceTypeRank(a.sourceType) - sourceTypeRank(b.sourceType);
    if (rankDiff !== 0) return rankDiff;
    // Preferir no-fallback
    if (Boolean(a.isFallback) !== Boolean(b.isFallback)) {
      return a.isFallback ? 1 : -1;
    }
    return a.occurrenceIndex - b.occurrenceIndex;
  });

  return merged.slice(0, MAX_EVIDENCE_ITEMS_PER_SKILL).map((item, i) => ({
    sourceType: item.sourceType,
    evidenceText: item.evidenceText,
    occurrenceIndex: i + 1,
    ...(item.isFallback ? { isFallback: true } : {}),
  }));
}

/**
 * Parsea evidenceItems crudos del modelo.
 * No elimina la skill ante fallos: emite warnings y puede devolver [].
 */
export function parseSkillEvidenceItems(
  raw: unknown,
  path: string,
  warnings: string[],
): SkillEvidenceItem[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    warnings.push(
      `${path}.evidenceItems: no es un arreglo; se ignora (skill conservada).`,
    );
    return [];
  }

  const parsed: SkillEvidenceItem[] = [];

  for (let i = 0; i < raw.length; i++) {
    const itemPath = `${path}.evidenceItems[${i}]`;
    const item = raw[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      warnings.push(`${itemPath}: no es un objeto; evidencia omitida.`);
      continue;
    }
    const record = item as Record<string, unknown>;

    if (!isEvidenceSourceType(record.sourceType)) {
      warnings.push(
        `${itemPath}: sourceType inválido (${String(record.sourceType)}); evidencia omitida.`,
      );
      continue;
    }
    if (typeof record.evidenceText !== 'string') {
      warnings.push(`${itemPath}: evidenceText inválido; evidencia omitida.`);
      continue;
    }
    const text = collapseWhitespace(record.evidenceText);
    if (!text) {
      warnings.push(`${itemPath}: evidenceText vacío; evidencia omitida.`);
      continue;
    }

    let occurrenceIndex = 0;
    if (
      typeof record.occurrenceIndex === 'number' &&
      Number.isFinite(record.occurrenceIndex)
    ) {
      occurrenceIndex = record.occurrenceIndex;
    }

    parsed.push({
      sourceType: record.sourceType,
      evidenceText: text,
      occurrenceIndex,
    });
  }

  if (parsed.length > MAX_EVIDENCE_ITEMS_PER_SKILL) {
    warnings.push(
      `${path}.evidenceItems: se limitó a ${MAX_EVIDENCE_ITEMS_PER_SKILL} evidencias.`,
    );
  }

  return mergeEvidenceItems(parsed);
}

/**
 * Si no hay evidencias válidas y hay category.evidence, crea fallback OTHER.
 */
export function applyCategoryEvidenceFallback(
  items: SkillEvidenceItem[],
  categoryEvidence: string | undefined,
  path: string,
  warnings: string[],
): SkillEvidenceItem[] {
  if (items.length > 0) return items;
  const fallbackText = categoryEvidence
    ? collapseWhitespace(categoryEvidence)
    : '';
  if (!fallbackText) return [];

  warnings.push(
    `${path}: evidenceItems vacío; se heredó evidence de categoría (fallback OTHER).`,
  );

  return mergeEvidenceItems([
    {
      sourceType: 'OTHER',
      evidenceText: fallbackText,
      occurrenceIndex: 1,
      isFallback: true,
    },
  ]);
}
