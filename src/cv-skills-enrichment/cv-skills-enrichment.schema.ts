/**
 * JSON Schema Gemini exclusivo del Skill Enricher (lista cerrada).
 */
import { EVIDENCE_SOURCE_TYPES } from '../cv-skills/cv-skills.types';

const evidenceItemSchema = {
  type: 'object',
  properties: {
    sourceType: {
      type: 'string',
      enum: [...EVIDENCE_SOURCE_TYPES],
      description: 'Sección del CV (enum cerrado). OTHER solo si no se puede determinar.',
    },
    evidenceText: {
      type: 'string',
      description: 'Cita corta y fiel al CV. No parafrasear ni inventar.',
    },
    occurrenceIndex: {
      type: 'integer',
      description: 'Orden de esta evidencia para la skill (inicia en 1).',
    },
  },
  required: ['sourceType', 'evidenceText', 'occurrenceIndex'],
} as const;

export const CV_SKILLS_ENRICHER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    skills: {
      type: 'array',
      description:
        'Exactamente una entrada por cada skill solicitada. No omitir ni agregar.',
      items: {
        type: 'object',
        properties: {
          extractionSkillId: {
            type: 'string',
            description: 'Debe coincidir exactamente con el ID solicitado.',
          },
          normalizedName: {
            type: 'string',
            description: 'Debe coincidir exactamente con el nombre solicitado.',
          },
          evidenceItems: {
            type: 'array',
            description: 'Hasta 5 citas. Puede ser [].',
            items: evidenceItemSchema,
          },
        },
        required: ['extractionSkillId', 'normalizedName', 'evidenceItems'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description: 'Advertencias del modelo (puede ser []).',
    },
  },
  required: ['skills', 'warnings'],
} as const;
