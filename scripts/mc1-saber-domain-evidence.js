/**
 * Extrae clusters P2 de un candidato de dominio desde packs P1/P2.
 *   node scripts/mc1-saber-domain-evidence.js <personId> <domainCode>
 */
const fs = require('fs');
const path = require('path');

const personId = process.argv[2];
const domain = process.argv[3] || 'ACADEMIC_RESEARCH';
const person = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', 'tmp', 'mc1-saber-cohort', `person-${personId}.json`),
    'utf8',
  ),
);
const dc = JSON.parse(
  fs.readFileSync(path.join(person.p2.packDir, 'domainCandidates.json'), 'utf8'),
);
const list = Array.isArray(dc) ? dc : dc.candidates || dc.domainCandidates || [];
const c = list.find((x) => x.domainCode === domain);
const ve = JSON.parse(
  fs.readFileSync(path.join(person.p1.packDir, 'validated-evidence.json'), 'utf8'),
);
const units = Array.isArray(ve) ? ve : ve.evidenceUnits || [];

function parseCeuId(id) {
  const m = String(id).match(/_(c-\d+)_(\d+)_(\d+)_([A-Z_]+)_/);
  return m
    ? { candidateId: m[1], start: Number(m[2]), end: Number(m[3]), kind: m[4] }
    : null;
}

const samples = [];
for (const eid of c?.supportingEvidenceUnitIds || []) {
  const meta = parseCeuId(eid);
  const u =
    units.find(
      (x) =>
        x.candidateId === meta?.candidateId &&
        x.startOffset === meta.start &&
        x.endOffset === meta.end,
    ) || units.find((x) => x.candidateId === meta?.candidateId);
  samples.push({
    kind: meta?.kind || u?.evidenceKind,
    explicitness: u?.explicitness,
    text: String(u?.sourceText || u?.normalizedActivity || '')
      .replace(/\s+/g, ' ')
      .slice(0, 220),
    activity: u?.normalizedActivity || null,
    object: u?.object || null,
  });
}

console.log(
  JSON.stringify(
    {
      personId,
      label: person.label,
      domain,
      confidence: c?.confidence,
      coverage: c?.coverageRatio,
      flags: c?.ambiguityFlags,
      mix: c?.signalKindMix,
      samples,
    },
    null,
    2,
  ),
);
