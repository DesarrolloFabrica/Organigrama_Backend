import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { CV_SKILLS_EXTRACTION_PROMPT } from './cv-skills.prompt';
import {
  DEFAULT_GEMINI_MODEL,
  EXTRACTED_CV_SKILLS_JSON_SCHEMA,
  type ExtractedCvSkills,
} from './cv-skills.types';
import {
  CvSkillsValidationError,
  validateExtractedCvSkills,
} from './cv-skills.validation';
import {
  emptyGeminiUsage,
  extractGeminiUsage,
  recordGeminiCall,
} from '../mc-pipeline/gemini';

/**
 * Extracción de skills profesionales desde un PDF (Buffer) vía Gemini.
 *
 * Desacoplado de Drive, cédula, person_cv y scripts CLI.
 * Firma reutilizable para la futura carga de hojas de vida V2:
 *   extractSkills(pdfBuffer: Buffer): Promise<ExtractedCvSkills>
 */
@Injectable()
export class CvSkillsExtractionService {
  private readonly logger = new Logger(CvSkillsExtractionService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Envía el PDF a Gemini (inline base64) y devuelve skills tipadas y validadas.
   * No escribe el PDF en disco. No imprime la API key.
   */
  async extractSkills(pdfBuffer: Buffer): Promise<ExtractedCvSkills> {
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw new Error(
        'pdfBuffer inválido o vacío: se requiere un Buffer PDF no vacío.',
      );
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error(
        'Falta la variable de entorno GEMINI_API_KEY. ' +
          'Defínela en el .env para habilitar la extracción de skills con Gemini.',
      );
    }

    const model =
      this.config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_GEMINI_MODEL;

    this.logger.log(
      `Extrayendo skills con Gemini model=${model} pdfBytes=${pdfBuffer.length}`,
    );

    const ai = new GoogleGenAI({ apiKey });

    let responseText: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { text: CV_SKILLS_EXTRACTION_PROMPT },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: EXTRACTED_CV_SKILLS_JSON_SCHEMA,
        },
      });
      responseText = response.text;
      try {
        const { usage, raw } = extractGeminiUsage(response);
        recordGeminiCall({
          context: { phase: 'CV_SKILLS', model },
          usage,
          usageRaw: raw,
          status: 'SUCCESS',
          durationMs: null,
        });
      } catch {
        // ledger best-effort
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error llamando a Gemini: ${message}`);
      try {
        recordGeminiCall({
          context: { phase: 'CV_SKILLS', model },
          usage: emptyGeminiUsage(),
          usageRaw: null,
          status: 'FAILED',
          durationMs: null,
          errorCode: message.slice(0, 180),
        });
      } catch {
        // ledger best-effort
      }
      throw new Error(`Fallo al llamar a Gemini para extracción de skills: ${message}`);
    }

    if (!responseText?.trim()) {
      throw new Error(
        'Gemini devolvió una respuesta vacía al extraer skills del CV.',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new CvSkillsValidationError(
        'Gemini no devolvió JSON parseable al extraer skills del CV.',
      );
    }

    return validateExtractedCvSkills(parsed);
  }
}
