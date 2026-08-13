/**
 * Extrae textos de EU que soportan dominios P2 propuestos.
 */
const fs = require('fs');
const path = require('path');

const cases = [
  {
    personId: '1275',
    label: 'ANGIE',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S89-20260812010250-61f1ed86/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S89-20260812010028-d26447f4/validated-evidence.json',
  },
  {
    personId: '1274',
    label: 'MAUREEN',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S88-20260812005958-6e0a12f1/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S88-20260812005734-fe7878a5/validated-evidence.json',
  },
  {
    personId: '1313',
    label: 'VIVIANA',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S97-20260812012543-12db5741/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S97-20260812012339-455b4916/validated-evidence.json',
  },
];

function loadEus(p1Path) {
  const raw = JSON.parse(fs.readFileSync(p1Path, 'utf8'));
  const list = Array.isArray(raw) ? raw : raw.evidenceUnits || raw.units || raw.validatedEvidence || [];
  const map = new Map();
  for (const u of list) {
    const id = u.evidenceUnitId || u.id;
    const text = u.normalizedText || u.text || u.surfaceText || u.snippet || u.rawText || '';
    if (id) map.set(id, { text: String(text).slice(0, 180), kind: u.signalKind || u.kind });
  }
  return { map, sampleKeys: [...map.keys()].slice(0, 3), count: map.size, rawType: Array.isArray(raw) ? 'array' : Object.keys(raw).slice(0, 8) };
}

const out = [];
for (const c of cases) {
  const p2 = JSON.parse(fs.readFileSync(c.p2, 'utf8'));
  const list = p2.domainCandidates || p2.candidates || [];
  const proposed = list.filter((x) => !x.domainCode);
  const eus = loadEus(c.p1);
  out.push({
    personId: c.personId,
    label: c.label,
    euMeta: { count: eus.count, rawType: eus.rawType, sampleKeys: eus.sampleKeys },
    proposed: proposed.map((p) => ({
      key: p.proposedDomainKey,
      confidence: p.confidence,
      coverage: p.coverageRatio,
      rationale: p.rationaleCode,
      mix: p.signalKindMix,
      flags: p.ambiguityFlags,
      evidence: (p.supportingEvidenceUnitIds || []).slice(0, 8).map((id) => eus.map.get(id) || { id, missing: true }),
    })),
  });
}
console.log(JSON.stringify(out, null, 2));
