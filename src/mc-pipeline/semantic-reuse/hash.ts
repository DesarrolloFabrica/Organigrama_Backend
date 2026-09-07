/**
 * Hash / stringify locales del prototipo. No toca reuse-fingerprint productivo.
 */
import { createHash } from 'node:crypto';

export function stableStringify(value: unknown): string {
  return stringifySorted(value);
}

function stringifySorted(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stringifySorted(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stringifySorted(obj[k])}`).join(',')}}`;
}

export function sha256Utf8(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}
