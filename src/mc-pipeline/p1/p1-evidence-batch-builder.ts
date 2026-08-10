/**
 * Constructor de lotes P1 — agrupa candidatos por página.
 */
import type { EvidenceBatch, EvidenceCandidate } from './p1.types';

export type BatchBuilderOptions = {
  /** Máx. candidatos evaluables por lote. */
  maxCandidatesPerBatch?: number;
  /** Máx. caracteres de candidatos evaluables por lote. */
  maxCharsPerBatch?: number;
};

const DEFAULT_MAX_CANDIDATES = 14;
const DEFAULT_MAX_CHARS = 4500;

export class P1EvidenceBatchBuilder {
  build(
    candidates: EvidenceCandidate[],
    options: BatchBuilderOptions = {},
  ): EvidenceBatch[] {
    const maxCand = options.maxCandidatesPerBatch ?? DEFAULT_MAX_CANDIDATES;
    const maxChars = options.maxCharsPerBatch ?? DEFAULT_MAX_CHARS;

    const byPage = new Map<number, EvidenceCandidate[]>();
    for (const c of candidates) {
      const list = byPage.get(c.pageNumber) ?? [];
      list.push(c);
      byPage.set(c.pageNumber, list);
    }

    const batches: EvidenceBatch[] = [];
    let batchSeq = 0;

    for (const page of [...byPage.keys()].sort((a, b) => a - b)) {
      const pageCands = byPage.get(page)!;
      let chunk: EvidenceCandidate[] = [];
      let chunkChars = 0;

      const flush = () => {
        if (chunk.length === 0) return;
        batchSeq += 1;
        const contextIds = chunk
          .filter((c) => c.candidateType === 'HEADING')
          .map((c) => c.candidateId);
        // Encabezado previo de la página como contexto si no está en el chunk
        const first = chunk[0];
        const priorHeading = pageCands
          .filter(
            (c) =>
              c.candidateType === 'HEADING' &&
              c.endOffset <= first.startOffset &&
              !chunk.some((x) => x.candidateId === c.candidateId),
          )
          .slice(-1);
        const contextCandidateIds = [
          ...new Set([
            ...priorHeading.map((c) => c.candidateId),
            ...contextIds,
          ]),
        ];

        batches.push({
          batchId: `b-${String(batchSeq).padStart(3, '0')}-p${page}`,
          candidateIds: chunk.map((c) => c.candidateId),
          pageRange: [page, page],
          characterCount: chunkChars,
          contextCandidateIds,
        });
        chunk = [];
        chunkChars = 0;
      };

      for (const c of pageCands) {
        const nextCount = chunk.length + 1;
        const nextChars = chunkChars + c.characterCount;
        if (
          chunk.length > 0 &&
          (nextCount > maxCand || nextChars > maxChars)
        ) {
          flush();
        }
        chunk.push(c);
        chunkChars += c.characterCount;
      }
      flush();
    }

    return batches;
  }
}
