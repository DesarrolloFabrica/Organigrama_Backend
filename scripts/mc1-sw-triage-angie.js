/**
 * Extrae EU que soportan dc-1 social_work de Angie 1275.
 */
const fs = require('fs');
const path = require('path');

const p2 = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'tmp/mc1-p2-functional/P2F-8A2-S89-20260812010250-61f1ed86/domainCandidates.json',
    ),
    'utf8',
  ),
);
const p1 = JSON.parse(
  fs.readFileSync(
    path.join(
      __dirname,
      '..',
      'tmp/mc1-p1-prototype/P1P-SOC-S89-20260812010028-d26447f4/validated-evidence.json',
    ),
    'utf8',
  ),
);

const dc1 = p2.domainCandidates.find((c) => c.candidateId === 'dc-1');
const ids = new Set(dc1.supportingEvidenceUnitIds);

function euKey(u) {
  const proto = (u.provenance && u.provenance.prototypeId) || '';
  const short = proto.replace(/^P1P-SOC-S\d+-/, '').replace(/^P1P-/, '');
  const start = String(u.startOffset).padStart(3, '0'); // not used
  return `${u.candidateId}_${u.startOffset}_${u.endOffset}_${u.evidenceKind}`;
}

const units = [];
for (const u of p1.units || []) {
  const idGuess = `ceu_${(u.provenance.prototypeId || '')
    .replace('P1P-SOC-S', '')
    .replace(/^\d+-/, '')}_${u.candidateId}_${u.startOffset}_${u.endOffset}_${u.evidenceKind}_o0`;
  // Match by candidateId + offsets + kind against supporting ids
  const match = [...ids].find((sid) => {
    return (
      sid.includes(u.candidateId) &&
      sid.includes(`_${u.startOffset}_`) &&
      sid.includes(`_${u.endOffset}_`) &&
      sid.includes(`_${u.evidenceKind}_`)
    );
  });
  units.push({
    match: match || null,
    candidateId: u.candidateId,
    evidenceKind: u.evidenceKind,
    explicitness: u.explicitness,
    decision: u.decision,
    sourceText: u.sourceText,
    normalizedActivity: u.normalizedActivity,
    object: u.object,
    toolOrMethod: u.toolOrMethod,
    result: u.result,
    scope: u.scope,
  });
}

const supporting = units.filter((u) => u.match);
const unmappedIds = [...ids].filter((id) => !supporting.some((u) => u.match === id));

console.log(
  JSON.stringify(
    {
      dc1: {
        key: dc1.proposedDomainKey,
        confidence: dc1.confidence,
        coverage: dc1.coverageRatio,
        rationale: dc1.rationaleCode,
        flags: dc1.ambiguityFlags,
        mix: dc1.signalKindMix,
        producedBy: dc1.producedBy,
        supportCount: dc1.supportingEvidenceUnitIds.length,
      },
      supporting,
      unmappedIds,
      allUnitsCount: units.length,
    },
    null,
    2,
  ),
);
