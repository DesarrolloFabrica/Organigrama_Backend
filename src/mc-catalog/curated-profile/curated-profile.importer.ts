/**
 * Importer controlado de un perfil curado (Fase 2).
 *
 * Orden adaptado a unique is_active:
 * 1) crear skills/mappings aprobados
 * 2) persistSucceededExtraction (activa nueva, desactiva previa)
 * 3) enrichment sintético + activate
 * 4) evidence persist + activate
 * 5) PA2 persist
 * 6) validar dominio/especialidades; si falla → rollback compensatorio
 *
 * No llama Gemini. Compensating rollback si falla post-escritura.
 */

import { createHash } from 'node:crypto';
import type { DataSource } from 'typeorm';
import { CvSkillsPersistenceService } from '../../cv-skills/cv-skills-persistence.service';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import { CvEvidencePersistenceService } from '../../cv-evidence/cv-evidence-persistence.service';
import { McPa2Service } from '../mc-pa2.service';
import {
  CURATED_EXTRACTION_MAPPING,
  CURATED_SYNTHETIC_DRIVE,
} from './curated-profile.constants';
import { createCuratedCatalogLookup } from './curated-profile.catalog-lookup';
import { validateCuratedProfile } from './curated-profile.validate';
import { buildCuratedImportSkillPlan } from './curated-profile.import-policy';
import { computeCuratedContentFingerprint } from './curated-profile.fingerprint';
import { buildExtractedCvSkillsFromCurated } from './curated-profile.extract-builder';
import { persistSyntheticEnrichment } from './curated-profile.enrichment-builder';
import {
  activateSucceededExtraction,
  deactivateExtraction,
  deactivateProfileEvaluationsForExtraction,
  ensureCvSkill,
  ensureDomainSpecialtyClassification,
  ensureSpecialtyMapping,
  findActiveExtractionId,
  readExtractionMeta,
} from './curated-profile.activation';
import { maskDocument, toCanonicalKey } from './curated-profile.normalize';
import { validateCuratedProfileStructure } from './curated-profile.validate-structure';
import type { CuratedImportPlanReport } from './curated-profile.import.types';
import type { CuratedProfileDocument } from './curated-profile.schema';
import { resolveOperativeRulesVersion } from '../mc-operative-domains';
import { classifyDomainConceptually } from '../mc-domain-qualification';

export interface CuratedImportDeps {
  dataSource: DataSource;
  extractionPersistence: CvSkillsPersistenceService;
  enrichmentPersistence: CvSkillsEnrichmentPersistenceService;
  evidencePersistence: CvEvidencePersistenceService;
  pa2: McPa2Service;
}

export interface CuratedImportOptions {
  documentOverride?: string;
  execute?: boolean;
  allowReactivateIdentical?: boolean;
  verify?: boolean;
}

function emptyReport(
  mode: 'DRY_RUN' | 'EXECUTE',
  documentMasked: string,
): CuratedImportPlanReport {
  return {
    mode,
    outcome: 'BLOCKED',
    person: {
      personId: null,
      documentMasked,
      personCvId: null,
    },
    contentFingerprint: null,
    currentActiveExtractionId: null,
    plannedExtraction: {
      model: CURATED_EXTRACTION_MAPPING.model,
      promptVersion: CURATED_EXTRACTION_MAPPING.promptVersion,
      extractorVersion: CURATED_EXTRACTION_MAPPING.extractorVersion,
      pdfSha256: null,
      previousExtractionId: null,
    },
    domain: { declared: null, validatedStatus: null },
    specialties: [],
    skills: {
      existing: [],
      aliases: [],
      approvedForCreation: [],
      omitted: [],
      mappingsToCreate: [],
    },
    skillPlans: [],
    evidenceCount: 0,
    pa2: { domainCode: null, planned: false },
    risks: [],
    errors: [],
    warnings: [],
  };
}

async function findIdenticalSucceeded(params: {
  dataSource: DataSource;
  personId: string;
  fingerprint: string;
}): Promise<{ id: string; isActive: boolean } | null> {
  const rows = (await params.dataSource.query(
    `SELECT id::text AS id, is_active AS "isActive"
     FROM organigrama.cv_extraction
     WHERE person_id = $1::bigint
       AND status = 'SUCCEEDED'
       AND model = $2
       AND prompt_version = $3
       AND extractor_version = $4
       AND pdf_sha256 = $5
     ORDER BY id DESC
     LIMIT 1`,
    [
      params.personId,
      CURATED_EXTRACTION_MAPPING.model,
      CURATED_EXTRACTION_MAPPING.promptVersion,
      CURATED_EXTRACTION_MAPPING.extractorVersion,
      params.fingerprint,
    ],
  )) as Array<{ id: string; isActive: boolean }>;
  return rows[0] ?? null;
}

async function createApprovedSkillsAndMappings(params: {
  dataSource: DataSource;
  document: CuratedProfileDocument;
  report: CuratedImportPlanReport;
  catalogVersionId: string;
}): Promise<void> {
  const qr = params.dataSource.createQueryRunner();
  await qr.connect();
  await qr.startTransaction();
  try {
    const manager = qr.manager;
    const domainRow = (await manager.query(
      `SELECT d.id::text AS id
       FROM organigrama.mc_domain d
       JOIN organigrama.mc_catalog_version cv ON cv.id = d.catalog_version_id
       WHERE cv.is_active = TRUE AND d.code = $1
       LIMIT 1`,
      [params.document.domain.code],
    )) as Array<{ id: string }>;
    if (!domainRow[0]) {
      throw new Error(`Dominio ${params.document.domain.code} no encontrado.`);
    }

    for (const plan of params.report.skillPlans) {
      if (plan.action === 'OMIT') continue;
      const specialty = params.report.specialties.find(
        (s) => s.code === plan.specialtyCode,
      );
      const specialtyRow = (await manager.query(
        `SELECT s.id::text AS id
         FROM organigrama.mc_specialty s
         JOIN organigrama.mc_catalog_version cv ON cv.id = s.catalog_version_id
         WHERE cv.is_active = TRUE AND s.code = $1
         LIMIT 1`,
        [plan.specialtyCode],
      )) as Array<{ id: string }>;
      if (!specialtyRow[0]) {
        throw new Error(`Especialidad ${plan.specialtyCode} no encontrada.`);
      }

      let skillId = plan.resolution.matchedSkillId;
      if (plan.action === 'CREATE_THEN_INCLUDE') {
        const name =
          plan.skill.displayName?.trim() || plan.skill.canonicalName.trim();
        const key = toCanonicalKey(name);
        const ensured = await ensureCvSkill({
          manager,
          normalizedName: name,
          normalizedKey: key,
          skillType: plan.skill.skillType!,
        });
        skillId = ensured.skillId;
        plan.resolution.matchedSkillId = skillId;
        plan.resolution.matchedNormalizedName = name;
        plan.resolution.status = 'EXISTING';
      }

      if (!skillId) {
        throw new Error(`Skill sin id resuelto: ${plan.skill.canonicalName}`);
      }

      await ensureDomainSpecialtyClassification({
        manager,
        catalogVersionId: params.catalogVersionId,
        domainId: domainRow[0].id,
        skillId,
        rationale: `manual-curated import domain=${params.document.domain.code}`,
      });

      const mapResult = await ensureSpecialtyMapping({
        manager,
        catalogVersionId: params.catalogVersionId,
        skillId,
        specialtyId: specialtyRow[0].id,
        rationale: `manual-curated import specialty=${plan.specialtyCode}`,
      });
      if (mapResult === 'CREATED') {
        params.report.skills.mappingsToCreate.push({
          skill: plan.skill.canonicalName,
          specialty: plan.specialtyCode,
          reason: plan.action === 'CREATE_THEN_INCLUDE' ? 'NEW_SKILL' : 'MISSING_MAPPING',
        });
      }
      void specialty;
    }
    await qr.commitTransaction();
  } catch (e) {
    await qr.rollbackTransaction();
    throw e;
  } finally {
    await qr.release();
  }
}

async function compensatingRollback(params: {
  dataSource: DataSource;
  personId: string;
  newExtractionId: string | null;
  previousExtractionId: string | null;
}): Promise<void> {
  if (params.newExtractionId) {
    await deactivateProfileEvaluationsForExtraction(
      params.dataSource,
      params.newExtractionId,
    );
    await deactivateExtraction(params.dataSource, params.newExtractionId);
  }
  if (params.previousExtractionId) {
    await activateSucceededExtraction({
      dataSource: params.dataSource,
      personId: params.personId,
      extractionId: params.previousExtractionId,
    });
  }
}

async function verifyPostImport(params: {
  dataSource: DataSource;
  personId: string;
  extractionId: string;
  domainCode: string;
}): Promise<{ ok: boolean; specialtyCodes: string[]; messages: string[] }> {
  const messages: string[] = [];
  const active = await findActiveExtractionId(
    params.dataSource,
    params.personId,
  );
  if (active !== params.extractionId) {
    messages.push(
      `Extracción activa esperada ${params.extractionId}, actual=${active}`,
    );
  }
  const evals = (await params.dataSource.query(
    `SELECT pe.id::text AS id, pe.domain_code AS "domainCode",
            pe.is_active AS "isActive", pe.status
     FROM organigrama.mc_profile_evaluation pe
     WHERE pe.extraction_id = $1::bigint
       AND pe.domain_code = $2
       AND pe.status = 'SUCCEEDED'
     ORDER BY pe.is_active DESC, pe.id DESC
     LIMIT 1`,
    [params.extractionId, params.domainCode],
  )) as Array<{
    id: string;
    domainCode: string;
    isActive: boolean;
    status: string;
  }>;
  if (!evals[0]) {
    messages.push('Sin evaluación PA2 SUCCEEDED para el dominio declarado.');
  } else if (!evals[0].isActive) {
    messages.push('Evaluación PA2 existe pero no está activa.');
  }

  const specialties = (await params.dataSource.query(
    `SELECT s.code
     FROM organigrama.mc_profile_specialty_result psr
     JOIN organigrama.mc_specialty s ON s.id = psr.specialty_id
     WHERE psr.profile_evaluation_id = $1::bigint
       AND psr.presentation_status IN ('ACTIVE', 'EMERGENT')
     ORDER BY psr.rank ASC`,
    [evals[0]?.id ?? '0'],
  )) as Array<{ code: string }>;

  return {
    ok: messages.length === 0,
    specialtyCodes: specialties.map((s) => s.code),
    messages,
  };
}

/**
 * Planifica (dry-run) o ejecuta la importación de una sola persona.
 */
export async function importCuratedProfile(
  input: unknown,
  deps: CuratedImportDeps,
  options: CuratedImportOptions = {},
): Promise<CuratedImportPlanReport> {
  const mode = options.execute ? 'EXECUTE' : 'DRY_RUN';
  const lookup = createCuratedCatalogLookup(deps.dataSource);
  const validation = await validateCuratedProfile(input, lookup, {
    documentOverride: options.documentOverride,
  });

  const report = emptyReport(mode, validation.person.documentMasked);
  report.errors = [...validation.errors];
  report.warnings = [...validation.warnings];
  report.person.personId = validation.person.personId;
  report.person.personCvId = validation.person.personCvId;
  report.domain.declared = validation.domain?.inputCode ?? null;
  report.domain.validatedStatus = validation.domain?.status ?? null;
  report.specialties = validation.specialties.map((s) => ({
    code: s.inputCode,
    status: s.status,
  }));
  report.pa2.domainCode = validation.domain?.inputCode ?? null;

  if (!validation.person.found || !validation.person.personId) {
    report.outcome = 'BLOCKED';
    return report;
  }

  // Reparse structure for document (validation already ran)
  const structure = validateCuratedProfileStructure(input);
  if (!structure.ok || !structure.document) {
    report.outcome = 'BLOCKED';
    return report;
  }
  const document: CuratedProfileDocument = {
    ...structure.document,
    person: {
      document: (
        options.documentOverride ?? structure.document.person.document
      ).trim(),
    },
  };

  const policy = buildCuratedImportSkillPlan({ document, validation });
  report.errors = policy.errors;
  report.warnings = policy.warnings;
  report.skillPlans = policy.skillPlans;

  report.skills.existing = policy.skillPlans
    .filter(
      (p) =>
        p.action === 'INCLUDE' && p.resolution.status === 'EXISTING',
    )
    .map((p) => p.skill.canonicalName);
  report.skills.aliases = policy.skillPlans
    .filter(
      (p) => p.action === 'INCLUDE' && p.resolution.status === 'ALIAS',
    )
    .map((p) => p.skill.canonicalName);
  report.skills.approvedForCreation = policy.skillPlans
    .filter((p) => p.action === 'CREATE_THEN_INCLUDE')
    .map((p) => p.skill.canonicalName);
  report.skills.omitted = policy.skillPlans
    .filter((p) => p.action === 'OMIT')
    .map((p) => p.skill.canonicalName);
  report.evidenceCount = policy.skillPlans
    .filter((p) => p.action !== 'OMIT')
    .reduce((acc, p) => acc + p.skill.evidence.length, 0);

  for (const plan of policy.skillPlans) {
    if (plan.action === 'OMIT') continue;
    if (
      plan.resolution.hasMappingToSpecialty === false ||
      plan.action === 'CREATE_THEN_INCLUDE'
    ) {
      report.skills.mappingsToCreate.push({
        skill: plan.skill.canonicalName,
        specialty: plan.specialtyCode,
        reason:
          plan.action === 'CREATE_THEN_INCLUDE'
            ? 'NEW_SKILL'
            : 'MISSING_MAPPING',
      });
    }
  }

  if (policy.errors.some((e) => e.severity === 'error')) {
    report.outcome = 'BLOCKED';
    return report;
  }

  const personId = validation.person.personId!;
  const personCvId = validation.person.personCvId!;
  const fingerprint = computeCuratedContentFingerprint({
    document,
    personId,
    personCvId,
  });
  report.contentFingerprint = fingerprint;
  report.plannedExtraction.pdfSha256 = fingerprint;

  const currentActive = await findActiveExtractionId(deps.dataSource, personId);
  report.currentActiveExtractionId = currentActive;
  report.plannedExtraction.previousExtractionId = currentActive;

  const identical = await findIdenticalSucceeded({
    dataSource: deps.dataSource,
    personId,
    fingerprint,
  });

  if (identical?.isActive) {
    report.outcome = 'NO_OP';
    report.risks.push(
      'Extracción manual idéntica ya activa (misma firma); no se escribirá.',
    );
    return report;
  }

  if (identical && !identical.isActive) {
    if (!options.allowReactivateIdentical) {
      report.outcome = 'BLOCKED';
      report.errors.push({
        code: 'IDENTICAL_INACTIVE',
        severity: 'error',
        path: '$',
        message: `Existe extracción SUCCEEDED inactiva id=${identical.id} con la misma firma. Use --allow-reactivate-identical para reactivarla.`,
      });
      return report;
    }
  }

  report.pa2.planned = true;
  report.risks.push(
    'Al ejecutar se desactivará la extracción activa previa (historial conservado).',
  );
  if (report.skills.approvedForCreation.length) {
    report.risks.push(
      `Se crearán ${report.skills.approvedForCreation.length} skill(s) nuevas en catálogo compartido.`,
    );
  }

  report.outcome = 'READY';
  if (!options.execute) {
    return report;
  }

  // ── EXECUTE ──────────────────────────────────────────────────────────
  let newExtractionId: string | null = null;
  const previousExtractionId = currentActive;

  try {
    if (identical && !identical.isActive && options.allowReactivateIdentical) {
      await activateSucceededExtraction({
        dataSource: deps.dataSource,
        personId,
        extractionId: identical.id,
      });
      newExtractionId = identical.id;
    } else {
      await createApprovedSkillsAndMappings({
        dataSource: deps.dataSource,
        document,
        report,
        catalogVersionId: validation.domain!.catalogVersionId!,
      });

      const extracted = buildExtractedCvSkillsFromCurated({
        document,
        skillPlans: report.skillPlans,
        contentFingerprint: fingerprint,
      });

      // Patch raw_result via warnings; persistSucceededExtraction builds raw_result.
      // We store fingerprint in pdf_sha256; also append previousExtractionId to warnings.
      extracted.warnings.push(
        `previousExtractionId=${previousExtractionId ?? 'none'}`,
      );

      const driveFileId = `${CURATED_SYNTHETIC_DRIVE.fileIdPrefix}${fingerprint.slice(0, 40)}`;
      const driveFileName = `${document.person.document}${CURATED_SYNTHETIC_DRIVE.fileNameSuffix}`;
      // pdf_byte_size > 0 required; use deterministic non-zero from fingerprint
      const pdfByteSize =
        (parseInt(fingerprint.slice(0, 8), 16) % 900_000) + 1000;

      const persistResult =
        await deps.extractionPersistence.persistSucceededExtraction({
          personId: Number(personId),
          personCvId: Number(personCvId),
          document: document.person.document,
          driveFileId,
          driveFileName,
          pdfSha256: fingerprint,
          pdfByteSize,
          model: CURATED_EXTRACTION_MAPPING.model,
          promptVersion: CURATED_EXTRACTION_MAPPING.promptVersion,
          extractorVersion: CURATED_EXTRACTION_MAPPING.extractorVersion,
          result: extracted,
        });

      newExtractionId = persistResult.extraction.id;

      // Stamp curated meta into raw_result (best-effort update)
      await deps.dataSource.query(
        `UPDATE organigrama.cv_extraction
         SET raw_result = COALESCE(raw_result, '{}'::jsonb) || $2::jsonb,
             updated_at = NOW()
         WHERE id = $1::bigint`,
        [
          newExtractionId,
          JSON.stringify({
            curatedImport: {
              source: 'MANUAL_CURATED',
              schemaVersion: document.schemaVersion,
              contentFingerprint: fingerprint,
              previousExtractionId,
              method: document.source.method,
            },
          }),
        ],
      );
    }

    const enrich = await persistSyntheticEnrichment({
      enrichmentPersistence: deps.enrichmentPersistence,
      dataSource: deps.dataSource,
      extractionId: newExtractionId!,
      personId,
      personCvId,
      pdfSha256: fingerprint,
      contentFingerprint: fingerprint,
    });

    const evidence = await deps.evidencePersistence.runPersist({
      enrichmentId: enrich.enrichmentId,
      activate: true,
    });

    const rulesVersion =
      resolveOperativeRulesVersion(document.domain.code) ?? undefined;
    const pa2 = await deps.pa2.evaluateProfileDomain({
      extractionId: newExtractionId!,
      domainCode: document.domain.code,
      rulesVersion,
      persist: true,
      activateOnPersist: true,
      domainQualification: undefined,
    });

    if (pa2.outcome === 'DRY_RUN' || !pa2.evaluationId) {
      throw new Error('PA2 no persistió evaluación.');
    }

    // Persistir calificación publicable (PRIMARY_MATCH si hay ACTIVE).
    if (pa2.result) {
      const qualification = classifyDomainConceptually(pa2.result, 'MEDIUM');
      await deps.dataSource.query(
        `UPDATE organigrama.mc_profile_evaluation
         SET domain_qualification = $2, updated_at = NOW()
         WHERE id = $1::bigint`,
        [pa2.evaluationId, qualification],
      );
    }

    // Domain coherence: evaluation must be for declared domain
    const evalRows = (await deps.dataSource.query(
      `SELECT domain_code AS "domainCode", is_active AS "isActive", status
       FROM organigrama.mc_profile_evaluation
       WHERE id = $1::bigint`,
      [pa2.evaluationId],
    )) as Array<{ domainCode: string; isActive: boolean; status: string }>;
    const evalRow = evalRows[0];
    if (!evalRow || evalRow.status !== 'SUCCEEDED' || !evalRow.isActive) {
      throw new Error('Evaluación PA2 incompleta o inactiva.');
    }
    if (evalRow.domainCode !== document.domain.code) {
      throw new Error(
        `PA2 produjo dominio ${evalRow.domainCode}, declarado ${document.domain.code}.`,
      );
    }

    const specialtyCodes = (await deps.dataSource.query(
      `SELECT s.code
       FROM organigrama.mc_profile_specialty_result psr
       JOIN organigrama.mc_specialty s ON s.id = psr.specialty_id
       WHERE psr.profile_evaluation_id = $1::bigint`,
      [pa2.evaluationId],
    )) as Array<{ code: string }>;

    const declaredCodes = document.specialties.map((s) => s.code);
    const produced = new Set(specialtyCodes.map((s) => s.code));
    const matchedDeclared = declaredCodes.filter((c) => produced.has(c));
    if (matchedDeclared.length === 0) {
      throw new Error(
        'PA2 no produjo ninguna especialidad declarada en el JSON.',
      );
    }
    for (const code of produced) {
      if (!declaredCodes.includes(code)) {
        report.warnings.push({
          code: 'PA2_EXTRA_SPECIALTY',
          severity: 'warning',
          path: 'pa2',
          message: `PA2 produjo especialidad adicional ${code} (mappings compartidos).`,
        });
      }
    }

    let verified = false;
    if (options.verify !== false) {
      const v = await verifyPostImport({
        dataSource: deps.dataSource,
        personId,
        extractionId: newExtractionId!,
        domainCode: document.domain.code,
      });
      verified = v.ok;
      for (const m of v.messages) {
        report.warnings.push({
          code: 'POST_VERIFY',
          severity: 'warning',
          path: 'verify',
          message: m,
        });
      }
    }

    report.outcome = 'EXECUTED';
    report.execution = {
      extractionId: newExtractionId!,
      enrichmentId: enrich.enrichmentId,
      evidenceEvaluationId: evidence.evaluationId,
      profileEvaluationId: pa2.evaluationId,
      pa2DomainCode: evalRow.domainCode,
      pa2SpecialtyCodes: specialtyCodes.map((s) => s.code),
      previousExtractionId,
      verified,
    };
    return report;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    report.errors.push({
      code: 'IMPORT_FAILED',
      severity: 'error',
      path: '$',
      message,
    });
    try {
      await compensatingRollback({
        dataSource: deps.dataSource,
        personId,
        newExtractionId,
        previousExtractionId,
      });
      report.outcome = 'FAILED';
      report.risks.push(
        'Rollback compensatorio aplicado (extracción previa reactivada si existía).',
      );
    } catch (rollbackError) {
      report.outcome = 'FAILED';
      report.errors.push({
        code: 'ROLLBACK_FAILED',
        severity: 'error',
        path: '$',
        message:
          rollbackError instanceof Error
            ? rollbackError.message
            : String(rollbackError),
      });
    }
    return report;
  }
}

export function assertSinglePersonDocument(raw: unknown): void {
  if (Array.isArray(raw)) {
    throw new Error(
      'Esta fase acepta un único perfil (objeto JSON), no un array.',
    );
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('JSON raíz inválido.');
  }
  const persons = (raw as { persons?: unknown }).persons;
  if (Array.isArray(persons) && persons.length > 1) {
    throw new Error('Archivo con más de una persona rechazado en Fase 2.');
  }
}

export { maskDocument, createHash, readExtractionMeta };
