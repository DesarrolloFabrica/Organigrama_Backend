/**
 * Interfaz del extractor de texto documental — independiente de unpdf.
 */
import type {
  CvDocumentExtractionInput,
  CvDocumentExtractionResult,
} from './p0.types';

export interface CvDocumentTextExtractor {
  /** Nombre estable del adapter (p.ej. unpdf). */
  readonly name: string;
  /** Versión del adapter (no solo el npm). */
  readonly version: string;

  extract(input: CvDocumentExtractionInput): Promise<CvDocumentExtractionResult>;
}
