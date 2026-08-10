/**
 * Detector heurístico de secciones (español). No IA. No bloqueante.
 * Texto no clasificado nunca se pierde.
 */
import type {
  CvExtractedPage,
  CvSection,
  CvSectionedContent,
  CvSectionType,
} from './p0.types';

export const CV_SECTION_DETECTOR_NAME = 'heuristic-cv-section-detector';
export const CV_SECTION_DETECTOR_VERSION = '1.0.0';

type HeadingRule = { type: CvSectionType; patterns: RegExp[] };

const HEADING_RULES: HeadingRule[] = [
  {
    type: 'PROFILE',
    patterns: [
      /^perfil(\s+profesional)?$/i,
      /^resumen(\s+profesional)?$/i,
      /^acerca\s+de\s+m[ií]$/i,
      /^objetivo(\s+profesional)?$/i,
    ],
  },
  {
    type: 'EXPERIENCE',
    patterns: [
      /^experiencia(\s+laboral|\s+profesional)?$/i,
      /^historial\s+laboral$/i,
      /^trayectoria$/i,
    ],
  },
  {
    type: 'EDUCATION',
    patterns: [
      /^educaci[oó]n$/i,
      /^formaci[oó]n(\s+acad[eé]mica)?$/i,
      /^estudios$/i,
    ],
  },
  {
    type: 'CERTIFICATIONS',
    patterns: [
      /^certificaciones?$/i,
      /^cursos(\s+y\s+certificaciones)?$/i,
      /^diplomas?$/i,
    ],
  },
  {
    type: 'PROJECTS',
    patterns: [/^proyectos?$/i, /^portfolio$/i],
  },
  {
    type: 'SKILLS',
    patterns: [
      /^habilidades$/i,
      /^competencias$/i,
      /^skills$/i,
      /^conocimientos(\s+t[eé]cnicos)?$/i,
    ],
  },
  {
    type: 'LANGUAGES',
    patterns: [/^idiomas?$/i, /^lenguas?$/i],
  },
  {
    type: 'REFERENCES',
    patterns: [/^referencias$/i],
  },
];

function normalizeHeadingLine(line: string): string {
  return line
    .normalize('NFC')
    .replace(/^[#*\-•\s]+/, '')
    .replace(/[:.\s]+$/g, '')
    .trim();
}

function matchHeading(line: string): CvSectionType | null {
  const n = normalizeHeadingLine(line);
  if (!n || n.length > 80) return null;
  for (const rule of HEADING_RULES) {
    for (const re of rule.patterns) {
      if (re.test(n)) return rule.type;
    }
  }
  return null;
}

export class CvSectionDetector {
  readonly name = CV_SECTION_DETECTOR_NAME;
  readonly version = CV_SECTION_DETECTOR_VERSION;

  detect(params: {
    normalizedText: string;
    pages?: CvExtractedPage[];
  }): CvSectionedContent {
    const warnings: string[] = [];
    const lines = params.normalizedText.split('\n');
    const sections: CvSection[] = [];
    let currentType: CvSectionType | null = null;
    let currentHeading: string | null = null;
    let buf: string[] = [];

    const flush = () => {
      if (currentType == null) return;
      const rawText = buf.join('\n').trim();
      sections.push({
        type: currentType,
        heading: currentHeading,
        startPage: null,
        endPage: null,
        rawText,
        confidence: currentHeading ? 'MEDIUM' : 'LOW',
      });
      buf = [];
    };

    for (const line of lines) {
      const headingType = matchHeading(line);
      if (headingType) {
        if (currentType == null && buf.length > 0) {
          // Prefacio antes del primer encabezado → OTHER
          sections.push({
            type: 'OTHER',
            heading: null,
            startPage: null,
            endPage: null,
            rawText: buf.join('\n').trim(),
            confidence: 'LOW',
          });
          buf = [];
          warnings.push('preface_marked_other');
        } else {
          flush();
        }
        currentType = headingType;
        currentHeading = normalizeHeadingLine(line);
        continue;
      }
      buf.push(line);
    }

    if (currentType == null) {
      // Sin encabezados → DOCUMENT completo
      const rawText = params.normalizedText;
      return {
        sections: [
          {
            type: 'DOCUMENT',
            heading: null,
            startPage: params.pages?.[0]?.pageNumber ?? 1,
            endPage:
              params.pages?.[params.pages.length - 1]?.pageNumber ?? null,
            rawText,
            confidence: 'LOW',
          },
        ],
        unclassifiedText: [],
        detectorName: this.name,
        detectorVersion: this.version,
        warnings: ['no_headings_fallback_document'],
      };
    }

    flush();

    // Garantizar que la concatenación de secciones no pierde contenido sustancial
    const joinedLen = sections.reduce((s, sec) => s + sec.rawText.length, 0);
    if (joinedLen + 50 < params.normalizedText.replace(/\s+/g, '').length) {
      warnings.push('possible_content_gap_check');
    }

    return {
      sections,
      unclassifiedText: [],
      detectorName: this.name,
      detectorVersion: this.version,
      warnings,
    };
  }
}
