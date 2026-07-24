/**
 * Engine puro del Attribute Engine (Fase E6).
 *
 * Sin TypeORM, sin IO, sin Gemini, sin PDF. Entrada: items de evidencia ya
 * evaluados + catálogo + mappings + config. Salida determinista.
 */

import { round2, round4 } from './cv-attributes.contribution';
import { scoreMacroattribute } from './cv-attributes.macroattribute-scoring';
import { validateAttributeCatalog } from './cv-attributes.mapping-validation';
import { scoreSubattribute } from './cv-attributes.subattribute-scoring';
import type {
  AttributeCatalog,
  AttributeEngineConfig,
  AttributeEngineRunResult,
  AttributeMapping,
  AttributeSkillInput,
  MacroattributeResult,
  SubattributeResult,
} from './cv-attributes.types';

export class AttributeEngineError extends Error {
  readonly issues: string[];

  constructor(message: string, issues: string[] = []) {
    super(message);
    this.name = 'AttributeEngineError';
    this.issues = issues;
  }
}

export function runAttributeEngine(
  skills: AttributeSkillInput[],
  catalog: AttributeCatalog,
  config: AttributeEngineConfig,
  options: { requireActiveCatalog?: boolean } = {},
): AttributeEngineRunResult {
  const validation = validateAttributeCatalog(catalog, options);
  if (!validation.ok) {
    throw new AttributeEngineError(
      'Catálogo o mappings inválidos; no se ejecuta el Attribute Engine.',
      validation.errors.map((e) => `${e.code}: ${e.message}`),
    );
  }

  const warnings: string[] = validation.warnings.map(
    (w) => `${w.code}: ${w.message}`,
  );

  const activeMacros = catalog.macroattributes
    .filter((m) => m.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const activeSubs = catalog.subattributes
    .filter((s) => s.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const activeMappings = catalog.mappings.filter((m) => m.isActive);

  const macroById = new Map(activeMacros.map((m) => [m.id, m]));

  // Una skill del perfil puede repetirse por skillId solo si la extracción
  // duplicara la misma skill; uq_cv_extraction_skill_item lo impide, así que el
  // índice por skillId es unívoco dentro del run.
  const skillsBySkillId = new Map<string, AttributeSkillInput>();
  for (const skill of skills) {
    if (skillsBySkillId.has(skill.skillId)) {
      warnings.push(
        `DUPLICATE_SKILL_IN_EVALUATION: skillId=${skill.skillId} aparece más de una vez; se usa la primera aparición.`,
      );
      continue;
    }
    skillsBySkillId.set(skill.skillId, skill);
  }

  const mappingsBySub = new Map<string, AttributeMapping[]>();
  const mappedSkillIds = new Set<string>();
  for (const mapping of activeMappings) {
    const list = mappingsBySub.get(mapping.subattributeId) ?? [];
    list.push(mapping);
    mappingsBySub.set(mapping.subattributeId, list);
    if (skillsBySkillId.has(mapping.skillId)) {
      mappedSkillIds.add(mapping.skillId);
    }
  }

  const relationsBySubId = new Map<string, string[]>();
  for (const relation of catalog.unmappedRelations ?? []) {
    if (!skillsBySkillId.has(relation.skillId)) continue;
    if (mappedSkillIds.has(relation.skillId)) continue;
    for (const subId of relation.relatedSubattributeIds) {
      const list = relationsBySubId.get(subId) ?? [];
      list.push(relation.skillName);
      relationsBySubId.set(subId, list);
    }
  }

  const unmappedSkills: AttributeEngineRunResult['unmappedSkills'] = [];
  for (const skill of skillsBySkillId.values()) {
    if (mappedSkillIds.has(skill.skillId)) continue;
    const declared = (catalog.unmappedRelations ?? []).find(
      (r) => r.skillId === skill.skillId,
    );
    unmappedSkills.push({
      skillId: skill.skillId,
      extractionSkillId: skill.extractionSkillId,
      normalizedName: skill.normalizedName,
      evidenceLevel: skill.evidenceLevel,
      evidenceStrength: skill.evidenceStrength,
      reason:
        declared?.reason ??
        'La skill no tiene mapping activo hacia ningún subatributo en esta versión del catálogo.',
    });
    warnings.push(
      `UNMAPPED_SKILL: ${skill.normalizedName} (skillId=${skill.skillId}) sin mapping activo; no genera contribución.`,
    );
  }

  const subResults: SubattributeResult[] = [];
  for (const sub of activeSubs) {
    const macro = macroById.get(sub.macroattributeId);
    if (!macro) continue;

    const mapped = (mappingsBySub.get(sub.id) ?? [])
      .map((mapping) => {
        const skill = skillsBySkillId.get(mapping.skillId);
        return skill ? { mapping, skill } : null;
      })
      .filter((v): v is { mapping: AttributeMapping; skill: AttributeSkillInput } => v !== null);

    subResults.push(
      scoreSubattribute(
        {
          sub,
          macroattributeId: macro.id,
          macroattributeCode: macro.code,
          mapped,
          unmappedRelatedSkillNames: (relationsBySubId.get(sub.id) ?? []).sort(),
        },
        config,
      ),
    );
  }

  const macroResults: MacroattributeResult[] = activeMacros.map((macro) =>
    scoreMacroattribute(
      macro,
      subResults.filter((s) => s.macroattributeId === macro.id),
      config,
    ),
  );

  const contributingSkillIds = new Set<string>();
  let tracesCount = 0;
  for (const sub of subResults) {
    tracesCount += sub.traces.length;
    for (const trace of sub.traces) {
      if (trace.rawContribution > 0) contributingSkillIds.add(trace.skillId);
    }
  }

  const ignoredNone = [...skillsBySkillId.values()].filter(
    (s) => s.evidenceLevel === 'NONE' && mappedSkillIds.has(s.skillId),
  ).length;

  const subsWithSupport = subResults.filter((s) => s.score > 0).length;
  const macrosWithSupport = macroResults.filter((m) => m.score > 0).length;

  const metrics: AttributeEngineRunResult['metrics'] = {
    inputSkills: skillsBySkillId.size,
    mappedSkills: mappedSkillIds.size,
    unmappedSkills: unmappedSkills.length,
    contributingSkills: contributingSkillIds.size,
    ignoredNoneSkills: ignoredNone,
    subattributesTotal: subResults.length,
    subattributesWithSupport: subsWithSupport,
    macroattributesTotal: macroResults.length,
    macroattributesWithSupport: macrosWithSupport,
    tracesCount,
    warningsCount: warnings.length,
    averageSubattributeScore: average(subResults.map((s) => s.score)),
    averageMacroattributeScore: average(macroResults.map((m) => m.score)),
  };

  return {
    subattributes: subResults,
    macroattributes: macroResults,
    unmappedSkills,
    metrics,
    warnings,
  };
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(round4(values.reduce((a, b) => a + b, 0) / values.length));
}
