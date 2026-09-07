/**
 * FASE — MC1 HYBRID RESOLVER SHADOW MODE IMPLEMENTATION
 * Harness offline. Gemini LIVE prohibido.
 *
 *   npx ts-node --transpile-only scripts/mc1-hybrid-resolver-shadow-runtime.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stableStringify } from '../src/mc-pipeline/experimental/deterministic-resolver/run-prototype';
import { runShadowRuntimeHarness } from '../src/mc-pipeline/shadow-resolver/harness';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const first = runShadowRuntimeHarness(root, { resetStore: true });
  const second = runShadowRuntimeHarness(root, { resetStore: false });
  const detPass =
    first.reuseReport.noInflation &&
    second.reuseReport.noInflation &&
    second.reuseReport.countBefore === first.reuseReport.countAfterProbe &&
    first.productionEquivalence.result === 'PASS' &&
    second.productionEquivalence.result === 'PASS';
  writeFileSync(
    join(first.outDir, 'determinism-report.json'),
    stableStringify({
      runs: 2,
      result: detPass ? 'PASS' : 'FAIL',
      gemini: 'NOT_INVOKED',
      skipGemini: isDeterministicSkipGeminiEnabled(),
      firstNoInflation: first.reuseReport.noInflation,
      secondAllReusedStore: second.reuseReport.countAfterRun1 === second.reuseReport.countAfterRun2,
    }),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: first.outDir,
        productionImpact: first.productionImpact,
        productionEquivalence: first.productionEquivalence.result,
        criticalPass: first.criticalControls.allPass,
        versionBlocked: first.criticalControls.versionBlocked,
        p2: first.metrics.p2,
        p3: first.metrics.p3,
        reuse: first.reuseReport,
        latency: first.latencyReport,
        reviewQueue: first.reviewQueue.length,
        cost: first.costCounterfactual,
        ledger: {
          callsDelta: first.ledger.callsDelta,
          tokensDelta: first.ledger.tokensDelta,
          newGeminiEvents: first.ledger.newGeminiEvents,
        },
        determinism: detPass ? 'PASS' : 'FAIL',
        skipGemini: isDeterministicSkipGeminiEnabled(),
        p4: first.p4,
        missing141: first.missingProfiles141,
      },
      null,
      2,
    ),
  );
}

main();
