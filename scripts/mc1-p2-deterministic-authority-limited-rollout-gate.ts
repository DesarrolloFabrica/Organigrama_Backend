/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY LIMITED ROLLOUT GATE
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-authority-limited-rollout-gate.ts
 */
import { resolve } from 'node:path';
import { runLimitedRolloutGate } from '../src/mc-pipeline/shadow-resolver/run-limited-rollout';
import { productionLimitedRolloutArmed } from '../src/mc-pipeline/shadow-resolver/limited-rollout';

function main() {
  const root = resolve(__dirname, '..');
  const r = runLimitedRolloutGate(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        armed: productionLimitedRolloutArmed(),
        matrix: r.matrix,
        failure: r.failure,
        net: r.net,
        firstCandidate: r.firstCandidate,
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
