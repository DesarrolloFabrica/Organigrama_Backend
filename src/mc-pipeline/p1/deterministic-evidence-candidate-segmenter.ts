/**
 * Segmentador determinístico P1 v1.1.0 — offsets autoridad + headings.
 * No clasifica conocimiento. No usa organigrama.
 */
import { createHash } from 'node:crypto';
import type { CvExtractedPage } from '../p0/p0.types';
import {
  P1_SEGMENTER_NAME,
  P1_SEGMENTER_VERSION,
  type EvidenceCandidate,
  type P1BlockType,
  type P1CandidateType,
  type SegmentationResult,
  type UnsegmentedGap,
} from './p1.types';

const PAGE_DELIM_RE = /^---PAGE\s+(\d+)---$/;
const BULLET_RE = /^(\s*)([•\-\*▪◦]|[a-zA-Z][.)])\s+\S/;
/** Viñetas numeradas de contenido (1. texto largo) — no títulos de sección. */
const NUMBERED_BULLET_RE = /^(\s*)\d+[.)]\s+\S.{15,}/;
const TABLE_LIKE_RE = /\t|(\s{2,}\S+){2,}/;

const KNOWN_HEADINGS: { re: RegExp; block: Exclude<P1BlockType, null> }[] = [
  { re: /^(perfil|resumen)(\s+profesional)?$/i, block: 'PROFILE' },
  { re: /^acerca\s+de\s+m[ií]$/i, block: 'PROFILE' },
  { re: /^objetivo(\s+profesional)?$/i, block: 'PROFILE' },
  {
    re: /^(experiencia)(\s+laboral|\s+profesional)?$/i,
    block: 'EXPERIENCE',
  },
  { re: /^(historial\s+laboral|trayectoria)$/i, block: 'EXPERIENCE' },
  {
    re: /^(formaci[oó]n|educaci[oó]n|estudios)(\s+acad[eé]mica)?$/i,
    block: 'EDUCATION',
  },
  {
    re: /^(certificaciones?|cursos|diplomas?)(\s+y\s+certificaciones)?$/i,
    block: 'CERTIFICATIONS',
  },
  { re: /^(proyectos?|portfolio)$/i, block: 'PROJECTS' },
  {
    re: /^(habilidades|competencias|skills|conocimientos)(\s+t[eé]cnicos)?$/i,
    block: 'SKILLS',
  },
  { re: /^(herramientas|tecnolog[ií]as|software)$/i, block: 'TOOLS' },
  { re: /^(idiomas?|lenguas?)$/i, block: 'LANGUAGES' },
  { re: /^referencias$/i, block: 'REFERENCES' },
  { re: /^informaci[oó]n(\s+personal|\s+de\s+contacto)?$/i, block: 'OTHER' },
];

function sha256Short(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function isWhitespaceOnly(s: string): boolean {
  return /^\s*$/.test(s);
}

function stripHeadingNoise(line: string): string {
  return line
    .normalize('NFC')
    .replace(/^[#*\-•\s]+/, '')
    .replace(/^(\d+(\.\d+)*\.?\s+)/, '')
    .replace(/[:.\s]+$/g, '')
    .trim();
}

function matchKnownHeading(core: string): Exclude<P1BlockType, null> | null {
  const n = core.normalize('NFC').trim();
  for (const rule of KNOWN_HEADINGS) {
    if (rule.re.test(n)) return rule.block;
  }
  return null;
}

function uppercaseRatio(s: string): number {
  const letters = s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letters.length < 3) return 0;
  const upper = [...letters].filter(
    (c) => c === c.toUpperCase() && c !== c.toLowerCase(),
  ).length;
  return upper / letters.length;
}

/**
 * Clasificación conservadora de HEADING (v1.1).
 * Numeración de sección se evalúa ANTES que viñeta numerada.
 */
export function classifyLineV11(line: string): {
  type: P1CandidateType;
  blockType: P1BlockType;
} {
  const t = line.trim();
  if (!t) return { type: 'OTHER', blockType: null };
  if (PAGE_DELIM_RE.test(t)) return { type: 'OTHER', blockType: null };

  const core = stripHeadingNoise(t);
  const known = matchKnownHeading(core);
  const short = t.length <= 80;
  const noSentenceEnd = !/[.!?]$/.test(t);
  const numberedSection = /^\d+(\.\d+)*\.?\s+\S/.test(t);
  const endsWithColon = /:\s*$/.test(t) && t.length <= 60;
  const mostlyUpper = uppercaseRatio(core) >= 0.75;

  // HEADING: known CV section, or numbered/ALL-CAPS short title, or title:
  if (short && noSentenceEnd) {
    if (known) {
      return { type: 'HEADING', blockType: known };
    }
    if (numberedSection && (mostlyUpper || core.length <= 40) && core.split(/\s+/).length <= 8) {
      return {
        type: 'HEADING',
        blockType: matchKnownHeading(core) ?? 'OTHER',
      };
    }
    if (mostlyUpper && core.length >= 4 && core.split(/\s+/).length <= 8) {
      return {
        type: 'HEADING',
        blockType: matchKnownHeading(core) ?? 'OTHER',
      };
    }
    if (endsWithColon && core.split(/\s+/).length <= 6) {
      return {
        type: 'HEADING',
        blockType: matchKnownHeading(core) ?? 'OTHER',
      };
    }
  }

  // Bullets (sin títulos de sección numerados cortos)
  if (BULLET_RE.test(line) || NUMBERED_BULLET_RE.test(line)) {
    // Si es "1. EXPERIENCIA" corto ya se capturó arriba
    return { type: 'BULLET', blockType: null };
  }

  if (TABLE_LIKE_RE.test(line) && t.length < 200) {
    return { type: 'TABLE_LIKE_ROW', blockType: null };
  }
  if (/[.!?]["')\]]?\s*$/.test(t) || t.length < 160) {
    return { type: 'SENTENCE', blockType: null };
  }
  return { type: 'PARAGRAPH', blockType: null };
}

function pageAtOffset(
  pages: CvExtractedPage[] | undefined,
  offset: number,
  normalizedText: string,
): number {
  const before = normalizedText.slice(0, offset);
  const matches = [...before.matchAll(/---PAGE\s+(\d+)---/g)];
  if (matches.length > 0) {
    return Number(matches[matches.length - 1][1]);
  }
  if (!pages?.length) return 1;
  let cursor = 0;
  for (const p of pages) {
    const len = (p.text || '').length;
    if (offset < cursor + len + 32) return p.pageNumber;
    cursor += len;
  }
  return pages[pages.length - 1]?.pageNumber ?? 1;
}

export type SegmenterInput = {
  snapshotId: string;
  normalizedText: string;
  pages?: CvExtractedPage[];
  sectionedContent?: unknown;
};

export class DeterministicEvidenceCandidateSegmenter {
  readonly name = P1_SEGMENTER_NAME;
  readonly version = P1_SEGMENTER_VERSION;

  segment(input: SegmenterInput): SegmentationResult {
    const text = input.normalizedText;
    if (!text || text.length === 0) {
      throw new Error('normalizedText vacío');
    }

    const candidates: EvidenceCandidate[] = [];
    const gaps: UnsegmentedGap[] = [];
    let headingContext: string | null = null;
    let parentHeadingCandidateId: string | null = null;
    let currentBlockType: P1BlockType = null;
    let parentBlockId: string | null = null;
    let blockCounter = 0;
    let candCounter = 0;

    let i = 0;
    while (i < text.length) {
      const nextNl = text.indexOf('\n', i);
      const lineEnd = nextNl === -1 ? text.length : nextNl;
      const lineIncludingNlEnd = nextNl === -1 ? text.length : nextNl + 1;
      const line = text.slice(i, lineEnd);

      if (PAGE_DELIM_RE.test(line.trim())) {
        gaps.push({
          startOffset: i,
          endOffset: lineIncludingNlEnd,
          characterCount: lineIncludingNlEnd - i,
          kind: 'PAGE_DELIMITER',
        });
        // Contexto de heading puede cruzar página; no reset forzado
        i = lineIncludingNlEnd;
        continue;
      }

      if (isWhitespaceOnly(line)) {
        gaps.push({
          startOffset: i,
          endOffset: lineIncludingNlEnd,
          characterCount: lineIncludingNlEnd - i,
          kind: 'WHITESPACE',
        });
        i = lineIncludingNlEnd;
        continue;
      }

      const { type: ctype, blockType: lineBlock } = classifyLineV11(line);
      const start = i;
      const end = lineEnd;
      if (end <= start) {
        gaps.push({
          startOffset: i,
          endOffset: lineIncludingNlEnd,
          characterCount: lineIncludingNlEnd - i,
          kind: 'OTHER',
        });
        i = lineIncludingNlEnd;
        continue;
      }

      const spanText = text.slice(start, end);
      candCounter += 1;
      const candidateId = `c-${String(candCounter).padStart(4, '0')}`;
      const pageNumber = pageAtOffset(input.pages, start, text);

      let thisParentHeading = parentHeadingCandidateId;
      let thisHeadingContext = headingContext;
      let thisBlockType = currentBlockType;
      let thisParentBlock = parentBlockId;

      if (ctype === 'HEADING') {
        headingContext = spanText.trim().slice(0, 120);
        parentHeadingCandidateId = candidateId;
        currentBlockType = lineBlock ?? 'OTHER';
        blockCounter += 1;
        parentBlockId = `blk-${blockCounter}`;
        // El propio heading no hereda el anterior como parent de contenido
        thisParentHeading = null;
        thisHeadingContext = headingContext;
        thisBlockType = currentBlockType;
        thisParentBlock = parentBlockId;
      }

      candidates.push({
        candidateId,
        snapshotId: input.snapshotId,
        pageNumber,
        startOffset: start,
        endOffset: end,
        textHash: sha256Short(spanText),
        characterCount: end - start,
        candidateType: ctype,
        parentBlockId: thisParentBlock,
        headingContext: thisHeadingContext,
        parentHeadingCandidateId: thisParentHeading,
        blockType: ctype === 'HEADING' ? thisBlockType : currentBlockType,
        text: spanText,
      });

      if (lineEnd < lineIncludingNlEnd) {
        gaps.push({
          startOffset: lineEnd,
          endOffset: lineIncludingNlEnd,
          characterCount: lineIncludingNlEnd - lineEnd,
          kind: 'WHITESPACE',
        });
      }

      i = lineIncludingNlEnd;
    }

    const covered = new Array<boolean>(text.length).fill(false);
    for (const c of candidates) {
      for (let k = c.startOffset; k < c.endOffset; k++) covered[k] = true;
    }
    for (const g of gaps) {
      for (let k = g.startOffset; k < g.endOffset; k++) covered[k] = true;
    }

    const missing: number[] = [];
    for (let k = 0; k < text.length; k++) {
      if (!covered[k]) missing.push(k);
    }
    if (missing.length > 0) {
      let s = missing[0];
      let prev = missing[0];
      for (let mi = 1; mi <= missing.length; mi++) {
        const cur = missing[mi];
        if (cur !== prev + 1) {
          gaps.push({
            startOffset: s,
            endOffset: prev + 1,
            characterCount: prev + 1 - s,
            kind: 'OTHER',
          });
          if (cur != null) s = cur;
        }
        prev = cur;
      }
    }

    const candidateChars = candidates.reduce((a, c) => a + c.characterCount, 0);
    const unseg = gaps.reduce((a, g) => a + g.characterCount, 0);
    const unsegRelevant = gaps
      .filter((g) => g.kind === 'OTHER')
      .reduce((a, g) => a + g.characterCount, 0);

    const pagesWithCand = new Set(candidates.map((c) => c.pageNumber));
    const pageCount = Math.max(
      input.pages?.length ?? 0,
      ...[...pagesWithCand],
      1,
    );
    const pageCoverageRatio =
      pageCount === 0 ? 0 : pagesWithCand.size / pageCount;

    const typeCounts: Record<string, number> = {};
    for (const c of candidates) {
      typeCounts[c.candidateType] = (typeCounts[c.candidateType] || 0) + 1;
    }
    const sizes = candidates.map((c) => c.characterCount);
    const headingCount = candidates.filter(
      (c) => c.candidateType === 'HEADING',
    ).length;

    for (const c of candidates) {
      const recon = text.slice(c.startOffset, c.endOffset);
      if (recon.length === 0) throw new Error(`span vacío ${c.candidateId}`);
      if (c.text != null && recon !== c.text) {
        throw new Error(`reconstrucción falló ${c.candidateId}`);
      }
    }

    const sorted = [...candidates].sort((a, b) => a.startOffset - b.startOffset);
    for (let j = 1; j < sorted.length; j++) {
      if (sorted[j].startOffset < sorted[j - 1].endOffset) {
        throw new Error(
          `solape ${sorted[j - 1].candidateId}/${sorted[j].candidateId}`,
        );
      }
    }

    void input.sectionedContent;

    return {
      segmenterName: this.name,
      segmenterVersion: this.version,
      snapshotId: input.snapshotId,
      candidates,
      gaps,
      metrics: {
        candidateCount: candidates.length,
        candidateCharacterCoverage: candidateChars / text.length,
        unsegmentedCharacterCount: unseg,
        unsegmentedRelevantCharacterCount: unsegRelevant,
        pageCoverageRatio,
        candidateTypeCounts: typeCounts,
        headingCount,
        largestCandidateCharacters: sizes.length ? Math.max(...sizes) : 0,
        smallestCandidateCharacters: sizes.length ? Math.min(...sizes) : 0,
        normalizedTextLength: text.length,
      },
    };
  }
}
