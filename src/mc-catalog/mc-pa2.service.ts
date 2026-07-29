/**
 * Orquestación PA2: carga extracción + evidencia + mappings, ejecuta motor,
 * opcionalmente persiste evaluación versionada.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MC_CATALOG_ADVISORY_LOCK_NS } from './mc-catalog.constants';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import { resolveMcMappingPack } from './mc-catalog.mapping-registry';
import {
  buildMcEvaluationContext,
  type McHistoricalContextReport,
} from './mc-evaluation-context';
import {
  assertMcPa2RuleFingerprint,
  resolveMcPa2AlgorithmVersion,
} from './mc-pa2.algorithm';
import {
  computeMcPa2ConfigHash,
  getDefaultMcPa2EngineConfig,
  resolveMcPa2EngineConfig,
  type McPa2EngineConfig,
} from './mc-pa2.config';
import { McPa2EngineError, runMcPa2Engine } from './mc-pa2.engine';
import type {
  McEvidenceLevel,
  McPa2EngineRunResult,
  McPa2SkillEvidenceInput,
} from './mc-pa2.types';
import type { McDomainQualification } from './mc-domain-qualification';
import {
  McCatalogVersion,
  McDomain,
  McEvaluationSet,
  McEvaluationSetDomain,
  McProfileEvaluation,
  McProfileSpecialtyResult,
  McSkillDomainClassification,
  McSkillSpecialtyMapping,
  McSpecialty,
} from './entities';
import {
  MC_EVALUATION_SET_SCHEMA_VERSION,
  MC_QUALIFICATION_POLICY_VERSION,
  type McEvaluationSetCandidateDomain,
  type PersistMultidomainEvaluationRunResult,
} from './mc-evaluation-set.types';
import {
  buildMcEvaluationSetContextPayload,
  computeMcEvaluationSetContextHash,
} from './mc-evaluation-set-context';

export class McPa2ServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McPa2ServiceError';
  }
}

export interface McPa2EvaluateParams {
  extractionId: string;
  domainCode: string;
  evidenceEvaluationId?: string;
  catalogVersion?: string;
  /** Versión explícita de reglas (p. ej. pa2-software-1.1.0). */
  rulesVersion?: string;
  config?: McPa2EngineConfig;
  persist?: boolean;
  /** Calificación intra-dominio MC1.1 (opcional al persistir). */
  domainQualification?: McDomainQualification | null;
  /**
   * Si false, la evaluación se persiste con is_active=false (no publicable en API).
   * Default true — compatibilidad con mc:evaluate y flujos single-domain.
   */
  activateOnPersist?: boolean;
}

export interface McPa2EvaluateOutcome {
  dryRun: boolean;
  evaluationId: string | null;
  outcome: 'DRY_RUN' | 'SEEDED' | 'ALREADY_EXISTS';
  result: McPa2EngineRunResult;
  /** Skills de evidencia cargadas para el motor (trazabilidad). */
  inputSkillsCount: number;
  meta: {
    personId: string;
    personCvId: string;
    extractionId: string;
    enrichmentId: string;
    evidenceEvaluationId: string;
    catalogVersionId: string;
    catalogVersion: string;
    domainId: string;
    domainCode: string;
    mappingHash: string;
    configHash: string;
    mappingPackCode: string;
    mappingPackVersion: string;
    sourceHash: string;
    algorithmVersion: string;
    evaluationContextHash: string;
  };
}

/** Ítem de persistencia atómica multidominio (MC1.1B cierre). */
export interface McPa2MultidomainPersistItem {
  meta: McPa2EvaluateOutcome['meta'];
  result: McPa2EngineRunResult;
  config: McPa2EngineConfig;
  inputSkillsCount: number;
  domainQualification: McDomainQualification | null;
  activateOnPersist: boolean;
}

export interface McPa2MultidomainPersistOutcome {
  domainCode: string;
  evaluationId: string;
  outcome: 'SEEDED';
  activateOnPersist: boolean;
  domainQualification: McDomainQualification | null;
}

@Injectable()
export class McPa2Service {
  private readonly logger = new Logger(McPa2Service.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(McCatalogVersion)
    private readonly versions: Repository<McCatalogVersion>,
    @InjectRepository(McDomain)
    private readonly domains: Repository<McDomain>,
    @InjectRepository(McSpecialty)
    private readonly specialties: Repository<McSpecialty>,
    @InjectRepository(McSkillDomainClassification)
    private readonly classifications: Repository<McSkillDomainClassification>,
    @InjectRepository(McSkillSpecialtyMapping)
    private readonly mappings: Repository<McSkillSpecialtyMapping>,
    @InjectRepository(McProfileEvaluation)
    private readonly evaluations: Repository<McProfileEvaluation>,
    @InjectRepository(McProfileSpecialtyResult)
    private readonly specialtyResults: Repository<McProfileSpecialtyResult>,
  ) {}

  async evaluateProfileDomain(
    params: McPa2EvaluateParams,
  ): Promise<McPa2EvaluateOutcome> {
    const config =
      params.config ??
      (params.rulesVersion
        ? resolveMcPa2EngineConfig(params.rulesVersion)
        : getDefaultMcPa2EngineConfig());
    if (!config.engineRulesVersion?.trim()) {
      throw new McPa2ServiceError('engineRulesVersion ausente en config');
    }
    if (
      params.rulesVersion &&
      params.rulesVersion.trim() !== config.engineRulesVersion
    ) {
      throw new McPa2ServiceError(
        `rulesVersion ${params.rulesVersion} no coincide con config ${config.engineRulesVersion}`,
      );
    }
    assertMcPa2RuleFingerprint(config);

    const extraction = await this.loadExtraction(params.extractionId);
    const sourceHash = await this.assertEvaluationChainCoherent(extraction);
    const evidence = await this.loadEvidenceEvaluation({
      extractionId: extraction.id,
      evidenceEvaluationId: params.evidenceEvaluationId,
    });
    if (!evidence.is_active) {
      throw new McPa2ServiceError(
        `Evidence evaluation ${evidence.id} no está activa; abortando evaluación`,
      );
    }
    const enrichmentId = evidence.enrichment_id;

    const catalog = await this.loadCatalog(params.catalogVersion);
    if (!catalog.is_active) {
      throw new McPa2ServiceError(
        `Catálogo ${catalog.version} no está activo`,
      );
    }

    const domain = await this.domains.findOne({
      where: {
        catalog_version_id: catalog.id,
        code: params.domainCode,
        is_active: true,
      },
    });
    if (!domain) {
      throw new McPa2ServiceError(
        `Dominio ${params.domainCode} no existe o inactivo`,
      );
    }

    const specialtyRows = await this.specialties.find({
      where: {
        catalog_version_id: catalog.id,
        domain_id: domain.id,
        is_active: true,
      },
      order: { sort_order: 'ASC' },
    });
    if (!specialtyRows.length) {
      throw new McPa2ServiceError(
        `Dominio ${params.domainCode} sin especialidades activas`,
      );
    }

    const classRows = await this.classifications.find({
      where: {
        catalog_version_id: catalog.id,
        domain_id: domain.id,
        is_active: true,
      },
    });
    if (!classRows.length) {
      throw new McPa2ServiceError(
        `Faltan clasificaciones para dominio ${params.domainCode}`,
      );
    }

    const mapRows = await this.mappings.find({
      where: { catalog_version_id: catalog.id, is_active: true },
    });
    if (!mapRows.length) {
      throw new McPa2ServiceError('Faltan mappings activos para el catálogo');
    }

    // Validar DOMAIN_SPECIALTY → mapping
    const specialtyIds = new Set(specialtyRows.map((s) => s.id));
    const domainMaps = mapRows.filter((m) => specialtyIds.has(m.specialty_id));
    const mappedSkillIds = new Set(domainMaps.map((m) => m.skill_id));
    for (const c of classRows) {
      if (c.classification === 'DOMAIN_SPECIALTY' && !mappedSkillIds.has(c.skill_id)) {
        throw new McPa2ServiceError(
          `DOMAIN_SPECIALTY skill_id=${c.skill_id} sin mapping`,
        );
      }
      if (
        c.classification !== 'DOMAIN_SPECIALTY' &&
        mappedSkillIds.has(c.skill_id)
      ) {
        throw new McPa2ServiceError(
          `Skill no DOMAIN_SPECIALTY mapeada: skill_id=${c.skill_id} (${c.classification})`,
        );
      }
    }

    const skillInputs = await this.loadSkillEvidence(
      params.extractionId,
      evidence.id,
    );

    const specialtyIdByCode = new Map(
      specialtyRows.map((s) => [s.code, s] as const),
    );

    const engineInput = {
      domainCode: params.domainCode,
      specialties: specialtyRows.map((s) => ({
        specialtyId: s.id,
        specialtyCode: s.code,
        specialtyName: s.name,
        lifecycleStatus: s.lifecycle_status,
        sortOrder: s.sort_order,
      })),
      mappings: domainMaps.map((m) => {
        const spec = [...specialtyIdByCode.values()].find(
          (s) => s.id === m.specialty_id,
        );
        if (!spec) {
          throw new McPa2ServiceError(
            `Mapping specialty_id=${m.specialty_id} fuera del dominio`,
          );
        }
        return {
          skillId: m.skill_id,
          specialtyCode: spec.code,
          specialtyId: spec.id,
          weight: Number(m.weight),
          mappingType: m.mapping_type,
          rationale: m.rationale,
        };
      }),
      skills: skillInputs,
      config,
    };

    let result: McPa2EngineRunResult;
    try {
      result = runMcPa2Engine(engineInput);
    } catch (err) {
      if (err instanceof McPa2EngineError) {
        throw new McPa2ServiceError(err.message);
      }
      throw err;
    }

    const mappingReg = resolveMcMappingPack(params.domainCode);
    const mappingHash = computeMcMappingPackHash(mappingReg.pack);
    const configHash = computeMcPa2ConfigHash(config);
    const algorithmVersion = resolveMcPa2AlgorithmVersion(config);
    const context = buildMcEvaluationContext({
      personId: extraction.person_id,
      domainCode: params.domainCode,
      catalogVersion: catalog.version,
      catalogVersionId: catalog.id,
      sourceHash,
      mappingPackCode: mappingReg.packCode,
      mappingPackVersion: mappingReg.mappingRulesVersion,
      mappingHash,
      engineRulesVersion: config.engineRulesVersion,
      algorithmVersion,
      configHash,
      extractionId: extraction.id,
      enrichmentId,
      evidenceEvaluationId: evidence.id,
    });

    // Revalidar cadena justo antes de armar meta (preflight→persist).
    const sourceHashRecheck =
      await this.assertEvaluationChainCoherent(extraction);
    if (sourceHashRecheck !== context.sourceHash) {
      throw new McPa2ServiceError(
        'source_hash cambió entre preflight y persistencia; abortando',
      );
    }

    const meta: McPa2EvaluateOutcome['meta'] = {
      personId: extraction.person_id,
      personCvId: extraction.person_cv_id,
      extractionId: extraction.id,
      enrichmentId,
      evidenceEvaluationId: evidence.id,
      catalogVersionId: catalog.id,
      catalogVersion: catalog.version,
      domainId: domain.id,
      domainCode: params.domainCode.toUpperCase(),
      mappingHash,
      configHash,
      mappingPackCode: context.mappingPackCode,
      mappingPackVersion: context.mappingPackVersion,
      sourceHash: context.sourceHash,
      algorithmVersion: context.algorithmVersion,
      evaluationContextHash: context.evaluationContextHash,
    };

    if (!params.persist) {
      return {
        dryRun: true,
        evaluationId: null,
        outcome: 'DRY_RUN',
        result,
        inputSkillsCount: skillInputs.length,
        meta,
      };
    }

    return this.persistEvaluation({
      meta,
      result,
      config,
      inputSkillsCount: skillInputs.length,
      domainQualification: params.domainQualification ?? null,
      activateOnPersist: params.activateOnPersist !== false,
    });
  }

  async getEvaluation(evaluationId: string): Promise<McProfileEvaluation> {
    const row = await this.evaluations.findOne({ where: { id: evaluationId } });
    if (!row) {
      throw new McPa2ServiceError(`Evaluación ${evaluationId} no existe`);
    }
    return row;
  }

  async getSpecialtyResults(
    evaluationId: string,
  ): Promise<McProfileSpecialtyResult[]> {
    return this.specialtyResults.find({
      where: { profile_evaluation_id: evaluationId },
      order: { rank: 'ASC' },
    });
  }

  /**
   * Persistencia atómica de N evaluaciones de dominio (MC1.1B + MC1.2/1C.2).
   * - Crea Evaluation Set + outcomes por dominio candidato.
   * - Máximo un activateOnPersist=true (publicación provisional 1B).
   * - Si hay ganador: desactiva TODAS las activas de la persona y publica solo esa.
   * - Si no hay ganador: inserta inactivas sin tocar activas previas.
   * - Todo-o-nada en una sola transacción.
   * - No ejecuta Cross-Domain Resolver ni Professional Classification.
   *
   * Política de fallos (provisional): cualquier error SQL/insert invalida el run
   * completo (ROLLBACK). PARTIAL aún no se produce en runtime porque PA2 se
   * ejecuta en dry-run antes y solo llegan ítems evaluables.
   */
  async persistMultidomainEvaluationRun(
    items: McPa2MultidomainPersistItem[],
  ): Promise<PersistMultidomainEvaluationRunResult> {
    if (!items.length) {
      throw new McPa2ServiceError('persistMultidomainEvaluationRun: sin ítems');
    }
    this.assertMultidomainSharedContext(items);

    const personId = items[0].meta.personId;
    const winners = items.filter((i) => i.activateOnPersist);
    if (winners.length > 1) {
      throw new McPa2ServiceError(
        `persistMultidomainEvaluationRun: ${winners.length} ganadores; máximo 1`,
      );
    }
    const hasWinner = winners.length === 1;

    const domainCodes = items.map((i) => i.meta.domainCode.toUpperCase());
    if (new Set(domainCodes).size !== domainCodes.length) {
      throw new McPa2ServiceError(
        'persistMultidomainEvaluationRun: dominio duplicado en el run',
      );
    }

    const candidates: McEvaluationSetCandidateDomain[] = items.map((item) => ({
      domainCode: item.meta.domainCode.toUpperCase(),
      mappingPackCode: item.meta.mappingPackCode,
      mappingPackVersion: item.meta.mappingPackVersion,
      mappingHash: item.meta.mappingHash,
      engineRulesVersion: item.config.engineRulesVersion,
      algorithmVersion: item.meta.algorithmVersion,
      configHash: item.meta.configHash,
    }));

    const contextInput = {
      personId: items[0].meta.personId,
      extractionId: items[0].meta.extractionId,
      enrichmentId: items[0].meta.enrichmentId,
      evidenceEvaluationId: items[0].meta.evidenceEvaluationId,
      catalogVersionId: items[0].meta.catalogVersionId,
      qualificationPolicyVersion: MC_QUALIFICATION_POLICY_VERSION,
      candidateDomains: candidates,
    };
    const setContextHash = computeMcEvaluationSetContextHash(contextInput);
    const snapshot = buildMcEvaluationSetContextPayload(contextInput)
      .candidateDomains;

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        MC_CATALOG_ADVISORY_LOCK_NS,
        3,
      ]);

      const setRow = manager.create(McEvaluationSet, {
        person_id: items[0].meta.personId,
        person_cv_id: items[0].meta.personCvId,
        extraction_id: items[0].meta.extractionId,
        enrichment_id: items[0].meta.enrichmentId,
        evidence_evaluation_id: items[0].meta.evidenceEvaluationId,
        catalog_version_id: items[0].meta.catalogVersionId,
        source_hash: items[0].meta.sourceHash,
        schema_version: MC_EVALUATION_SET_SCHEMA_VERSION,
        qualification_policy_version: MC_QUALIFICATION_POLICY_VERSION,
        candidate_domains_snapshot: snapshot,
        set_context_hash: setContextHash,
        status: 'RUNNING',
        warnings: null,
        completed_at: null,
        failed_at: null,
      });
      const savedSet = await manager.save(setRow);

      // Filas candidatas iniciales (NOT_EVALUATED) — fuente autoritativa del universo.
      for (const item of items) {
        await manager.save(
          manager.create(McEvaluationSetDomain, {
            evaluation_set_id: savedSet.id,
            domain_code: item.meta.domainCode.toUpperCase(),
            domain_status: 'NOT_EVALUATED',
            profile_evaluation_id: null,
            domain_qualification: null,
            mapping_pack_code: item.meta.mappingPackCode,
            mapping_pack_version: item.meta.mappingPackVersion,
            mapping_hash: item.meta.mappingHash,
            engine_rules_version: item.config.engineRulesVersion,
            algorithm_version: item.meta.algorithmVersion,
            config_hash: item.meta.configHash,
            failure_code: null,
            failure_message: null,
            skip_reason: null,
            completed_at: null,
          }),
        );
      }

      if (hasWinner) {
        await manager
          .createQueryBuilder()
          .update(McProfileEvaluation)
          .set({ is_active: false })
          .where('person_id = :personId', { personId })
          .andWhere('is_active = TRUE')
          .execute();
      }

      const domainResults: PersistMultidomainEvaluationRunResult['domainResults'] =
        [];

      for (const item of items) {
        const isActive = hasWinner && item.activateOnPersist;
        const saved = await this.insertEvaluationRow(manager, {
          meta: item.meta,
          result: item.result,
          config: item.config,
          inputSkillsCount: item.inputSkillsCount,
          domainQualification: item.domainQualification,
          isActive,
        });

        await manager
          .createQueryBuilder()
          .update(McEvaluationSetDomain)
          .set({
            domain_status: 'SUCCEEDED',
            profile_evaluation_id: saved.id,
            domain_qualification: item.domainQualification,
            completed_at: new Date(),
          })
          .where('evaluation_set_id = :setId', { setId: savedSet.id })
          .andWhere('domain_code = :domainCode', {
            domainCode: item.meta.domainCode.toUpperCase(),
          })
          .execute();

        domainResults.push({
          domainCode: item.meta.domainCode.toUpperCase(),
          domainStatus: 'SUCCEEDED',
          profileEvaluationId: saved.id,
          domainQualification: item.domainQualification,
          isActive,
          engineRulesVersion: item.config.engineRulesVersion,
          mappingPackCode: item.meta.mappingPackCode,
          mappingPackVersion: item.meta.mappingPackVersion,
        });
      }

      // Runtime actual: todos los ítems llegan ya evaluados → COMPLETE.
      // COMPLETE ≠ tiene PRIMARY_MATCH / ganador publicado.
      const setStatus = 'COMPLETE' as const;
      await manager
        .createQueryBuilder()
        .update(McEvaluationSet)
        .set({
          status: setStatus,
          completed_at: new Date(),
        })
        .where('id = :id', { id: savedSet.id })
        .execute();

      this.logger.log(
        `PA2 multidomain set=${savedSet.id} status=${setStatus} ` +
          `person=${personId} domains=${domainResults.length} ` +
          `winner=${winners[0]?.meta.domainCode ?? 'NONE'} ` +
          `hash=${setContextHash.slice(0, 12)}…`,
      );

      return {
        evaluationSetId: savedSet.id,
        evaluationSetStatus: setStatus,
        contextHash: setContextHash,
        schemaVersion: MC_EVALUATION_SET_SCHEMA_VERSION,
        qualificationPolicyVersion: MC_QUALIFICATION_POLICY_VERSION,
        domainResults,
      };
    });
  }

  private assertMultidomainSharedContext(
    items: McPa2MultidomainPersistItem[],
  ): void {
    const first = items[0].meta;
    for (const item of items) {
      const m = item.meta;
      if (m.personId !== first.personId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: personId inconsistente entre ítems',
        );
      }
      if (m.extractionId !== first.extractionId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: extractionId inconsistente',
        );
      }
      if (m.enrichmentId !== first.enrichmentId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: enrichmentId inconsistente',
        );
      }
      if (m.evidenceEvaluationId !== first.evidenceEvaluationId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: evidenceEvaluationId inconsistente',
        );
      }
      if (m.catalogVersionId !== first.catalogVersionId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: catalogVersionId inconsistente',
        );
      }
      if (m.personCvId !== first.personCvId) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: personCvId inconsistente',
        );
      }
      if (m.sourceHash !== first.sourceHash) {
        throw new McPa2ServiceError(
          'persistMultidomainEvaluationRun: sourceHash inconsistente',
        );
      }
    }
  }

  private async persistEvaluation(params: {
    meta: McPa2EvaluateOutcome['meta'];
    result: McPa2EngineRunResult;
    config: McPa2EngineConfig;
    inputSkillsCount: number;
    domainQualification?: McDomainQualification | null;
    activateOnPersist?: boolean;
  }): Promise<McPa2EvaluateOutcome> {
    const activateOnPersist = params.activateOnPersist !== false;

    if (activateOnPersist) {
      const existing = await this.evaluations.findOne({
        where: {
          extraction_id: params.meta.extractionId,
          domain_id: params.meta.domainId,
          catalog_version_id: params.meta.catalogVersionId,
          engine_rules_version: params.config.engineRulesVersion,
          config_hash: params.meta.configHash,
          mapping_hash: params.meta.mappingHash,
          is_active: true,
          status: 'SUCCEEDED',
        },
      });
      if (existing) {
        return {
          dryRun: false,
          evaluationId: existing.id,
          outcome: 'ALREADY_EXISTS',
          result: params.result,
          inputSkillsCount: params.inputSkillsCount,
          meta: params.meta,
        };
      }
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        MC_CATALOG_ADVISORY_LOCK_NS,
        3,
      ]);

      if (activateOnPersist) {
        // MC1.1B: desactivación global por persona (máx. 1 activa publicada).
        await manager
          .createQueryBuilder()
          .update(McProfileEvaluation)
          .set({ is_active: false })
          .where('person_id = :personId', {
            personId: params.meta.personId,
          })
          .andWhere('is_active = TRUE')
          .execute();
      }
      // Inactiva: no desactiva activas previas (evita dejar sin resultado
      // visible cuando el run no tiene ganador).

      const saved = await this.insertEvaluationRow(manager, {
        meta: params.meta,
        result: params.result,
        config: params.config,
        inputSkillsCount: params.inputSkillsCount,
        domainQualification: params.domainQualification ?? null,
        isActive: activateOnPersist,
      });

      return {
        dryRun: false,
        evaluationId: saved.id,
        outcome: 'SEEDED',
        result: params.result,
        inputSkillsCount: params.inputSkillsCount,
        meta: params.meta,
      };
    });
  }

  private async insertEvaluationRow(
    manager: {
      create: (entity: unknown, data: Record<string, unknown>) => unknown;
      save: (entity: unknown) => Promise<{ id: string }>;
    },
    params: {
      meta: McPa2EvaluateOutcome['meta'];
      result: McPa2EngineRunResult;
      config: McPa2EngineConfig;
      inputSkillsCount: number;
      domainQualification: McDomainQualification | null;
      isActive: boolean;
    },
  ): Promise<{ id: string }> {
    const startedAt = new Date();
    const evalRow = manager.create(McProfileEvaluation, {
      person_id: params.meta.personId,
      person_cv_id: params.meta.personCvId,
      extraction_id: params.meta.extractionId,
      enrichment_id: params.meta.enrichmentId,
      evidence_evaluation_id: params.meta.evidenceEvaluationId,
      catalog_version_id: params.meta.catalogVersionId,
      domain_id: params.meta.domainId,
      domain_code: params.meta.domainCode,
      engine_rules_version: params.config.engineRulesVersion,
      config_hash: params.meta.configHash,
      mapping_hash: params.meta.mappingHash,
      mapping_pack_code: params.meta.mappingPackCode,
      mapping_pack_version: params.meta.mappingPackVersion,
      source_hash: params.meta.sourceHash,
      algorithm_version: params.meta.algorithmVersion,
      evaluation_context_hash: params.meta.evaluationContextHash,
      domain_qualification: params.domainQualification,
      status: 'SUCCEEDED',
      is_active: params.isActive,
      input_skills_count: params.inputSkillsCount,
      specialty_count: params.result.specialtyResults.length,
      active_count: params.result.activeCount,
      emergent_count: params.result.emergentCount,
      hidden_count: params.result.hiddenCount,
      default_specialty_code: params.result.defaultSpecialtyCode,
      warnings: params.result.warnings,
      metrics: {
        engineRulesVersion: params.result.engineRulesVersion,
        configHash: params.result.configHash,
        algorithmVersion: params.meta.algorithmVersion,
        evaluationContextHash: params.meta.evaluationContextHash,
      },
      started_at: startedAt,
      completed_at: new Date(),
    });
    const saved = await manager.save(evalRow);

    for (const r of params.result.specialtyResults) {
      await manager.save(
        manager.create(McProfileSpecialtyResult, {
          profile_evaluation_id: saved.id,
          specialty_id: r.specialtyId,
          specialty_code: r.specialtyCode,
          lifecycle_status: r.lifecycleStatus,
          presentation_status: r.presentationStatus,
          mapped_skill_count: r.mappedSkillCount,
          evidenced_skill_count: r.evidencedSkillCount,
          coverage: String(r.coverage),
          confidence: String(r.confidence),
          strength: String(r.strength),
          rank: r.rank,
          is_default: r.isDefault,
          ranking_score: String(r.rankingScore),
          reasons: r.reasons,
          warnings: r.warnings,
          skill_breakdown: r.skillBreakdown,
        }),
      );
    }

    this.logger.log(
      `PA2 evaluation id=${saved.id} extraction=${params.meta.extractionId} ` +
        `domain=${params.meta.domainCode} default=${params.result.defaultSpecialtyCode} ` +
        `active=${params.isActive}`,
    );
    return saved;
  }

  /**
   * Auditoría RO de una evaluación histórica: completeness del contexto.
   */
  async reportHistoricalContext(
    evaluationId: string,
  ): Promise<McHistoricalContextReport> {
    const row = await this.evaluations.findOne({
      where: { id: evaluationId },
    });
    if (!row) {
      throw new McPa2ServiceError(`Evaluación ${evaluationId} no existe`);
    }

    const missing: string[] = [];
    const notes: string[] = [];
    if (!row.mapping_pack_code) missing.push('mapping_pack_code');
    if (!row.mapping_pack_version) missing.push('mapping_pack_version');
    if (!row.source_hash) missing.push('source_hash');
    if (!row.algorithm_version) missing.push('algorithm_version');
    if (!row.evaluation_context_hash) missing.push('evaluation_context_hash');

    const reconstructed: McHistoricalContextReport['reconstructed'] = {};

    if (!row.source_hash) {
      const ext = await this.loadExtraction(row.extraction_id);
      reconstructed.sourceHash = ext.pdf_sha256.toLowerCase();
      notes.push('source_hash reconstruido desde cv_extraction.pdf_sha256');
    }
    if (!row.mapping_pack_code || !row.mapping_pack_version) {
      const reg = resolveMcMappingPack(row.domain_code);
      const hash = computeMcMappingPackHash(reg.pack);
      if (hash === row.mapping_hash) {
        reconstructed.mappingPackCode = reg.packCode;
        reconstructed.mappingPackVersion = reg.mappingRulesVersion;
        notes.push(
          'pack reconstruido por igualdad mapping_hash ↔ pack registrado',
        );
      } else {
        notes.push(
          'mapping_hash no coincide con pack registrado actual; pack no inequívoco',
        );
      }
    }
    if (!row.algorithm_version) {
      try {
        const cfg = resolveMcPa2EngineConfig(row.engine_rules_version);
        if (computeMcPa2ConfigHash(cfg) === row.config_hash) {
          reconstructed.algorithmVersion = resolveMcPa2AlgorithmVersion(cfg);
          notes.push(
            'algorithm_version reconstruido por fingerprint de regla+config_hash',
          );
        } else {
          notes.push(
            'config_hash no coincide con regla actual; algorithm no inequívoco',
          );
        }
      } catch {
        notes.push('regla PA2 desconocida en código actual');
      }
    }

    let status: McHistoricalContextReport['status'] = 'context_complete';
    if (missing.length === 0) {
      status = 'context_complete';
    } else if (
      (row.source_hash || reconstructed.sourceHash) &&
      (row.mapping_pack_version || reconstructed.mappingPackVersion) &&
      (row.algorithm_version || reconstructed.algorithmVersion)
    ) {
      status = 'context_partially_reconstructible';
    } else if (missing.length > 0) {
      status =
        reconstructed.sourceHash || reconstructed.mappingPackVersion
          ? 'context_partially_reconstructible'
          : 'context_incomplete';
    }

    return {
      evaluationId: row.id,
      status,
      persisted: {
        mappingPackCode: row.mapping_pack_code,
        mappingPackVersion: row.mapping_pack_version,
        sourceHash: row.source_hash,
        algorithmVersion: row.algorithm_version,
        evaluationContextHash: row.evaluation_context_hash,
        engineRulesVersion: row.engine_rules_version,
        configHash: row.config_hash,
        mappingHash: row.mapping_hash,
        domainCode: row.domain_code,
      },
      reconstructed,
      missing,
      notes,
    };
  }
  /**
   * Abort guards MC1.6.1B/B.2: persona activa, CV activo = extracción,
   * extracción SUCCEEDED+activa, enrichment misma cadena+hash.
   * @returns source_hash (pdf_sha256) coherente
   */
  private async assertEvaluationChainCoherent(extraction: {
    id: string;
    person_id: string;
    person_cv_id: string;
    status: string;
    is_active: boolean;
    pdf_sha256: string;
  }): Promise<string> {
    if (!extraction.is_active) {
      throw new McPa2ServiceError(
        `Extracción ${extraction.id} no está activa; abortando evaluación`,
      );
    }
    if (!extraction.pdf_sha256?.trim()) {
      throw new McPa2ServiceError(
        `Extracción ${extraction.id} sin pdf_sha256; abortando`,
      );
    }

    const persons = (await this.dataSource.query(
      `SELECT id::text, is_active FROM core.person WHERE id = $1`,
      [extraction.person_id],
    )) as Array<{ id: string; is_active: boolean }>;
    if (!persons[0]?.is_active) {
      throw new McPa2ServiceError(
        `Persona ${extraction.person_id} no está activa; abortando evaluación`,
      );
    }

    const cvs = (await this.dataSource.query(
      `SELECT id::text, is_active FROM organigrama.person_cv
        WHERE person_id = $1 AND is_active = TRUE
        ORDER BY id DESC LIMIT 1`,
      [extraction.person_id],
    )) as Array<{ id: string; is_active: boolean }>;
    if (!cvs[0]) {
      throw new McPa2ServiceError(
        `Persona ${extraction.person_id} sin CV activo; abortando evaluación`,
      );
    }
    if (cvs[0].id !== extraction.person_cv_id) {
      throw new McPa2ServiceError(
        `CV activo ${cvs[0].id} != person_cv de extracción ${extraction.person_cv_id}; abortando`,
      );
    }

    const enrichments = (await this.dataSource.query(
      `SELECT id::text, status, is_active, pdf_sha256
         FROM organigrama.cv_skill_enrichment
        WHERE extraction_id = $1 AND is_active = TRUE
        ORDER BY id DESC LIMIT 1`,
      [extraction.id],
    )) as Array<{
      id: string;
      status: string;
      is_active: boolean;
      pdf_sha256: string;
    }>;
    if (!enrichments[0] || enrichments[0].status !== 'SUCCEEDED') {
      throw new McPa2ServiceError(
        `Sin enrichment SUCCEEDED activo para extracción ${extraction.id}; abortando`,
      );
    }
    if (
      String(enrichments[0].pdf_sha256).toLowerCase() !==
      String(extraction.pdf_sha256).toLowerCase()
    ) {
      throw new McPa2ServiceError(
        `source_hash mismatch extracción/enrichment; abortando evaluación`,
      );
    }
    return extraction.pdf_sha256.toLowerCase();
  }

  private async loadExtraction(extractionId: string): Promise<{
    id: string;
    person_id: string;
    person_cv_id: string;
    status: string;
    is_active: boolean;
    pdf_sha256: string;
  }> {
    const rows = (await this.dataSource.query(
      `SELECT id::text, person_id::text, person_cv_id::text, status, is_active,
              pdf_sha256
         FROM organigrama.cv_extraction
        WHERE id = $1`,
      [extractionId],
    )) as Array<{
      id: string;
      person_id: string;
      person_cv_id: string;
      status: string;
      is_active: boolean;
      pdf_sha256: string;
    }>;
    if (!rows[0]) {
      throw new McPa2ServiceError(`Extracción ${extractionId} no existe`);
    }
    if (rows[0].status !== 'SUCCEEDED') {
      throw new McPa2ServiceError(
        `Extracción ${extractionId} no está SUCCEEDED (status=${rows[0].status})`,
      );
    }
    return rows[0];
  }

  private async loadEvidenceEvaluation(params: {
    extractionId: string;
    evidenceEvaluationId?: string;
  }): Promise<{
    id: string;
    enrichment_id: string;
    extraction_id: string;
    status: string;
    is_active: boolean;
  }> {
    let rows: Array<{
      id: string;
      enrichment_id: string;
      extraction_id: string;
      status: string;
      is_active: boolean;
    }>;

    if (params.evidenceEvaluationId) {
      rows = await this.dataSource.query(
        `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
           FROM organigrama.cv_evidence_evaluation
          WHERE id = $1`,
        [params.evidenceEvaluationId],
      );
    } else {
      rows = await this.dataSource.query(
        `SELECT id::text, enrichment_id::text, extraction_id::text, status, is_active
           FROM organigrama.cv_evidence_evaluation
          WHERE extraction_id = $1 AND is_active = TRUE
          ORDER BY id DESC
          LIMIT 1`,
        [params.extractionId],
      );
    }

    if (!rows[0]) {
      throw new McPa2ServiceError(
        `No hay evidence evaluation para extraction ${params.extractionId}`,
      );
    }
    if (rows[0].extraction_id !== params.extractionId) {
      throw new McPa2ServiceError(
        `Evidence evaluation ${rows[0].id} no corresponde a extraction ${params.extractionId}`,
      );
    }
    if (rows[0].status !== 'SUCCEEDED') {
      throw new McPa2ServiceError(
        `Evidence evaluation ${rows[0].id} status=${rows[0].status}`,
      );
    }
    return rows[0];
  }

  private async loadCatalog(catalogVersion?: string): Promise<McCatalogVersion> {
    if (catalogVersion) {
      const row = await this.versions.findOne({
        where: { version: catalogVersion },
      });
      if (!row) {
        throw new McPa2ServiceError(
          `Catálogo versión ${catalogVersion} no encontrado`,
        );
      }
      return row;
    }
    const row = await this.versions.findOne({ where: { is_active: true } });
    if (!row) {
      throw new McPa2ServiceError('No hay catálogo MC1 activo');
    }
    return row;
  }

  private async loadSkillEvidence(
    extractionId: string,
    evidenceEvaluationId: string,
  ): Promise<McPa2SkillEvidenceInput[]> {
    const rows = (await this.dataSource.query(
      `SELECT
          es.skill_id::text AS skill_id,
          s.normalized_key,
          s.normalized_name,
          s.skill_type,
          ev.evidence_level,
          ev.evidence_strength::float8 AS evidence_strength,
          ev.evidence_confidence::float8 AS evidence_confidence
         FROM organigrama.cv_extraction_skill es
         JOIN organigrama.cv_skill s ON s.id = es.skill_id
         JOIN organigrama.cv_evidence_evaluation_item ev
           ON ev.extraction_skill_id = es.id
          AND ev.evaluation_id = $2
        WHERE es.extraction_id = $1
        ORDER BY es.sort_order, es.id`,
      [extractionId, evidenceEvaluationId],
    )) as Array<{
      skill_id: string;
      normalized_key: string;
      normalized_name: string;
      skill_type: string;
      evidence_level: McEvidenceLevel;
      evidence_strength: number;
      evidence_confidence: number;
    }>;

    if (!rows.length) {
      throw new McPa2ServiceError(
        `Sin skills/evidencia para extraction=${extractionId} evaluation=${evidenceEvaluationId}`,
      );
    }

    return rows.map((r) => ({
      skillId: r.skill_id,
      skillKey: r.normalized_key,
      skillName: r.normalized_name,
      skillType: r.skill_type,
      evidenceLevel: r.evidence_level,
      evidenceStrength: Number(r.evidence_strength),
      evidenceConfidence: Number(r.evidence_confidence),
    }));
  }
}
