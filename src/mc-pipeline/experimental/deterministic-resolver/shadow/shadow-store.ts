/**
 * Store aislado. Imposible confundir con P2/P3 real:
 * - eventType = MC1.SHADOW.RESOLVER.EVENT
 * - notAProductionResult = true
 * - directorio tmp/mc1-hybrid-resolver-shadow (nunca tmp/mc1-p2-functional)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stableStringify } from '../run-prototype';
import type { ShadowDecision } from './shadow-types';
import { SHADOW_STORE_KIND } from './shadow-types';

export class ShadowEventStore {
  private readonly byFingerprint = new Map<string, ShadowDecision>();

  constructor(private readonly dir: string) {}

  get(fingerprint: string): ShadowDecision | undefined {
    return this.byFingerprint.get(fingerprint);
  }

  put(decision: ShadowDecision): 'COMPUTED' | 'SHADOW_REUSED' {
    const existing = this.byFingerprint.get(decision.inputFingerprint);
    if (existing) return 'SHADOW_REUSED';
    this.byFingerprint.set(decision.inputFingerprint, decision);
    return 'COMPUTED';
  }

  persistJsonl(): void {
    mkdirSync(this.dir, { recursive: true });
    const lines = [...this.byFingerprint.values()].map((d) =>
      JSON.stringify({
        storeKind: SHADOW_STORE_KIND,
        ...d,
      }),
    );
    writeFileSync(join(this.dir, 'events.jsonl'), `${lines.join('\n')}\n`, 'utf8');
  }

  static isProductionPackPath(path: string): boolean {
    return /mc1-p[1234]-(functional|prototype)/i.test(path.replace(/\\/g, '/'));
  }
}

export function writeIsolatedJson(dir: string, name: string, body: unknown): void {
  mkdirSync(dir, { recursive: true });
  if (ShadowEventStore.isProductionPackPath(join(dir, name))) {
    throw new Error('Refusing to write shadow artifacts into a production pack path');
  }
  writeFileSync(join(dir, name), stableStringify(body), 'utf8');
}

export function ledgerSnapshot(backendRoot: string) {
  const path = join(backendRoot, 'tmp', 'mc1-gemini-ledger', 'events.jsonl');
  if (!existsSync(path)) {
    return { exists: false, path, calls: 0, tokens: 0 };
  }
  const text = readFileSync(path, 'utf8');
  let calls = 0;
  let tokens = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line) as {
        eventType?: string;
        usage?: { totalTokens?: number };
      };
      if (ev.eventType === 'GEMINI_CALL') {
        calls += 1;
        tokens += ev.usage?.totalTokens ?? 0;
      }
    } catch {
      // ignore
    }
  }
  return { exists: true, path, calls, tokens };
}
