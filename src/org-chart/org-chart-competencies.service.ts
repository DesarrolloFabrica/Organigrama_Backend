/**
 * Lectura del Explorador de Competencias (MC1.3.4).
 *
 * - Reutiliza OrgChartVisibilityService.canViewFullProfile (sin política paralela).
 * - Solo lee evaluaciones PA2 persistidas (no ejecuta el motor).
 * - Payloads orientados a producto (DTOs), no entidades.
 */

import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type {
  CompetencyAvailabilityStatus,
  CompetencyDomainDetailDto,
  CompetencyEvidenceItemDto,
  CompetencyExplorerSummaryDto,
  CompetencyPresentationStatus,
  CompetencyProfessionalProfileDto,
  CompetencySkillDto,
  CompetencySpecialtyDetailDto,
  CompetencySpecialtySummaryDto,
} from './dto/competencies.response.dto';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import type { OrgViewerContext } from './org-viewer-context';
import {
  deriveDomainQualification,
  filterPublishableDomains,
  selectDefaultDomainCode,
  sortPublishableDomains,
  type McPublishableDomainCandidate,
} from './mc-multidomain-profile-publish';
import { buildMvpProfessionalCapabilities } from './mc-mvp-capability-projection';

const LOG_TAG = '[CompetencyExplorer]';
const MAX_EVIDENCE_TEXT = 400;

type ResolvedEvaluation = {
  availabilityStatus: CompetencyAvailabilityStatus;
  evaluation: {
    id: string;
    status: 'SUCCEEDED' | 'FAILED';
    is_active: boolean;
    person_id: string;
    extraction_id: string;
    enrichment_id: string;
    evidence_evaluation_id: string;
    catalog_version_id: string;
    domain_id: string;
    domain_code: string;
    engine_rules_version: string;
    config_hash: string;
    mapping_hash: string;
    mapping_pack_code: string | null;
    mapping_pack_version: string | null;
    source_hash: string | null;
    algorithm_version: string | null;
    evaluation_context_hash: string | null;
    default_specialty_code: string | null;
    active_count: number;
    emergent_count: number;
    hidden_count: number;
    warnings: string[] | null;
    completed_at: Date | string | null;
    catalog_version: string;
    catalog_is_active: boolean;
    domain_name: string;
    extraction_is_active: boolean;
    evidence_is_active: boolean;
  } | null;
  warnings: string[];
};

type SpecialtyRow = {
  specialty_code: string;
  specialty_name: string;
  lifecycle_status: string;
  presentation_status: string;
  mapped_skill_count: number;
  evidenced_skill_count: number;
  coverage: string | number;
  confidence: string | number;
  strength: string | number;
  rank: number;
  is_default: boolean;
  reasons: string[] | null;
  warnings: string[] | null;
  skill_breakdown: Array<{
    skillId: string;
    skillKey: string;
    skillName: string;
    skillType: string;
    mappingWeight: number;
    mappingType: 'PRIMARY' | 'SECONDARY';
    evidenceLevel: string;
    evidenceStrength: number;
    evidenceConfidence: number;
  }> | null;
};

@Injectable()
export class OrgChartCompetenciesService {
  private readonly logger = new Logger(OrgChartCompetenciesService.name);

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly visibility: OrgChartVisibilityService,
  ) {}

  async getExplorerSummary(
    viewer: OrgViewerContext,
    personId: string,
    versionId: string,
    options: { includeHidden?: boolean; includeAudit?: boolean } = {},
  ): Promise<CompetencyExplorerSummaryDto> {
    await this.assertCanView(viewer, personId, versionId);
    const person = await this.loadPerson(personId);
    const resolved = await this.resolvePrimaryEvaluation(personId);

    if (
      resolved.availabilityStatus !== 'AVAILABLE' ||
      !resolved.evaluation
    ) {
      return {
        availabilityStatus: resolved.availabilityStatus,
        person,
        evaluation: resolved.evaluation
          ? this.toEvaluationMeta(
              resolved.evaluation,
              options.includeAudit,
              resolved.availabilityStatus,
            )
          : null,
        domains: [],
        warnings: resolved.warnings,
      };
    }

    const specialties = await this.loadSpecialtySummaries(
      resolved.evaluation.id,
      options.includeHidden === true,
    );

    return {
      availabilityStatus: 'AVAILABLE',
      person,
      evaluation: this.toEvaluationMeta(
        resolved.evaluation,
        options.includeAudit,
        'AVAILABLE',
      ),
      domains: [
        {
          code: resolved.evaluation.domain_code,
          name: resolved.evaluation.domain_name,
          defaultSpecialtyCode: resolved.evaluation.default_specialty_code,
          activeSpecialtyCount: resolved.evaluation.active_count,
          emergentSpecialtyCount: resolved.evaluation.emergent_count,
          specialties,
        },
      ],
      warnings: [
        ...(resolved.evaluation.warnings ?? []),
        ...resolved.warnings,
      ],
    };
  }

  /**
   * Perfil profesional multidominio (piloto).
   * Lista solo dominios publicables de la extracción activa.
   * No inventa CDR ni scores.
   */
  async getProfessionalProfile(
    viewer: OrgViewerContext,
    personId: string,
    versionId: string,
    options: { includeHidden?: boolean; includeAudit?: boolean } = {},
  ): Promise<CompetencyProfessionalProfileDto> {
    await this.assertCanView(viewer, personId, versionId);
    const person = await this.loadPerson(personId);
    const activeExtractionId = await this.loadActiveExtractionId(personId);
    const candidates = await this.loadDomainEvaluationCandidates(personId);
    const publishable = sortPublishableDomains(
      filterPublishableDomains(candidates, activeExtractionId),
    );
    const defaultDomainCode = selectDefaultDomainCode(publishable);
    const mvpCapabilities = activeExtractionId
      ? await this.loadMvpCapabilities(
          activeExtractionId,
          publishable.length > 0,
        )
      : null;

    if (!publishable.length) {
      const primary = await this.resolvePrimaryEvaluation(personId);
      const hasMvp =
        !!mvpCapabilities &&
        (mvpCapabilities.consolidatedCapabilities.length > 0 ||
          mvpCapabilities.complementaryCapabilities.length > 0 ||
          mvpCapabilities.emergingCapabilities.length > 0 ||
          mvpCapabilities.tools.length > 0 ||
          mvpCapabilities.methodologies.length > 0);
      return {
        availabilityStatus: hasMvp ? 'AVAILABLE' : primary.availabilityStatus,
        person,
        extractionId: activeExtractionId,
        defaultDomainCode: null,
        crossDomainClassification: null,
        evaluatedDomains: [],
        mvpCapabilities,
        warnings: hasMvp
          ? ['COMPETENCY_CLASSIFICATION_PENDING']
          : primary.warnings.length
            ? primary.warnings
            : ['COMPETENCY_NO_PUBLISHABLE_DOMAINS'],
      };
    }

    const evaluatedDomains: CompetencyProfessionalProfileDto['evaluatedDomains'] =
      [];

    for (const row of publishable) {
      const qualification = deriveDomainQualification(row);
      const specialties = await this.loadSpecialtySummaries(
        row.evaluationId,
        options.includeHidden === true,
      );
      evaluatedDomains.push({
        code: row.domainCode,
        name: row.domainName,
        qualification,
        evaluationId: row.evaluationId,
        isPublishedPrimary: row.isActive,
        evaluatedAt: row.completedAt,
        rulesVersion: row.engineRulesVersion,
        defaultSpecialtyCode: row.defaultSpecialtyCode,
        activeSpecialtyCount: row.activeCount,
        emergentSpecialtyCount: row.emergentCount,
        summary: this.buildDomainSummaryText({
          qualification,
          activeCount: row.activeCount,
          emergentCount: row.emergentCount,
          domainName: row.domainName,
        }),
        specialties,
        warnings: [],
      });
    }

    void options.includeAudit;

    return {
      availabilityStatus: 'AVAILABLE',
      person,
      extractionId: activeExtractionId,
      defaultDomainCode,
      crossDomainClassification: null,
      evaluatedDomains,
      mvpCapabilities,
      warnings: [],
    };
  }

  private async loadMvpCapabilities(
    extractionId: string,
    hasPublishableDomain: boolean,
  ): Promise<CompetencyProfessionalProfileDto['mvpCapabilities']> {
    const rows = await this.dataSource.query(
      `SELECT s.normalized_name,
              ces.original_name,
              s.skill_type,
              ei.evidence_level,
              ei.has_work_experience,
              ei.substantive_evidence_count,
              ces.evidence AS evidence_text,
              ces.evidence_items
         FROM organigrama.cv_extraction_skill ces
         JOIN organigrama.cv_skill s ON s.id = ces.skill_id
         LEFT JOIN organigrama.cv_evidence_evaluation ev
           ON ev.extraction_id = ces.extraction_id
          AND ev.is_active = TRUE AND ev.status = 'SUCCEEDED'
         LEFT JOIN organigrama.cv_evidence_evaluation_item ei
           ON ei.evaluation_id = ev.id AND ei.extraction_skill_id = ces.id
        WHERE ces.extraction_id = $1`,
      [extractionId],
    );

    const built = buildMvpProfessionalCapabilities(
      (rows as Array<Record<string, unknown>>).map((r) => ({
        normalizedName: String(r.normalized_name ?? ''),
        originalName: r.original_name ? String(r.original_name) : null,
        skillType: r.skill_type ? String(r.skill_type) : null,
        evidenceLevel: r.evidence_level ? String(r.evidence_level) : null,
        hasWorkExperience:
          r.has_work_experience == null
            ? null
            : Boolean(r.has_work_experience),
        substantiveCount:
          r.substantive_evidence_count == null
            ? null
            : Number(r.substantive_evidence_count),
        evidenceText: r.evidence_text ? String(r.evidence_text) : null,
        evidenceItems: (r.evidence_items as Array<{
          sourceType?: string;
          evidenceText?: string;
        }> | null) ?? null,
      })),
      { hasPublishableDomain },
    );

    return {
      classificationPending: built.classificationPending,
      consolidatedCapabilities: built.consolidatedCapabilities.map((c) => ({
        code: c.code,
        label: c.label,
        evidenceLevel: c.evidenceLevel,
        sourceCount: c.sourceCount,
        domainCode: c.domainCode,
        classification: c.classification,
      })),
      complementaryCapabilities: built.complementaryCapabilities.map((c) => ({
        code: c.code,
        label: c.label,
        evidenceLevel: c.evidenceLevel,
        sourceCount: c.sourceCount,
        domainCode: c.domainCode,
        classification: c.classification,
      })),
      emergingCapabilities: built.emergingCapabilities.map((c) => ({
        code: c.code,
        label: c.label,
        evidenceLevel: c.evidenceLevel,
        sourceCount: c.sourceCount,
        domainCode: c.domainCode,
        classification: c.classification,
      })),
      tools: built.tools.map((t) => ({
        label: t.label,
        type: t.type,
        evidenceLevel: t.evidenceLevel,
        hasProfessionalContext: t.hasProfessionalContext,
      })),
      methodologies: built.methodologies.map((t) => ({
        label: t.label,
        type: t.type,
        evidenceLevel: t.evidenceLevel,
        hasProfessionalContext: t.hasProfessionalContext,
      })),
      qualityAlerts: built.qualityAlerts,
    };
  }

  private buildDomainSummaryText(params: {
    qualification: string;
    activeCount: number;
    emergentCount: number;
    domainName: string;
  }): string {
    if (params.qualification === 'PRIMARY_MATCH') {
      return `Se identificó práctica profesional consolidada en ${params.domainName} (${params.activeCount} especialidad${params.activeCount === 1 ? '' : 'es'} activa${params.activeCount === 1 ? '' : 's'}).`;
    }
    if (params.qualification === 'SECONDARY_SIGNAL') {
      return `Se identificaron señales profesionales en ${params.domainName}, pero todavía no hay una especialidad consolidada.`;
    }
    return `Resultado de evaluación disponible para ${params.domainName}.`;
  }

  private async loadActiveExtractionId(
    personId: string,
  ): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT id::text AS id
         FROM organigrama.cv_extraction
        WHERE person_id = $1
          AND is_active = TRUE
          AND status = 'SUCCEEDED'
        ORDER BY id DESC
        LIMIT 1`,
      [personId],
    );
    return rows[0]?.id ? String(rows[0].id) : null;
  }

  private async loadDomainEvaluationCandidates(
    personId: string,
  ): Promise<McPublishableDomainCandidate[]> {
    const hasQual = await this.dataSource.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'organigrama'
          AND table_name = 'mc_profile_evaluation'
          AND column_name = 'domain_qualification'`,
    );
    const qualSelect = hasQual.length
      ? 'e.domain_qualification'
      : 'NULL::varchar AS domain_qualification';

    const rows = await this.dataSource.query(
      `SELECT
          e.id::text AS evaluation_id,
          e.domain_code,
          d.name AS domain_name,
          COALESCE(d.sort_order, 0) AS domain_sort_order,
          e.extraction_id::text AS extraction_id,
          e.is_active,
          e.status,
          ${qualSelect},
          e.active_count,
          e.emergent_count,
          e.hidden_count,
          e.default_specialty_code,
          e.engine_rules_version,
          e.completed_at
         FROM organigrama.mc_profile_evaluation e
         JOIN organigrama.mc_domain d ON d.id = e.domain_id
        WHERE e.person_id = $1
          AND e.status = 'SUCCEEDED'`,
      [personId],
    );

    return (rows as Array<Record<string, unknown>>).map((r) => ({
      evaluationId: String(r.evaluation_id),
      domainCode: String(r.domain_code).toUpperCase(),
      domainName: String(r.domain_name),
      domainSortOrder: Number(r.domain_sort_order) || 0,
      extractionId: String(r.extraction_id),
      isActive: Boolean(r.is_active),
      status: String(r.status),
      domainQualification: (r.domain_qualification as
        | McPublishableDomainCandidate['domainQualification']
        | null) ?? null,
      activeCount: Number(r.active_count) || 0,
      emergentCount: Number(r.emergent_count) || 0,
      hiddenCount: Number(r.hidden_count) || 0,
      defaultSpecialtyCode: r.default_specialty_code
        ? String(r.default_specialty_code)
        : null,
      engineRulesVersion: String(r.engine_rules_version),
      completedAt: r.completed_at
        ? new Date(r.completed_at as string | Date).toISOString()
        : null,
    }));
  }

  async getDomainDetail(
    viewer: OrgViewerContext,
    personId: string,
    domainCode: string,
    versionId: string,
    options: { includeHidden?: boolean; includeAudit?: boolean } = {},
  ): Promise<CompetencyDomainDetailDto> {
    await this.assertCanView(viewer, personId, versionId);
    this.assertDomainCode(domainCode);
    const domain = await this.assertDomainExists(domainCode);
    const person = await this.loadPerson(personId);
    const resolved = await this.resolveEvaluation(personId, domainCode);

    if (
      resolved.availabilityStatus !== 'AVAILABLE' ||
      !resolved.evaluation
    ) {
      return {
        availabilityStatus: resolved.availabilityStatus,
        person,
        evaluation: resolved.evaluation
          ? this.toEvaluationMeta(
              resolved.evaluation,
              options.includeAudit,
              resolved.availabilityStatus,
            )
          : null,
        domain: {
          code: domain.code,
          name: domain.name,
          defaultSpecialtyCode: null,
          activeSpecialtyCount: 0,
          emergentSpecialtyCount: 0,
        },
        specialties: [],
        warnings: resolved.warnings,
      };
    }

    const specialties = await this.loadSpecialtySummaries(
      resolved.evaluation.id,
      options.includeHidden === true,
    );

    return {
      availabilityStatus: 'AVAILABLE',
      person,
      evaluation: this.toEvaluationMeta(
        resolved.evaluation,
        options.includeAudit,
        'AVAILABLE',
      ),
      domain: {
        code: resolved.evaluation.domain_code,
        name: resolved.evaluation.domain_name,
        defaultSpecialtyCode: resolved.evaluation.default_specialty_code,
        activeSpecialtyCount: resolved.evaluation.active_count,
        emergentSpecialtyCount: resolved.evaluation.emergent_count,
      },
      specialties,
      warnings: [
        ...(resolved.evaluation.warnings ?? []),
        ...resolved.warnings,
      ],
    };
  }

  async getSpecialtyDetail(
    viewer: OrgViewerContext,
    personId: string,
    domainCode: string,
    specialtyCode: string,
    versionId: string,
    options: { includeAudit?: boolean } = {},
  ): Promise<CompetencySpecialtyDetailDto> {
    await this.assertCanView(viewer, personId, versionId);
    this.assertDomainCode(domainCode);
    this.assertSpecialtyCode(specialtyCode);
    await this.assertDomainExists(domainCode);

    const resolved = await this.resolveEvaluation(personId, domainCode);
    if (!resolved.evaluation || resolved.availabilityStatus === 'NOT_EVALUATED') {
      throw new NotFoundException({
        code: 'COMPETENCY_EVALUATION_NOT_FOUND',
        message: `No hay evaluación PA2 disponible para personId=${personId} domain=${domainCode}`,
        availabilityStatus: resolved.availabilityStatus,
      });
    }
    if (resolved.availabilityStatus === 'FAILED') {
      throw new NotFoundException({
        code: 'COMPETENCY_EVALUATION_FAILED',
        message: `La evaluación PA2 falló para personId=${personId} domain=${domainCode}`,
        availabilityStatus: 'FAILED',
      });
    }
    // AVAILABLE o STALE: se sirve el resultado persistido (STALE incluye warnings).

    const rows = await this.dataSource.query(
      `SELECT
          r.specialty_code,
          s.name AS specialty_name,
          r.lifecycle_status,
          r.presentation_status,
          r.mapped_skill_count,
          r.evidenced_skill_count,
          r.coverage,
          r.confidence,
          r.strength,
          r.rank,
          r.is_default,
          r.reasons,
          r.warnings,
          r.skill_breakdown
         FROM organigrama.mc_profile_specialty_result r
         JOIN organigrama.mc_specialty s ON s.id = r.specialty_id
        WHERE r.profile_evaluation_id = $1
          AND r.specialty_code = $2
        LIMIT 1`,
      [resolved.evaluation.id, specialtyCode.toUpperCase()],
    );

    if (!rows[0]) {
      throw new NotFoundException({
        code: 'COMPETENCY_SPECIALTY_NOT_FOUND',
        message: `Especialidad ${specialtyCode} no encontrada en la evaluación`,
      });
    }

    const row = rows[0] as SpecialtyRow;
    const breakdown = Array.isArray(row.skill_breakdown)
      ? row.skill_breakdown
      : [];
    const skillIds = breakdown.map((b) => b.skillId);
    const evidenceBySkill = await this.loadEvidenceItems(
      resolved.evaluation.enrichment_id,
      skillIds,
    );

    const skills: CompetencySkillDto[] = breakdown.map((b) => ({
      id: String(b.skillId),
      code: b.skillKey,
      name: b.skillName,
      type: b.skillType,
      mapping: {
        role: b.mappingType,
        weight: Number(b.mappingWeight),
      },
      evidence: {
        level: b.evidenceLevel,
        strength: Number(b.evidenceStrength),
        confidence: Number(b.evidenceConfidence),
        items: evidenceBySkill.get(String(b.skillId)) ?? [],
      },
    }));

    return {
      code: row.specialty_code,
      name: row.specialty_name,
      presentationStatus: row.presentation_status as CompetencyPresentationStatus,
      lifecycleStatus: row.lifecycle_status,
      isDefault: row.is_default === true,
      rank: Number(row.rank),
      metrics: {
        mappedSkillCount: Number(row.mapped_skill_count),
        evidencedSkillCount: Number(row.evidenced_skill_count),
        coverage: Number(row.coverage),
        confidence: Number(row.confidence),
        strength: Number(row.strength),
      },
      reasons: row.reasons ?? [],
      warnings: row.warnings ?? [],
      skills,
      evaluation: this.toEvaluationMeta(
        resolved.evaluation,
        options.includeAudit,
        resolved.availabilityStatus,
      ),
    };
  }

  /**
   * Resolución determinista de evaluación PA2 para una persona + dominio.
   * No ejecuta el motor.
   */
  /**
   * Evaluación PA2 activa principal de la persona (un dominio por persona en V1).
   * No asume SOFTWARE: toma la SUCCEEDED activa más reciente (prioriza catálogo activo).
   */
  async resolvePrimaryEvaluation(
    personId: string,
  ): Promise<ResolvedEvaluation> {
    const rows = (await this.dataSource.query(
      `SELECT e.domain_code
         FROM organigrama.mc_profile_evaluation e
         JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
        WHERE e.person_id = $1
          AND e.is_active = TRUE
          AND e.status = 'SUCCEEDED'
        ORDER BY cv.is_active DESC, e.id DESC
        LIMIT 1`,
      [personId],
    )) as Array<{ domain_code: string }> | undefined;
    if (!rows?.[0]?.domain_code) {
      return {
        availabilityStatus: 'NOT_EVALUATED',
        evaluation: null,
        warnings: ['COMPETENCY_EVALUATION_NOT_FOUND'],
      };
    }
    return this.resolveEvaluation(personId, String(rows[0].domain_code));
  }

  async resolveEvaluation(
    personId: string,
    domainCode: string,
  ): Promise<ResolvedEvaluation> {
    const code = domainCode.toUpperCase();
    const warnings: string[] = [];

    const rows = await this.dataSource.query(
      `SELECT
          e.id::text,
          e.status,
          e.is_active,
          e.person_id::text,
          e.extraction_id::text,
          e.enrichment_id::text,
          e.evidence_evaluation_id::text,
          e.catalog_version_id::text,
          e.domain_id::text,
          e.domain_code,
          e.engine_rules_version,
          e.config_hash,
          e.mapping_hash,
          e.mapping_pack_code,
          e.mapping_pack_version,
          e.source_hash,
          e.algorithm_version,
          e.evaluation_context_hash,
          e.default_specialty_code,
          e.active_count,
          e.emergent_count,
          e.hidden_count,
          e.warnings,
          e.completed_at,
          cv.version AS catalog_version,
          cv.is_active AS catalog_is_active,
          d.name AS domain_name,
          x.is_active AS extraction_is_active,
          ev.is_active AS evidence_is_active
         FROM organigrama.mc_profile_evaluation e
         JOIN organigrama.mc_catalog_version cv ON cv.id = e.catalog_version_id
         JOIN organigrama.mc_domain d ON d.id = e.domain_id
         JOIN organigrama.cv_extraction x ON x.id = e.extraction_id
         JOIN organigrama.cv_evidence_evaluation ev ON ev.id = e.evidence_evaluation_id
        WHERE e.person_id = $1
          AND e.domain_code = $2
          AND e.status = 'SUCCEEDED'
          AND (
            e.is_active = TRUE
            OR e.extraction_id = (
              SELECT x2.id
                FROM organigrama.cv_extraction x2
               WHERE x2.person_id = $1
                 AND x2.is_active = TRUE
                 AND x2.status = 'SUCCEEDED'
               ORDER BY x2.id DESC
               LIMIT 1
            )
          )
        ORDER BY e.is_active DESC, e.id DESC
        LIMIT 1`,
      [personId, code],
    );

    if (!rows?.[0]) {
      return {
        availabilityStatus: 'NOT_EVALUATED',
        evaluation: null,
        warnings: ['COMPETENCY_EVALUATION_NOT_FOUND'],
      };
    }

    const evaluation = rows[0] as NonNullable<ResolvedEvaluation['evaluation']>;

    if (evaluation.status === 'FAILED') {
      return {
        availabilityStatus: 'FAILED',
        evaluation,
        warnings: ['COMPETENCY_EVALUATION_FAILED'],
      };
    }

    if (evaluation.status !== 'SUCCEEDED') {
      return {
        availabilityStatus: 'NOT_EVALUATED',
        evaluation,
        warnings: [`COMPETENCY_EVALUATION_STATUS_${evaluation.status}`],
      };
    }

    if (!evaluation.extraction_is_active) {
      warnings.push('STALE_EXTRACTION_NOT_ACTIVE');
    }
    if (!evaluation.catalog_is_active) {
      warnings.push('STALE_CATALOG_NOT_ACTIVE');
    }
    if (!evaluation.evidence_is_active) {
      warnings.push('STALE_EVIDENCE_NOT_ACTIVE');
    }

    if (warnings.length > 0) {
      return {
        availabilityStatus: 'STALE',
        evaluation,
        warnings,
      };
    }

    return {
      availabilityStatus: 'AVAILABLE',
      evaluation,
      warnings: [],
    };
  }

  private async assertCanView(
    viewer: OrgViewerContext,
    personId: string,
    versionId: string,
  ): Promise<void> {
    const canView = await this.visibility.canViewFullProfile(
      viewer,
      personId,
      versionId,
    );
    if (!canView) {
      this.logger.warn(
        `${LOG_TAG} denied viewerPersonId=${viewer.personId} targetPersonId=${personId}`,
      );
      throw new ForbiddenException({
        code: 'COMPETENCY_ACCESS_DENIED',
        message: 'No tiene permiso para consultar el Explorador de esta persona.',
      });
    }
  }

  private assertDomainCode(domainCode: string): void {
    const code = domainCode?.trim().toUpperCase();
    if (!code || !/^[A-Z][A-Z0-9_]{1,79}$/.test(code)) {
      throw new NotFoundException({
        code: 'COMPETENCY_DOMAIN_INVALID',
        message: `domainCode inválido: ${domainCode}`,
      });
    }
  }

  private async assertDomainExists(
    domainCode: string,
  ): Promise<{ code: string; name: string }> {
    const code = domainCode.trim().toUpperCase();
    const rows = await this.dataSource.query(
      `SELECT code, name
         FROM organigrama.mc_domain
        WHERE code = $1
        LIMIT 1`,
      [code],
    );
    if (!rows[0]) {
      throw new NotFoundException({
        code: 'COMPETENCY_DOMAIN_NOT_FOUND',
        message: `Dominio inexistente: ${code}`,
      });
    }
    return { code: rows[0].code, name: rows[0].name };
  }

  private assertSpecialtyCode(specialtyCode: string): void {
    const code = specialtyCode?.trim().toUpperCase();
    if (!code || !/^[A-Z][A-Z0-9_]{1,79}$/.test(code)) {
      throw new NotFoundException({
        code: 'COMPETENCY_SPECIALTY_INVALID',
        message: `specialtyCode inválido: ${specialtyCode}`,
      });
    }
  }

  private async loadPerson(personId: string): Promise<{
    id: string;
    fullName: string;
    role: string | null;
  }> {
    const rows = await this.dataSource.query(
      `SELECT p.id::text, p.full_name, r.name AS role_name
         FROM core.person p
         LEFT JOIN core.role r ON r.id = p.role_id
        WHERE p.id = $1
        LIMIT 1`,
      [personId],
    );
    if (!rows[0]) {
      throw new NotFoundException(`No existe una persona con id ${personId}.`);
    }
    return {
      id: rows[0].id,
      fullName: rows[0].full_name ?? '',
      role: rows[0].role_name ?? null,
    };
  }

  private async loadSpecialtySummaries(
    evaluationId: string,
    includeHidden: boolean,
  ): Promise<CompetencySpecialtySummaryDto[]> {
    const rows = (await this.dataSource.query(
      `SELECT
          r.specialty_code,
          s.name AS specialty_name,
          r.presentation_status,
          r.mapped_skill_count,
          r.evidenced_skill_count,
          r.coverage,
          r.confidence,
          r.strength,
          r.rank,
          r.is_default,
          r.warnings
         FROM organigrama.mc_profile_specialty_result r
         JOIN organigrama.mc_specialty s ON s.id = r.specialty_id
        WHERE r.profile_evaluation_id = $1
          AND ($2::boolean = TRUE OR r.presentation_status <> 'HIDDEN')
        ORDER BY r.rank ASC`,
      [evaluationId, includeHidden],
    )) as Array<{
      specialty_code: string;
      specialty_name: string;
      presentation_status: string;
      mapped_skill_count: number;
      evidenced_skill_count: number;
      coverage: string | number;
      confidence: string | number;
      strength: string | number;
      rank: number;
      is_default: boolean;
      warnings: string[] | null;
    }>;

    return rows.map((r) => ({
      code: r.specialty_code,
      name: r.specialty_name,
      presentationStatus: r.presentation_status as CompetencyPresentationStatus,
      isDefault: r.is_default === true,
      rank: Number(r.rank),
      metrics: {
        mappedSkillCount: Number(r.mapped_skill_count),
        evidencedSkillCount: Number(r.evidenced_skill_count),
        coverage: Number(r.coverage),
        confidence: Number(r.confidence),
        strength: Number(r.strength),
      },
      warnings: r.warnings ?? [],
    }));
  }

  /**
   * Una sola consulta para todos los fragments de evidencia de las skills.
   * No carga el CV completo.
   */
  private async loadEvidenceItems(
    enrichmentId: string,
    skillIds: string[],
  ): Promise<Map<string, CompetencyEvidenceItemDto[]>> {
    const map = new Map<string, CompetencyEvidenceItemDto[]>();
    if (skillIds.length === 0) return map;

    const rows = (await this.dataSource.query(
      `SELECT es.skill_id::text AS skill_id, ei.evidence_items
         FROM organigrama.cv_skill_enrichment_item ei
         JOIN organigrama.cv_extraction_skill es
           ON es.id = ei.extraction_skill_id
        WHERE ei.enrichment_id = $1
          AND es.skill_id = ANY($2::bigint[])`,
      [enrichmentId, skillIds],
    )) as Array<{ skill_id: string; evidence_items: unknown }>;

    for (const row of rows) {
      const items = Array.isArray(row.evidence_items) ? row.evidence_items : [];
      const mapped: CompetencyEvidenceItemDto[] = [];
      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const sourceType = String(
          (item as { sourceType?: string }).sourceType ?? 'OTHER',
        );
        const text = String(
          (item as { evidenceText?: string }).evidenceText ?? '',
        ).trim();
        if (!text) continue;
        mapped.push({
          sourceType,
          text:
            text.length > MAX_EVIDENCE_TEXT
              ? `${text.slice(0, MAX_EVIDENCE_TEXT)}…`
              : text,
        });
      }
      map.set(row.skill_id, mapped);
    }
    return map;
  }

  private toEvaluationMeta(
    evaluation: NonNullable<ResolvedEvaluation['evaluation']>,
    includeAudit: boolean | undefined,
    availabilityStatus: CompetencyAvailabilityStatus,
  ) {
    return {
      id: evaluation.id,
      status: evaluation.status,
      availabilityStatus,
      evaluatedAt: this.toIso(evaluation.completed_at),
      rulesVersion: evaluation.engine_rules_version,
      ...(includeAudit
        ? {
            audit: {
              catalogVersion: evaluation.catalog_version,
              catalogVersionId: evaluation.catalog_version_id,
              mappingHash: evaluation.mapping_hash,
              configHash: evaluation.config_hash,
              extractionId: evaluation.extraction_id,
              evidenceEvaluationId: evaluation.evidence_evaluation_id,
              enrichmentId: evaluation.enrichment_id,
              domainCode: evaluation.domain_code,
              mappingPackCode: evaluation.mapping_pack_code ?? null,
              mappingPackVersion: evaluation.mapping_pack_version ?? null,
              sourceHash: evaluation.source_hash ?? null,
              algorithmVersion: evaluation.algorithm_version ?? null,
              evaluationContextHash:
                evaluation.evaluation_context_hash ?? null,
            },
          }
        : {}),
    };
  }

  private toIso(value: Date | string | null): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
}
