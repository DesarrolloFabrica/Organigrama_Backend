/**
 * FASE 9F — Presentation DTO for PersonDetail competencies (MC1 Profile Assembly).
 * No paths, packs, evidence IDs, or pipeline internals.
 */

export type Mc1PersonProfileReadStatus =
  | 'AVAILABLE'
  | 'NOT_AVAILABLE'
  | 'INVALID';

export type Mc1PersonCompetenciesPresentationDto = {
  status: 'AVAILABLE';
  source: 'ARTIFACT_ONLY_LOCAL' | 'CLOUD_PRESENTATION_STORE';
  /** Additive provenance for consumers that need to audit radar geometry. */
  calibration?: {
    policy: string;
    version: string;
  };
  fields: Array<{
    code: string;
    label: string;
    role: 'PRIMARY' | 'SECONDARY';
    confidence?: number;
    derivedPresentationLabel?: string | null;
    specialties: Array<{
      code: string;
      label: string;
      confidence?: number;
      skills: Array<{
        code: string;
        name: string;
      }>;
    }>;
    tools: string[];
    competencyMap: {
      dimensions: Array<{
        code: string;
        label: string;
        relativeCoverage: number;
        /** Present on current responses; optional in historical stored JSON. */
        displayCoverage?: number;
        evidenceState?: 'NO_EVIDENCE' | 'WEAK_EVIDENCE' | 'OBSERVED';
      }>;
    };
    evidenceVolume: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;
};

export type Mc1PersonProfileReadResult =
  | {
      status: 'AVAILABLE';
      presentation: Mc1PersonCompetenciesPresentationDto;
    }
  | { status: 'NOT_AVAILABLE' }
  | { status: 'INVALID'; reason: string };
