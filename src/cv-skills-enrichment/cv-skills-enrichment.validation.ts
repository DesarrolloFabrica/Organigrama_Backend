/**
 * Validación de integridad input vs output del enricher (por bloque).
 */
import { parseSkillEvidenceItems } from '../cv-skills/cv-skills.evidence';
import type { SkillEvidenceItem } from '../cv-skills/cv-skills.types';
import type {
  EnrichmentInputSkill,
  EnrichmentOutputSkill,
  BlockValidationIssue,
  BlockValidationResult,
} from './cv-skills-enrichment.types';

function namesEqual(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function mergeDuplicateOutputs(
  a: EnrichmentOutputSkill,
  b: EnrichmentOutputSkill,
): EnrichmentOutputSkill {
  const warnings = [...a.warnings, ...b.warnings];
  const evidenceItems = parseSkillEvidenceItems(
    [...a.evidenceItems, ...b.evidenceItems],
    `merge:${a.extractionSkillId}`,
    warnings,
  );
  return {
    extractionSkillId: a.extractionSkillId,
    normalizedName: a.normalizedName,
    evidenceItems,
    warnings,
  };
}

/**
 * Valida respuesta cruda de Gemini contra el input del bloque.
 * Conserva orden e IDs del input.
 */
export function validateEnrichmentBlockResponse(
  inputSkills: EnrichmentInputSkill[],
  raw: unknown,
): BlockValidationResult {
  const identityErrors: BlockValidationIssue[] = [];
  const warnings: string[] = [];
  let unknownSkillsReturned = 0;
  let duplicateSkillsReturned = 0;

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      ok: false,
      skills: [],
      identityErrors: [
        {
          code: 'INVALID_ROOT',
          message: 'La respuesta del enricher no es un objeto JSON.',
        },
      ],
      warnings,
      unknownSkillsReturned: 0,
      duplicateSkillsReturned: 0,
    };
  }

  const root = raw as Record<string, unknown>;
  if (Array.isArray(root.warnings)) {
    for (const w of root.warnings) {
      if (typeof w === 'string' && w.trim()) {
        warnings.push(w.trim());
      }
    }
  }

  if (!Array.isArray(root.skills)) {
    return {
      ok: false,
      skills: [],
      identityErrors: [
        {
          code: 'MISSING_SKILLS_ARRAY',
          message: 'Falta el arreglo skills en la respuesta.',
        },
      ],
      warnings,
      unknownSkillsReturned: 0,
      duplicateSkillsReturned: 0,
    };
  }

  const expectedById = new Map(
    inputSkills.map((s) => [s.extractionSkillId, s] as const),
  );
  const collected = new Map<string, EnrichmentOutputSkill>();

  for (let i = 0; i < root.skills.length; i++) {
    const item = root.skills[i];
    const path = `skills[${i}]`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      identityErrors.push({
        code: 'INVALID_SKILL_OBJECT',
        message: `${path}: no es un objeto.`,
      });
      continue;
    }
    const rec = item as Record<string, unknown>;
    const id =
      typeof rec.extractionSkillId === 'string'
        ? rec.extractionSkillId.trim()
        : '';
    const name =
      typeof rec.normalizedName === 'string' ? rec.normalizedName.trim() : '';

    if (!id) {
      identityErrors.push({
        code: 'MISSING_ID',
        message: `${path}: extractionSkillId ausente.`,
      });
      continue;
    }

    const expected = expectedById.get(id);
    if (!expected) {
      unknownSkillsReturned += 1;
      warnings.push(
        `${path}: skill no solicitada (extractionSkillId=${id}); ignorada.`,
      );
      continue;
    }

    if (!name || !namesEqual(name, expected.normalizedName)) {
      identityErrors.push({
        code: 'NAME_MISMATCH',
        message: `${path}: normalizedName cambiado (esperado "${expected.normalizedName}", recibido "${name}").`,
        extractionSkillId: id,
      });
      continue;
    }

    const itemWarnings: string[] = [];
    const evidenceItems: SkillEvidenceItem[] = parseSkillEvidenceItems(
      rec.evidenceItems,
      path,
      itemWarnings,
    );
    warnings.push(...itemWarnings);

    const output: EnrichmentOutputSkill = {
      extractionSkillId: expected.extractionSkillId,
      normalizedName: expected.normalizedName,
      evidenceItems,
      warnings: itemWarnings,
    };

    const existing = collected.get(id);
    if (existing) {
      duplicateSkillsReturned += 1;
      warnings.push(
        `${path}: skill duplicada (extractionSkillId=${id}); se hace merge determinista.`,
      );
      if (!namesEqual(existing.normalizedName, output.normalizedName)) {
        identityErrors.push({
          code: 'DUPLICATE_IDENTITY_CONFLICT',
          message: `${path}: duplicado con conflicto de normalizedName.`,
          extractionSkillId: id,
        });
        continue;
      }
      collected.set(id, mergeDuplicateOutputs(existing, output));
    } else {
      collected.set(id, output);
    }
  }

  for (const expected of inputSkills) {
    if (!collected.has(expected.extractionSkillId)) {
      identityErrors.push({
        code: 'SKILL_OMITTED',
        message: `Skill omitida: ${expected.extractionSkillId} (${expected.normalizedName}).`,
        extractionSkillId: expected.extractionSkillId,
      });
    }
  }

  const ok = identityErrors.length === 0;
  const skills: EnrichmentOutputSkill[] = ok
    ? inputSkills.map((s) => collected.get(s.extractionSkillId)!)
    : [];

  return {
    ok,
    skills,
    identityErrors,
    warnings,
    unknownSkillsReturned,
    duplicateSkillsReturned,
  };
}
