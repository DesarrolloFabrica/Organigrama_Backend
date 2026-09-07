/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY SHADOW GATE
 * Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-authority-shadow-gate.ts
 */
import { resolve } from 'node:path';
import { runAuthorityShadowGate } from '../src/mc-pipeline/shadow-resolver/run-authority-shadow';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runAuthorityShadowGate(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        evaluated: r.evaluated,
        authority: r.authority,
        r1: r.r1,
        p3: r.p3,
        review: r.review,
        adversarial: r.adversarial,
        mutation: r.mutation,
        failureIsolation: r.failureIsolation,
        determinism: r.determinism,
        cost: r.cost,
        profile: r.profile,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        controls: r.controls,
      },
      null,
      2,
    ),
  );
}

main();
