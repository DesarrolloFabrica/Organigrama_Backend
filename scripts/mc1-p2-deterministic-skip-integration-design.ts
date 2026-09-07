/**
 * FASE — MC1 P2 DETERMINISTIC SKIP INTEGRATION DESIGN
 * Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-skip-integration-design.ts
 */
import { resolve } from 'node:path';
import { runP2SkipIntegrationDesign } from '../src/mc-pipeline/shadow-resolver/run-p2-skip-integration-design';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runP2SkipIntegrationDesign(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        r1: r.r1,
        p3Input: r.p3Input,
        synthetic: r.synthetic,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        missing141: r.missing141,
      },
      null,
      2,
    ),
  );
}

main();
