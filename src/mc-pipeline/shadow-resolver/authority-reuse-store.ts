/**
 * Store de reuse determinístico P2. Separado del reuse Gemini.
 * Mismo fingerprint → P2_DETERMINISTIC_REUSED. No lee packs P2F- Gemini.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ShadowEventStore } from '../experimental/deterministic-resolver/shadow/shadow-store';

export type DeterministicReuseRecord = {
  authorityFingerprint: string;
  snapshotId: string;
  producedBy: 'DETERMINISTIC_RESOLVER';
  primary: string | null;
  secondaries: string[];
  context: string[];
  decision: string;
};

export class DeterministicP2ReuseStore {
  private readonly byFp = new Map<string, DeterministicReuseRecord>();

  constructor(private readonly dir?: string) {
    if (dir) {
      if (ShadowEventStore.isProductionPackPath(dir)) {
        throw new Error('Deterministic reuse store collides with production packs');
      }
      mkdirSync(dir, { recursive: true });
      this.load();
    }
  }

  lookup(fingerprint: string): DeterministicReuseRecord | undefined {
    return this.byFp.get(fingerprint);
  }

  insert(record: DeterministicReuseRecord): 'COMPUTED' | 'P2_DETERMINISTIC_REUSED' {
    const existing = this.byFp.get(record.authorityFingerprint);
    if (existing) return 'P2_DETERMINISTIC_REUSED';
    this.byFp.set(record.authorityFingerprint, record);
    this.persist();
    return 'COMPUTED';
  }

  private file(): string | null {
    return this.dir ? join(this.dir, 'deterministic-p2-reuse.json') : null;
  }

  private load(): void {
    const f = this.file();
    if (!f || !existsSync(f)) return;
    try {
      const rows = JSON.parse(readFileSync(f, 'utf8')) as DeterministicReuseRecord[];
      for (const r of rows) this.byFp.set(r.authorityFingerprint, r);
    } catch {
      /* ignore */
    }
  }

  private persist(): void {
    const f = this.file();
    if (!f) return;
    writeFileSync(f, `${JSON.stringify([...this.byFp.values()], null, 2)}\n`, 'utf8');
  }
}
