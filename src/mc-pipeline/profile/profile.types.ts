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

/** FASE 12A — presentation eligibility (not P2/R1 discovery/resolution). */
export type ProfileFieldPublicationStatus =
  | 'PUBLISHABLE'
  | 'PROVENANCE_ONLY';

export type ProfileResolvedFieldProvenance = {
  fieldCode: string;
  role: 'PRIMARY' | 'SECONDARY';
  r1Confidence?: number;
  publicationStatus: ProfileFieldPublicationStatus;
  reasonCode: string;
  taxonomyPending: boolean;
  observedSpecialtyCount: number;
  observedSkillCount: number;
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
  /**
   * FASE 12A — PersonDetail tab eligibility.
   * RESOLVED fields that are PROVENANCE_ONLY stay in resolvedFieldsProvenance.
   */
  publicationStatus?: ProfileFieldPublicationStatus;
  taxonomyPending?: boolean;
  publicationReasonCode?: string;
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
    /** PUBLISHABLE fields only (PersonDetail tabs). */
    fields: ProfileFieldBlock[];
    /**
     * All R1-resolved fields with publication classification (audit / ambiguity).
     * Includes PROVENANCE_ONLY secondaries that must not become empty tabs.
     */
    resolvedFieldsProvenance?: ProfileResolvedFieldProvenance[];
    presentationNotes: {
      weakHiddenFromPrimary: true;
      toolsSeparatedFromSkills: true;
      radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY';
      formulaVersion: string;
      /** FASE 12A */
      fieldPublicationGate?: 'MC1.PROFILE.PUBLICATION_GATE.1.0.0';
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
