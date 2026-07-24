import type {
  AttributeSupportLevel,
  MacroattributeQualityFlag,
  SubattributeQualityFlag,
} from './cv-attributes.types';

/**
 * Plantillas deterministas. Describen respaldo de evidencia; nunca afirman
 * dominio, experticia, competencia ni nivel profesional certificado.
 */

export interface SubattributeExplanationInput {
  level: AttributeSupportLevel;
  contributingSkillsCount: number;
  topSkillNames: string[];
  flags: SubattributeQualityFlag[];
}

export function buildSubattributeExplanation(
  input: SubattributeExplanationInput,
): string {
  const { level, contributingSkillsCount: n, topSkillNames, flags } = input;

  if (level === 'NO_SUPPORT') {
    if (flags.includes('NO_MAPPED_SKILLS')) {
      return (
        'No hay skills del perfil asociadas a este subatributo en la versión ' +
        'vigente del catálogo.'
      );
    }
    return (
      'No se identificaron skills con evidencia suficiente asociadas a este ' +
      'subatributo.'
    );
  }

  const skills = formatSkillList(topSkillNames);

  if (level === 'LIMITED') {
    if (flags.includes('CONTEXTUAL_MAPPING_ONLY')) {
      return (
        'El subatributo presenta respaldo limitado y solo por asociación ' +
        `contextual de ${skills}.`
      );
    }
    return `El subatributo presenta respaldo limitado, sustentado principalmente por ${skills}.`;
  }

  if (level === 'DEVELOPING') {
    return (
      `El subatributo cuenta con respaldo parcial mediante ${n} ` +
      `${n === 1 ? 'skill' : 'skills'}, con evidencia principal en ${skills}.`
    );
  }

  if (level === 'ESTABLISHED') {
    return (
      'El subatributo muestra respaldo consistente en varias skills con ' +
      `evidencia moderada o fuerte, principalmente ${skills}.`
    );
  }

  return (
    'El subatributo está respaldado por múltiples skills con evidencia fuerte y ' +
    `diversa, principalmente ${skills}.`
  );
}

export interface MacroattributeExplanationInput {
  level: AttributeSupportLevel;
  supportedSubattributesCount: number;
  totalSubattributesCount: number;
  topSubattributeNames: string[];
  flags: MacroattributeQualityFlag[];
}

export function buildMacroattributeExplanation(
  input: MacroattributeExplanationInput,
): string {
  const {
    level,
    supportedSubattributesCount: supported,
    totalSubattributesCount: total,
    topSubattributeNames,
    flags,
  } = input;

  if (level === 'NO_SUPPORT') {
    return (
      'No se identificaron subatributos con respaldo de evidencia dentro de ' +
      'este macroatributo.'
    );
  }

  const subs = formatSkillList(topSubattributeNames);
  const coverageNote = `Respaldo observado en ${supported} de ${total} subatributos del macroatributo.`;

  if (flags.includes('SINGLE_SUBATTRIBUTE_SUPPORT')) {
    return (
      `El respaldo del macroatributo proviene de un solo subatributo (${subs}). ` +
      coverageNote
    );
  }

  if (level === 'LIMITED') {
    return `El macroatributo presenta respaldo limitado, concentrado en ${subs}. ${coverageNote}`;
  }
  if (level === 'DEVELOPING') {
    return `El macroatributo cuenta con respaldo parcial, con mayor evidencia en ${subs}. ${coverageNote}`;
  }
  if (level === 'ESTABLISHED') {
    return `El macroatributo muestra respaldo consistente en varios subatributos, principalmente ${subs}. ${coverageNote}`;
  }
  return `El macroatributo está respaldado de forma amplia y consistente, principalmente en ${subs}. ${coverageNote}`;
}

function formatSkillList(names: string[]): string {
  const list = names.filter((n) => n && n.trim().length > 0);
  if (list.length === 0) return 'las skills asociadas';
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} y ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
}
