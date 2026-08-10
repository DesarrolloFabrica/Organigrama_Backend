export const PROFILE_CONTRACT_CODE = 'MC1.PROFILE.PILOT' as const;
export const PROFILE_CONTRACT_VERSION = '1.0.0' as const;

export type ProfilePresentationSkill = {
  skillCode: string;
  name: string;
  parentSpecialtyCode: string;
  confidence: number;
  supportingEvidenceUnitIds: string[];
};

export type ProfileSkillDimensionMapping = {
  skillCode: string;
  dimensionCodes: string[];
  supportingEvidenceUnitIds: string[];
  mappingJustification: string;
};

export type ProfileRadarAxis = {
  dimensionCode: string;
  label: string;
  rawScore: number;
  relativeCoverage: number;
  contributingSkillCodes: string[];
  supportingEvidenceUnitIds: string[];
};

export type ProfileFieldBlock = {
  fieldCode: string;
  role: 'PRIMARY' | 'SECONDARY';
  r1Confidence?: number;
  specialties: Array<{ specialtyCode: string; confidence: number }>;
  skills: ProfilePresentationSkill[];
  toolsTechnologies: string[];
  skillDimensionMappings: ProfileSkillDimensionMapping[];
  radar: {
    fieldCode: string;
    axes: ProfileRadarAxis[];
  };
  evidenceVolume: 'LOW' | 'MEDIUM' | 'HIGH';
  evidenceUnitCount: number;
  /** Descriptor visual opcional (nunca specialty almacenada). Ej: "Perfil Full Stack". */
  derivedPresentationLabel?: string | null;
};

export type ProfilePilotEnvelope = {
  contractCode: typeof PROFILE_CONTRACT_CODE;
  contractVersion: typeof PROFILE_CONTRACT_VERSION;
  stageCode: 'PROFILE_PILOT';
  producedAt: string;
  warnings: Array<{ code: string; severity: string; messageSafe: string }>;
  payload: {
    snapshotId: string;
    r1FieldResolutionStatus: 'RESOLVED' | 'MULTI_FIELD' | 'UNRESOLVED';
    fields: ProfileFieldBlock[];
    presentationNotes: {
      weakHiddenFromPrimary: true;
      toolsSeparatedFromSkills: true;
      radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY';
      formulaVersion: string;
    };
    provenance: {
      r1PackDir: string;
      p3PackDir: string;
      p4PackDir: string;
      mode: 'ARTIFACT_ONLY';
      dimensionsDoc: string;
    };
  };
};
