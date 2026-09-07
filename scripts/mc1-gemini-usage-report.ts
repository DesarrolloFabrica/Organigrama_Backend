/**
 * Reporte CLI del Gemini usage ledger (JSONL local).
 *
 *   npx ts-node --transpile-only scripts/mc1-gemini-usage-report.ts
 *   npx ts-node --transpile-only scripts/mc1-gemini-usage-report.ts --run=RUN_ID
 *   npx ts-node --transpile-only scripts/mc1-gemini-usage-report.ts --snapshot=19 --person=1349
 *
 * No imprime prompts, CV ni Evidence Units.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  aggregateGeminiUsage,
  filterLedgerByRun,
  groupGeminiUsage,
  readGeminiLedgerEvents,
  resolveGeminiLedgerPath,
  type GeminiLedgerEvent,
} from '../src/mc-pipeline/gemini';

const ROOT = resolve(__dirname, '..');

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit?.slice(flag.length + 1);
}

function loadEnvLedgerPath() {
  const envPath = resolve(ROOT, 'secrets/mc1-mde.local.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (k === 'MC1_GEMINI_LEDGER_PATH' && v && !process.env.MC1_GEMINI_LEDGER_PATH) {
      process.env.MC1_GEMINI_LEDGER_PATH = v;
    }
  }
}

function phaseTokens(events: GeminiLedgerEvent[]) {
  const byPhase = groupGeminiUsage(events, 'phase');
  const out: Record<string, ReturnType<typeof aggregateGeminiUsage>> = {};
  for (const phase of ['P1', 'P2', 'P3', 'P4', 'CV_SKILLS', 'CV_ENRICHMENT']) {
    if (byPhase[phase]) out[phase] = byPhase[phase];
  }
  return out;
}

function main() {
  loadEnvLedgerPath();
  const runId = argValue('--run');
  const snapshotId = argValue('--snapshot');
  const personId = argValue('--person');
  let events = readGeminiLedgerEvents(ROOT);
  if (runId) events = filterLedgerByRun(events, runId);
  if (snapshotId) {
    events = events.filter((e) => String(e.snapshotId) === snapshotId);
  }
  if (personId) {
    events = events.filter((e) => String(e.personId) === personId);
  }

  const totals = aggregateGeminiUsage(events);
  const report = {
    ledgerPath: resolveGeminiLedgerPath(ROOT),
    filters: { runId: runId ?? null, snapshotId: snapshotId ?? null, personId: personId ?? null },
    eventCount: events.length,
    totals,
    byPhase: phaseTokens(events),
    byPerson: groupGeminiUsage(events, 'personId'),
    byModel: groupGeminiUsage(events, 'model'),
    byRun: groupGeminiUsage(events, 'runId'),
    bySnapshot: groupGeminiUsage(events, 'snapshotId'),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
