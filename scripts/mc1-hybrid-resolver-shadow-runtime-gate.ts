/**
 * FASE — MC1 HYBRID RESOLVER SHADOW RUNTIME GATE
 * Offline. Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-hybrid-resolver-shadow-runtime-gate.ts
 */
import { resolve } from 'node:path';
import { runShadowRuntimeGate } from '../src/mc-pipeline/shadow-resolver/run-gate';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runShadowRuntimeGate(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        p2: r.p2,
        p3: r.p3,
        reviewCounts: r.reviewCounts,
        skipGateBlocked: r.skipGateBlocked,
        criticalPass: r.criticalControls.pass,
        mutations: {
          passed: r.mutations.filter((m) => m.pass).length,
          failed: r.mutations.filter((m) => !m.pass).length,
        },
        adversarial: {
          passed: r.adversarial.filter((a) => a.pass).length,
          failed: r.adversarial.filter((a) => !a.pass).length,
        },
        cost: r.cost,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          newGeminiEvents: r.ledger.newGeminiEvents,
        },
        p4: r.p4,
        missing141: r.missingProfiles141,
        versionFreeze: r.versionFreeze,
      },
      null,
      2,
    ),
  );
}

main();
