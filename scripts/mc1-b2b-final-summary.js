const fs = require('fs');
const path = require('path');
const r = require('../tmp/mc1-b2b-cohort/cohort-report.json');
const out = {
  decision: r.decision,
  fingerprint: r.configFingerprint,
  summary: {
    found: 5,
    withCv: 5,
    done: r.processed,
    taxonomyPending: r.taxonomyPending,
    drift: r.driftNonBlocking,
    errors: r.errors,
    domains: r.domainsFound,
    newDomain: r.taxonomyPendingDomains,
  },
  people: r.results.map((p) => ({
    personId: p.personId,
    personCvId: p.personCvId,
    label: p.label,
    status: p.status,
    personDecision: p.personDecision,
    error: p.error || null,
    snapshot: p.snapshotId || null,
    p1EU: p.p1?.evidenceUnits ?? null,
    p2: p.p2?.candidates ?? null,
    r1: p.r1
      ? {
          status: p.r1.status,
          primary: p.r1.primary,
          secondaries: p.r1.secondaries,
        }
      : null,
    p3: p.p3?.byField ?? null,
    p4:
      p.p4?.specialtyResults?.map((s) => ({
        sp: s.specialtyCode,
        skills: s.skillsObserved,
        tools: s.tools,
      })) ?? null,
    gate: p.publicationGate || null,
    radar: p.radar || null,
    mc1: p.mc1ProfileFinalStatus || null,
    anomalies: p.anomalies || null,
    taxonomy: p.taxonomy || null,
  })),
};
const dest = path.join(__dirname, '..', 'tmp', 'mc1-b2b-cohort', 'final-summary.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, null, 2));
