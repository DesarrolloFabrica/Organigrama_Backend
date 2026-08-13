export type CompetencyPeopleSearchCriterion = 'domain' | 'specialty' | 'skill';

export type CompetencyPeopleSearchWarningCode =
  | 'DOMAIN_INVALID'
  | 'SPECIALTY_REQUIRES_DOMAIN'
  | 'SPECIALTY_INVALID'
  | 'SPECIALTY_OUTSIDE_DOMAIN'
  | 'SKILLS_REQUIRE_SPECIALTY'
  | 'SKILL_INVALID';

export type CompetencyPeopleSearchQueryDto = {
  domainCode: string | null;
  specialtyCode: string | null;
  skillCodes: string[];
};

export type CompetencyPeopleSearchWarningDto = {
  code: CompetencyPeopleSearchWarningCode;
  criterion: CompetencyPeopleSearchCriterion;
  value: string;
};

export type CompetencyPeopleSearchFacetDto = {
  code: string;
  label: string;
  count: number;
};

export type CompetencyPeopleSearchMatchValueDto = {
  code: string;
  label: string;
};

export type CompetencyPeopleSearchPersonDto = {
  personId: string;
  displayName: string;
  photoUrl: string | null;
  jobTitle: string | null;
  domainMatchRole: 'PRIMARY' | 'SECONDARY';
  matchedDomain: CompetencyPeopleSearchMatchValueDto;
  matchedSpecialty: CompetencyPeopleSearchMatchValueDto | null;
  matchedSkills: CompetencyPeopleSearchMatchValueDto[];
  explanation: {
    domain: CompetencyPeopleSearchMatchValueDto & {
      role: 'PRIMARY' | 'SECONDARY';
    };
    specialty: CompetencyPeopleSearchMatchValueDto | null;
    skills: CompetencyPeopleSearchMatchValueDto[];
  };
};

export type CompetencyPeopleSearchResponseDto = {
  query: CompetencyPeopleSearchQueryDto;
  selectedCriteria: {
    domain: CompetencyPeopleSearchMatchValueDto | null;
    specialty: CompetencyPeopleSearchMatchValueDto | null;
    skills: CompetencyPeopleSearchMatchValueDto[];
  };
  warnings: CompetencyPeopleSearchWarningDto[];
  authorizedUniverseTotal: number;
  total: number;
  people: CompetencyPeopleSearchPersonDto[];
  facets: {
    domains: CompetencyPeopleSearchFacetDto[];
    specialties: CompetencyPeopleSearchFacetDto[];
    skills: CompetencyPeopleSearchFacetDto[];
  };
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
};
