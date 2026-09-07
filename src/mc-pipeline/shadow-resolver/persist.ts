import { existsSync, mkdirSync, readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ShadowEventStore } from '../experimental/deterministic-resolver/shadow/shadow-store';
import type { RuntimeComparison, RuntimeShadowEvent, RuntimeShadowP3Event } from './types';

function isP3(
  e: RuntimeShadowEvent | RuntimeShadowP3Event,
): e is RuntimeShadowP3Event {
  return e.phase === 'P3';
}

/**
 * Store persistente `mc1_shadow_resolver_event`.
 * Carga JSONL existente para reuse entre corridas. No escribe packs P2/P3.
 */
export class PersistentShadowStore {
  private readonly byFingerprint = new Map<
    string,
    RuntimeShadowEvent | RuntimeShadowP3Event
  >();
  private readonly events: Array<RuntimeShadowEvent | RuntimeShadowP3Event> = [];
  private readonly comparisons: RuntimeComparison[] = [];

  constructor(private readonly dir: string) {
    if (ShadowEventStore.isProductionPackPath(dir)) {
      throw new Error('Shadow store path collides with production packs');
    }
    mkdirSync(dir, { recursive: true });
    this.load();
  }

  get dirPath(): string {
    return this.dir;
  }

  lookup(fingerprint: string): RuntimeShadowEvent | RuntimeShadowP3Event | undefined {
    return this.byFingerprint.get(fingerprint);
  }

  insert(event: RuntimeShadowEvent | RuntimeShadowP3Event): 'COMPUTED' | 'SHADOW_REUSED' {
    const existing = this.byFingerprint.get(event.inputFingerprint);
    if (existing) return 'SHADOW_REUSED';
    this.byFingerprint.set(event.inputFingerprint, event);
    this.events.push(event);
    appendFileSync(this.eventsPath(), `${JSON.stringify(event)}\n`, 'utf8');
    return 'COMPUTED';
  }

  insertComparison(row: RuntimeComparison): void {
    this.comparisons.push(row);
  }

  allEvents(): Array<RuntimeShadowEvent | RuntimeShadowP3Event> {
    return [...this.events];
  }

  p2Events(): RuntimeShadowEvent[] {
    return this.events.filter((e) => e.phase === 'P2');
  }

  p3Events(): RuntimeShadowP3Event[] {
    return this.events.filter(isP3);
  }

  allComparisons(): RuntimeComparison[] {
    return [...this.comparisons];
  }

  count(): number {
    return this.events.length;
  }

  persistComparisons(): void {
    if (this.comparisons.length === 0) return;
    writeFileSync(
      join(this.dir, 'comparisons.jsonl'),
      this.comparisons.map((c) => JSON.stringify(c)).join('\n') + '\n',
      'utf8',
    );
  }

  private eventsPath(): string {
    return join(this.dir, 'events.jsonl');
  }

  private comparisonsPath(): string {
    return join(this.dir, 'comparisons.jsonl');
  }

  private load(): void {
    this.loadFile(this.eventsPath(), (row) => {
      const ev = row as RuntimeShadowEvent | RuntimeShadowP3Event;
      if (!ev?.inputFingerprint) return;
      if (this.byFingerprint.has(ev.inputFingerprint)) return;
      this.byFingerprint.set(ev.inputFingerprint, ev);
      this.events.push(ev);
    });
    this.loadFile(this.comparisonsPath(), (row) => {
      const cmp = row as RuntimeComparison;
      if (!cmp?.eventId) return;
      this.comparisons.push(cmp);
    });
  }

  private loadFile(path: string, consume: (row: unknown) => void): void {
    if (!existsSync(path)) return;
    const text = readFileSync(path, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        consume(JSON.parse(line) as never);
      } catch {
        // ignore corrupt line
      }
    }
  }
}
