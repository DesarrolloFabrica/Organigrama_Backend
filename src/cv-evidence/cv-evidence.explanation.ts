import type {
  EvidenceLevel,
  EvidenceQualityFlag,
} from './cv-evidence.types';

export function buildEvidenceExplanation(params: {
  level: EvidenceLevel;
  flags: EvidenceQualityFlag[];
  evidenceCount: number;
  uniqueEvidenceCount: number;
  appliedEvidenceCount: number;
  substantiveEvidenceCount: number;
  ambiguousEvidenceCount: number;
  sourceDiversity: number;
  evidenceStrength: number;
  rulesProfile?: 'er1' | 'er2';
  noneReason?: string;
}): string {
  const {
    level,
    flags,
    evidenceCount,
    uniqueEvidenceCount,
    appliedEvidenceCount,
    substantiveEvidenceCount,
    ambiguousEvidenceCount,
    sourceDiversity,
    evidenceStrength,
    rulesProfile = 'er2',
    noneReason,
  } = params;

  const facts: string[] = [];
  facts.push(
    `Se observaron ${evidenceCount} evidencia(s) persistida(s) (${uniqueEvidenceCount} única(s))`,
  );
  facts.push(`diversidad de fuentes=${sourceDiversity}`);
  facts.push(`evidencia aplicada=${appliedEvidenceCount}`);
  facts.push(`sustantiva=${substantiveEvidenceCount}`);
  facts.push(`ambigua=${ambiguousEvidenceCount}`);
  facts.push(`strength=${evidenceStrength}`);
  if (noneReason) facts.push(`noneReason=${noneReason}`);

  let template: string;

  if (level === 'NONE' && flags.includes('NO_EVIDENCE')) {
    template = 'No se encontró evidencia estructurada para esta skill.';
  } else if (
    level === 'NONE' &&
    (flags.includes('ONLY_AMBIGUOUS_EVIDENCE') ||
      flags.includes('AMBIGUOUS_EVIDENCE'))
  ) {
    template =
      'Se encontraron menciones de la skill, pero no contienen contexto suficiente ' +
      'para considerarlas evidencia profesional sustantiva.';
  } else if (level === 'NONE') {
    template =
      'La evaluación determinista no encontró respaldo sustantivo suficiente (strength=0).';
  } else if (
    level === 'WEAK' &&
    (flags.includes('ONLY_SKILLS_SECTION') ||
      flags.includes('ONLY_LISTING_EVIDENCE'))
  ) {
    template =
      rulesProfile === 'er2'
        ? 'La evidencia se limita a una mención explícita en una lista de habilidades o ' +
          'herramientas, sin aplicación profesional identificada.'
        : 'La evidencia se limita a una mención en la sección de habilidades, sin experiencia aplicada identificada.';
  } else if (
    level === 'WEAK' &&
    flags.includes('ONLY_PROFILE_SUMMARY') &&
    flags.includes('HAS_SUBSTANTIVE_EVIDENCE')
  ) {
    template =
      'La skill aparece descrita en el resumen profesional con contexto limitado, ' +
      'sin evidencia aplicada adicional.';
  } else if (
    level === 'WEAK' &&
    flags.includes('ONLY_PROFILE_SUMMARY')
  ) {
    template =
      'La skill aparece en el resumen profesional, pero no cuenta con evidencia aplicada adicional.';
  } else if (
    level === 'WEAK' &&
    flags.includes('NAME_ONLY_EVIDENCE')
  ) {
    template =
      'La evidencia es mínima y coincide con el nombre de la skill, sin respaldo contextual adicional.';
  } else if (level === 'WEAK') {
    template =
      `La skill tiene evidencia limitada y un respaldo débil según las reglas ${rulesProfile}.`;
  } else if (level === 'MODERATE') {
    template =
      rulesProfile === 'er2'
        ? 'La skill cuenta con evidencia sustantiva y respaldo en más de una sección, ' +
          'aunque la evidencia aplicada es limitada.'
        : 'La skill tiene evidencia en varias secciones, aunque el respaldo aplicado es limitado.';
  } else {
    template =
      rulesProfile === 'er2'
        ? 'La skill cuenta con evidencia profesional aplicada y respaldo consistente en ' +
          'múltiples secciones.'
        : 'La skill cuenta con evidencia aplicada y respaldo en múltiples secciones del CV.';
  }

  return `${template} [${facts.join('; ')}. flags=${flags.join(',')}]`;
}
