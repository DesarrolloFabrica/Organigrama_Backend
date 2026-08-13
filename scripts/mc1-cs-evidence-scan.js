/**
 * Extrae señales CS de evidence units B2B (Paula/Jeimy/Yenny/Jonh).
 *   node scripts/mc1-cs-evidence-scan.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const report = JSON.parse(
  fs.readFileSync(
    path.join(ROOT, 'tmp', 'mc1-b2b-cohort', 'cohort-report.json'),
    'utf8',
  ),
);

const CS_RE =
  /cliente|usuario|vincul|admisi|matricul|inscrip|crm|retenci|fideliz|seguimiento|acompañ|servicio|atenci[oó]n|pqrs|soporte|comercial|b2b|prospect|lead|lifecycle|onboarding|satisfacc|nps|experiencia del (cliente|usuario)/i;

const people = ['1195', '1196', '1198', '1191'];
const out = [];

for (const id of people) {
  const p = report.results.find((x) => x.personId === id);
  const pack = p?.p1?.packDir;
  if (!pack) continue;
  const vePath = path.join(pack, 'validated-evidence.json');
  const candPath = path.join(pack, 'candidates.json');
  let units = [];
  if (fs.existsSync(vePath)) {
    const ve = JSON.parse(fs.readFileSync(vePath, 'utf8'));
    units = ve.evidenceUnits || ve.units || ve;
  } else if (fs.existsSync(candPath)) {
    const c = JSON.parse(fs.readFileSync(candPath, 'utf8'));
    units = c.candidates || [];
  }
  if (!Array.isArray(units)) units = [];
  const hits = [];
  for (const u of units) {
    const text = String(
      u.sourceText ||
        u.text ||
        u.spanText ||
        u.sourceSpan?.text ||
        u.normalizedText ||
        '',
    );
    if (CS_RE.test(text)) {
      hits.push({
        id: u.evidenceUnitId || u.candidateId || u.id,
        explicitness: u.explicitness,
        type: u.evidenceType || u.candidateType,
        text: text.replace(/\s+/g, ' ').trim().slice(0, 220),
      });
    }
  }
  out.push({
    personId: id,
    label: p.label,
    primary: p.r1?.primary,
    euTotal: units.length,
    csHits: hits.length,
    samples: hits.slice(0, 12),
  });
}

const dest = path.join(ROOT, 'tmp', 'mc1-b2b-cohort', 'cs-evidence-scan.json');
fs.writeFileSync(dest, JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, null, 2));
