/**
 * Resumen compacto cohorte Escuela de Especializaciones.
 *   node scripts/mc1-esp-summarize.js
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'tmp', 'mc1-esp-cohort');
const compact = JSON.parse(fs.readFileSync(path.join(dir, 'compact-summary.json'), 'utf8'));
const lookup = JSON.parse(fs.readFileSync(path.join(dir, 'lookup.json'), 'utf8'));

const rows = [];
const prim = {};
const sec = {};
const pendingPrimary = [];
const pendingSecondary = [];
const anomalies = [];

for (const r of compact.compactRows || []) {
  const pid = String(r.personId);
  const pf = path.join(dir, `person-${pid}.json`);
  let proposedPending = [];
  let secondaries = r.r1?.secondaries || [];
  if (fs.existsSync(pf)) {
    const p = JSON.parse(fs.readFileSync(pf, 'utf8'));
    proposedPending = p.taxonomy?.proposedPending || [];
    if (!r.r1 && p.r1) {
      r.r1 = { primary: p.r1.primary, secondaries: p.r1.secondaries };
      secondaries = p.r1.secondaries || [];
    }
  }
  if (r.r1?.primary) prim[r.r1.primary] = (prim[r.r1.primary] || 0) + 1;
  for (const s of secondaries) {
    const code = s.code || s.sourceKey || 'null';
    sec[code] = (sec[code] || 0) + 1;
  }
  for (const pp of proposedPending) {
    const rec = {
      persona: r.persona,
      personId: pid,
      proposedDomainKey: pp.proposedDomainKey,
      confidence: pp.confidence,
      role: pp.role,
    };
    if (pp.role === 'PRIMARY') pendingPrimary.push(rec);
    else pendingSecondary.push(rec);
  }
  rows.push({
    persona: r.persona,
    id: pid,
    cv: r.cv,
    eu: r.p1EU,
    primary: r.r1?.primary || null,
    secondaries: secondaries.map((s) => `${s.code || s.sourceKey || 'null'}:${s.confidence}`),
    p3Obs: r.p3Obs || [],
    p3Weak: r.p3Weak || [],
    skills: (r.p4Skills || []).length,
    gate: r.gate,
    estado: r.estado,
    proposedPending,
  });
  if (
    r.estado !== 'VALIDATED' &&
    r.estado !== 'NO_CV' &&
    r.estado !== 'SKIPPED_NO_CV'
  ) {
    anomalies.push({
      persona: r.persona,
      id: pid,
      estado: r.estado,
      primary: r.r1?.primary || null,
      proposedPending,
      p3Obs: r.p3Obs,
      p3Weak: r.p3Weak,
      gate: r.gate,
    });
  }
}

console.log(
  JSON.stringify(
    {
      decision: compact.decision,
      preflight: {
        coordinadora: 1,
        hijosActivos: lookup.childrenActiveTotal,
        docentesExcluidos: (lookup.excludedTeachingScope || []).length,
        noDocentes: lookup.nonTeachersEligible,
        vacantes: (lookup.vacanciesExcluded || []).length,
        cohorteEfectiva: lookup.found,
        withCv: lookup.withCv,
        withoutCv: (lookup.withoutCv || []).length,
      },
      prim,
      sec,
      pendingPrimary,
      pendingSecondary,
      rows,
      anomalies,
      excludedTeachingCount: (lookup.excludedTeachingScope || []).length,
    },
    null,
    2,
  ),
);
