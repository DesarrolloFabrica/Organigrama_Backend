/**
 * Normalizador determinístico de texto CV.
 * NFC (compose) — estable y reversible en la práctica para CV latinos.
 * No resume, no traduce, no elimina secciones.
 */
import { createHash } from 'node:crypto';
import type { CvTextNormalizationResult } from './p0.types';

export const CV_TEXT_NORMALIZER_NAME = 'deterministic-cv-text-normalizer';
export const CV_TEXT_NORMALIZER_VERSION = '1.0.0';

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export class CvTextNormalizer {
  readonly name = CV_TEXT_NORMALIZER_NAME;
  readonly version = CV_TEXT_NORMALIZER_VERSION;

  normalize(rawText: string): CvTextNormalizationResult {
    const warnings: string[] = [];
    let controlCharsRemoved = 0;
    let softHyphenJoins = 0;
    let linesCollapsed = 0;

    // 1) CRLF / CR → LF
    let text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 2) Unicode NFC (forma canónica compuesta — elegida por estabilidad en español)
    text = text.normalize('NFC');

    // 3) Eliminar controles C0/C1 excepto \n y \t
    text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, () => {
      controlCharsRemoved += 1;
      return '';
    });

    // 4) Soft hyphen + corte de línea conservador: palabra-\ncontinuación → palabracontinuación
    text = text.replace(/(\p{L}|\p{N})-\n(\p{L}|\p{N})/gu, (_m, a: string, b: string) => {
      softHyphenJoins += 1;
      return `${a}${b}`;
    });

    // 5) Por línea: colapsar espacios/tabs horizontales; trim final
    const lines = text.split('\n');
    const outLines = lines.map((line) => {
      const collapsed = line.replace(/[ \t]+/g, ' ').replace(/[ \t]+$/g, '');
      if (collapsed !== line) linesCollapsed += 1;
      return collapsed;
    });
    text = outLines.join('\n');

    // 6) Colapsar más de 2 saltos de párrafo consecutivos a 2 (conserva párrafos)
    text = text.replace(/\n{3,}/g, '\n\n');

    // Delimitadores ---PAGE n--- se conservan intactos (no se tocan aparte).

    if (controlCharsRemoved > 0) {
      warnings.push('control_chars_removed');
    }
    if (softHyphenJoins > 0) {
      warnings.push('soft_hyphen_joins_applied');
    }

    return {
      normalizedText: text,
      normalizedTextHash: sha256Hex(text),
      metrics: {
        inputChars: rawText.length,
        outputChars: text.length,
        linesCollapsed,
        controlCharsRemoved,
        softHyphenJoins,
      },
      warnings,
    };
  }
}
