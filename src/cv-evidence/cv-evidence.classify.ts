import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';
import type { EvidenceTextClassification } from './cv-evidence.types';

const VERB_HINTS =
  /\b(usar|usé|usa|usando|utilizar|utilicé|manejar|manejé|liderar|lideré|crear|creé|crear|editar|edité|presentar|presenté|planificar|planifiqué|ejecutar|ejecuté|desarrollar|desarrollé|gestionar|gestioné|implementar|implementé|diseñar|diseñé|actuar|actué|producir|produje|coordinar|coordiné|escribir|escribí|grabar|grabé|memorizar|use|used|using|manage|managed|lead|led|create|created|edit|edited|present|presented|plan|planned|execute|executed|develop|developed|implement|implemented|design|designed|act|acted|produce|produced|coordinate|coordinated|write|wrote|record|recorded)\b/i;

const CONTEXT_HINTS =
  /\b(experiencia|proyecto|campaña|cliente|equipo|empresa|producto|contenido|video|redes|estrategia|herramienta|aplicación|responsabilidad|resultado|frente a|en|para|con|experience|project|campaign|client|team|company|product|content|tool|application|responsibility|result)\b/i;

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

/** Normalización para comparación (no altera el original persistido). */
export function normalizeForCompare(text: string): string {
  return stripDiacritics(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/^[\s•\-–—*·.:,;|/\\]+/, '')
    .replace(/[\s•\-–—*·.:,;|/\\]+$/, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  return text.split(' ').filter(Boolean);
}

function isBulletOrListFormat(original: string): boolean {
  const t = original.trim();
  if (/^([•\-–—*·]|\d+[.)])\s+/.test(t)) return true;
  // lista de tokens cortos separados por coma/slash sin verbo
  if ((t.match(/,/g) || []).length >= 2 && !VERB_HINTS.test(t)) return true;
  if ((t.match(/\//g) || []).length >= 2 && !VERB_HINTS.test(t)) return true;
  return false;
}

/**
 * Clasificador determinista de un evidenceText (sin NLP externo / Gemini).
 */
export function classifyEvidenceText(params: {
  evidenceText: string;
  normalizedName: string;
  sourceType: EvidenceSourceType | string;
  shortMaxChars?: number;
}): EvidenceTextClassification {
  const shortMax = params.shortMaxChars ?? 24;
  const original = String(params.evidenceText ?? '');
  const sourceType = String(params.sourceType || 'OTHER').toUpperCase();
  const nameCmp = normalizeForCompare(params.normalizedName);
  const textCmp = normalizeForCompare(original);
  const reasons: string[] = [];

  const isShort = textCmp.length > 0 && textCmp.length <= shortMax;
  if (isShort) reasons.push('short_text');

  const tokens = tokenize(textCmp);
  const nameTokens = tokenize(nameCmp);

  let isNameOnly = false;
  if (textCmp.length > 0 && textCmp === nameCmp) {
    isNameOnly = true;
    reasons.push('exact_name_match');
  } else if (
    textCmp.length > 0 &&
    (textCmp === `• ${nameCmp}` ||
      textCmp === `- ${nameCmp}` ||
      textCmp === `* ${nameCmp}` ||
      new RegExp(`^(bullet )?${escapeReg(nameCmp)}$`).test(textCmp))
  ) {
    isNameOnly = true;
    reasons.push('bullet_name_only');
  } else if (
    nameTokens.length > 0 &&
    tokens.length > 0 &&
    tokens.length <= nameTokens.length + 1 &&
    nameTokens.every((t) => tokens.includes(t)) &&
    tokens.every((t) => nameTokens.includes(t) || t === 'y' || t === 'and')
  ) {
    isNameOnly = true;
    reasons.push('near_name_only');
  }

  const isListingSource = sourceType === 'SKILLS_SECTION';
  const isListingFormat = isBulletOrListFormat(original);
  const isListing = isListingSource || isListingFormat;
  if (isListingSource) reasons.push('skills_section_source');
  if (isListingFormat) reasons.push('list_format');

  const hasVerb = VERB_HINTS.test(original) || VERB_HINTS.test(textCmp);
  const hasContext = CONTEXT_HINTS.test(original) || CONTEXT_HINTS.test(textCmp);
  const hasExtraBeyondName =
    textCmp.length > 0 &&
    !isNameOnly &&
    (tokens.length >= nameTokens.length + 2 ||
      (textCmp.includes(nameCmp) && textCmp.length >= nameCmp.length + 8));

  let isAmbiguous = false;
  if (isNameOnly) {
    isAmbiguous = true;
    reasons.push('ambiguous_name_only');
  } else if (
    sourceType === 'SKILLS_SECTION' &&
    !isNameOnly &&
    hasExtraBeyondName
  ) {
    // Listado claro de herramienta/skill con contexto mínimo de lista:
    // no es ambigüedad name-only; se trata como listing no sustantivo.
    isAmbiguous = false;
    reasons.push('clear_skills_listing_mention');
  } else if (isShort && !hasVerb && !hasContext) {
    isAmbiguous = true;
    reasons.push('ambiguous_short_no_context');
  } else if (
    tokens.length <= 3 &&
    !hasVerb &&
    !hasContext &&
    sourceType !== 'WORK_EXPERIENCE' &&
    sourceType !== 'SKILLS_SECTION'
  ) {
    isAmbiguous = true;
    reasons.push('ambiguous_few_tokens');
  } else if (isListingFormat && !hasVerb && !hasExtraBeyondName) {
    isAmbiguous = true;
    reasons.push('ambiguous_list_without_context');
  }

  let isSubstantive = false;
  if (!isNameOnly && hasExtraBeyondName) {
    if (sourceType === 'WORK_EXPERIENCE' || sourceType === 'PROJECT') {
      isSubstantive = true;
      reasons.push('substantive_applied_context');
    } else if (sourceType === 'SKILLS_SECTION') {
      // Listado de herramientas: no sustantivo aunque tenga palabras alrededor.
      isSubstantive = false;
      reasons.push('skills_section_not_substantive');
    } else if (hasVerb || hasContext) {
      isSubstantive = true;
      reasons.push('substantive_with_verb_or_context');
    } else if (tokens.length >= 6 && textCmp.includes(nameCmp)) {
      isSubstantive = true;
      reasons.push('substantive_extended_mention');
    }
  }

  // No marcar sustantiva solo por longitud sin relación/contexto
  if (isSubstantive && !textCmp.includes(nameCmp) && !hasVerb && !hasContext) {
    isSubstantive = false;
    reasons.push('revoked_substantive_unrelated_long');
  }

  if (isSubstantive) {
    isAmbiguous = false;
  }

  return {
    isNameOnly,
    isShort,
    isListing,
    isAmbiguous,
    isSubstantive,
    reasons,
  };
}

function escapeReg(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
