/**
 * Catálogo MC1 (dominios + especialidades).
 *
 * Seed e inspección data-driven. No toca PA1, Extractor, Enrichment ni Evidence.
 * No calcula Coverage/Confidence ni crea mappings.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MC_CATALOG_ADVISORY_LOCK_NS } from './mc-catalog.constants';
import { MC1_CATALOG_DEFINITION } from './mc-catalog.definition-mc12';
import { computeMcCatalogDefinitionHash } from './mc-catalog.hash';
import type {
  McCatalogDefinition,
  McCatalogSnapshot,
  McCatalogVersionStatus,
  McDomainView,
  McSpecialtyLifecycleStatus,
  McSpecialtyView,
} from './mc-catalog.types';
import { MC_SPECIALTY_LIFECYCLE_STATUSES } from './mc-catalog.types';
import { McCatalogVersion, McDomain, McSpecialty } from './entities';

export class McCatalogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McCatalogError';
  }
}

export interface McCatalogSeedOutcome {
  outcome: 'ALREADY_SEEDED' | 'SEEDED';
  catalogVersionId: string;
  catalogCode: string;
  catalogVersion: string;
  status: McCatalogVersionStatus;
  isActive: boolean;
  configHash: string;
  domainCount: number;
  specialtyCount: number;
}

@Injectable()
export class McCatalogService {
  private readonly logger = new Logger(McCatalogService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(McCatalogVersion)
    private readonly versions: Repository<McCatalogVersion>,
    @InjectRepository(McDomain)
    private readonly domains: Repository<McDomain>,
    @InjectRepository(McSpecialty)
    private readonly specialties: Repository<McSpecialty>,
  ) {}

  /** Hash de la definición MC1.2 sembrable. */
  definitionHash(
    definition: McCatalogDefinition = MC1_CATALOG_DEFINITION,
  ): string {
    return computeMcCatalogDefinitionHash(definition);
  }

  /**
   * Valida reglas estructurales del catálogo (sin Coverage/Confidence).
   * Rechaza cualquier estado fuera del ciclo de vida (incl. EMERGENT).
   */
  validateDefinition(definition: McCatalogDefinition): void {
    if (!definition.catalogCode?.trim()) {
      throw new McCatalogError('catalogCode vacío');
    }
    if (!definition.catalogVersion?.trim()) {
      throw new McCatalogError('catalogVersion vacío');
    }
    if (!definition.domains.length) {
      throw new McCatalogError('El catálogo debe declarar al menos un dominio');
    }

    const domainCodes = new Set<string>();
    const specialtyCodes = new Set<string>();

    for (const domain of definition.domains) {
      if (!domain.code?.trim()) {
        throw new McCatalogError('Dominio sin code');
      }
      if (domainCodes.has(domain.code)) {
        throw new McCatalogError(`Dominio duplicado: ${domain.code}`);
      }
      domainCodes.add(domain.code);

      if (!domain.specialties.length) {
        throw new McCatalogError(
          `Dominio ${domain.code} sin especialidades (MC1.2 requiere al menos una)`,
        );
      }

      for (const specialty of domain.specialties) {
        if (!specialty.code?.trim()) {
          throw new McCatalogError(
            `Especialidad sin code en dominio ${domain.code}`,
          );
        }
        if (specialtyCodes.has(specialty.code)) {
          throw new McCatalogError(
            `Especialidad duplicada en catálogo: ${specialty.code}`,
          );
        }
        specialtyCodes.add(specialty.code);

        if (
          !MC_SPECIALTY_LIFECYCLE_STATUSES.includes(
            specialty.lifecycleStatus as McSpecialtyLifecycleStatus,
          )
        ) {
          throw new McCatalogError(
            `lifecycle_status inválido "${String(
              (specialty as { lifecycleStatus?: string }).lifecycleStatus,
            )}" en ${specialty.code}. ` +
              `Permitidos: ACTIVE|EXPERIMENTAL|INACTIVE. ` +
              `EMERGENT es presentación por perfil, no catálogo.`,
          );
        }
        if (!specialty.purpose?.trim() || !specialty.description?.trim()) {
          throw new McCatalogError(
            `Especialidad ${specialty.code} requiere purpose y description`,
          );
        }
        if (!specialty.name?.trim()) {
          throw new McCatalogError(
            `Especialidad ${specialty.code} requiere name visible`,
          );
        }
      }
    }
  }

  /**
   * Siembra (o reconoce) la versión MC1.2. Idempotente por (code, version).
   * No reescribe si ya existe con el mismo config_hash.
   */
  async seedMc12(params: { activate?: boolean } = {}): Promise<McCatalogSeedOutcome> {
    const definition = MC1_CATALOG_DEFINITION;
    this.validateDefinition(definition);
    const configHash = this.definitionHash(definition);

    const existing = await this.versions.findOne({
      where: {
        code: definition.catalogCode,
        version: definition.catalogVersion,
      },
    });

    if (existing) {
      if (existing.config_hash !== configHash) {
        throw new McCatalogError(
          `Catálogo ${definition.catalogVersion} ya existe con config_hash distinto ` +
            `(persistido=${existing.config_hash}, definición=${configHash}). ` +
            `Crear una nueva versión de catálogo; no mutar la existente.`,
        );
      }

      if (params.activate && !existing.is_active) {
        await this.activateCatalogVersion(existing.id);
        existing.is_active = true;
        existing.status = 'ACTIVE';
      }

      const counts = await this.countChildren(existing.id);
      return {
        outcome: 'ALREADY_SEEDED',
        catalogVersionId: existing.id,
        catalogCode: existing.code,
        catalogVersion: existing.version,
        status: existing.status,
        isActive: existing.is_active,
        configHash: existing.config_hash,
        domainCount: counts.domainCount,
        specialtyCount: counts.specialtyCount,
      };
    }

    return this.dataSource.transaction(async (manager) => {
      await this.acquireCatalogLock(manager);

      const raced = await manager.findOne(McCatalogVersion, {
        where: {
          code: definition.catalogCode,
          version: definition.catalogVersion,
        },
      });
      if (raced) {
        throw new McCatalogError(
          `Seed concurrente detectado para ${definition.catalogVersion}; reintentar.`,
        );
      }

      const version = manager.create(McCatalogVersion, {
        code: definition.catalogCode,
        name: definition.catalogName,
        description: definition.catalogDescription,
        version: definition.catalogVersion,
        status: params.activate ? 'ACTIVE' : 'DRAFT',
        is_active: false,
        config_hash: configHash,
      });
      const savedVersion = await manager.save(version);

      for (const domainDef of definition.domains) {
        const domain = manager.create(McDomain, {
          catalog_version_id: savedVersion.id,
          code: domainDef.code,
          name: domainDef.name,
          description: domainDef.description,
          sort_order: domainDef.sortOrder,
          is_active: true,
        });
        const savedDomain = await manager.save(domain);

        for (const specialtyDef of domainDef.specialties) {
          const specialty = manager.create(McSpecialty, {
            catalog_version_id: savedVersion.id,
            domain_id: savedDomain.id,
            code: specialtyDef.code,
            name: specialtyDef.name,
            purpose: specialtyDef.purpose,
            description: specialtyDef.description,
            lifecycle_status: specialtyDef.lifecycleStatus,
            sort_order: specialtyDef.sortOrder,
            is_active: specialtyDef.lifecycleStatus !== 'INACTIVE',
          });
          await manager.save(specialty);
        }
      }

      if (params.activate) {
        await this.activateCatalogVersionInTx(manager, savedVersion.id);
        savedVersion.is_active = true;
        savedVersion.status = 'ACTIVE';
      }

      this.logger.log(
        `Catálogo MC1 ${definition.catalogVersion} sembrado ` +
          `(id=${savedVersion.id}, hash=${configHash.slice(0, 12)}…)`,
      );

      return {
        outcome: 'SEEDED',
        catalogVersionId: savedVersion.id,
        catalogCode: savedVersion.code,
        catalogVersion: savedVersion.version,
        status: savedVersion.status,
        isActive: savedVersion.is_active,
        configHash,
        domainCount: definition.domains.length,
        specialtyCount: definition.domains.reduce(
          (n, d) => n + d.specialties.length,
          0,
        ),
      };
    });
  }

  async activateCatalogVersion(catalogVersionId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await this.acquireCatalogLock(manager);
      await this.activateCatalogVersionInTx(manager, catalogVersionId);
    });
  }

  /**
   * Carga el catálogo activo (o una versión concreta) desde BD.
   * Fuente de verdad runtime: tablas, no el archivo de definición.
   */
  async loadSnapshot(params: {
    catalogCode?: string;
    catalogVersion?: string;
    requireActive?: boolean;
  } = {}): Promise<McCatalogSnapshot> {
    const code = params.catalogCode ?? MC1_CATALOG_DEFINITION.catalogCode;

    let version: McCatalogVersion | null;
    if (params.catalogVersion) {
      version = await this.versions.findOne({
        where: { code, version: params.catalogVersion },
      });
    } else {
      version = await this.versions.findOne({
        where: { code, is_active: true },
      });
    }

    if (!version) {
      throw new McCatalogError(
        params.catalogVersion
          ? `Catálogo ${code}@${params.catalogVersion} no encontrado`
          : `No hay catálogo activo para code=${code}`,
      );
    }

    if (params.requireActive && !version.is_active) {
      throw new McCatalogError(
        `Catálogo ${code}@${version.version} no está activo`,
      );
    }

    const domainRows = await this.domains.find({
      where: { catalog_version_id: version.id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });
    const specialtyRows = await this.specialties.find({
      where: { catalog_version_id: version.id },
      order: { sort_order: 'ASC', id: 'ASC' },
    });

    const domains: McDomainView[] = domainRows.map((d) => {
      const specs: McSpecialtyView[] = specialtyRows
        .filter((s) => s.domain_id === d.id)
        .map((s) => ({
          id: s.id,
          code: s.code,
          name: s.name,
          purpose: s.purpose,
          description: s.description,
          lifecycleStatus: s.lifecycle_status,
          sortOrder: s.sort_order,
          isActive: s.is_active,
          domainCode: d.code,
        }));
      return {
        id: d.id,
        code: d.code,
        name: d.name,
        description: d.description,
        sortOrder: d.sort_order,
        isActive: d.is_active,
        specialties: specs,
      };
    });

    return {
      catalogVersionId: version.id,
      catalogCode: version.code,
      catalogVersion: version.version,
      status: version.status,
      isActive: version.is_active,
      configHash: version.config_hash,
      domains,
    };
  }

  async findDomainByCode(
    domainCode: string,
    params: { catalogVersion?: string; requireActive?: boolean } = {},
  ): Promise<McDomainView> {
    const snapshot = await this.loadSnapshot({
      catalogVersion: params.catalogVersion,
      requireActive: params.requireActive,
    });
    const domain = snapshot.domains.find((d) => d.code === domainCode);
    if (!domain) {
      throw new McCatalogError(
        `Dominio ${domainCode} no existe en catálogo ${snapshot.catalogVersion}`,
      );
    }
    return domain;
  }

  private async countChildren(
    catalogVersionId: string,
  ): Promise<{ domainCount: number; specialtyCount: number }> {
    const domainCount = await this.domains.count({
      where: { catalog_version_id: catalogVersionId },
    });
    const specialtyCount = await this.specialties.count({
      where: { catalog_version_id: catalogVersionId },
    });
    return { domainCount, specialtyCount };
  }

  private async activateCatalogVersionInTx(
    manager: EntityManager,
    catalogVersionId: string,
  ): Promise<void> {
    const target = await manager.findOne(McCatalogVersion, {
      where: { id: catalogVersionId },
    });
    if (!target) {
      throw new McCatalogError(
        `mc_catalog_version id=${catalogVersionId} no existe`,
      );
    }

    await manager
      .createQueryBuilder()
      .update(McCatalogVersion)
      .set({ is_active: false, status: 'RETIRED' })
      .where('code = :code', { code: target.code })
      .andWhere('id <> :id', { id: catalogVersionId })
      .andWhere('is_active = TRUE')
      .execute();

    await manager.update(
      McCatalogVersion,
      { id: catalogVersionId },
      { is_active: true, status: 'ACTIVE' },
    );
  }

  private async acquireCatalogLock(manager: EntityManager): Promise<void> {
    await manager.query('SELECT pg_advisory_xact_lock($1, $2)', [
      MC_CATALOG_ADVISORY_LOCK_NS,
      1,
    ]);
  }
}
