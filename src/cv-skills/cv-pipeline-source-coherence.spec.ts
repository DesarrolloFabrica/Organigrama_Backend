import {
  assertActivePipelineIntegrity,
  canReuseSucceededExtraction,
  detectPdfSourceDrift,
  enrichmentHashMatchesExtraction,
  evidenceMatchesEnrichment,
  normalizeSha256,
} from './cv-pipeline-source-coherence';

describe('cv-pipeline-source-coherence (MC1.5.2C)', () => {
  const hashA = '6c292f8c79fc90846631403f36cbf06f452d64b1770b6fe0a99091620a6d053c';
  const hashB = '467d7dbea064e77535fe2c3742e58c6adfff499fc98745f3a68844d62f86f3a6';

  it('detecta PDF cambiado (drift de hash)', () => {
    const drift = detectPdfSourceDrift({
      activeExtractionHash: hashA,
      livePdfHash: hashB,
    });
    expect(drift.drifted).toBe(true);
    expect(drift.previousHash).toBe(hashA);
    expect(drift.liveHash).toBe(hashB);
  });

  it('no reporta drift si los hashes coinciden', () => {
    expect(
      detectPdfSourceDrift({
        activeExtractionHash: hashB,
        livePdfHash: hashB.toUpperCase(),
      }).drifted,
    ).toBe(false);
  });

  it('no reutiliza extracción con hash diferente', () => {
    expect(
      canReuseSucceededExtraction({
        existingPdfSha256: hashA,
        candidatePdfSha256: hashB,
      }),
    ).toBe(false);
  });

  it('sí reutiliza extracción con el mismo hash', () => {
    expect(
      canReuseSucceededExtraction({
        existingPdfSha256: hashB,
        candidatePdfSha256: hashB,
      }),
    ).toBe(true);
  });

  it('exige Enrichment asociado al hash de la nueva extracción', () => {
    expect(
      enrichmentHashMatchesExtraction({
        extractionPdfSha256: hashB,
        enrichmentPdfSha256: hashB,
      }),
    ).toBe(true);
    expect(
      enrichmentHashMatchesExtraction({
        extractionPdfSha256: hashB,
        enrichmentPdfSha256: hashA,
      }),
    ).toBe(false);
  });

  it('exige Evidence asociada al nuevo Enrichment', () => {
    expect(
      evidenceMatchesEnrichment({
        evidenceEnrichmentId: '5',
        enrichmentId: '5',
      }),
    ).toBe(true);
    expect(
      evidenceMatchesEnrichment({
        evidenceEnrichmentId: '4',
        enrichmentId: '5',
      }),
    ).toBe(false);
  });

  it('valida integridad del pipeline activo sin PA2', () => {
    const ok = assertActivePipelineIntegrity({
      extractionId: '207',
      enrichmentId: '5',
      evidenceId: '5',
      pdfSha256: hashB,
      extractionActive: true,
      enrichmentActive: true,
      evidenceActive: true,
      pa2Count: 0,
    });
    expect(ok).toEqual({ ok: true, violations: [] });

    const bad = assertActivePipelineIntegrity({
      extractionId: '207',
      enrichmentId: '5',
      evidenceId: '4',
      pdfSha256: hashB,
      extractionActive: true,
      enrichmentActive: true,
      evidenceActive: false,
      pa2Count: 1,
    });
    expect(bad.ok).toBe(false);
    expect(bad.violations).toEqual(
      expect.arrayContaining(['evidence_not_active', 'unexpected_pa2']),
    );
  });

  it('normaliza hash a minúsculas', () => {
    expect(normalizeSha256('AB' + 'c'.repeat(62))).toBe('ab' + 'c'.repeat(62));
  });
});
