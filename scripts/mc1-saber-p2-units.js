/**
 * Dump P2 candidate + matched P1 units for overclassification review.
 *   node scripts/mc1-saber-p2-units.js <personId>
 */
const fs = require('fs');
const path = require('path');

const personId = process.argv[2];
const p = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'tmp', 'mc1-saber-cohort', `person-${personId}.json`),
    'utf8',
  ),
);
const dc = JSON.parse(
  fs.readFileSync(path.join(p.p2.packDir, 'domainCandidates.json'), 'utf8'),
);
const list = Array.isArray(dc) ? dc : dc.candidates || dc.domainCandidates || [];
const ve = JSON.parse(
  fs.readFileSync(path.join(p.p1.packDir, 'validated-evidence.json'), 'utf8'),
);
const units = Array.isArray(ve) ? ve : ve.evidenceUnits || [];

function parseCeuId(id) {
  const m = String(id).match(/_(c-\d+)_(\d+)_(\d+)_([A-Z_]+)_/);
  return m
    ? { candidateId: m[1], start: Number(m[2]), end: Number(m[3]), kind: m[4] }
    : null;
}

function findUnit(eid) {
  const meta = parseCeuId(eid);
  if (!meta) return null;
  return (
    units.find(
      (x) =>
        String(x.candidateId) === meta.candidateId &&
        Number(x.startOffset) === meta.start &&
        Number(x.endOffset) === meta.end,
    ) ||
    units.find(
      (x) =>
        Number(x.startOffset) === meta.start && Number(x.endOffset) === meta.end,
    ) ||
    units.find((x) => String(x.candidateId) === meta.candidateId) ||
    null
  );
}

const out = {
  personId,
  label: p.label,
  p1UnitCount: units.length,
  sampleUnitKeys: units[0] ? Object.keys(units[0]) : [],
  sampleCandidateIds: [...new Set(units.map((u) => u.candidateId))].slice(0, 8),
  candidates: list.map((c) => {
    const samples = (c.supportingEvidenceUnitIds || []).slice(0, 8).map((eid) => {
      const u = findUnit(eid);
      const meta = parseCeuId(eid);
      return {
        eid: String(eid).slice(-70),
        meta,
        matched: !!u,
        text: String(u?.sourceText || u?.normalizedActivity || '')
          .replace(/\s+/g, ' ')
          .slice(0, 180),
        activity: u?.normalizedActivity || null,
        object: u?.object || null,
        kind: u?.evidenceKind || meta?.kind || null,
      };
    });
    return {
      domainCode: c.domainCode,
      confidence: c.confidence,
      coverage: c.coverageRatio,
      flags: c.ambiguityFlags,
      mix: c.signalKindMix,
      samples,
    };
  }),
};
console.log(JSON.stringify(out, null, 2));
