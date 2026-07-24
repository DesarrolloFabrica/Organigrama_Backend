/**
 * Catálogo versionado de atributos (Fase E6).
 *
 * Seed, carga, inspección y activación. No modifica cv_skill ni ninguna capa
 * previa: solo lee cv_skill para resolver skill_id de los mappings declarados.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  PA1_CATALOG_CODE,
  PA1_CATALOG_DESCRIPTION,
  PA1_CATALOG_NAME,
  PA1_CATALOG_VERSION,
  PA1_DEFAULT_TARGET_SUPPORTING_SKILLS,
  PA1_INTENTIONAL_UNMAPPED,
  PA1_MACROS,
  PA1_MAPPINGS,
  PA1_SUBS,
} from './cv-attributes.catalog-pa1';
import { ATTRIBUTE_CATALOG_ADVISORY_LOCK_NS } from './cv-attributes.constants';
import {
  computeCatalogDefinitionHash,
  computeMappingHash,
} from './cv-attributes.hash';
import { validateAttributeCatalog } from './cv-attributes.mapping-validation';
import type {
  AttributeCatalog,
  AttributeUnmappedRelation,
} from './cv-attributes.types';
import {
  CvAttributeCatalogVersion,
  CvMacroattribute,
  CvSkillAttributeMapping,
  CvSubattribute,
} from './entities';

export class CvAttributeCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CvAttributeCatalogError';
  }
}

export interface CatalogSeedOutcome {
  outcome: 'ALREADY_SEEDED' | 'SEEDED';
  catalogVersionId: string;
  catalogCode: string;
  catalogVersion: string;
  status: string;
  isActive: boolean;
  definitionHash: string;
  mappingHash: string;
  macroCount: number;
  subCount: number;
  mappingCount: number;
  unmappedDeclaredCount: number;
}

@Injectable()
export class CvAttributeCatalogService {
  private readonly logger = new Logger(CvAttributeCatalogService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CvAttributeCatalogVersion)
    private readonly versions: Repository<CvAttributeCatalogVersion>,
    @InjectRepository(CvMacroattribute)
    private readonly macros: Repository<CvMacroattribute>,
    @InjectRepository(CvSubattribute)
    private readonly subs: Repository<CvSubattribute>,
    @InjectRepository(CvSkillAttributeMapping)
    private readonly mappings: Repository<CvSkillAttributeMapping>,
  ) {}

  /** Hash de la definición declarativa pa1 (independiente de ids de BD). */
  pa1DefinitionHash(): string {
    return computeCatalogDefinitionHash({
      catalogCode: PA1_CATALOG_CODE,
      catalogVersion: PA1_CATALOG_VERSION,
      macros: PA1_MACROS.map((m) => ({
        code: m.code,
        name: m.name,
        sortOrder: m.sortOrder,
      })),
      subs: PA1_SUBS.map((s) => ({
        code: s.code,
        macroCode: s.macroCode,
        name: s.name,
        sortOrder: s.sortOrder,
        minimumSupportingSkills:
          s.minimumSupportingSkills ?? PA1_DEFAULT_TARGET_SUPPORTING_SKILLS,
      })),
      mappings: PA1_MAPPINGS.map((m) => ({
        skillKey: m.skillKey,
        skillType: m.skillType,
        subCode: m.subCode,
        weight: m.weight,
        mappingType: m.mappingType,
      })),
    });
  }

  /**
   * Crea (o reconoce) la versión pa1 del catálogo. Idempotente por
   * (code, version): si ya existe, no reescribe nada.
   */
  async seedPa1(params: { activate?: boolean } = {}): Promise<CatalogSeedOutcome> {
    const definitionHash = this.pa1DefinitionHash();

    const existing = await this.versions.findOne({
      where: { code: PA1_CATALOG_CODE, version: PA1_CATALOG_VERSION },
    });

    if (existing) {
      if (existing.config_hash !== definitionHash) {
        throw new CvAttributeCatalogError(
          `Catálogo ${PA1_CATALOG_VERSION} ya existe con config_hash distinto ` +
            `(persistido=${existing.config_hash}, definición=${definitionHash}). ` +
            'Publica una versión nueva en lugar de mutar una existente.',
        );
      }
      if (params.activate && !existing.is_active) {
        await this.activate(existing.id);
      }
      const catalog = await this.loadCatalog({ catalogVersionId: existing.id });
      const refreshed = await this.versions.findOneOrFail({
        where: { id: existing.id },
      });
      return {
        outcome: 'ALREADY_SEEDED',
        catalogVersionId: existing.id,
        catalogCode: existing.code,
        catalogVersion: existing.version,
        status: refreshed.status,
        isActive: refreshed.is_active,
        definitionHash,
        mappingHash: computeMappingHash(catalog),
        macroCount: catalog.macroattributes.length,
        subCount: catalog.subattributes.length,
        mappingCount: catalog.mappings.length,
        unmappedDeclaredCount: (catalog.unmappedRelations ?? []).length,
      };
    }

    const skillIdByKey = await this.resolveSeedSkillIds();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let versionId: string;
    try {
      const manager = queryRunner.manager;
      versionId = await this.insertCatalogDefinition(
        manager,
        definitionHash,
        skillIdByKey,
      );
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const catalog = await this.loadCatalog({ catalogVersionId: versionId });
    const validation = validateAttributeCatalog(catalog);
    if (!validation.ok) {
      throw new CvAttributeCatalogError(
        'El catálogo recién sembrado no pasa validación: ' +
          validation.errors.map((e) => `${e.code}: ${e.message}`).join(' | '),
      );
    }

    if (params.activate) {
      await this.activate(versionId);
    }

    const persisted = await this.versions.findOneOrFail({
      where: { id: versionId },
    });
    this.logger.log(
      `Catálogo ${PA1_CATALOG_VERSION} sembrado (id=${versionId}, ` +
        `mappings=${catalog.mappings.length}).`,
    );

    return {
      outcome: 'SEEDED',
      catalogVersionId: versionId,
      catalogCode: persisted.code,
      catalogVersion: persisted.version,
      status: persisted.status,
      isActive: persisted.is_active,
      definitionHash,
      mappingHash: computeMappingHash(catalog),
      macroCount: catalog.macroattributes.length,
      subCount: catalog.subattributes.length,
      mappingCount: catalog.mappings.length,
      unmappedDeclaredCount: (catalog.unmappedRelations ?? []).length,
    };
  }

  private async insertCatalogDefinition(
    manager: EntityManager,
    definitionHash: string,
    skillIdByKey: Map<string, string>,
  ): Promise<string> {
    const version = await manager.save(
      CvAttributeCatalogVersion,
      manager.create(CvAttributeCatalogVersion, {
        code: PA1_CATALOG_CODE,
        name: PA1_CATALOG_NAME,
        description: PA1_CATALOG_DESCRIPTION,
        version: PA1_CATALOG_VERSION,
        status: 'ACTIVE',
        is_active: false,
        config_hash: definitionHash,
      }),
    );

    const macroIdByCode = new Map<string, string>();
    for (const macro of PA1_MACROS) {
      const row = await manager.save(
        CvMacroattribute,
        manager.create(CvMacroattribute, {
          catalog_version_id: version.id,
          code: macro.code,
          name: macro.name,
          description: macro.description,
          sort_order: macro.sortOrder,
          is_active: true,
        }),
      );
      macroIdByCode.set(macro.code, row.id);
    }

    const subIdByCode = new Map<string, string>();
    for (const sub of PA1_SUBS) {
      const macroId = macroIdByCode.get(sub.macroCode);
      if (!macroId) {
        throw new CvAttributeCatalogError(
          `Subatributo ${sub.code} referencia macroatributo inexistente ${sub.macroCode}.`,
        );
      }
      const row = await manager.save(
        CvSubattribute,
        manager.create(CvSubattribute, {
          catalog_version_id: version.id,
          macroattribute_id: macroId,
          code: sub.code,
          name: sub.name,
          description: sub.description,
          sort_order: sub.sortOrder,
          is_active: true,
          minimum_supporting_skills:
            sub.minimumSupportingSkills ?? PA1_DEFAULT_TARGET_SUPPORTING_SKILLS,
        }),
      );
      subIdByCode.set(sub.code, row.id);
    }

    for (const mapping of PA1_MAPPINGS) {
      const skillId = skillIdByKey.get(
        seedSkillKey(mapping.skillKey, mapping.skillType),
      );
      const subId = subIdByCode.get(mapping.subCode);
      if (!skillId) {
        throw new CvAttributeCatalogError(
          `Skill ${mapping.skillName} (${mapping.skillKey}/${mapping.skillType}) no existe en cv_skill.`,
        );
      }
      if (!subId) {
        throw new CvAttributeCatalogError(
          `Mapping de ${mapping.skillName} apunta a subatributo inexistente ${mapping.subCode}.`,
        );
      }
      await manager.save(
        CvSkillAttributeMapping,
        manager.create(CvSkillAttributeMapping, {
          catalog_version_id: version.id,
          skill_id: skillId,
          subattribute_id: subId,
          weight: mapping.weight.toFixed(3),
          mapping_type: mapping.mappingType,
          rationale: mapping.rationale,
          is_active: true,
        }),
      );
    }

    return version.id;
  }

  private async resolveSeedSkillIds(): Promise<Map<string, string>> {
    const keys = new Set<string>();
    for (const mapping of PA1_MAPPINGS) {
      keys.add(seedSkillKey(mapping.skillKey, mapping.skillType));
    }
    for (const unmapped of PA1_INTENTIONAL_UNMAPPED) {
      keys.add(seedSkillKey(unmapped.skillKey, unmapped.skillType));
    }

    const rows = (await this.dataSource.query(
      `SELECT id::text, normalized_key, skill_type
         FROM organigrama.cv_skill
        WHERE normalized_key = ANY($1::text[])`,
      [[...new Set([...PA1_MAPPINGS, ...PA1_INTENTIONAL_UNMAPPED].map((m) => m.skillKey))]],
    )) as Array<{ id: string; normalized_key: string; skill_type: string }>;

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(seedSkillKey(row.normalized_key, row.skill_type), row.id);
    }

    const missing = [...keys].filter((k) => !map.has(k));
    if (missing.length > 0) {
      throw new CvAttributeCatalogError(
        `Skills declaradas en el seed que no existen en cv_skill: ${missing.join(', ')}. ` +
          'El seed no crea skills nuevas.',
      );
    }
    return map;
  }

  /** Carga el catálogo completo listo para el engine puro. */
  async loadCatalog(params: {
    catalogVersionId?: string;
    catalogVersion?: string;
    catalogCode?: string;
    activeOnly?: boolean;
  }): Promise<AttributeCatalog> {
    let version: CvAttributeCatalogVersion | null = null;

    if (params.catalogVersionId) {
      version = await this.versions.findOne({
        where: { id: String(params.catalogVersionId) },
      });
    } else if (params.catalogVersion) {
      version = await this.versions.findOne({
        where: {
          code: params.catalogCode ?? PA1_CATALOG_CODE,
          version: params.catalogVersion,
        },
      });
    } else {
      version = await this.versions.findOne({
        where: { code: params.catalogCode ?? PA1_CATALOG_CODE, is_active: true },
      });
    }

    if (!version) {
      throw new CvAttributeCatalogError(
        'No se encontró versión de catálogo para el filtro dado.',
      );
    }
    if (params.activeOnly && !version.is_active) {
      throw new CvAttributeCatalogError(
        `Catálogo ${version.version} no está activo.`,
      );
    }

    const [macroRows, subRows, mappingRows] = await Promise.all([
      this.macros.find({
        where: { catalog_version_id: version.id },
        order: { sort_order: 'ASC', code: 'ASC' },
      }),
      this.subs.find({
        where: { catalog_version_id: version.id },
        order: { sort_order: 'ASC', code: 'ASC' },
      }),
      this.mappings.find({
        where: { catalog_version_id: version.id },
        order: { id: 'ASC' },
      }),
    ]);

    const subIdByCode = new Map(subRows.map((s) => [s.code, s.id] as const));
    const unmappedRelations = await this.resolveUnmappedRelations(subIdByCode);

    return {
      catalogVersionId: version.id,
      catalogCode: version.code,
      catalogVersion: version.version,
      status: version.status,
      macroattributes: macroRows.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        sortOrder: m.sort_order,
        isActive: m.is_active,
      })),
      subattributes: subRows.map((s) => ({
        id: s.id,
        macroattributeId: s.macroattribute_id,
        code: s.code,
        name: s.name,
        description: s.description,
        sortOrder: s.sort_order,
        isActive: s.is_active,
        minimumSupportingSkills: s.minimum_supporting_skills,
      })),
      mappings: mappingRows.map((m) => ({
        id: m.id,
        skillId: m.skill_id,
        subattributeId: m.subattribute_id,
        weight: Number(m.weight),
        mappingType: m.mapping_type,
        rationale: m.rationale,
        isActive: m.is_active,
      })),
      unmappedRelations,
    };
  }

  /**
   * Skills declaradas como intencionalmente no mapeadas. Se resuelven contra
   * cv_skill; las que no existan se omiten sin fallar (el catálogo puede
   * publicarse en instalaciones sin esas skills).
   */
  private async resolveUnmappedRelations(
    subIdByCode: Map<string, string>,
  ): Promise<AttributeUnmappedRelation[]> {
    if (PA1_INTENTIONAL_UNMAPPED.length === 0) return [];

    const rows = (await this.dataSource.query(
      `SELECT id::text, normalized_key, skill_type
         FROM organigrama.cv_skill
        WHERE normalized_key = ANY($1::text[])`,
      [PA1_INTENTIONAL_UNMAPPED.map((u) => u.skillKey)],
    )) as Array<{ id: string; normalized_key: string; skill_type: string }>;

    const idByKey = new Map(
      rows.map((r) => [seedSkillKey(r.normalized_key, r.skill_type), r.id] as const),
    );

    const relations: AttributeUnmappedRelation[] = [];
    for (const declared of PA1_INTENTIONAL_UNMAPPED) {
      const skillId = idByKey.get(
        seedSkillKey(declared.skillKey, declared.skillType),
      );
      if (!skillId) continue;
      relations.push({
        skillId,
        skillName: declared.skillName,
        reason: declared.reason,
        relatedSubattributeIds: declared.relatedSubCodes
          .map((code) => subIdByCode.get(code))
          .filter((id): id is string => Boolean(id)),
      });
    }
    return relations;
  }

  /** Activa una versión de catálogo; desactiva la anterior del mismo code. */
  async activate(catalogVersionId: string): Promise<{
    catalogVersionId: string;
    previousActiveId: string | null;
    activated: boolean;
    alreadyActive: boolean;
  }> {
    const id = String(catalogVersionId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const manager = queryRunner.manager;
      const version = await manager.findOne(CvAttributeCatalogVersion, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!version) {
        throw new CvAttributeCatalogError(
          `Versión de catálogo id=${id} no encontrada.`,
        );
      }
      if (version.status !== 'ACTIVE') {
        throw new CvAttributeCatalogError(
          `Solo un catálogo con status ACTIVE puede activarse (status=${version.status}).`,
        );
      }

      await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
        ATTRIBUTE_CATALOG_ADVISORY_LOCK_NS,
        hashCodeToInt(version.code),
      ]);

      if (version.is_active) {
        await queryRunner.commitTransaction();
        return {
          catalogVersionId: version.id,
          previousActiveId: version.id,
          activated: true,
          alreadyActive: true,
        };
      }

      const previous = await manager.findOne(CvAttributeCatalogVersion, {
        where: { code: version.code, is_active: true },
      });
      if (previous && previous.id !== version.id) {
        previous.is_active = false;
        await manager.save(CvAttributeCatalogVersion, previous);
      }

      version.is_active = true;
      await manager.save(CvAttributeCatalogVersion, version);
      await queryRunner.commitTransaction();

      return {
        catalogVersionId: version.id,
        previousActiveId:
          previous && previous.id !== version.id ? previous.id : null,
        activated: true,
        alreadyActive: false,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /** Vista de inspección del catálogo, agrupada por macro → sub → mappings. */
  async inspect(params: {
    catalogVersion?: string;
    catalogVersionId?: string;
  }): Promise<Record<string, unknown>> {
    const catalog = await this.loadCatalog(params);
    const validation = validateAttributeCatalog(catalog);

    const skillNames = await this.loadSkillNames(
      catalog.mappings.map((m) => m.skillId),
    );

    const subById = new Map(catalog.subattributes.map((s) => [s.id, s]));
    const mappingsBySub = new Map<string, typeof catalog.mappings>();
    for (const mapping of catalog.mappings) {
      const list = mappingsBySub.get(mapping.subattributeId) ?? [];
      list.push(mapping);
      mappingsBySub.set(mapping.subattributeId, list);
    }

    return {
      catalogVersionId: catalog.catalogVersionId,
      catalogCode: catalog.catalogCode,
      catalogVersion: catalog.catalogVersion,
      status: catalog.status,
      mappingHash: computeMappingHash(catalog),
      definitionHash: this.pa1DefinitionHash(),
      validation: {
        ok: validation.ok,
        errors: validation.errors,
        warnings: validation.warnings,
      },
      weightSumBySkill: Object.fromEntries(
        Object.entries(validation.weightSumBySkill).map(([skillId, sum]) => [
          skillNames.get(skillId) ?? `skillId=${skillId}`,
          sum,
        ]),
      ),
      macroattributes: catalog.macroattributes.map((macro) => ({
        code: macro.code,
        name: macro.name,
        isActive: macro.isActive,
        subattributes: catalog.subattributes
          .filter((s) => s.macroattributeId === macro.id)
          .map((sub) => ({
            code: sub.code,
            name: sub.name,
            isActive: sub.isActive,
            minimumSupportingSkills: sub.minimumSupportingSkills,
            mappings: (mappingsBySub.get(sub.id) ?? []).map((m) => ({
              skill: skillNames.get(m.skillId) ?? `skillId=${m.skillId}`,
              weight: m.weight,
              mappingType: m.mappingType,
              isActive: m.isActive,
              rationale: m.rationale,
            })),
          })),
      })),
      intentionalUnmapped: (catalog.unmappedRelations ?? []).map((r) => ({
        skill: r.skillName,
        reason: r.reason,
        relatedSubattributes: r.relatedSubattributeIds.map(
          (id) => subById.get(id)?.code ?? `subId=${id}`,
        ),
      })),
    };
  }

  async loadSkillNames(skillIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(skillIds.map(String))];
    if (unique.length === 0) return new Map();
    const rows = (await this.dataSource.query(
      `SELECT id::text, normalized_name
         FROM organigrama.cv_skill
        WHERE id = ANY($1::bigint[])`,
      [unique],
    )) as Array<{ id: string; normalized_name: string }>;
    return new Map(rows.map((r) => [r.id, r.normalized_name] as const));
  }
}

function seedSkillKey(normalizedKey: string, skillType: string): string {
  return `${normalizedKey}|${skillType}`;
}

/** Entero estable a partir del code, para el advisory lock del catálogo. */
function hashCodeToInt(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i += 1) {
    hash = (hash * 31 + code.charCodeAt(i)) % 2147483647;
  }
  return hash;
}
