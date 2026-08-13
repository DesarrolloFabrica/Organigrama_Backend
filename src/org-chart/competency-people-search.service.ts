import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { PROFESSIONAL_FIELDS } from '../mc-pipeline/catalog/professional-fields';
import {
  SPECIALTY_BY_CODE,
  resolveToKnownSpecialtyCode,
} from '../mc-pipeline/catalog/specialties-visual-education';
import { validateMc1PresentationPayload } from '../mc-pipeline/person-profile/mc1-person-profile-store';
import type { Mc1PersonCompetenciesPresentationDto } from '../mc-pipeline/person-profile/mc1-person-profile.types';
import type { Person } from '../person/entities/person.entity';
import type {
  CompetencyPeopleSearchFacetDto,
  CompetencyPeopleSearchPersonDto,
  CompetencyPeopleSearchQueryDto,
  CompetencyPeopleSearchResponseDto,
  CompetencyPeopleSearchWarningDto,
} from './dto/competency-people-search.response.dto';
import type { OrgViewerContext } from './org-viewer-context';
import { viewerHasGlobalReadAccess } from './org-viewer-context';
import { OrgChartVisibilityService } from './org-chart-visibility.service';
import { PhotoUrlBuilder } from './photos/photo-url.builder';

type SearchInput = {
  domain?: string | null;
  specialty?: string | null;
  skills?: string | string[] | null;
  page?: string | number | null;
  pageSize?: string | number | null;
};

type StoredProfileRow = {
  person_id: string | number;
  display_name: string;
  edu_email: string | null;
  job_title: string | null;
  payload_json: unknown;
};

type SearchableProfile = {
  personId: string;
  displayName: string;
  eduEmail: string | null;
  jobTitle: string | null;
  presentation: Mc1PersonCompetenciesPresentationDto;
};

type PresentationField = Mc1PersonCompetenciesPresentationDto['fields'][number];
type PresentationSpecialty = PresentationField['specialties'][number];

const FIELD_BY_CODE = new Map(
  PROFESSIONAL_FIELDS.map((field) => [field.code, field] as const),
);

const PAGE_SIZE_DEFAULT = 24;
const PAGE_SIZE_MAX = 50;

@Injectable()
export class CompetencyPeopleSearchService {
  private readonly spanishCollator = new Intl.Collator('es', {
    numeric: true,
    sensitivity: 'base',
  });

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly visibilityService: OrgChartVisibilityService,
    private readonly photoUrlBuilder: PhotoUrlBuilder,
  ) {}

  async search(
    viewer: OrgViewerContext,
    versionId: string,
    input: SearchInput,
  ): Promise<CompetencyPeopleSearchResponseDto> {
    // Security boundary: determine the full-profile universe before reading MC1.
    const hasGlobalAccess = viewerHasGlobalReadAccess(viewer);
    const allowedIds = hasGlobalAccess
      ? []
      : await this.getAllowedPersonIds(viewer, versionId);

    const rows = await this.readAuthorizedProfiles(
      allowedIds,
      hasGlobalAccess,
      versionId,
    );
    const profiles = this.toSearchableProfiles(rows);
    const { query, warnings } = this.canonicalizeQuery(input, profiles);
    const selectedCriteria = this.describeQuery(query, profiles);
    const page = this.toPositiveInteger(input.page, 1);
    const pageSize = Math.min(
      this.toPositiveInteger(input.pageSize, PAGE_SIZE_DEFAULT),
      PAGE_SIZE_MAX,
    );

    const domainFacets = query.domainCode
      ? []
      : this.buildDomainFacets(profiles);
    const specialtyFacets =
      query.domainCode && !query.specialtyCode
        ? this.buildSpecialtyFacets(profiles, query.domainCode)
        : [];

    if (!query.domainCode) {
      return {
        query,
        selectedCriteria,
        warnings,
        authorizedUniverseTotal: profiles.length,
        total: profiles.length,
        people: [],
        facets: {
          domains: domainFacets,
          specialties: [],
          skills: [],
        },
        pagination: { page: 1, pageSize, totalPages: 0 },
      };
    }

    const matches = profiles
      .map((profile) => ({
        profile,
        fields: this.findMatchingFields(profile, query),
      }))
      .filter((match) => match.fields.length > 0);

    const people = matches
      .map(({ profile, fields }) => this.toPersonResult(profile, fields, query))
      .sort((left, right) => this.comparePeople(left, right));

    const skillFacets = query.specialtyCode
      ? this.buildSkillFacets(matches, query)
      : [];
    const totalPages =
      people.length === 0 ? 0 : Math.ceil(people.length / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    return {
      query,
      selectedCriteria,
      warnings,
      authorizedUniverseTotal: profiles.length,
      total: people.length,
      people: people.slice(offset, offset + pageSize),
      facets: {
        domains: [],
        specialties: specialtyFacets,
        skills: skillFacets,
      },
      pagination: {
        page: safePage,
        pageSize,
        totalPages,
      },
    };
  }

  private async getAllowedPersonIds(
    viewer: OrgViewerContext,
    versionId: string,
  ): Promise<string[]> {
    const descendants = await this.visibilityService.getVisibleDescendantIds(
      viewer,
      versionId,
    );
    const allowed = new Set(descendants);
    const selfId = String(viewer.personId ?? '').trim();
    if (selfId) allowed.add(selfId);
    return [...allowed].filter((id) => /^\d+$/.test(id));
  }

  private async readAuthorizedProfiles(
    allowedPersonIds: string[],
    hasGlobalAccess: boolean,
    versionId: string,
  ): Promise<StoredProfileRow[]> {
    return this.dataSource.query<StoredProfileRow[]>(
      `
      SELECT
        p.id::text AS person_id,
        p.full_name AS display_name,
        p.edu_email,
        job_role.name AS job_title,
        presentation.payload_json
      FROM organigrama.mc1_person_profile_presentation presentation
      INNER JOIN core.person p
        ON p.id = presentation.person_id
       AND p.is_active = TRUE
      LEFT JOIN organigrama.org_chart_person_override person_override
        ON person_override.version_id = $3
       AND person_override.person_id = p.id
      LEFT JOIN core.role job_role
        ON job_role.id = COALESCE(person_override.role_id_override, p.role_id)
      WHERE presentation.is_active = TRUE
        AND ($2::boolean = TRUE OR p.id = ANY($1::bigint[]))
      ORDER BY p.id ASC
      `,
      [allowedPersonIds, hasGlobalAccess, versionId],
    );
  }

  private toSearchableProfiles(rows: StoredProfileRow[]): SearchableProfile[] {
    const byPersonId = new Map<string, SearchableProfile>();
    for (const row of rows ?? []) {
      const personId = String(row.person_id ?? '').trim();
      if (!personId || byPersonId.has(personId)) continue;
      const validation = validateMc1PresentationPayload(row.payload_json);
      if (!validation.ok) continue;
      byPersonId.set(personId, {
        personId,
        displayName: String(row.display_name ?? '').trim() || personId,
        eduEmail: row.edu_email ? String(row.edu_email) : null,
        jobTitle: row.job_title ? String(row.job_title) : null,
        presentation: validation.presentation,
      });
    }
    return [...byPersonId.values()];
  }

  private canonicalizeQuery(
    input: SearchInput,
    profiles: SearchableProfile[],
  ): {
    query: CompetencyPeopleSearchQueryDto;
    warnings: CompetencyPeopleSearchWarningDto[];
  } {
    const warnings: CompetencyPeopleSearchWarningDto[] = [];
    const rawDomain = this.clean(input.domain);
    const rawSpecialty = this.clean(input.specialty);
    const rawSkills = this.parseSkillCodes(input.skills);

    const domainCode =
      rawDomain && FIELD_BY_CODE.has(rawDomain) ? rawDomain : null;
    if (rawDomain && !domainCode) {
      warnings.push({
        code: 'DOMAIN_INVALID',
        criterion: 'domain',
        value: rawDomain,
      });
    }

    let specialtyCode: string | null = null;
    if (rawSpecialty && !domainCode) {
      warnings.push({
        code: 'SPECIALTY_REQUIRES_DOMAIN',
        criterion: 'specialty',
        value: rawSpecialty,
      });
    } else if (rawSpecialty && domainCode) {
      const resolved = resolveToKnownSpecialtyCode(rawSpecialty);
      const specialty = resolved ? SPECIALTY_BY_CODE.get(resolved) : null;
      if (!specialty) {
        warnings.push({
          code: 'SPECIALTY_INVALID',
          criterion: 'specialty',
          value: rawSpecialty,
        });
      } else if (specialty.parentField !== domainCode) {
        warnings.push({
          code: 'SPECIALTY_OUTSIDE_DOMAIN',
          criterion: 'specialty',
          value: rawSpecialty,
        });
      } else {
        specialtyCode = specialty.code;
      }
    }

    const skillCodes: string[] = [];
    if (rawSkills.length > 0 && (!domainCode || !specialtyCode)) {
      for (const value of rawSkills) {
        warnings.push({
          code: 'SKILLS_REQUIRE_SPECIALTY',
          criterion: 'skill',
          value,
        });
      }
    } else if (domainCode && specialtyCode) {
      const contextualSkills = this.contextualSkillCodes(
        profiles,
        domainCode,
        specialtyCode,
      );
      for (const value of rawSkills) {
        if (contextualSkills.has(value)) {
          skillCodes.push(value);
        } else {
          warnings.push({
            code: 'SKILL_INVALID',
            criterion: 'skill',
            value,
          });
        }
      }
    }

    return {
      query: { domainCode, specialtyCode, skillCodes },
      warnings,
    };
  }

  private contextualSkillCodes(
    profiles: SearchableProfile[],
    domainCode: string,
    specialtyCode: string,
  ): Set<string> {
    const codes = new Set<string>();
    for (const profile of profiles) {
      for (const field of this.usableFields(profile)) {
        if (field.code !== domainCode) continue;
        for (const specialty of this.usableSpecialties(field)) {
          if (specialty.code !== specialtyCode) continue;
          for (const skill of specialty.skills) codes.add(skill.code);
        }
      }
    }
    return codes;
  }

  private describeQuery(
    query: CompetencyPeopleSearchQueryDto,
    profiles: SearchableProfile[],
  ): CompetencyPeopleSearchResponseDto['selectedCriteria'] {
    const labels = new Map<string, string[]>();
    if (query.domainCode && query.specialtyCode) {
      for (const profile of profiles) {
        for (const field of this.usableFields(profile)) {
          if (field.code !== query.domainCode) continue;
          for (const specialty of this.usableSpecialties(field)) {
            if (specialty.code !== query.specialtyCode) continue;
            for (const skill of specialty.skills) {
              const values = labels.get(skill.code) ?? [];
              values.push(skill.name);
              labels.set(skill.code, values);
            }
          }
        }
      }
    }
    return {
      domain: query.domainCode
        ? {
            code: query.domainCode,
            label:
              FIELD_BY_CODE.get(query.domainCode)?.name ?? query.domainCode,
          }
        : null,
      specialty: query.specialtyCode
        ? {
            code: query.specialtyCode,
            label:
              SPECIALTY_BY_CODE.get(query.specialtyCode)?.name ??
              query.specialtyCode,
          }
        : null,
      skills: query.skillCodes.map((code) => ({
        code,
        label: this.pickStableLabel(labels.get(code) ?? [], code),
      })),
    };
  }

  private buildDomainFacets(
    profiles: SearchableProfile[],
  ): CompetencyPeopleSearchFacetDto[] {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const codes = new Set(
        this.usableFields(profile).map((field) => field.code),
      );
      for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return this.toFacets(
      counts,
      (code) => FIELD_BY_CODE.get(code)?.name ?? code,
    );
  }

  private buildSpecialtyFacets(
    profiles: SearchableProfile[],
    domainCode: string,
  ): CompetencyPeopleSearchFacetDto[] {
    const counts = new Map<string, number>();
    for (const profile of profiles) {
      const codes = new Set<string>();
      for (const field of this.usableFields(profile)) {
        if (field.code !== domainCode) continue;
        for (const specialty of this.usableSpecialties(field)) {
          codes.add(specialty.code);
        }
      }
      for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return this.toFacets(
      counts,
      (code) => SPECIALTY_BY_CODE.get(code)?.name ?? code,
    );
  }

  private buildSkillFacets(
    matches: Array<{ profile: SearchableProfile; fields: PresentationField[] }>,
    query: CompetencyPeopleSearchQueryDto,
  ): CompetencyPeopleSearchFacetDto[] {
    if (!query.specialtyCode) return [];
    const selected = new Set(query.skillCodes);
    const counts = new Map<string, number>();
    const labels = new Map<string, string[]>();

    for (const match of matches) {
      const personSkills = new Map<string, string[]>();
      for (const field of match.fields) {
        for (const specialty of this.usableSpecialties(field)) {
          if (specialty.code !== query.specialtyCode) continue;
          for (const skill of specialty.skills) {
            if (selected.has(skill.code)) continue;
            const skillLabels = personSkills.get(skill.code) ?? [];
            skillLabels.push(skill.name);
            personSkills.set(skill.code, skillLabels);
          }
        }
      }
      for (const [code, personLabels] of personSkills) {
        counts.set(code, (counts.get(code) ?? 0) + 1);
        labels.set(code, [...(labels.get(code) ?? []), ...personLabels]);
      }
    }

    return this.toFacets(counts, (code) =>
      this.pickStableLabel(labels.get(code) ?? [], code),
    );
  }

  private findMatchingFields(
    profile: SearchableProfile,
    query: CompetencyPeopleSearchQueryDto,
  ): PresentationField[] {
    if (!query.domainCode) return [];
    return this.usableFields(profile).filter((field) => {
      if (field.code !== query.domainCode) return false;
      if (!query.specialtyCode) return true;
      const skills = this.skillsForSpecialty(field, query.specialtyCode);
      if (skills === null) return false;
      return query.skillCodes.every((code) => skills.has(code));
    });
  }

  private toPersonResult(
    profile: SearchableProfile,
    matchingFields: PresentationField[],
    query: CompetencyPeopleSearchQueryDto,
  ): CompetencyPeopleSearchPersonDto {
    const field = [...matchingFields].sort((left, right) => {
      if (left.role === right.role) return 0;
      return left.role === 'PRIMARY' ? -1 : 1;
    })[0];
    const domain = {
      code: field.code,
      label: FIELD_BY_CODE.get(field.code)?.name ?? field.label ?? field.code,
    };
    const specialtyEntry = query.specialtyCode
      ? SPECIALTY_BY_CODE.get(query.specialtyCode)
      : null;
    const specialty =
      query.specialtyCode && specialtyEntry
        ? { code: specialtyEntry.code, label: specialtyEntry.name }
        : null;
    const skillMap = query.specialtyCode
      ? (this.skillsForSpecialty(field, query.specialtyCode) ??
        new Map<string, string[]>())
      : new Map<string, string[]>();
    const skills = query.skillCodes.map((code) => ({
      code,
      label: this.pickStableLabel(skillMap.get(code) ?? [], code),
    }));
    const role = field.role;
    const photoUrl = this.photoUrlBuilder.buildPhotoUrl({
      id: profile.personId,
      edu_email: profile.eduEmail,
    } as Person);

    return {
      personId: profile.personId,
      displayName: profile.displayName,
      photoUrl,
      jobTitle: profile.jobTitle,
      domainMatchRole: role,
      matchedDomain: domain,
      matchedSpecialty: specialty,
      matchedSkills: skills,
      explanation: {
        domain: { ...domain, role },
        specialty,
        skills,
      },
    };
  }

  private comparePeople(
    left: CompetencyPeopleSearchPersonDto,
    right: CompetencyPeopleSearchPersonDto,
  ): number {
    if (left.domainMatchRole !== right.domainMatchRole) {
      return left.domainMatchRole === 'PRIMARY' ? -1 : 1;
    }
    const byName = this.spanishCollator.compare(
      left.displayName,
      right.displayName,
    );
    if (byName !== 0) return byName;
    return this.spanishCollator.compare(left.personId, right.personId);
  }

  private usableFields(profile: SearchableProfile): PresentationField[] {
    return profile.presentation.fields.filter((field) =>
      FIELD_BY_CODE.has(field.code),
    );
  }

  private usableSpecialties(field: PresentationField): PresentationSpecialty[] {
    return field.specialties.filter((specialty) => {
      const catalogEntry = SPECIALTY_BY_CODE.get(specialty.code);
      return catalogEntry?.parentField === field.code;
    });
  }

  private skillsForSpecialty(
    field: PresentationField,
    specialtyCode: string,
  ): Map<string, string[]> | null {
    const matching = this.usableSpecialties(field).filter(
      (specialty) => specialty.code === specialtyCode,
    );
    if (matching.length === 0) return null;
    const skills = new Map<string, string[]>();
    for (const specialty of matching) {
      for (const skill of specialty.skills) {
        const labels = skills.get(skill.code) ?? [];
        labels.push(skill.name);
        skills.set(skill.code, labels);
      }
    }
    return skills;
  }

  private toFacets(
    counts: Map<string, number>,
    labelFor: (code: string) => string,
  ): CompetencyPeopleSearchFacetDto[] {
    return [...counts]
      .filter(([, count]) => count > 0)
      .map(([code, count]) => ({ code, label: labelFor(code), count }))
      .sort((left, right) => {
        if (left.count !== right.count) return right.count - left.count;
        const byLabel = this.spanishCollator.compare(left.label, right.label);
        return byLabel || this.spanishCollator.compare(left.code, right.code);
      });
  }

  private pickStableLabel(labels: string[], fallback: string): string {
    const counts = new Map<string, number>();
    for (const raw of labels) {
      const label = String(raw ?? '').trim();
      if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return (
      [...counts].sort((left, right) => {
        if (left[1] !== right[1]) return right[1] - left[1];
        return this.spanishCollator.compare(left[0], right[0]);
      })[0]?.[0] ?? fallback
    );
  }

  private parseSkillCodes(raw: SearchInput['skills']): string[] {
    const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
      for (const part of String(value).split(',')) {
        const code = part.trim();
        if (code && !seen.has(code)) {
          seen.add(code);
          result.push(code);
        }
      }
    }
    return result;
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = String(value ?? '').trim();
    return cleaned || null;
  }

  private toPositiveInteger(
    value: string | number | null | undefined,
    fallback: number,
  ): number {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
