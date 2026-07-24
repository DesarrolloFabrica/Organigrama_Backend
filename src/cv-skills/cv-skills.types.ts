/**
 * Tipos y esquema JSON de salida para la extracción de skills desde un CV (PDF).
 * Independientes de Drive, cédula y base de datos.
 */

export const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export const SKILL_TYPES = [
  'TECHNOLOGY',
  'TOOL',
  'METHODOLOGY',
  'PROFESSIONAL_KNOWLEDGE',
  'LANGUAGE',
  'SOFT_SKILL',
  'OTHER',
] as const;

export type SkillType = (typeof SKILL_TYPES)[number];

/** Catálogo cerrado de sección del CV donde se encontró la evidencia. */
export const EVIDENCE_SOURCE_TYPES = [
  'PROFILE_SUMMARY',
  'SKILLS_SECTION',
  'WORK_EXPERIENCE',
  'PROJECT',
  'EDUCATION',
  'CERTIFICATION',
  'ACHIEVEMENT',
  'RESPONSIBILITY',
  'OTHER',
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

/**
 * Prioridad de sourceType al consolidar evidencias (mayor prioridad = primero).
 * WORK_EXPERIENCE … OTHER según política Fase B.
 */
export const EVIDENCE_SOURCE_TYPE_PRIORITY: readonly EvidenceSourceType[] = [
  'WORK_EXPERIENCE',
  'PROJECT',
  'ACHIEVEMENT',
  'RESPONSIBILITY',
  'CERTIFICATION',
  'EDUCATION',
  'PROFILE_SUMMARY',
  'SKILLS_SECTION',
  'OTHER',
] as const;

export const MAX_EVIDENCE_ITEMS_PER_SKILL = 5;

export interface SkillEvidenceItem {
  sourceType: EvidenceSourceType;
  evidenceText: string;
  occurrenceIndex: number;
  /** true si se heredó de category.evidence (no vino del modelo por skill). */
  isFallback?: boolean;
}

export interface ExtractedSkill {
  originalName: string;
  normalizedName: string;
  skillType: SkillType;
  confidence: number;
  isExplicit: true;
  level?: string | null;
  /** Citas textuales por skill (Fase B). Puede ser [] si no hay evidencia. */
  evidenceItems?: SkillEvidenceItem[];
}

export interface ExtractedSkillCategory {
  category: string;
  skills: ExtractedSkill[];
  /** Evidencia de categoría (compatibilidad temporal). */
  evidence: string;
}

export interface ExtractedLanguage {
  name: string;
  level?: string | null;
  isCertified?: boolean | null;
  evidence: string;
}

export interface ExtractedCertification {
  name: string;
  issuer?: string | null;
  evidence: string;
}

/**
 * Resultado tipado de `extractSkills(pdfBuffer)`.
 * Sin metadatos de cédula/Drive: eso lo añade el orquestador en fases posteriores.
 */
export interface ExtractedCvSkills {
  categories: ExtractedSkillCategory[];
  languages: ExtractedLanguage[];
  certifications: ExtractedCertification[];
  warnings: string[];
}

const skillEvidenceItemSchema = {
  type: 'object',
  properties: {
    sourceType: {
      type: 'string',
      enum: [...EVIDENCE_SOURCE_TYPES],
      description:
        'Sección del CV donde aparece la cita (enum cerrado). Usar OTHER solo si no se puede determinar.',
    },
    evidenceText: {
      type: 'string',
      description:
        'Cita corta y fiel al CV (copiar fragmento; no parafrasear ni inventar).',
    },
    occurrenceIndex: {
      type: 'number',
      description: 'Orden de aparición de esta evidencia para la skill (inicia en 1).',
    },
  },
  required: ['sourceType', 'evidenceText', 'occurrenceIndex'],
} as const;

/**
 * JSON Schema para Gemini (`responseJsonSchema` + `responseMimeType: application/json`).
 * Subconjunto compatible con el SDK @google/genai.
 */
export const EXTRACTED_CV_SKILLS_JSON_SCHEMA = {
  type: 'object',
  properties: {
    categories: {
      type: 'array',
      description: 'Categorías profesionales con skills explícitas y evidencia textual',
      items: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Nombre de la categoría (ej. Frontend, Idiomas, Diseño)',
          },
          skills: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                originalName: {
                  type: 'string',
                  description: 'Nombre tal como aparece en el CV',
                },
                normalizedName: {
                  type: 'string',
                  description: 'Nombre normalizado conocido, sin inventar skills nuevas',
                },
                skillType: {
                  type: 'string',
                  enum: [...SKILL_TYPES],
                },
                confidence: {
                  type: 'number',
                  description: 'Confianza 0..1 de que la skill está explícita en el texto',
                },
                isExplicit: {
                  type: 'boolean',
                  description: 'Debe ser siempre true; no incluir skills no explícitas',
                },
                level: {
                  type: ['string', 'null'],
                  description: 'Nivel solo si está escrito en el CV',
                },
                evidenceItems: {
                  type: 'array',
                  description:
                    'Hasta 5 citas textuales del CV para esta skill (no inventar; vacío si no hay cita).',
                  items: skillEvidenceItemSchema,
                },
              },
              required: [
                'originalName',
                'normalizedName',
                'skillType',
                'confidence',
                'isExplicit',
                'evidenceItems',
              ],
            },
          },
          evidence: {
            type: 'string',
            description:
              'Cita textual del CV que respalda la categoría (compatibilidad; preferir evidenceItems por skill).',
          },
        },
        required: ['category', 'skills', 'evidence'],
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: {
            type: ['string', 'null'],
            description: 'Solo si el nivel está escrito',
          },
          isCertified: {
            type: ['boolean', 'null'],
            description: 'true solo si el CV indica certificación explícita',
          },
          evidence: { type: 'string' },
        },
        required: ['name', 'evidence'],
      },
    },
    certifications: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          issuer: { type: ['string', 'null'] },
          evidence: { type: 'string' },
        },
        required: ['name', 'evidence'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Advertencias (poca información, sin sección de skills, CV escaso, etc.)',
    },
  },
  required: ['categories', 'languages', 'certifications', 'warnings'],
} as const;
