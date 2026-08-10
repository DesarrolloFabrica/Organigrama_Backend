/**
 * Tipos P0 Snapshot — desacoplados de librerías (unpdf) y de Nest.
 * Contrato: MC1.P0.SNAPSHOT 1.1.0
 */
/** Estados de parse del artefacto documental (persistidos en BD). */
export type P0ParseStatus =
  | 'PARSED'
  | 'PARTIAL'
  | 'EMPTY_DOCUMENT'
  | 'SCANNED_OR_IMAGE_ONLY'
  | 'UNSUPPORTED_FORMAT'
  | 'FAILED';

/** Página de texto extraída (1-based). */
export type CvExtractedPage = {
  pageNumber: number;
  text: string;
  characterCount: number;
};

/** Entrada al extractor de texto (buffer ya descargado). */
export type CvDocumentExtractionInput = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
};

/** Resultado del extractor — sin normalizar ni secciones. */
export type CvDocumentExtractionResult = {
  status: P0ParseStatus;
  rawText: string;
  pages: CvExtractedPage[];
  pageCount: number;
  metadata: {
    title?: string | null;
    author?: string | null;
  };
  warnings: string[];
  errorCode?: string;
  errorDetailSafe?: string;
};

/** Resultado del normalizador determinístico. */
export type CvTextNormalizationResult = {
  normalizedText: string;
  normalizedTextHash: string;
  metrics: {
    inputChars: number;
    outputChars: number;
    linesCollapsed: number;
    controlCharsRemoved: number;
    softHyphenJoins: number;
  };
  warnings: string[];
};

export type CvSectionType =
  | 'PROFILE'
  | 'EXPERIENCE'
  | 'EDUCATION'
  | 'CERTIFICATIONS'
  | 'PROJECTS'
  | 'SKILLS'
  | 'LANGUAGES'
  | 'REFERENCES'
  | 'OTHER'
  | 'DOCUMENT';

export type CvSectionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

/** Sección heurística — no es evidencia ni clasificación de skills. */
export type CvSection = {
  type: CvSectionType;
  heading: string | null;
  startPage: number | null;
  endPage: number | null;
  rawText: string;
  confidence: CvSectionConfidence;
};

export type CvSectionedContent = {
  sections: CvSection[];
  unclassifiedText: string[];
  detectorName: string;
  detectorVersion: string;
  warnings: string[];
};

/** Input preparado (sin Drive) para crear/reutilizar snapshot. */
export type McCvSnapshotCreationInput = {
  personId: number;
  personCvId: number;
  driveFileId: string;
  driveFileName: string;
  mimeType: string;
  buffer: Buffer;
  sourceHash: string;
  sourceSizeBytes: number;
  sourceModifiedTime?: Date | null;
};

export type McCvSnapshotOutcome = 'CREATED' | 'REUSED';

export type McCvSnapshotCreationResult = {
  outcome: McCvSnapshotOutcome;
  snapshotId: string;
  parseStatus: P0ParseStatus;
  pageCount: number;
  sourceHash: string;
  normalizedTextHash: string | null;
  extractorName: string;
  extractorVersion: string;
  normalizerName: string;
  normalizerVersion: string;
  warnings: string[];
};

/** Metadatos seguros — sin textos PII. */
export type McCvSnapshotMetadata = {
  snapshotId: string;
  personId: string;
  personCvId: string;
  sourceHash: string;
  mimeType: string;
  pageCount: number;
  parseStatus: P0ParseStatus;
  extractorName: string;
  extractorVersion: string;
  normalizerName: string;
  normalizerVersion: string;
  normalizedTextHash: string | null;
  sourceSizeBytes: string;
  createdAt: Date;
  rawTextPresent: boolean;
  normalizedTextPresent: boolean;
};

export const PAGE_DELIMITER_PREFIX = '---PAGE ';
export const PAGE_DELIMITER_SUFFIX = '---';

export function pageDelimiter(pageNumber: number): string {
  return `${PAGE_DELIMITER_PREFIX}${pageNumber}${PAGE_DELIMITER_SUFFIX}`;
}
