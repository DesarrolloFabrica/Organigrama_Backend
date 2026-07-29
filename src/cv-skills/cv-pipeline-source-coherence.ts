/**
 * MC1.5.2C — Reglas puras de coherencia de fuente PDF en el pipeline CV.
 * Sin I/O: documentan la política de drift y activación.
 */

export type PipelineSourceHashes = {
  extractionPdfSha256: string;
  enrichmentPdfSha256: string;
  /** Evidence no guarda hash propio; se valida vía enrichment → extraction. */
  evidenceEnrichmentId: string;
  enrichmentId: string;
};

export type ActivePipelineRow = {
  extractionId: string;
  enrichmentId: string;
  evidenceId: string;
  pdfSha256: string;
  extractionActive: boolean;
  enrichmentActive: boolean;
  evidenceActive: boolean;
  pa2Count: number;
};

export function normalizeSha256(value: string): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/** Detecta que el PDF vivo no coincide con la extracción activa. */
export function detectPdfSourceDrift(params: {
  activeExtractionHash: string;
  livePdfHash: string;
}): { drifted: boolean; previousHash: string; liveHash: string } {
  const previousHash = normalizeSha256(params.activeExtractionHash);
  const liveHash = normalizeSha256(params.livePdfHash);
  return {
    drifted: previousHash.length === 64 && liveHash.length === 64 && previousHash !== liveHash,
    previousHash,
    liveHash,
  };
}

/**
 * Una extracción SUCCEEDED solo es reutilizable si el hash (y versiones) coinciden.
 * Hash distinto ⇒ nueva fila; no reutilizar la extracción anterior.
 */
export function canReuseSucceededExtraction(params: {
  existingPdfSha256: string;
  candidatePdfSha256: string;
}): boolean {
  return (
    normalizeSha256(params.existingPdfSha256) ===
    normalizeSha256(params.candidatePdfSha256)
  );
}

/** Enrichment activable solo si su hash coincide con la extracción vinculada. */
export function enrichmentHashMatchesExtraction(params: {
  extractionPdfSha256: string;
  enrichmentPdfSha256: string;
}): boolean {
  return (
    normalizeSha256(params.extractionPdfSha256) ===
    normalizeSha256(params.enrichmentPdfSha256)
  );
}

/** Evidence debe apuntar al enrichment activo de la cadena. */
export function evidenceMatchesEnrichment(params: {
  evidenceEnrichmentId: string;
  enrichmentId: string;
}): boolean {
  return String(params.evidenceEnrichmentId) === String(params.enrichmentId);
}

export function assertActivePipelineIntegrity(row: ActivePipelineRow): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  if (!row.extractionActive) violations.push('extraction_not_active');
  if (!row.enrichmentActive) violations.push('enrichment_not_active');
  if (!row.evidenceActive) violations.push('evidence_not_active');
  if (normalizeSha256(row.pdfSha256).length !== 64) {
    violations.push('invalid_pdf_sha256');
  }
  if (row.pa2Count !== 0) violations.push('unexpected_pa2');
  return { ok: violations.length === 0, violations };
}
