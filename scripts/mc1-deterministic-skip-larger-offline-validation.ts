/**
 * FASE — MC1 DETERMINISTIC SKIP LARGER OFFLINE VALIDATION
 * Candidate.1 congelado. Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-deterministic-skip-larger-offline-validation.ts
 */
import { resolve } from 'node:path';
import { runLargerOfflineValidation } from '../src/mc-pipeline/shadow-resolver/run-larger-validation';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runLargerOfflineValidation(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        overall: r.overall,
        p2Verdict: r.p2Verdict,
        p3Verdict: r.p3Verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        frozen: r.frozen,
        p2: r.p2,
        p3: r.p3,
        tokens: r.tokens.productionSafeCandidate,
        adversarial: {
          passed: r.adversarial.filter((a) => a.pass).length,
          failed: r.adversarial.filter((a) => !a.pass).length,
        },
        mutation: {
          passed: r.mutation.filter((m) => m.pass).length,
          failed: r.mutation.filter((m) => !m.pass).length,
        },
        determinism: r.determinism,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          newGeminiEvents: r.ledger.newGeminiEvents,
        },
        missing141: r.missingProfiles141,
      },
      null,
      2,
    ),
  );
}

main();
