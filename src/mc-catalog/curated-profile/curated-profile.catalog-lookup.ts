/**
 * Consultas de solo lectura para resolver persona, CV y catálogo MC1.
 * Toda query es SELECT; no hay escrituras.
 */

import type { DataSource } from 'typeorm';
import type { SkillType } from '../../cv-skills/cv-skills.types';

export interface CuratedPersonRow {
  personId: string;
  document: string;
  isActive: boolean;
}

export interface CuratedPersonCvRow {
  id: string;
  personId: string;
}

export interface CuratedDomainRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  catalogVersionId: string;
  catalogVersion: string;
}

export interface CuratedSpecialtyRow {
  id: string;
  code: string;
  name: string;
  domainId: string;
  domainCode: string;
  lifecycleStatus: string;
  isActive: boolean;
  mappingSkillCount: number;
}

export interface CuratedSkillRow {
  id: string;
  normalizedName: string;
  normalizedKey: string;
  skillType: SkillType;
  isActive: boolean;
}

export interface CuratedAliasRow {
  aliasKey: string;
  aliasName: string;
  skillId: string;
  skillNormalizedName: string;
  skillNormalizedKey: string;
  skillType: SkillType;
  skillIsActive: boolean;
}

export interface CuratedCatalogLookup {
  findPersonsByDocument(document: string): Promise<CuratedPersonRow[]>;
  findActivePersonCvs(personId: string): Promise<CuratedPersonCvRow[]>;
  findActiveDomainByCode(code: string): Promise<CuratedDomainRow | null>;
  findSpecialtiesByCodes(
    codes: string[],
  ): Promise<CuratedSpecialtyRow[]>;
  findSkillsByKeys(
    keys: Array<{ normalizedKey: string; skillType?: SkillType }>,
  ): Promise<CuratedSkillRow[]>;
  findAliasesByKeys(aliasKeys: string[]): Promise<CuratedAliasRow[]>;
  findSkillsByNormalizedKeys(
    normalizedKeys: string[],
  ): Promise<CuratedSkillRow[]>;
  hasSpecialtyMapping(params: {
    specialtyId: string;
    skillId: string;
  }): Promise<boolean>;
}

type QueryFn = (sql: string, params?: unknown[]) => Promise<unknown[]>;

function asQueryFn(ds: DataSource): QueryFn {
  return (sql, params = []) => ds.query(sql, params);
}

/**
 * Implementación RO sobre TypeORM DataSource.
 */
export function createCuratedCatalogLookup(
  dataSource: DataSource,
): CuratedCatalogLookup {
  const query = asQueryFn(dataSource);

  return {
    async findPersonsByDocument(document) {
      const rows = (await query(
        `SELECT id::text AS "personId",
                document,
                is_active AS "isActive"
         FROM core.person
         WHERE document = $1`,
        [document],
      )) as CuratedPersonRow[];
      return rows;
    },

    async findActivePersonCvs(personId) {
      const rows = (await query(
        `SELECT id::text AS id,
                person_id::text AS "personId"
         FROM organigrama.person_cv
         WHERE person_id = $1::bigint
           AND is_active = true
         ORDER BY id ASC`,
        [personId],
      )) as CuratedPersonCvRow[];
      return rows;
    },

    async findActiveDomainByCode(code) {
      const rows = (await query(
        `SELECT d.id::text AS id,
                d.code,
                d.name,
                d.is_active AS "isActive",
                cv.id::text AS "catalogVersionId",
                cv.version AS "catalogVersion"
         FROM organigrama.mc_domain d
         JOIN organigrama.mc_catalog_version cv
           ON cv.id = d.catalog_version_id
         WHERE cv.is_active = true
           AND d.code = $1
         LIMIT 1`,
        [code],
      )) as CuratedDomainRow[];
      return rows[0] ?? null;
    },

    async findSpecialtiesByCodes(codes) {
      if (codes.length === 0) return [];
      const rows = (await query(
        `SELECT s.id::text AS id,
                s.code,
                s.name,
                s.domain_id::text AS "domainId",
                d.code AS "domainCode",
                s.lifecycle_status AS "lifecycleStatus",
                s.is_active AS "isActive",
                (
                  SELECT COUNT(*)::int
                  FROM organigrama.mc_skill_specialty_mapping m
                  WHERE m.specialty_id = s.id
                    AND m.catalog_version_id = s.catalog_version_id
                ) AS "mappingSkillCount"
         FROM organigrama.mc_specialty s
         JOIN organigrama.mc_domain d ON d.id = s.domain_id
         JOIN organigrama.mc_catalog_version cv
           ON cv.id = s.catalog_version_id
         WHERE cv.is_active = true
           AND s.code = ANY($1::text[])`,
        [codes],
      )) as CuratedSpecialtyRow[];
      return rows;
    },

    async findSkillsByKeys(keys) {
      if (keys.length === 0) return [];
      const uniqueKeys = [...new Set(keys.map((k) => k.normalizedKey))];
      const rows = (await query(
        `SELECT id::text AS id,
                normalized_name AS "normalizedName",
                normalized_key AS "normalizedKey",
                skill_type AS "skillType",
                is_active AS "isActive"
         FROM organigrama.cv_skill
         WHERE normalized_key = ANY($1::text[])`,
        [uniqueKeys],
      )) as CuratedSkillRow[];
      return rows;
    },

    async findSkillsByNormalizedKeys(normalizedKeys) {
      if (normalizedKeys.length === 0) return [];
      const rows = (await query(
        `SELECT id::text AS id,
                normalized_name AS "normalizedName",
                normalized_key AS "normalizedKey",
                skill_type AS "skillType",
                is_active AS "isActive"
         FROM organigrama.cv_skill
         WHERE normalized_key = ANY($1::text[])`,
        [normalizedKeys],
      )) as CuratedSkillRow[];
      return rows;
    },

    async findAliasesByKeys(aliasKeys) {
      if (aliasKeys.length === 0) return [];
      const rows = (await query(
        `SELECT a.alias_key AS "aliasKey",
                a.alias_name AS "aliasName",
                a.skill_id::text AS "skillId",
                s.normalized_name AS "skillNormalizedName",
                s.normalized_key AS "skillNormalizedKey",
                s.skill_type AS "skillType",
                s.is_active AS "skillIsActive"
         FROM organigrama.cv_skill_alias a
         JOIN organigrama.cv_skill s ON s.id = a.skill_id
         WHERE a.alias_key = ANY($1::text[])`,
        [aliasKeys],
      )) as CuratedAliasRow[];
      return rows;
    },

    async hasSpecialtyMapping(params) {
      const rows = (await query(
        `SELECT 1 AS ok
         FROM organigrama.mc_skill_specialty_mapping m
         JOIN organigrama.mc_catalog_version cv
           ON cv.id = m.catalog_version_id
         WHERE cv.is_active = true
           AND m.specialty_id = $1::bigint
           AND m.skill_id = $2::bigint
         LIMIT 1`,
        [params.specialtyId, params.skillId],
      )) as Array<{ ok: number }>;
      return rows.length > 0;
    },
  };
}
