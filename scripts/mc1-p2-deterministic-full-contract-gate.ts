/**
 * FASE — MC1 P2 DETERMINISTIC FULL CONTRACT GATE
 * Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-full-contract-gate.ts
 */
import { resolve } from 'node:path';
import { runFullContractGate } from '../src/mc-pipeline/shadow-resolver/run-full-contract';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runFullContractGate(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        evaluated: r.evaluated,
        eligibility: r.eligibility,
        r1: r.r1,
        p3: r.p3,
        review: r.review,
        adversarial: r.adversarial,
        mutation: r.mutation,
        determinism: r.determinism,
        cost: r.cost,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        matrix: r.matrix,
      },
      null,
      2,
    ),
  );
}

main();
