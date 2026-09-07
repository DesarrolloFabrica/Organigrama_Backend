/**
 * FASE — MC1 P2 SEMANTIC REUSE CANARY EXECUTION
 *
 * Runner aislado. No arma flags productivos. Gemini = 0.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-semantic-reuse-canary.ts
 */
import { resolve } from 'node:path';
import { runCamiloCanaryExecution } from '../src/mc-pipeline/shadow-resolver/run-canary-execution';
import {
  CAMILO_CANARY_IDENTITY,
  CANARY_ISOLATED_RUNNER_ID,
  isP2CanaryEnabled,
  productionCanaryArmed,
} from '../src/mc-pipeline/shadow-resolver/canary-design';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runCamiloCanaryExecution(root, {
    personId: CAMILO_CANARY_IDENTITY.personId,
    snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
  });
  const ledger = r.ledger as {
    before: { calls: number; tokens: number; events: number };
    after: { calls: number; tokens: number; events: number };
    delta: { calls: number; tokens: number; events: number };
  };
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        runner: CANARY_ISOLATED_RUNNER_ID,
        outDir: r.outDir,
        state: r.state,
        reason: r.reason,
        blockedBy: r.blockedBy,
        scope: {
          personId: CAMILO_CANARY_IDENTITY.personId,
          snapshotId: CAMILO_CANARY_IDENTITY.snapshotId,
          otherPersonsTouched: [],
        },
        skipGemini: isP2DeterministicSkipGeminiEnabled(),
        authority: isP2DeterministicAuthorityEnabled(),
        canaryEnabled: isP2CanaryEnabled(),
        armed: productionCanaryArmed(),
        flagsAfter: r.flagsAfter,
        ledger: {
          callsBefore: ledger.before.calls,
          callsAfter: ledger.after.calls,
          callsDelta: ledger.delta.calls,
          tokensBefore: ledger.before.tokens,
          tokensAfter: ledger.after.tokens,
          tokensDelta: ledger.delta.tokens,
          eventsDelta: ledger.delta.events,
        },
        p2: r.core?.p2 ?? null,
        p3: r.core?.p3 ?? null,
        p4: r.core?.p4 ?? null,
        semantic: r.core?.semanticDiff ?? null,
        cloud: r.cloud,
        idempotency: r.idempotency,
        johan: 'NOT_TOUCHED',
        s19: 'NOT_TOUCHED',
        missingProfiles: 'NOT_PROCESSED',
      },
      null,
      2,
    ),
  );
  if (r.state !== 'CAMILO_ZERO_GEMINI_CANARY_VALIDATED') {
    process.exitCode = 1;
  }
}

main();
