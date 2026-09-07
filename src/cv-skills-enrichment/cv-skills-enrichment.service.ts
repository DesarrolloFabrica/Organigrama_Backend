import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { DEFAULT_GEMINI_MODEL } from '../cv-skills/cv-skills.types';
import { CV_SKILLS_ENRICHER_PROMPT } from './cv-skills-enrichment.prompt';
import { CV_SKILLS_ENRICHER_JSON_SCHEMA } from './cv-skills-enrichment.schema';
import type { EnrichmentInputSkill } from './cv-skills-enrichment.types';
import {
  emptyGeminiUsage,
  extractGeminiUsage,
  recordGeminiCall,
} from '../mc-pipeline/gemini';

export class EnrichmentGeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrichmentGeminiError';
  }
}

@Injectable()
export class CvSkillsEnrichmentService {
  private readonly logger = new Logger(CvSkillsEnrichmentService.name);

  constructor(private readonly config: ConfigService) {}

  resolveModel(override?: string): string {
    return (
      override?.trim() ||
      this.config.get<string>('GEMINI_MODEL')?.trim() ||
      DEFAULT_GEMINI_MODEL
    );
  }

  /**
   * Llama a Gemini con PDF + lista cerrada del bloque.
   * Devuelve el JSON parseado (aún sin validación de integridad).
   */
  async enrichBlock(params: {
    pdfBuffer: Buffer;
    skills: EnrichmentInputSkill[];
    model?: string;
  }): Promise<{ raw: unknown; model: string; rawText: string }> {
    const { pdfBuffer, skills } = params;
    if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
      throw new EnrichmentGeminiError('pdfBuffer inválido o vacío.');
    }
    if (skills.length === 0) {
      throw new EnrichmentGeminiError('Bloque sin skills.');
    }

    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new EnrichmentGeminiError(
        'Falta GEMINI_API_KEY para el Skill Enricher.',
      );
    }

    const model = this.resolveModel(params.model);
    const closedList = skills.map((s) => ({
      extractionSkillId: s.extractionSkillId,
      normalizedName: s.normalizedName,
      ...(s.originalName ? { originalName: s.originalName } : {}),
      ...(s.skillType ? { skillType: s.skillType } : {}),
    }));

    const listText = JSON.stringify({ skills: closedList }, null, 2);
    const userBlock = [
      CV_SKILLS_ENRICHER_PROMPT,
      '',
      '## Lista cerrada de skills a enriquecer (devolver TODAS)',
      listText,
    ].join('\n');

    this.logger.log(
      `Enricher Gemini model=${model} skills=${skills.length} pdfBytes=${pdfBuffer.length}`,
    );

    const ai = new GoogleGenAI({ apiKey });
    let responseText: string | undefined;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          { text: userBlock },
          {
            inlineData: {
              mimeType: 'application/pdf',
              data: pdfBuffer.toString('base64'),
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: CV_SKILLS_ENRICHER_JSON_SCHEMA,
        },
      });
      responseText = response.text;
      try {
        const { usage, raw } = extractGeminiUsage(response);
        recordGeminiCall({
          context: { phase: 'CV_ENRICHMENT', model },
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
      this.logger.error(`Error Gemini enricher: ${message}`);
      try {
        recordGeminiCall({
          context: { phase: 'CV_ENRICHMENT', model },
          usage: emptyGeminiUsage(),
          usageRaw: null,
          status: 'FAILED',
          durationMs: null,
          errorCode: message.slice(0, 180),
        });
      } catch {
        // ledger best-effort
      }
      throw new EnrichmentGeminiError(
        `Fallo al llamar a Gemini (enricher): ${message}`,
      );
    }

    if (!responseText?.trim()) {
      throw new EnrichmentGeminiError('Gemini devolvió respuesta vacía (enricher).');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      throw new EnrichmentGeminiError(
        'Gemini no devolvió JSON parseable (enricher).',
      );
    }

    return { raw: parsed, model, rawText: responseText };
  }
}
