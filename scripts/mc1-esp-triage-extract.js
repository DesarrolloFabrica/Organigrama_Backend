/**
 * Extrae sourceText de EU que soportan un candidato P2.
 */
const fs = require('fs');
const path = require('path');

const cases = [
  {
    label: 'BAIRON',
    personId: '1128',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S116-20260812024648-f5250cf5/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S116-20260812024341-131c9dd5/validated-evidence.json',
    target: { domainCode: 'IT_SYSTEMS' },
  },
  {
    label: 'DIEGO1228',
    personId: '1228',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S84-20260812002842-3b069135/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S84-20260812002616-bed20e4e/validated-evidence.json',
    target: { domainCode: 'IT_SYSTEMS' },
  },
  {
    label: 'SAMARY',
    personId: '1203',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S80-20260812001939-d9f8271a/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S80-20260812001740-e12c135f/validated-evidence.json',
    target: { domainCode: 'IT_SYSTEMS' },
  },
  {
    label: 'KAROLINA',
    personId: '1315',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S99-20260812013009-3eb6bc67/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S99-20260812012757-128b643d/validated-evidence.json',
    target: { domainCode: 'IT_SYSTEMS' },
  },
  {
    label: 'DANIEL1108',
    personId: '1108',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S114-20260812024015-8995de27/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S114-20260812023832-90e0bdcd/validated-evidence.json',
    target: { domainCode: 'IT_SYSTEMS' },
  },
  {
    label: 'EDWAR_LEGAL',
    personId: '1126',
    p2: 'tmp/mc1-p2-functional/P2F-8A2-S115-20260812024313-0b78384e/domainCandidates.json',
    p1: 'tmp/mc1-p1-prototype/P1P-SOC-S115-20260812024052-b1a1f0c1/validated-evidence.json',
    target: { proposed: 'field.legal_administrative' },
  },
];

function loadUnits(p1Path) {
  const raw = JSON.parse(fs.readFileSync(p1Path, 'utf8'));
  return raw.units || [];
}

function matchEu(u, sid) {
  return (
    sid.includes(u.candidateId) &&
    sid.includes(`_${u.startOffset}_`) &&
    sid.includes(`_${u.endOffset}_`) &&
    sid.includes(`_${u.evidenceKind}_`)
  );
}

const out = [];
for (const c of cases) {
  const p2 = JSON.parse(fs.readFileSync(c.p2, 'utf8'));
  const list = p2.domainCandidates || [];
  const cand = list.find((x) =>
    c.target.proposed
      ? x.proposedDomainKey === c.target.proposed
      : x.domainCode === c.target.domainCode,
  );
  if (!cand) {
    out.push({ label: c.label, error: 'CANDIDATE_NOT_FOUND' });
    continue;
  }
  const units = loadUnits(c.p1);
  const ids = cand.supportingEvidenceUnitIds || [];
  const evidence = ids
    .map((id) => {
      const u = units.find((x) => matchEu(x, id));
      return u
        ? {
            kind: u.evidenceKind,
            expl: u.explicitness,
            text: u.sourceText,
            activity: u.normalizedActivity,
            object: u.object,
            tool: u.toolOrMethod,
          }
        : { id, missing: true };
    })
    .filter((e) => !e.missing);
  out.push({
    label: c.label,
    personId: c.personId,
    domainCode: cand.domainCode,
    proposed: cand.proposedDomainKey,
    confidence: cand.confidence,
    coverage: cand.coverageRatio,
    rationale: cand.rationaleCode,
    flags: cand.ambiguityFlags,
    mix: cand.signalKindMix,
    supportCount: ids.length,
    evidence,
  });
}
console.log(JSON.stringify(out, null, 2));
