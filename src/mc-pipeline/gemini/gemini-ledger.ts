/**
 * Ledger JSONL local (tmp/). Observabilidad: IDs, hashes, contadores. Sin PII/prompts/CV.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { GeminiUsage, GeminiUsageRaw } from './gemini-usage';
import { emptyGeminiUsage } from './gemini-usage';

export type GeminiPhase = 'P1' | 'P2' | 'P3' | 'P4' | 'CV_SKILLS' | 'CV_ENRICHMENT';

export type GeminiLedgerEventType = 'GEMINI_CALL' | 'REUSE';

export type GeminiCallStatus =
  | 'SUCCESS'
  | 'FAILED'
  | 'REUSED'
  | 'EXECUTED_FORCE';

export type GeminiLedgerContext = {
  phase: GeminiPhase;
  personId?: string | null;
  personCvId?: string | null;
  snapshotId?: string | null;
  runId?: string | null;
  batchId?: string | null;
  batchIndex?: number | null;
  attempt?: number | null;
  model?: string | null;
  promptVersion?: string | null;
  contractVersion?: string | null;
  catalogVersion?: string | null;
  configFingerprint?: string | null;
  reuseFingerprint?: string | null;
  inputFingerprint?: string | null;
  forceRecompute?: boolean;
};

export type GeminiLedgerEvent = {
  eventType: GeminiLedgerEventType;
  timestamp: string;
  phase: GeminiPhase;
  personId: string | null;
  personCvId: string | null;
  snapshotId: string | null;
  runId: string | null;
  batchId: string | null;
  batchIndex: number | null;
  attempt: number | null;
  model: string | null;
  promptVersion: string | null;
  contractVersion: string | null;
  catalogVersion: string | null;
  configFingerprint: string | null;
  reuseFingerprint: string | null;
  inputFingerprint: string | null;
  usage: GeminiUsage | null;
  usageRaw: GeminiUsageRaw | null;
  status: GeminiCallStatus;
  durationMs: number | null;
  errorCode: string | null;
  sourceArtifactId: string | null;
  forceRecompute: boolean;
};

export type GeminiUsageTotals = {
  calls: number;
  successfulCalls: number;
  failedCalls: number;
  retryCalls: number;
  reuseEvents: number;
  promptTokens: number | null;
  candidateTokens: number | null;
  thinkingTokens: number | null;
  totalTokens: number | null;
  cachedTokens: number | null;
  durationMs: number;
  thinkingUsage: 'EXPOSED' | 'THINKING_USAGE_NOT_EXPOSED' | 'MIXED';
};

const DEFAULT_REL = join('tmp', 'mc1-gemini-ledger', 'events.jsonl');

export function resolveGeminiLedgerPath(backendRoot?: string): string {
  if (process.env.MC1_GEMINI_LEDGER_PATH) {
    return resolve(process.env.MC1_GEMINI_LEDGER_PATH);
  }
  const root = backendRoot ?? process.cwd();
  return resolve(root, DEFAULT_REL);
}

function contextDefaults(ctx: GeminiLedgerContext): Omit<
  GeminiLedgerEvent,
  'eventType' | 'timestamp' | 'usage' | 'usageRaw' | 'status' | 'durationMs' | 'errorCode' | 'sourceArtifactId'
> {
  return {
    phase: ctx.phase,
    personId: ctx.personId ?? null,
    personCvId: ctx.personCvId ?? null,
    snapshotId: ctx.snapshotId ?? null,
    runId: ctx.runId ?? null,
    batchId: ctx.batchId ?? null,
    batchIndex: ctx.batchIndex ?? null,
    attempt: ctx.attempt ?? null,
    model: ctx.model ?? null,
    promptVersion: ctx.promptVersion ?? null,
    contractVersion: ctx.contractVersion ?? null,
    catalogVersion: ctx.catalogVersion ?? null,
    configFingerprint: ctx.configFingerprint ?? null,
    reuseFingerprint: ctx.reuseFingerprint ?? null,
    inputFingerprint: ctx.inputFingerprint ?? null,
    forceRecompute: ctx.forceRecompute === true,
  };
}

export function appendGeminiLedgerEvent(
  event: GeminiLedgerEvent,
  backendRoot?: string,
): string {
  const path = resolveGeminiLedgerPath(backendRoot);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(event)}\n`, 'utf8');
  return path;
}

export function recordGeminiCall(args: {
  context: GeminiLedgerContext;
  usage: GeminiUsage | null;
  usageRaw: GeminiUsageRaw | null;
  status: GeminiCallStatus;
  durationMs: number | null;
  errorCode?: string | null;
  backendRoot?: string;
}): GeminiLedgerEvent {
  const event: GeminiLedgerEvent = {
    eventType: 'GEMINI_CALL',
    timestamp: new Date().toISOString(),
    ...contextDefaults(args.context),
    usage: args.usage,
    usageRaw: args.usageRaw,
    status: args.status,
    durationMs: args.durationMs,
    errorCode: args.errorCode ?? null,
    sourceArtifactId: null,
    forceRecompute: args.context.forceRecompute === true,
  };
  appendGeminiLedgerEvent(event, args.backendRoot);
  return event;
}

export function recordGeminiReuse(args: {
  context: GeminiLedgerContext;
  sourceArtifactId: string;
  durationMs?: number | null;
  backendRoot?: string;
}): GeminiLedgerEvent {
  const event: GeminiLedgerEvent = {
    eventType: 'REUSE',
    timestamp: new Date().toISOString(),
    ...contextDefaults(args.context),
    usage: emptyGeminiUsage(),
    usageRaw: null,
    status: 'REUSED',
    durationMs: args.durationMs ?? 0,
    errorCode: null,
    sourceArtifactId: args.sourceArtifactId,
    forceRecompute: false,
  };
  appendGeminiLedgerEvent(event, args.backendRoot);
  return event;
}

export function readGeminiLedgerEvents(backendRoot?: string): GeminiLedgerEvent[] {
  const path = resolveGeminiLedgerPath(backendRoot);
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8');
  const events: GeminiLedgerEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as GeminiLedgerEvent);
    } catch {
      // skip malformed
    }
  }
  return events;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  let any = false;
  let sum = 0;
  for (const v of values) {
    if (v == null) continue;
    any = true;
    sum += v;
  }
  return any ? sum : null;
}

export function aggregateGeminiUsage(
  events: GeminiLedgerEvent[],
): GeminiUsageTotals {
  const calls = events.filter((e) => e.eventType === 'GEMINI_CALL');
  const successfulCalls = calls.filter((e) => e.status === 'SUCCESS' || e.status === 'EXECUTED_FORCE').length;
  const failedCalls = calls.filter((e) => e.status === 'FAILED').length;
  const retryCalls = calls.filter((e) => (e.attempt ?? 1) > 1).length;
  const reuseEvents = events.filter((e) => e.eventType === 'REUSE').length;
  const thinkingValues = calls.map((e) => e.usage?.thinkingTokens ?? null);
  const thinkingKnown = thinkingValues.some((v) => v != null);
  const thinkingUnknown = thinkingValues.some((v) => v == null);
  let thinkingUsage: GeminiUsageTotals['thinkingUsage'] = 'THINKING_USAGE_NOT_EXPOSED';
  if (thinkingKnown && thinkingUnknown) thinkingUsage = 'MIXED';
  else if (thinkingKnown) thinkingUsage = 'EXPOSED';

  return {
    calls: calls.length,
    successfulCalls,
    failedCalls,
    retryCalls,
    reuseEvents,
    promptTokens: sumNullable(calls.map((e) => e.usage?.promptTokens)),
    candidateTokens: sumNullable(calls.map((e) => e.usage?.candidateTokens)),
    thinkingTokens: sumNullable(calls.map((e) => e.usage?.thinkingTokens)),
    totalTokens: sumNullable(calls.map((e) => e.usage?.totalTokens)),
    cachedTokens: sumNullable(calls.map((e) => e.usage?.cachedTokens)),
    durationMs: calls.reduce((a, e) => a + (e.durationMs ?? 0), 0),
    thinkingUsage,
  };
}

export function groupGeminiUsage(
  events: GeminiLedgerEvent[],
  key: 'phase' | 'snapshotId' | 'runId' | 'model' | 'personId',
): Record<string, GeminiUsageTotals> {
  const groups = new Map<string, GeminiLedgerEvent[]>();
  for (const e of events) {
    const k = String(e[key] ?? 'UNKNOWN');
    const list = groups.get(k) ?? [];
    list.push(e);
    groups.set(k, list);
  }
  const out: Record<string, GeminiUsageTotals> = {};
  for (const [k, list] of groups) {
    out[k] = aggregateGeminiUsage(list);
  }
  return out;
}

export function filterLedgerByRun(
  events: GeminiLedgerEvent[],
  runId: string,
): GeminiLedgerEvent[] {
  return events.filter((e) => e.runId === runId);
}

/** Test helper: overwrite ledger file. */
export function writeGeminiLedgerEventsForTest(
  events: GeminiLedgerEvent[],
  backendRoot: string,
): void {
  const path = resolveGeminiLedgerPath(backendRoot);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    events.map((e) => JSON.stringify(e)).join('\n') + (events.length ? '\n' : ''),
    'utf8',
  );
}
