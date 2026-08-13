/**
 * Escaneo evidencia PEOPLE_HR desde packs P1/P2/R1 de José/Katiuska/Paula/Nataly.
 *   node scripts/mc1-people-hr-evidence-scan.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tmp', 'mc1-people-hr-foundation');
const PEOPLE = [
  { id: '1265', label: 'Jose Cruz' },
  { id: '1266', label: 'Katiuska Fuentes' },
  { id: '1271', label: 'Paula Terreros' },
  { id: '1272', label: 'Nataly Torres' },
];

const HR_RE =
  /recurso\s*humano|rr\.?\s*hh|talent|selecci[oó]n\s+(?:de\s+)?personal|reclutamiento|contrataci[oó]n|onboarding|inducci[oó]n|n[oó]mina|payroll|seguridad\s+social|bienestar|clima\s+laboral|desempe[nñ]o|capacitaci[oó]n\s+(?:al\s+)?personal|formaci[oó]n\s+(?:de\s+)?personal|desarrollo\s+(?:de\s+)?(?:personal|talento|humano)|gesti[oó]n\s+(?:de\s+)?(?:personas|talento|humano)|afiliaci[oó]n|hoja\s+de\s+vida|entrevista|psicometr|sst|sg-sst|hseq|compensaci[oó]n|beneficios|ausentismo|retenci[oó]n\s+(?:de\s+)?(?:talent|personal|colabor)|vinculaci[oó]n\s+(?:laboral|de\s+personal)|desvinculaci[oó]n|liquidaci[oó]n\s+(?:de\s+)?(?:n[oó]mina|prestaciones)|arl|eps|caja\s+de\s+compensaci[oó]n|prestaciones?\s+sociales|cultura\s+organizacional|clima\s+organizacional|competencias?\s+(?:laborales|del\s+talento)|evaluaci[oó]n\s+(?:de\s+)?desempe[nñ]o|plan\s+de\s+carrera|sucesi[oó]n/i;

const FA_BORDER =
  /archiv|documentaci[oó]n\s+administrativa|inventario|facturaci[oó]n|contabil|caja|presupuesto|compras|proveedor|tr[aá]mite\s+administrativo/i;

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function findEvidenceUnits(p1Dir) {
  const candidates = [
    path.join(p1Dir, 'evidence-units.json'),
    path.join(p1Dir, 'units.json'),
    path.join(p1Dir, 'p1-evidence-units.json'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return loadJson(c);
  }
  // search
  const files = fs.readdirSync(p1Dir);
  for (const f of files) {
    if (/evidence|unit/i.test(f) && f.endsWith('.json')) {
      return loadJson(path.join(p1Dir, f));
    }
  }
  return null;
}

function unitText(u) {
  return [
    u.statement || '',
    u.text || '',
    u.normalizedText || '',
    u.claim || '',
    ...(u.supportingSignals || []),
    ...(u.signals || []),
    u.practiceLabel || '',
    u.summary || '',
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clusterHint(text) {
  const t = text.toLowerCase();
  if (/selecci[oó]n|reclutamiento|contrataci[oó]n|entrevista|vinculaci[oó]n laboral|hoja de vida/.test(t))
    return 'TALENT_ACQUISITION';
  if (/onboarding|inducci[oó]n|afiliaci[oó]n|seguridad social|eps|arl|caja de compens/.test(t))
    return 'HR_ONBOARDING_AFFILIATION';
  if (/n[oó]mina|payroll|liquidaci[oó]n|prestaciones|compensaci[oó]n|beneficios/.test(t))
    return 'PAYROLL_COMPENSATION';
  if (/desempe[nñ]o|evaluaci[oó]n de desempe|plan de carrera|sucesi[oó]n|desarrollo de (personal|talento)/.test(t))
    return 'PERFORMANCE_DEVELOPMENT';
  if (/bienestar|clima laboral|clima organizacional|cultura organizacional|retenci[oó]n de (talent|personal|colabor)/.test(t))
    return 'WELLBEING_CULTURE';
  if (/capacitaci[oó]n|formaci[oó]n de personal|entrenamiento/.test(t))
    return 'LEARNING_HR';
  if (/sst|sg-sst|hseq|seguridad y salud|riesgo laboral/.test(t))
    return 'OHS_SST';
  if (/gesti[oó]n (de )?(personas|talento|humano)|recurso humano|rr\.?\s*hh/.test(t))
    return 'HR_GENERAL';
  return 'OTHER_HR_SIGNAL';
}

const report = { people: [], clusters: {}, borderlineFa: [], incidental: [] };

for (const person of PEOPLE) {
  const personPath = path.join(
    ROOT,
    'tmp',
    'mc1-social-outreach-cohort',
    `person-${person.id}.json`,
  );
  const personJson = loadJson(personPath);
  const p1Dir = personJson.p1?.packDir;
  const p2 = personJson.p2;
  const r1 = personJson.r1;

  let units = [];
  if (p1Dir && fs.existsSync(p1Dir)) {
    const raw = findEvidenceUnits(p1Dir);
    const list = Array.isArray(raw)
      ? raw
      : raw?.evidenceUnits || raw?.units || raw?.payload?.evidenceUnits || [];
    units = list;
  }

  const hrHits = [];
  for (const u of units) {
    const text = unitText(u);
    if (!text) continue;
    if (!HR_RE.test(text)) continue;
    const cluster = clusterHint(text);
    const borderFa = FA_BORDER.test(text) && !/n[oó]mina|seguridad social|afiliaci[oó]n|prestaciones/.test(text.toLowerCase());
    const item = {
      evidenceUnitId: u.evidenceUnitId || u.id || null,
      explicitness: u.explicitness || null,
      cluster,
      borderFa,
      sample: text.slice(0, 220),
    };
    hrHits.push(item);
    if (borderFa) {
      report.borderlineFa.push({ personId: person.id, ...item });
    }
    report.clusters[cluster] = report.clusters[cluster] || {
      count: 0,
      persons: new Set(),
      samples: [],
    };
    report.clusters[cluster].count += 1;
    report.clusters[cluster].persons.add(person.id);
    if (report.clusters[cluster].samples.length < 6) {
      report.clusters[cluster].samples.push({
        personId: person.id,
        sample: item.sample,
        explicitness: item.explicitness,
      });
    }
  }

  // Also scan domain practice notes / p2 candidates reasoning if present
  const p2Hr = (p2?.candidates || []).find((c) => c.domainCode === 'PEOPLE_HR');
  const notes =
    (personJson.taxonomy?.domainPracticeNotes || []).find(
      (n) => n.fieldCode === 'PEOPLE_HR',
    )?.practicesFromCv || [];

  report.people.push({
    personId: person.id,
    label: person.label,
    primary: r1?.primary,
    peopleHrSecondary: (r1?.secondaries || []).find((s) => s.code === 'PEOPLE_HR') || null,
    p2PeopleHr: p2Hr || null,
    p1Dir,
    r1Pack: r1?.packDir,
    p3Pack: personJson.p3?.packDir,
    totalUnits: units.length,
    hrHitCount: hrHits.length,
    hrHits,
    practiceNotes: notes,
  });
}

// serialize Sets
report.clusters = Object.fromEntries(
  Object.entries(report.clusters).map(([k, v]) => [
    k,
    {
      count: v.count,
      persons: [...v.persons],
      personCount: v.persons.size,
      samples: v.samples,
    },
  ]),
);

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'evidence-scan.json'), JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      people: report.people.map((p) => ({
        id: p.personId,
        label: p.label,
        primary: p.primary,
        hrConf: p.peopleHrSecondary?.confidence,
        units: p.totalUnits,
        hrHits: p.hrHitCount,
        clusters: [...new Set(p.hrHits.map((h) => h.cluster))],
        notes: p.practiceNotes,
      })),
      clusters: report.clusters,
    },
    null,
    2,
  ),
);
