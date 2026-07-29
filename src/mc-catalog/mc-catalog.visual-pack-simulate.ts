/**
 * Simulación in-memory de PA2 Visual con un pack concreto (sin I/O DB de mappings).
 * Usado por MC1.11.0 --simulate-pack y tests de consolidación.
 */

import { MC_VISUAL_DESIGN_SPECIALTY_CODES } from './mc-catalog.definition-mc12';
import type { McDomainMappingPack } from './mc-catalog.types';
import {
  getMcPa2EngineConfigVisualDesignV110,
  type McPa2EngineConfig,
} from './mc-pa2.config';
import { runMcPa2Engine } from './mc-pa2.engine';
import {
  classifyDomainConceptually,
  type McDomainQualification,
} from './mc-domain-qualification';
import type {
  McPa2EngineRunResult,
  McPa2MappingInput,
  McPa2SkillEvidenceInput,
  McPa2SpecialtyInput,
  McEvidenceLevel,
} from './mc-pa2.types';

export type VisualPackSimulationSkill = {
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: string;
  evidenceLevel: string;
  evidenceStrength: number;
  evidenceConfidence: number;
};

export type VisualPackSimulationOutcome = {
  packVersion: string;
  result: McPa2EngineRunResult;
  conceptualClass: McDomainQualification;
  mappedSkillKeys: string[];
  unmappedDomainSpecialtyKeys: string[];
};

export function buildVisualSpecialtyInputs(): McPa2SpecialtyInput[] {
  return MC_VISUAL_DESIGN_SPECIALTY_CODES.map((code, i) => ({
    specialtyId: String(i + 1),
    specialtyCode: code,
    specialtyName: code,
    lifecycleStatus: 'ACTIVE' as const,
    sortOrder: i + 1,
  }));
}

/**
 * Ejecuta PA2 Visual con mappings del pack resueltos contra skills del perfil.
 * Skills del pack sin presencia en el perfil se omiten (no inventa evidencia).
 */
export function simulateVisualPa2WithPack(params: {
  pack: McDomainMappingPack;
  packVersion: string;
  skills: VisualPackSimulationSkill[];
  config?: McPa2EngineConfig;
}): VisualPackSimulationOutcome {
  const specialties = buildVisualSpecialtyInputs();
  const codeToId = Object.fromEntries(
    specialties.map((s) => [s.specialtyCode, s.specialtyId]),
  );
  const skillByKey = new Map(
    params.skills.map((s) => [`${s.skillKey}|${s.skillType}`, s]),
  );

  const mappings: McPa2MappingInput[] = [];
  const mappedSkillKeys: string[] = [];
  for (const m of params.pack.mappings) {
    const hit = skillByKey.get(`${m.skillKey}|${m.skillType}`);
    if (!hit) continue;
    mappings.push({
      skillId: hit.skillId,
      specialtyCode: m.specialtyCode,
      specialtyId: codeToId[m.specialtyCode],
      weight: m.weight,
      mappingType: m.mappingType,
      rationale: m.rationale,
    });
    if (!mappedSkillKeys.includes(m.skillKey)) {
      mappedSkillKeys.push(m.skillKey);
    }
  }

  const domainSpecialtyKeys = params.pack.classifications
    .filter((c) => c.classification === 'DOMAIN_SPECIALTY')
    .map((c) => c.skillKey);
  const unmappedDomainSpecialtyKeys = domainSpecialtyKeys.filter((k) => {
    const cls = params.pack.classifications.find(
      (c) => c.skillKey === k && c.classification === 'DOMAIN_SPECIALTY',
    );
    if (!cls) return false;
    const inProfile = skillByKey.has(`${k}|${cls.skillType}`);
    if (!inProfile) return false;
    return !mappedSkillKeys.includes(k);
  });

  const skillInputs: McPa2SkillEvidenceInput[] = params.skills.map((s) => ({
    skillId: s.skillId,
    skillKey: s.skillKey,
    skillName: s.skillName,
    skillType: s.skillType,
    evidenceLevel: s.evidenceLevel as McEvidenceLevel,
    evidenceStrength: s.evidenceStrength,
    evidenceConfidence: s.evidenceConfidence,
  }));

  const result = runMcPa2Engine({
    domainCode: 'VISUAL_DESIGN',
    specialties,
    mappings,
    skills: skillInputs,
    config: params.config ?? getMcPa2EngineConfigVisualDesignV110(),
  });

  return {
    packVersion: params.packVersion,
    result,
    conceptualClass: classifyDomainConceptually(result, 'MEDIUM'),
    mappedSkillKeys,
    unmappedDomainSpecialtyKeys,
  };
}
