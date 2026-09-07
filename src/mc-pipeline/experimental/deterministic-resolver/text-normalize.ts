const STOPWORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'de',
  'del',
  'y',
  'o',
  'u',
  'un',
  'una',
  'unos',
  'unas',
  'para',
  'como',
  'con',
  'en',
  'a',
  'al',
  'que',
  'se',
  'su',
  'sus',
  'por',
  'no',
  'ni',
  'lo',
  'le',
  'les',
  'es',
  'son',
  'mas',
  'más',
  'the',
  'and',
  'or',
  'of',
  'to',
  'in',
  'as',
]);

/** Palabras de catálogo que no son práctica profesional. */
export const GENERIC_CATALOG_TOKENS = new Set([
  ...STOPWORDS,
  'practica',
  'practicas',
  'profesional',
  'profesionales',
  'dominante',
  'recurrente',
  'recurrentes',
  'responsabilidad',
  'central',
  'identidad',
  'evidenciada',
  'orientada',
  'orientado',
  'servicio',
  'parte',
  'solo',
  'sin',
  'ver',
  'etc',
  'como',
  'mas',
  'alla',
  'debe',
  'puede',
  'cuando',
  'incluso',
  'tambien',
  'valida',
  'valido',
]);

export function stripAccents(input: string): string {
  return input.normalize('NFD').replace(/\p{M}/gu, '');
}

export function normalizeText(input: string | null | undefined): string {
  if (!input) return '';
  return stripAccents(input)
    .toLowerCase()
    .replace(/[^a-z0-9/+ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(input: string | null | undefined): string[] {
  const n = normalizeText(input);
  if (!n) return [];
  return n.split(' ').filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Stemming mínimo español — documentado, no un modelo. */
export function stemToken(token: string): string {
  let t = normalizeText(token);
  if (t.length <= 3) return t;
  if (t.endsWith('s') && !t.endsWith('ss') && t.length > 4) t = t.slice(0, -1);
  t = t.replace(/mente$/, '');
  t = t.replace(/aciones$|acion$/, '');
  t = t.replace(/ando$|iendo$/, '');
  t = t.replace(/adas$|ados$|ada$|ado$/, '');
  t = t.replace(/ar$|er$|ir$/, '');
  return t.slice(0, 12);
}

export function stemSet(tokens: string[]): Set<string> {
  return new Set(tokens.map(stemToken).filter((t) => t.length > 1));
}

export function joinSlots(
  parts: Array<string | null | undefined>,
): string {
  return parts
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function containsContiguousPhrase(
  haystackNorm: string,
  phraseNorm: string,
): boolean {
  if (!phraseNorm || !haystackNorm) return false;
  return ` ${haystackNorm} `.includes(` ${phraseNorm} `);
}

export function containsStemTokens(
  haystackStems: Set<string>,
  phraseTokens: string[],
): boolean {
  const needed = phraseTokens.map(stemToken).filter((t) => t.length > 1);
  if (needed.length === 0) return false;
  return needed.every((t) => haystackStems.has(t));
}
