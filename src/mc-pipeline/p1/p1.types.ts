/**
 * Tipos P1 prototipo — alineados a MC1.P1.EVIDENCE 2.0.0 (subconjunto).
 * Segmenter/prompt v1.1.0 — contrato permanece 2.0.0.
 */
export type P1CandidateType =
  | 'SENTENCE'
  | 'BULLET'
  | 'PARAGRAPH'
  | 'HEADING'
  | 'TABLE_LIKE_ROW'
  | 'OTHER';

export type P1CandidateDecision =
  | 'ACCEPTED'
  | 'REJECTED_NON_PROFESSIONAL'
  | 'REJECTED_CONTEXT_ONLY'
  | 'AMBIGUOUS'
  | 'REVIEW_REQUIRED';

export type P1EvidenceKind =
  | 'ACTION'
  | 'RESPONSIBILITY'
  | 'PROJECT'
  | 'DELIVERABLE'
  | 'RESULT'
  | 'TOOL_USAGE'
  | 'METHODOLOGY'
  | 'CERTIFICATION'
  | 'KNOWLEDGE_STATEMENT'
  | 'LANGUAGE'
  | 'EDUCATION_SIGNAL'
  | 'OTHER_PROFESSIONAL_EVIDENCE';

export type P1Explicitness = 'EXPLICIT' | 'STRONGLY_SUPPORTED' | 'INFERRED';

export type P1BlockType =
  | 'PROFILE'
  | 'EXPERIENCE'
  | 'EDUCATION'
  | 'CERTIFICATIONS'
  | 'SKILLS'
  | 'TOOLS'
  | 'LANGUAGES'
  | 'PROJECTS'
  | 'REFERENCES'
  | 'OTHER'
  | null;

export type EvidenceCandidate = {
  candidateId: string;
  snapshotId: string;
  pageNumber: number;
  startOffset: number;
  endOffset: number;
  textHash: string;
  characterCount: number;
  candidateType: P1CandidateType;
  parentBlockId: string | null;
  headingContext: string | null;
  /** v1.1 — candidato HEADING que aporta contexto */
  parentHeadingCandidateId: string | null;
  /** v1.1 — tipo de bloque inferido del heading */
  blockType: P1BlockType;
  /** Solo en memoria / artefactos CONFIDENTIAL — no logs. */
  text?: string;
};

export type UnsegmentedGap = {
  startOffset: number;
  endOffset: number;
  characterCount: number;
  kind: 'WHITESPACE' | 'PAGE_DELIMITER' | 'OTHER';
};

export type SegmentationResult = {
  segmenterName: string;
  segmenterVersion: string;
  snapshotId: string;
  candidates: EvidenceCandidate[];
  gaps: UnsegmentedGap[];
  metrics: {
    candidateCount: number;
    candidateCharacterCoverage: number;
    unsegmentedCharacterCount: number;
    unsegmentedRelevantCharacterCount: number;
    pageCoverageRatio: number;
    candidateTypeCounts: Record<string, number>;
    headingCount: number;
    largestCandidateCharacters: number;
    smallestCandidateCharacters: number;
    normalizedTextLength: number;
  };
};

export type EvidenceBatch = {
  batchId: string;
  candidateIds: string[];
  pageRange: [number, number];
  characterCount: number;
  contextCandidateIds: string[];
};

/** Prompt activo del prototipo (v1.1). */
export const P1_PROMPT_VERSION = 'MC1.P1.PROMPT.PROTOTYPE.1.1.0';
export const P1_PROMPT_VERSION_V10 = 'MC1.P1.PROMPT.PROTOTYPE.1.0.0';
export const P1_SEGMENTER_NAME = 'deterministic-evidence-candidate-segmenter';
export const P1_SEGMENTER_VERSION = '1.1.0';
export const P1_SEGMENTER_VERSION_V10 = '1.0.0';
export const P1_CONTRACT_VERSION = '2.0.0';
