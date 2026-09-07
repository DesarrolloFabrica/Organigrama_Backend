import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aggregateGeminiUsage,
  filterLedgerByRun,
  groupGeminiUsage,
  recordGeminiCall,
  recordGeminiReuse,
  readGeminiLedgerEvents,
  resolveGeminiLedgerPath,
} from './gemini-ledger';
import { emptyGeminiUsage } from './gemini-usage';

describe('gemini-ledger', () => {
  const prev = process.env.MC1_GEMINI_LEDGER_PATH;
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'mc1-ledger-'));
    process.env.MC1_GEMINI_LEDGER_PATH = join(dir, 'events.jsonl');
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.MC1_GEMINI_LEDGER_PATH;
    else process.env.MC1_GEMINI_LEDGER_PATH = prev;
    rmSync(dir, { recursive: true, force: true });
  });

  it('appends JSONL call events and distinguishes retries', () => {
    recordGeminiCall({
      context: {
        phase: 'P1',
        snapshotId: '19',
        personId: '1349',
        runId: 'run-a',
        attempt: 1,
        model: 'gemini-3.6-flash',
        reuseFingerprint: 'fp1',
      },
      usage: {
        promptTokens: 100,
        candidateTokens: 20,
        totalTokens: 120,
        cachedTokens: null,
        thinkingTokens: null,
        toolUsePromptTokens: null,
      },
      usageRaw: null,
      status: 'FAILED',
      durationMs: 10,
      errorCode: 'timeout',
    });
    recordGeminiCall({
      context: {
        phase: 'P1',
        snapshotId: '19',
        personId: '1349',
        runId: 'run-a',
        attempt: 2,
        model: 'gemini-3.6-flash',
        reuseFingerprint: 'fp1',
      },
      usage: {
        promptTokens: 100,
        candidateTokens: 40,
        totalTokens: 140,
        cachedTokens: null,
        thinkingTokens: null,
        toolUsePromptTokens: null,
      },
      usageRaw: null,
      status: 'SUCCESS',
      durationMs: 20,
    });

    const events = readGeminiLedgerEvents();
    expect(events).toHaveLength(2);
    expect(events[0].eventType).toBe('GEMINI_CALL');
    expect(events[0].usage?.promptTokens).toBe(100);
    expect(JSON.stringify(events[0])).not.toMatch(/prompt text|normalizedText/i);

    const totals = aggregateGeminiUsage(events);
    expect(totals.calls).toBe(2);
    expect(totals.successfulCalls).toBe(1);
    expect(totals.failedCalls).toBe(1);
    expect(totals.retryCalls).toBe(1);
    expect(totals.promptTokens).toBe(200);
    expect(totals.totalTokens).toBe(260);
    expect(totals.thinkingTokens).toBeNull();
    expect(totals.thinkingUsage).toBe('THINKING_USAGE_NOT_EXPOSED');
    expect(resolveGeminiLedgerPath()).toBe(join(dir, 'events.jsonl'));
  });

  it('records reuse without fabricating a Gemini call', () => {
    recordGeminiReuse({
      context: { phase: 'P2', snapshotId: '19', runId: 'run-b', model: 'gemini-3.6-flash' },
      sourceArtifactId: 'P2F-source',
    });
    const events = readGeminiLedgerEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('REUSE');
    expect(events[0].status).toBe('REUSED');
    expect(events[0].sourceArtifactId).toBe('P2F-source');
    const totals = aggregateGeminiUsage(events);
    expect(totals.calls).toBe(0);
    expect(totals.reuseEvents).toBe(1);
    expect(totals.totalTokens).toBeNull();
  });

  it('groups by phase and filters by run', () => {
    recordGeminiCall({
      context: { phase: 'P1', runId: 'r1', personId: '1349' },
      usage: { ...emptyGeminiUsage(), promptTokens: 5, totalTokens: 5 },
      usageRaw: null,
      status: 'SUCCESS',
      durationMs: 1,
    });
    recordGeminiCall({
      context: { phase: 'P2', runId: 'r2', personId: '1349' },
      usage: { ...emptyGeminiUsage(), promptTokens: 9, totalTokens: 9 },
      usageRaw: null,
      status: 'SUCCESS',
      durationMs: 1,
    });
    const all = readGeminiLedgerEvents();
    expect(groupGeminiUsage(all, 'phase').P1.calls).toBe(1);
    expect(groupGeminiUsage(all, 'phase').P2.promptTokens).toBe(9);
    expect(filterLedgerByRun(all, 'r1')).toHaveLength(1);
  });
});
