/**
 * FASE — MC1 P2 DETERMINISTIC AUTHORITY IMPLEMENTATION GATE
 * Gemini LIVE prohibido. Authority y skip desactivados.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-authority-implementation-gate.ts
 */
import { resolve } from 'node:path';
import { runAuthorityImplementationGate } from '../src/mc-pipeline/shadow-resolver/run-authority-implementation';
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runAuthorityImplementationGate(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        authorityEnabled: isP2DeterministicAuthorityEnabled(),
        skipEnabled: isP2DeterministicSkipGeminiEnabled(),
        evaluated: r.evaluated,
        eligible: r.eligible,
        simulated: r.simulated,
        fallback: r.fallback,
        reused: r.reused,
        errors: r.errors,
        latency: r.latency,
        productionEquivalence: r.productionEquivalence,
        featureFlagSafety: r.featureFlagSafety,
        failureIsolation: r.failureIsolation,
        fingerprint: r.fingerprint,
        determinism: r.determinism,
        tests: r.tests,
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
