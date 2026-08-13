/**
 * Resuelve supportingEvidenceUnitIds de PEOPLE_HR → textos P1.
 * node scripts/mc1-people-hr-resolve-evidence.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tmp', 'mc1-people-hr-foundation');
const PEOPLE = ['1265', '1266', '1271', '1272'];

function parseCeuId(id) {
  // ceu_<exec>_c-NNNN_start_end_KIND_oN
  const m = String(id).match(/_(c-\d+)_(\d+)_(\d+)_([A-Z_]+)_/);
  if (!m) return null;
  return { candidateId: m[1], start: Number(m[2]), end: Number(m[3]), kind: m[4] };
}

function loadUnits(p1Dir) {
  const ve = JSON.parse(
    fs.readFileSync(path.join(p1Dir, 'validated-evidence.json'), 'utf8'),
  );
  return Array.isArray(ve) ? ve : ve.evidenceUnits || ve.units || [];
}

function findUnit(units, meta, eid) {
  if (!meta) return null;
  return (
    units.find(
      (x) =>
        x.candidateId === meta.candidateId &&
        x.startOffset === meta.start &&
        x.endOffset === meta.end,
    ) ||
    units.find(
      (x) => x.startOffset === meta.start && x.endOffset === meta.end,
    ) ||
    units.find((x) => x.candidateId === meta.candidateId) ||
    units.find((x) => (x.evidencePrototypeId || '') === eid) ||
    null
  );
}

function clusterOf(text) {
  const t = (text || '').toLowerCase();
  if (/selecci[oó]n|reclut|contrataci[oó]n|entrevista|vinculaci[oó]n laboral|hoja de vida|talent acquisition/.test(t))
    return 'TALENT_ACQUISITION';
  if (/inducci[oó]n|onboarding|afiliaci[oó]n|seguridad social|\beps\b|\barl\b|caja de compens/.test(t))
    return 'HR_ONBOARDING_AFFILIATION';
  if (/n[oó]mina|payroll|liquidaci[oó]n|prestaciones sociales|compensaci[oó]n salarial|beneficios laborales/.test(t))
    return 'PAYROLL_COMPENSATION';
  if (/desempe[nñ]o|evaluaci[oó]n de desempe|plan de carrera|sucesi[oó]n|desarrollo (del |de )?(personal|talento|humano)/.test(t))
    return 'PERFORMANCE_DEVELOPMENT';
  if (/bienestar|clima laboral|clima organizacional|cultura organizacional|retenci[oó]n de (talent|personal|colabor)/.test(t))
    return 'WELLBEING_CULTURE';
  if (/capacitaci[oó]n (al |de |del )?personal|formaci[oó]n (de |del )?personal|entrenamiento (de |al )?personal/.test(t))
    return 'LEARNING_HR';
  if (/\bsst\b|sg-sst|hseq|seguridad y salud|riesgo laboral|salud ocupacional/.test(t))
    return 'OHS_SST';
  if (/recurso humano|rr\.?\s*hh|gesti[oó]n (de )?(personas|talento|humano)|talento humano/.test(t))
    return 'HR_GENERAL';
  if (/supervis|coordin|lider|equipo|colaborador|personal a cargo|gesti[oó]n de equipos/.test(t))
    return 'TEAM_SUPERVISION_BORDER';
  if (/docen|educaci|formaci[oó]n acad|universidad|estudiant/.test(t))
    return 'EDUCATION_BORDER';
  if (/archiv|tr[aá]mite|document|administrativ|factur|contabil|caja|presupuesto/.test(t))
    return 'FINANCE_ADMIN_BORDER';
  if (/atenci[oó]n|cliente|usuario|servicio|pqrs/.test(t))
    return 'CUSTOMER_SUCCESS_BORDER';
  return 'UNCLASSIFIED';
}

fs.mkdirSync(OUT, { recursive: true });
const report = { people: [], clusters: {} };

for (const id of PEOPLE) {
  const person = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'tmp', 'mc1-social-outreach-cohort', `person-${id}.json`),
      'utf8',
    ),
  );
  const dc = JSON.parse(
    fs.readFileSync(path.join(person.p2.packDir, 'domainCandidates.json'), 'utf8'),
  );
  const list = Array.isArray(dc) ? dc : dc.candidates || dc.domainCandidates || [];
  const hr = list.find((c) => c.domainCode === 'PEOPLE_HR');
  const units = loadUnits(person.p1.packDir);

  // also dump candidateId inventory for debug
  const candIds = [...new Set(units.map((u) => u.candidateId))];

  const resolved = [];
  for (const eid of hr?.supportingEvidenceUnitIds || []) {
    const meta = parseCeuId(eid);
    const u = findUnit(units, meta, eid);
    const text = [u?.sourceText, u?.normalizedActivity, u?.object, u?.result]
      .filter(Boolean)
      .join(' | ')
      .replace(/\s+/g, ' ')
      .trim();
    const cluster = clusterOf(text);
    const item = {
      evidenceId: eid,
      matched: Boolean(u),
      meta,
      explicitness: u?.explicitness || null,
      evidenceKind: u?.evidenceKind || meta?.kind || null,
      sourceText: (u?.sourceText || '').replace(/\s+/g, ' ').slice(0, 280),
      normalizedActivity: u?.normalizedActivity || null,
      object: u?.object || null,
      toolOrMethod: u?.toolOrMethod || null,
      result: u?.result || null,
      cluster,
    };
    resolved.push(item);
    if (!report.clusters[cluster]) {
      report.clusters[cluster] = { count: 0, persons: new Set(), samples: [] };
    }
    report.clusters[cluster].count += 1;
    report.clusters[cluster].persons.add(id);
    if (report.clusters[cluster].samples.length < 8) {
      report.clusters[cluster].samples.push({
        personId: id,
        sample: item.sourceText || item.normalizedActivity,
        activity: item.normalizedActivity,
        object: item.object,
      });
    }
  }

  // unmatched debug: show nearby offsets from units
  const unmatched = resolved.filter((r) => !r.matched);
  let offsetHints = [];
  if (unmatched.length) {
    offsetHints = unmatched.map((r) => {
      const near = units
        .filter(
          (u) =>
            Math.abs((u.startOffset || 0) - (r.meta?.start || -9999)) < 30,
        )
        .map((u) => ({
          candidateId: u.candidateId,
          start: u.startOffset,
          end: u.endOffset,
          text: (u.sourceText || '').slice(0, 120),
        }));
      return { eid: r.evidenceId, near };
    });
  }

  report.people.push({
    personId: id,
    label: person.label,
    primary: person.r1?.primary,
    hrConfidence: hr?.confidence,
    coverageRatio: hr?.coverageRatio,
    ambiguityFlags: hr?.ambiguityFlags || [],
    signalKindMix: hr?.signalKindMix || {},
    candidateIdsInP1: candIds.slice(0, 5),
    candidateIdCount: candIds.length,
    unitCount: units.length,
    resolved,
    unmatchedCount: unmatched.length,
    offsetHints,
  });
}

report.clusters = Object.fromEntries(
  Object.entries(report.clusters).map(([k, v]) => [
    k,
    { count: v.count, persons: [...v.persons], personCount: v.persons.size, samples: v.samples },
  ]),
);

fs.writeFileSync(path.join(OUT, 'resolved-evidence.json'), JSON.stringify(report, null, 2));

const summary = {
  people: report.people.map((p) => ({
    id: p.personId,
    label: p.label,
    hrConf: p.hrConfidence,
    coverage: p.coverageRatio,
    flags: p.ambiguityFlags,
    matched: p.resolved.filter((r) => r.matched).length,
    unmatched: p.unmatchedCount,
    clusters: [...new Set(p.resolved.map((r) => r.cluster))],
    samples: p.resolved.map((r) => ({
      matched: r.matched,
      cluster: r.cluster,
      text: r.sourceText || r.normalizedActivity,
      activity: r.normalizedActivity,
      object: r.object,
    })),
  })),
  clusters: report.clusters,
};
console.log(JSON.stringify(summary, null, 2));
