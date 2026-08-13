/**
 * Resumen compacto cohorte PD.
 *   node scripts/mc1-pd-summarize.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'tmp', 'mc1-pd-cohort');
const compact = JSON.parse(fs.readFileSync(path.join(dir, 'compact-summary.json'), 'utf8'));
const lookup = JSON.parse(fs.readFileSync(path.join(dir, 'lookup.json'), 'utf8'));

const rows = [];
const prim = {};
const sec = {};
const pending = {};
const anomalies = [];

for (const r of compact.compactRows) {
  const pid = String(r.personId);
  const pf = path.join(dir, `person-${pid}.json`);
  let pendingFields = [];
  let secondaries = r.r1?.secondaries || [];
  let p3obs = r.p3Obs || [];
  let skills = r.p4Skills || [];
  if (fs.existsSync(pf)) {
    const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
    pendingFields = p.taxonomy?.pendingFields || [];
    if (!r.r1 && p.r1) {
      r.r1 = { primary: p.r1.primary, secondaries: p.r1.secondaries };
      secondaries = p.r1.secondaries || [];
    }
  }
  for (const f of pendingFields) pending[f] = (pending[f] || 0) + 1;
  if (r.r1?.primary) prim[r.r1.primary] = (prim[r.r1.primary] || 0) + 1;
  for (const s of secondaries) sec[s.code] = (sec[s.code] || 0) + 1;

  rows.push({
    persona: r.persona,
    id: pid,
    cv: r.cv,
    eu: r.p1EU,
    primary: r.r1?.primary || null,
    secondaries: secondaries.map((s) => `${s.code}:${s.confidence}`),
    p3Obs: p3obs,
    skills: (skills || []).length,
    gate: r.gate,
    estado: r.estado,
    pendingFields,
  });

  if (
    r.estado === 'ERROR' ||
    r.estado === 'VALIDATED_WITH_DRIFT' ||
    pendingFields.length ||
    !r.r1?.primary && r.estado === 'VALIDATED'
  ) {
    anomalies.push({
      persona: r.persona,
      id: pid,
      estado: r.estado,
      primary: r.r1?.primary || null,
      secondaries,
      pendingFields,
      p3Obs: p3obs,
      p3Weak: r.p3Weak,
      skills,
      gate: r.gate,
    });
  }
}

console.log(JSON.stringify({
  decision: compact.decision,
  lookup: {
    leader: lookup.leader?.full_name || lookup.leader?.fullName,
    versionId: lookup.versionId,
    childrenActive: lookup.childrenCount,
    vacancies: (lookup.vacanciesExcluded || []).length,
    cohort: lookup.found,
    withCv: lookup.withCv,
    withoutCv: lookup.withoutCv?.length,
    duplicateNames: lookup.duplicateNames,
  },
  prim,
  sec,
  pending,
  rows,
  anomalies,
}, null, 2));
