/**
 * Política de catálogo del importer (Fase 2).
 * Más estricta que el dry-run de validación Fase 1 para especialidades PROPOSED.
 */

import type { CuratedProfileValidationReport } from './curated-profile.types';
import type { CuratedSkillImportPlanItem } from './curated-profile.extract-builder';
import type { CuratedProfileDocument } from './curated-profile.schema';
import type { CuratedIssue } from './curated-profile.types';

function findSkillResolution(
  report: CuratedProfileValidationReport,
  specialtyCode: string,
  canonicalName: string,
) {
  const all = [
    ...report.skills.existing,
    ...report.skills.resolvedAliases,
    ...report.skills.proposed,
    ...report.skills.ambiguous,
    ...report.skills.invalid,
  ];
  return all.find(
    (s) =>
      s.specialtyCode === specialtyCode &&
      s.inputCanonicalName === canonicalName,
  );
}

/**
 * Construye plan de skills + errores bloqueantes de política de import.
 */
export function buildCuratedImportSkillPlan(params: {
  document: CuratedProfileDocument;
  validation: CuratedProfileValidationReport;
}): {
  skillPlans: CuratedSkillImportPlanItem[];
  errors: CuratedIssue[];
  warnings: CuratedIssue[];
} {
  const errors: CuratedIssue[] = [...params.validation.errors];
  const warnings: CuratedIssue[] = [...params.validation.warnings];
  const skillPlans: CuratedSkillImportPlanItem[] = [];

  if (params.validation.domain?.status === 'PROPOSED') {
    errors.push({
      code: 'IMPORT_DOMAIN_PROPOSED',
      severity: 'error',
      path: '$.domain.code',
      message: 'Dominio PROPOSED: el importer no crea dominios.',
    });
  }
  if (
    params.validation.domain &&
    (params.validation.domain.status === 'INVALID' ||
      params.validation.domain.status === 'AMBIGUOUS')
  ) {
    errors.push({
      code: 'IMPORT_DOMAIN_INVALID',
      severity: 'error',
      path: '$.domain.code',
      message: `Dominio ${params.validation.domain.status}: import bloqueado.`,
    });
  }

  for (const specialty of params.validation.specialties) {
    if (specialty.status === 'PROPOSED') {
      errors.push({
        code: 'IMPORT_SPECIALTY_PROPOSED',
        severity: 'error',
        path: `specialty:${specialty.inputCode}`,
        message: `Especialidad PROPOSED "${specialty.inputCode}": el importer no crea especialidades.`,
      });
    }
    if (specialty.status === 'INVALID' || specialty.status === 'AMBIGUOUS') {
      errors.push({
        code: 'IMPORT_SPECIALTY_INVALID',
        severity: 'error',
        path: `specialty:${specialty.inputCode}`,
        message: `Especialidad ${specialty.status} "${specialty.inputCode}".`,
      });
    }
  }

  params.document.specialties.forEach((specialty, si) => {
    specialty.skills.forEach((skill, ski) => {
      const path = `$.specialties[${si}].skills[${ski}]`;
      const resolution = findSkillResolution(
        params.validation,
        specialty.code,
        skill.canonicalName,
      );
      if (!resolution) {
        errors.push({
          code: 'IMPORT_SKILL_RESOLUTION_MISSING',
          severity: 'error',
          path,
          message: `Sin resolución de catálogo para "${skill.canonicalName}".`,
        });
        return;
      }

      const decision = skill.reviewDecision ?? 'REUSE_EXISTING';

      if (resolution.status === 'AMBIGUOUS' || resolution.status === 'INVALID') {
        errors.push({
          code: 'IMPORT_SKILL_BLOCKED',
          severity: 'error',
          path,
          message: `Skill ${resolution.status}: "${skill.canonicalName}".`,
        });
        skillPlans.push({
          specialtyCode: specialty.code,
          skill,
          resolution,
          action: 'OMIT',
          omitReason: resolution.status,
        });
        return;
      }

      if (decision === 'REJECTED' || decision === 'OMIT') {
        warnings.push({
          code: 'IMPORT_SKILL_OMITTED',
          severity: 'warning',
          path,
          message: `Skill omitida por reviewDecision=${decision}.`,
        });
        skillPlans.push({
          specialtyCode: specialty.code,
          skill,
          resolution,
          action: 'OMIT',
          omitReason: decision,
        });
        return;
      }

      if (resolution.status === 'PROPOSED') {
        if (decision === 'APPROVED_FOR_CREATION') {
          skillPlans.push({
            specialtyCode: specialty.code,
            skill,
            resolution,
            action: 'CREATE_THEN_INCLUDE',
          });
          return;
        }
        warnings.push({
          code: 'IMPORT_SKILL_PROPOSED_OMITTED',
          severity: 'warning',
          path,
          message: `Skill PROPOSED sin APPROVED_FOR_CREATION; se omite: "${skill.canonicalName}".`,
        });
        skillPlans.push({
          specialtyCode: specialty.code,
          skill,
          resolution,
          action: 'OMIT',
          omitReason: 'PROPOSED_WITHOUT_APPROVAL',
        });
        return;
      }

      // EXISTING / ALIAS
      if (decision === 'APPROVED_FOR_CREATION') {
        warnings.push({
          code: 'IMPORT_SKILL_ALREADY_EXISTS',
          severity: 'warning',
          path,
          message: `reviewDecision=APPROVED_FOR_CREATION pero skill ya existe; se reutiliza.`,
        });
      }
      skillPlans.push({
        specialtyCode: specialty.code,
        skill,
        resolution,
        action: 'INCLUDE',
      });
    });
  });

  const included = skillPlans.filter((p) => p.action !== 'OMIT');
  if (included.length === 0) {
    errors.push({
      code: 'IMPORT_NO_SKILLS',
      severity: 'error',
      path: '$.specialties',
      message: 'Ninguna skill quedaría incluida tras la política de import.',
    });
  }

  return { skillPlans, errors, warnings };
}
