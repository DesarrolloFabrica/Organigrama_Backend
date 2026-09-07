/**
 * Compila positiveSignals / exclusions / notes del catálogo a léxico matchable.
 * No usa outputs Gemini. No trata una herramienta aislada como identidad.
 */
import {
  PROFESSIONAL_FIELDS,
  type ProfessionalFieldEntry,
} from '../../catalog/professional-fields';
import {
  SPECIALTIES,
  type SpecialtyEntry,
} from '../../catalog/specialties-visual-education';
import {
  GENERIC_CATALOG_TOKENS,
  normalizeText,
  tokenize,
} from './text-normalize';

export type CompiledSpecialtyLexicon = {
  code: string;
  parentField: string;
  practicePhrases: string[];
  practiceNouns: string[];
  outcomeAtoms: string[];
  requiresOutcomeForOrigin: boolean;
  toolTokens: string[];
  exclusionLabels: string[];
  dataAssetRequiredForOutcome: boolean;
};

export type CompiledFieldLexicon = {
  code: string;
  definition: string;
  practicePhrases: string[];
  practiceNouns: string[];
  uniquePracticeNouns: string[];
  toolTokens: string[];
  specialties: CompiledSpecialtyLexicon[];
};

/** Herramientas/tecnologías que nunca originan Field/Specialty por sí solas. */
export const TOOL_TOKEN_DENYLIST = [
  'sql',
  'mysql',
  'postgresql',
  'python',
  'gcp',
  'aws',
  'azure',
  'power bi',
  'powerbi',
  'tableau',
  'looker',
  'lightgbm',
  'react',
  'angular',
  'vue',
  'nestjs',
  'nodejs',
  'docker',
  'kubernetes',
  'photoshop',
  'illustrator',
  'premiere',
  'after effects',
  'figma',
  'canva',
  'github',
  'gitlab',
  'java',
  'javascript',
  'typescript',
  'excel',
  'moodle',
  'capcut',
  'obs',
  'resolve',
  'audition',
  'vmware',
  'linux',
  'windows',
] as const;

const WEAK_MATCH_TOKENS = new Set([
  'alto',
  'impacto',
  'imagen',
  'digital',
  'marca',
  'tono',
  'metas',
  'comercial',
  'comerciales',
  'visibilidad',
  'fortalecer',
  'iniciativas',
  'alineando',
  'objetivo',
  'objetivos',
  'resultados',
  'usuarios',
  'usuario',
  'producto',
  'productos',
  'contenido',
  'gestion',
  'sistemas',
  'sistema',
  'experiencia',
  'aplicaciones',
  'coherentes',
]);

const DATA_ASSET_PHRASES = [
  'repositorio',
  'esquema',
  'datos',
  'dato',
  'informacion',
  'pipeline',
  'pipelines',
  'etl',
  'activo de datos',
  'calidad del dato',
  'calidad de datos',
];

const OUTCOME_ATOM_SEEDS = [
  'gobernanza',
  'gobernanza de datos',
  'gobierno de datos',
  'integridad',
  'trazabilidad',
  'calidad del dato',
  'calidad de datos',
  'disponibilidad de informacion',
];

function splitAlternates(raw: string): string[] {
  return raw
    .split(/\s*\/\s*|\s*,\s*|\s+o\s+|\s+u\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isToolish(phrase: string): boolean {
  const n = normalizeText(phrase);
  return TOOL_TOKEN_DENYLIST.some((t) => n === t || n.includes(t));
}

function extractPhrasesFromSignal(signal: string): string[] {
  const out: string[] = [];
  for (const alt of splitAlternates(signal)) {
    const n = normalizeText(alt);
    if (!n) continue;
    const tokens = tokenize(n).filter((t) => !GENERIC_CATALOG_TOKENS.has(t));
    for (let i = 0; i < tokens.length - 1; i += 1) {
      const a = tokens[i];
      const b = tokens[i + 1];
      if (WEAK_MATCH_TOKENS.has(a) || WEAK_MATCH_TOKENS.has(b)) continue;
      const phrase = `${a} ${b}`;
      if (!isToolish(phrase)) out.push(phrase);
    }
    for (const noun of tokens) {
      if (WEAK_MATCH_TOKENS.has(noun)) continue;
      if (noun.length >= 3 && !GENERIC_CATALOG_TOKENS.has(noun) && !isToolish(noun)) {
        out.push(noun);
      }
    }
  }
  return out;
}

function unique(list: string[]): string[] {
  return [...new Set(list.map(normalizeText).filter(Boolean))].sort();
}

function compileSpecialty(s: SpecialtyEntry): CompiledSpecialtyLexicon {
  const practicePhrases: string[] = [];
  const practiceNouns: string[] = [];
  for (const sig of s.positiveSignals) {
    for (const p of extractPhrasesFromSignal(sig)) {
      if (p.includes(' ')) practicePhrases.push(p);
      else practiceNouns.push(p);
    }
  }
  for (const p of extractPhrasesFromSignal(s.definition)) {
    if (p.includes(' ')) practicePhrases.push(p);
  }

  const blob = `${s.positiveSignals.join(' ')} ${s.exclusions.join(' ')} ${s.definition}`;
  const requiresOutcomeForOrigin =
    /ACTION|RESPONSIBILITY|outcome|result\/responsibility/i.test(blob) &&
    /nunca originarlo sola|por s[ií] solos/i.test(blob);

  const outcomeAtoms = requiresOutcomeForOrigin
    ? unique([
        ...OUTCOME_ATOM_SEEDS,
        ...s.positiveSignals
          .flatMap(splitAlternates)
          .map(normalizeText)
          .filter((p) =>
            /gobernanz|gobierno de datos|integridad|trazabilidad|calidad del dato|calidad de datos/.test(
              p,
            ),
          ),
      ])
    : [];

  const toolTokens = unique(
    [...TOOL_TOKEN_DENYLIST].filter((t) =>
      normalizeText(blob).includes(normalizeText(t)),
    ),
  );

  const exclusionLabels: string[] = [];
  const excl = s.exclusions.join(' | ');
  if (/SQL|ETL|pipelines|cloud|repositorios/i.test(excl) && /por s[ií] solos/i.test(excl)) {
    exclusionLabels.push('TECH_WITHOUT_GOVERNANCE_OUTCOME');
  }
  if (/declaraci[oó]n aislada de conocimiento|nunca originarlo sola/i.test(excl)) {
    exclusionLabels.push('KNOWLEDGE_CANNOT_ORIGINATE');
  }
  if (/solo listar|sin pr[aá]ctica/i.test(excl)) {
    exclusionLabels.push('TOOL_OR_LISTING_WITHOUT_PRACTICE');
  }
  if (/menci[oó]n aislada de 'calidad'/i.test(excl)) {
    exclusionLabels.push('ISOLATED_QUALITY_OF_DELIVERABLE');
  }

  return {
    code: s.code,
    parentField: s.parentField,
    practicePhrases: unique(practicePhrases),
    practiceNouns: unique(practiceNouns.filter((n) => n.length >= 3)),
    outcomeAtoms,
    requiresOutcomeForOrigin,
    toolTokens,
    exclusionLabels,
    dataAssetRequiredForOutcome: requiresOutcomeForOrigin,
  };
}

let cached: CompiledFieldLexicon[] | null = null;

export function compileFieldLexicon(): CompiledFieldLexicon[] {
  if (cached) return cached;
  const byField = new Map<string, SpecialtyEntry[]>();
  for (const s of SPECIALTIES) {
    const list = byField.get(s.parentField) ?? [];
    list.push(s);
    byField.set(s.parentField, list);
  }
  cached = PROFESSIONAL_FIELDS.map((f: ProfessionalFieldEntry) => {
    const specs = (byField.get(f.code) ?? []).map(compileSpecialty);
    const practicePhrases = unique([
      ...specs.flatMap((s) => s.practicePhrases),
      ...extractPhrasesFromSignal(f.definition).filter((p) => p.includes(' ')),
    ]);
    const practiceNouns = unique(specs.flatMap((s) => s.practiceNouns));
    const toolTokens = unique(specs.flatMap((s) => s.toolTokens));
    return {
      code: f.code,
      definition: f.definition,
      practicePhrases,
      practiceNouns,
      uniquePracticeNouns: [] as string[],
      toolTokens,
      specialties: specs,
    };
  });
  const nounOwners = new Map<string, Set<string>>();
  for (const f of cached) {
    for (const n of f.practiceNouns) {
      const set = nounOwners.get(n) ?? new Set<string>();
      set.add(f.code);
      nounOwners.set(n, set);
    }
  }
  for (const f of cached) {
    f.uniquePracticeNouns = f.practiceNouns.filter(
      (n) => (nounOwners.get(n)?.size ?? 0) === 1,
    );
  }
  return cached;
}

export function lexiconForField(fieldCode: string): CompiledFieldLexicon | null {
  return compileFieldLexicon().find((f) => f.code === fieldCode) ?? null;
}

export function lexiconForSpecialty(
  specialtyCode: string,
): CompiledSpecialtyLexicon | null {
  for (const f of compileFieldLexicon()) {
    const hit = f.specialties.find((s) => s.code === specialtyCode);
    if (hit) return hit;
  }
  return null;
}

export function isDataAssetText(norm: string): boolean {
  return DATA_ASSET_PHRASES.some((p) => ` ${norm} `.includes(` ${p} `));
}

export { DATA_ASSET_PHRASES };
