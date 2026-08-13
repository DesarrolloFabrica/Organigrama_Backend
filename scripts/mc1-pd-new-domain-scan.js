/**
 * Escanea P2 proposed/unmapped (domainCode null) en la cohorte PD.
 *   node scripts/mc1-pd-new-domain-scan.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'tmp', 'mc1-pd-cohort');
const files = fs.readdirSync(dir).filter((f) => /^person-\d+\.json$/.test(f));
const hits = [];

for (const f of files) {
  const p = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const nullCands = (p.p2?.candidates || []).filter((c) => !c.domainCode);
  if (!nullCands.length) continue;
  let proposed = [];
  try {
    const dc = JSON.parse(
      fs.readFileSync(path.join(p.p2.packDir, 'domainCandidates.json'), 'utf8'),
    );
    const list = Array.isArray(dc) ? dc : dc.candidates || dc.domainCandidates || [];
    proposed = list
      .filter((c) => !c.domainCode)
      .map((c) => ({
        proposedDomainKey: c.proposedDomainKey || c.proposedKey || c.label || null,
        confidence: c.confidence,
        coverage: c.coverageRatio,
        flags: c.ambiguityFlags,
        mix: c.signalKindMix,
        rationaleCode: c.rationaleCode,
        catalogStatus: c.catalogStatus,
        candidateStatus: c.candidateStatus,
        supportingCount: (c.supportingEvidenceUnitIds || []).length,
      }));
  } catch (e) {
    proposed = [{ error: String(e.message).slice(0, 120) }];
  }
  hits.push({
    personId: p.personId,
    label: p.label,
    r1Primary: p.r1?.primary ?? null,
    r1Status: p.r1?.status,
    decision: p.personDecision,
    p2Null: nullCands,
    proposed,
  });
}

console.log(JSON.stringify({ count: hits.length, hits }, null, 2));
