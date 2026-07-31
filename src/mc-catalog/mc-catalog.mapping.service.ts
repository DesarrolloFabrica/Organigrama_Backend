/**
 * Seed e inspección de clasificaciones + mappings MC1.
 * Identidad: cv_skill.id vía (normalized_key, skill_type).
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MC_CATALOG_ADVISORY_LOCK_NS } from './mc-catalog.constants';
import { computeMcMappingPackHash } from './mc-catalog.mapping-hash';
import {
  listMcMappingDomainCodes,
  resolveMcMappingPack,
} from './mc-catalog.mapping-registry';
import {
  MC_SOFTWARE_EXPECTED_DISTRIBUTION,
  MC_SOFTWARE_MAPPING_PACK,
} from './mc-catalog.mapping-software-mc11';
import {
  assertExpectedDistribution,
  McMappingValidationError,
  seedSkillKey,
  validateMappingPack,
} from './mc-catalog.mapping-validation';
import type {
  McDomainMappingPack,
  McSkillClassificationStatus,
  McSkillMappingType,
} from './mc-catalog.types';
import {
  McCatalogVersion,
  McDomain,
  McMappingPackRelease,
  McSkillDomainClassification,
  McSkillSpecialtyMapping,
  McSpecialty,
} from './entities';

export class McMappingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McMappingError';
  }
}

export interface McMappingSeedOutcome {
  outcome: 'ALREADY_SEEDED' | 'SEEDED' | 'RESEEDED';
  catalogVersionId: string;
  domainCode: string;
  mappingPackCode: string;
  mappingRulesVersion: string;
  mappingHash: string;
  classificationCount: number;
  mappingCount: number;
  distribution: Record<McSkillClassificationStatus, number>;
}

export interface McSkillMappingView {
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: string;
  classification: McSkillClassificationStatus;
  classificationRationale: string | null;
  mappings: Array<{
    specialtyCode: string;
    specialtyName: string;
    weight: number;
    mappingType: McSkillMappingType;
    rationale: string | null;
  }>;
}

@Injectable()
export class McMappingService {
  private readonly logger = new Logger(McMappingService.name);

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
    @InjectRepository(McMappingPackRelease)
    private readonly packReleases: Repository<McMappingPackRelease>,
  ) {}

  packHash(pack: McDomainMappingPack = MC_SOFTWARE_MAPPING_PACK): string {
    return computeMcMappingPackHash(pack);
  }

  /**
   * Valida el pack SOFTWARE contra especialidades ACTIVE del catálogo activo
   * y contra la distribución MC1.1 esperada (42/14/3/0/0).
   */
  async validateSoftwarePackOrThrow(
    pack: McDomainMappingPack = MC_SOFTWARE_MAPPING_PACK,
  ): Promise<ReturnType<typeof validateMappingPack>> {
    const catalog = await this.requireActiveCatalog();
    const domain = await this.requireDomain(catalog.id, pack.domainCode);
    const specs = await this.specialties.find({
      where: {
        catalog_version_id: catalog.id,
        domain_id: domain.id,
        lifecycle_status: 'ACTIVE',
        is_active: true,
      },
    });
    const codes = new Set(specs.map((s) => s.code));
    const result = validateMappingPack(pack, codes);
    assertExpectedDistribution(
      result.classificationCounts,
      MC_SOFTWARE_EXPECTED_DISTRIBUTION,
    );
    return result;
  }

  async seedSoftwareMappings(params: {
    catalogVersion?: string;
  } = {}): Promise<McMappingSeedOutcome> {
    return this.seedDomainMappings({
      domainCode: 'SOFTWARE',
      catalogVersion: params.catalogVersion,
    });
  }

  /**
   * Siembra clasificaciones + mappings de un dominio registrado.
   * Idempotente por (catalogVersion, domain) si el pack coincide.
   * Con forceReseed=true: desactiva mappings/classifications del dominio y resiembra
   * (p.ej. upgrade Visual V1 → V2). No toca otros dominios ni packs publicados.
   */
  async seedDomainMappings(params: {
    domainCode: string;
    catalogVersion?: string;
    forceReseed?: boolean;
  }): Promise<McMappingSeedOutcome> {
    const { pack, packCode, mappingRulesVersion, expectedDistribution } =
      resolveMcMappingPack(params.domainCode);
    const mappingHash = this.packHash(pack);

    // Inmutabilidad: misma versión publicada no puede cambiar de contenido.
    await this.publishOrAssertPackRelease({
      packCode,
      packVersion: mappingRulesVersion,
      domainCode: pack.domainCode,
      contentHash: mappingHash,
      sourceRef: pack.sourceRef ?? null,
    });

    const catalog = await this.requireCatalog(params.catalogVersion);
    const domain = await this.requireDomain(catalog.id, pack.domainCode);

    const specs = await this.specialties.find({
      where: {
        catalog_version_id: catalog.id,
        domain_id: domain.id,
        is_active: true,
      },
    });
    const activeCodes = new Set(
      specs
        .filter((s) => s.lifecycle_status === 'ACTIVE')
        .map((s) => s.code),
    );
    const validation = validateMappingPack(pack, activeCodes);
    assertExpectedDistribution(
      validation.classificationCounts,
      expectedDistribution,
    );

    const existingClassCount = await this.classifications.count({
      where: {
        catalog_version_id: catalog.id,
        domain_id: domain.id,
        is_active: true,
      },
    });
    const existingMapCount = await this.countMappingsForDomain(
      catalog.id,
      domain.id,
    );

    if (existingClassCount > 0 || existingMapCount > 0) {
      if (!params.forceReseed) {
        try {
          await this.assertPersistedMatchesPack(catalog.id, domain.id, pack);
          return {
            outcome: 'ALREADY_SEEDED',
            catalogVersionId: catalog.id,
            domainCode: pack.domainCode,
            mappingPackCode: packCode,
            mappingRulesVersion,
            mappingHash,
            classificationCount: existingClassCount,
            mappingCount: existingMapCount,
            distribution: validation.classificationCounts,
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new McMappingError(
            `${msg} Use --force-reseed --i-confirm-reseed para reemplazar ` +
              `mappings del dominio con pack ${packCode}@${mappingRulesVersion}.`,
          );
        }
      }
      this.logger.warn(
        `Reseed forzado: dominio ${pack.domainCode} → pack ${packCode}@${mappingRulesVersion}`,
      );
      await this.deactivateDomainMappings(catalog.id, domain.id, specs.map((s) => s.id));
    }

    const skillIdByKey = await this.resolveSkillIds(pack);

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        MC_CATALOG_ADVISORY_LOCK_NS,
        2,
      ]);

      const raced = await manager.count(McSkillDomainClassification, {
        where: {
          catalog_version_id: catalog.id,
          domain_id: domain.id,
          is_active: true,
        },
      });
      if (raced > 0 && !params.forceReseed) {
        throw new McMappingError(
          'Seed concurrente de mappings detectado; reintentar.',
        );
      }

      const specialtyIdByCode = new Map(
        specs.map((s) => [s.code, s.id] as const),
      );
      const reseed = params.forceReseed === true;

      for (const c of pack.classifications) {
        const skillId = skillIdByKey.get(
          seedSkillKey(c.skillKey, c.skillType),
        );
        if (!skillId) {
          throw new McMappingError(
            `Skill no resuelta: ${c.skillName} (${c.skillKey}/${c.skillType})`,
          );
        }
        if (reseed) {
          const existing = await manager.findOne(McSkillDomainClassification, {
            where: {
              catalog_version_id: catalog.id,
              domain_id: domain.id,
              skill_id: skillId,
            },
          });
          if (existing) {
            existing.classification = c.classification;
            existing.rationale = c.rationale;
            existing.is_active = true;
            await manager.save(existing);
            continue;
          }
        }
        await manager.save(
          manager.create(McSkillDomainClassification, {
            catalog_version_id: catalog.id,
            domain_id: domain.id,
            skill_id: skillId,
            classification: c.classification,
            rationale: c.rationale,
            is_active: true,
          }),
        );
      }

      for (const m of pack.mappings) {
        const skillId = skillIdByKey.get(
          seedSkillKey(m.skillKey, m.skillType),
        );
        const specialtyId = specialtyIdByCode.get(m.specialtyCode);
        if (!skillId) {
          throw new McMappingError(
            `Skill no resuelta en mapping: ${m.skillKey}/${m.skillType}`,
          );
        }
        if (!specialtyId) {
          throw new McMappingError(
            `Especialidad no encontrada: ${m.specialtyCode}`,
          );
        }
        if (reseed) {
          const existing = await manager.findOne(McSkillSpecialtyMapping, {
            where: {
              catalog_version_id: catalog.id,
              skill_id: skillId,
              specialty_id: specialtyId,
            },
          });
          if (existing) {
            existing.weight = String(m.weight);
            existing.mapping_type = m.mappingType;
            existing.rationale = m.rationale;
            existing.is_active = true;
            await manager.save(existing);
            continue;
          }
        }
        await manager.save(
          manager.create(McSkillSpecialtyMapping, {
            catalog_version_id: catalog.id,
            skill_id: skillId,
            specialty_id: specialtyId,
            weight: String(m.weight),
            mapping_type: m.mappingType,
            rationale: m.rationale,
            is_active: true,
          }),
        );
      }

      this.logger.log(
        `Mappings ${pack.domainCode} sembrados (catalog=${catalog.version}, ` +
          `classifications=${pack.classifications.length}, ` +
          `mappings=${pack.mappings.length}, hash=${mappingHash.slice(0, 12)}…)`,
      );

      return {
        outcome: params.forceReseed ? 'RESEEDED' : 'SEEDED',
        catalogVersionId: catalog.id,
        domainCode: pack.domainCode,
        mappingPackCode: packCode,
        mappingRulesVersion,
        mappingHash,
        classificationCount: pack.classifications.length,
        mappingCount: pack.mappings.length,
        distribution: validation.classificationCounts,
      };
    });
  }

  /** Desactiva classifications + mappings del dominio (no borra filas). */
  private async deactivateDomainMappings(
    catalogVersionId: string,
    domainId: string,
    specialtyIds: string[],
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(McSkillDomainClassification)
        .set({ is_active: false })
        .where('catalog_version_id = :cv', { cv: catalogVersionId })
        .andWhere('domain_id = :d', { d: domainId })
        .andWhere('is_active = TRUE')
        .execute();
      if (specialtyIds.length > 0) {
        await manager
          .createQueryBuilder()
          .update(McSkillSpecialtyMapping)
          .set({ is_active: false })
          .where('catalog_version_id = :cv', { cv: catalogVersionId })
          .andWhere('specialty_id IN (:...ids)', { ids: specialtyIds })
          .andWhere('is_active = TRUE')
          .execute();
      }
    });
  }

  /**
   * Publica o valida un release de pack.
   * Si (pack_code, pack_version) existe con otro content_hash → error (no mutar).
   */
  async publishOrAssertPackRelease(params: {
    packCode: string;
    packVersion: string;
    domainCode: string;
    contentHash: string;
    sourceRef?: string | null;
  }): Promise<McMappingPackRelease> {
    const existing = await this.packReleases.findOne({
      where: {
        pack_code: params.packCode,
        pack_version: params.packVersion,
      },
    });
    if (existing) {
      if (existing.content_hash !== params.contentHash) {
        throw new McMappingError(
          `Pack ${params.packCode}@${params.packVersion} ya PUBLISHED con hash ` +
            `${existing.content_hash.slice(0, 12)}…; intento=${params.contentHash.slice(0, 12)}…. ` +
            `Crear nueva pack_version (no editar in-place).`,
        );
      }
      if (existing.status === 'RETIRED') {
        throw new McMappingError(
          `Pack ${params.packCode}@${params.packVersion} está RETIRED.`,
        );
      }
      return existing;
    }

    const row = this.packReleases.create({
      pack_code: params.packCode,
      pack_version: params.packVersion,
      domain_code: params.domainCode.toUpperCase(),
      content_hash: params.contentHash,
      status: 'PUBLISHED',
      source_ref: params.sourceRef ?? null,
    });
    return this.packReleases.save(row);
  }

  listRegisteredDomains(): string[] {
    return listMcMappingDomainCodes();
  }

  async loadSkillMappings(params: {
    catalogVersion?: string;
    domainCode?: string;
  } = {}): Promise<McSkillMappingView[]> {
    const domainCode = (params.domainCode ?? 'SOFTWARE').toUpperCase();
    const catalog = await this.requireCatalog(params.catalogVersion);
    const domain = await this.requireDomain(catalog.id, domainCode);

    const classRows = await this.classifications.find({
      where: { catalog_version_id: catalog.id, domain_id: domain.id },
    });
    const specs = await this.specialties.find({
      where: { catalog_version_id: catalog.id, domain_id: domain.id },
    });
    const specById = new Map(specs.map((s) => [s.id, s]));
    const specialtyIds = specs.map((s) => s.id);

    const mapRows =
      specialtyIds.length === 0
        ? []
        : await this.mappings
            .createQueryBuilder('m')
            .where('m.catalog_version_id = :cv', { cv: catalog.id })
            .andWhere('m.is_active = TRUE')
            .andWhere('m.specialty_id IN (:...ids)', { ids: specialtyIds })
            .getMany();

    const skillIds = [...new Set(classRows.map((c) => c.skill_id))];
    const skills =
      skillIds.length === 0
        ? []
        : ((await this.dataSource.query(
            `SELECT id::text, normalized_key, normalized_name, skill_type
               FROM organigrama.cv_skill
              WHERE id = ANY($1::bigint[])`,
            [skillIds],
          )) as Array<{
            id: string;
            normalized_key: string;
            normalized_name: string;
            skill_type: string;
          }>);
    const skillById = new Map(skills.map((s) => [s.id, s]));

    return classRows.map((c) => {
      const skill = skillById.get(c.skill_id);
      const related = mapRows
        .filter((m) => m.skill_id === c.skill_id)
        .map((m) => {
          const spec = specById.get(m.specialty_id);
          return {
            specialtyCode: spec?.code ?? 'UNKNOWN',
            specialtyName: spec?.name ?? 'UNKNOWN',
            weight: Number(m.weight),
            mappingType: m.mapping_type,
            rationale: m.rationale,
          };
        })
        .sort((a, b) => b.weight - a.weight);

      return {
        skillId: c.skill_id,
        skillKey: skill?.normalized_key ?? '',
        skillName: skill?.normalized_name ?? '',
        skillType: skill?.skill_type ?? '',
        classification: c.classification,
        classificationRationale: c.rationale,
        mappings: related,
      };
    });
  }

  /**
   * Verifica cobertura de clasificación para una extracción (SOFTWARE histórico: 59).
   * Para otros dominios, exige que cada skill de la extracción tenga clasificación
   * si está en el pack; no exige cardinalidad fija 59.
   */
  async assertExtractionFullyClassified(params: {
    extractionId: string;
    domainCode?: string;
    catalogVersion?: string;
  }): Promise<{
    ok: true;
    extractionId: string;
    skillCount: number;
    classifiedCount: number;
    distribution: Record<McSkillClassificationStatus, number>;
  }> {
    const domainCode = (params.domainCode ?? 'SOFTWARE').toUpperCase();
    const views = await this.loadSkillMappings({
      catalogVersion: params.catalogVersion,
      domainCode,
    });
    const bySkillId = new Map(views.map((v) => [v.skillId, v]));

    const rows = (await this.dataSource.query(
      `SELECT skill_id::text
         FROM organigrama.cv_extraction_skill
        WHERE extraction_id = $1
        ORDER BY sort_order, id`,
      [params.extractionId],
    )) as Array<{ skill_id: string }>;

    if (domainCode === 'SOFTWARE' && rows.length !== 59) {
      throw new McMappingError(
        `Extracción ${params.extractionId} tiene ${rows.length} skills; se esperaban 59`,
      );
    }

    const distribution: Record<McSkillClassificationStatus, number> = {
      DOMAIN_SPECIALTY: 0,
      TRANSVERSAL_FUTURE: 0,
      OUTSIDE_SOFTWARE_DOMAIN: 0,
      AMBIGUOUS: 0,
      CATALOG_GAP: 0,
    };

    let classifiedCount = 0;
    for (const row of rows) {
      const view = bySkillId.get(row.skill_id);
      if (!view) {
        if (domainCode === 'SOFTWARE') {
          throw new McMappingError(
            `Skill ${row.skill_id} de extracción ${params.extractionId} sin clasificación`,
          );
        }
        continue;
      }
      classifiedCount += 1;
      distribution[view.classification] += 1;
    }

    if (domainCode === 'SOFTWARE') {
      assertExpectedDistribution(
        distribution,
        MC_SOFTWARE_EXPECTED_DISTRIBUTION,
      );
    }

    return {
      ok: true,
      extractionId: params.extractionId,
      skillCount: rows.length,
      classifiedCount,
      distribution,
    };
  }

  private async requireActiveCatalog(): Promise<McCatalogVersion> {
    const catalog = await this.versions.findOne({
      where: { is_active: true },
    });
    if (!catalog) {
      throw new McMappingError('No hay catálogo MC1 activo');
    }
    return catalog;
  }

  private async requireCatalog(
    catalogVersion?: string,
  ): Promise<McCatalogVersion> {
    if (catalogVersion) {
      const catalog = await this.versions.findOne({
        where: { version: catalogVersion },
      });
      if (!catalog) {
        throw new McMappingError(
          `Catálogo versión ${catalogVersion} no encontrado`,
        );
      }
      return catalog;
    }
    return this.requireActiveCatalog();
  }

  private async requireDomain(
    catalogVersionId: string,
    domainCode: string,
  ): Promise<McDomain> {
    const domain = await this.domains.findOne({
      where: {
        catalog_version_id: catalogVersionId,
        code: domainCode,
        is_active: true,
      },
    });
    if (!domain) {
      throw new McMappingError(
        `Dominio ${domainCode} no existe o está inactivo`,
      );
    }
    return domain;
  }

  private async resolveSkillIds(
    pack: McDomainMappingPack,
  ): Promise<Map<string, string>> {
    const refs = [
      ...pack.classifications,
      ...pack.mappings,
    ];
    const keys = [...new Set(refs.map((r) => r.skillKey))];
    const rows = (await this.dataSource.query(
      `SELECT id::text, normalized_key, skill_type
         FROM organigrama.cv_skill
        WHERE normalized_key = ANY($1::text[])`,
      [keys],
    )) as Array<{ id: string; normalized_key: string; skill_type: string }>;

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(seedSkillKey(row.normalized_key, row.skill_type), row.id);
    }

    // Crear skills faltantes solo desde classifications (tienen skillName).
    for (const c of pack.classifications) {
      const key = seedSkillKey(c.skillKey, c.skillType);
      if (map.has(key)) continue;
      const inserted = (await this.dataSource.query(
        `INSERT INTO organigrama.cv_skill
           (normalized_name, normalized_key, skill_type, is_active)
         VALUES ($1, $2, $3, TRUE)
         ON CONFLICT (normalized_key, skill_type) DO NOTHING
         RETURNING id::text AS id`,
        [c.skillName, c.skillKey, c.skillType],
      )) as Array<{ id: string }>;
      if (inserted[0]?.id) {
        map.set(key, inserted[0].id);
        this.logger.warn(
          `Skill creada en seed mappings: ${c.skillName} (${key})`,
        );
        continue;
      }
      const again = (await this.dataSource.query(
        `SELECT id::text AS id
           FROM organigrama.cv_skill
          WHERE normalized_key = $1 AND skill_type = $2
          LIMIT 1`,
        [c.skillKey, c.skillType],
      )) as Array<{ id: string }>;
      if (again[0]?.id) {
        map.set(key, again[0].id);
        continue;
      }
      throw new McMappingError(
        `Skill inexistente en cv_skill: ${c.skillName} (${key})`,
      );
    }

    for (const ref of refs) {
      const key = seedSkillKey(ref.skillKey, ref.skillType);
      if (!map.has(key)) {
        throw new McMappingError(
          `Skill inexistente en cv_skill: ${ref.skillKey}/${ref.skillType} (${key})`,
        );
      }
    }
    return map;
  }

  private async countMappingsForDomain(
    catalogVersionId: string,
    domainId: string,
  ): Promise<number> {
    const rows = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS cnt
         FROM organigrama.mc_skill_specialty_mapping m
         JOIN organigrama.mc_specialty s ON s.id = m.specialty_id
        WHERE m.catalog_version_id = $1
          AND s.domain_id = $2
          AND m.is_active = TRUE`,
      [catalogVersionId, domainId],
    )) as Array<{ cnt: number }>;
    return rows[0]?.cnt ?? 0;
  }

  private async assertPersistedMatchesPack(
    catalogVersionId: string,
    domainId: string,
    pack: McDomainMappingPack,
  ): Promise<void> {
    const classCount = await this.classifications.count({
      where: {
        catalog_version_id: catalogVersionId,
        domain_id: domainId,
        is_active: true,
      },
    });
    const mapCount = await this.countMappingsForDomain(
      catalogVersionId,
      domainId,
    );
    if (classCount !== pack.classifications.length) {
      throw new McMappingError(
        `Mappings ya sembrados con classificationCount=${classCount}, ` +
          `esperado ${pack.classifications.length}. No mutar: nueva versión.`,
      );
    }
    if (mapCount !== pack.mappings.length) {
      throw new McMappingError(
        `Mappings ya sembrados con mappingCount=${mapCount}, ` +
          `esperado ${pack.mappings.length}. No mutar: nueva versión.`,
      );
    }
  }
}
