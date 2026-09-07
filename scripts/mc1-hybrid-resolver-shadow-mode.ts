/**
 * FASE — MC1 HYBRID RESOLVER SHADOW MODE DESIGN
 * ARTIFACT_ONLY. Gemini LIVE prohibido. No muta producción.
 *
 *   npx ts-node --transpile-only scripts/mc1-hybrid-resolver-shadow-mode.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { stableStringify } from '../src/mc-pipeline/experimental/deterministic-resolver/run-prototype';
import {
  comparableShadowPayload,
  runShadowSimulation,
  writeShadowArtifacts,
} from '../src/mc-pipeline/experimental/deterministic-resolver/shadow/run-shadow';

function main() {
  const root = resolve(__dirname, '..');
  const first = runShadowSimulation(root);
  const second = runShadowSimulation(root);
  const outDir = writeShadowArtifacts(root, first);
  const detPass =
    stableStringify(comparableShadowPayload(first)) ===
    stableStringify(comparableShadowPayload(second));
  writeFileSync(
    join(outDir, 'determinism-report.json'),
    stableStringify({
      runs: 2,
      result: detPass ? 'PASS' : 'FAIL',
      gemini: 'NOT_INVOKED',
      sameFingerprints: first.p2.every(
        (r, i) => r.inputFingerprint === second.p2[i]?.inputFingerprint,
      ),
    }),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir,
        productionImpact: first.productionImpact,
        criticalPass: first.criticalControls.allPass,
        versionBlocked: first.criticalControls.versionBlocked,
        p2: first.metrics.p2,
        p3: first.metrics.p3,
        wouldSkip: {
          p2: first.metrics.p2.wouldSkip,
          p3: first.metrics.p3.wouldSkip,
        },
        cost: first.costCounterfactual,
        ledger: {
          callsDelta: first.ledger.callsDelta,
          tokensDelta: first.ledger.tokensDelta,
          newGeminiEvents: first.ledger.newGeminiEvents,
        },
        determinism: detPass ? 'PASS' : 'FAIL',
        p4: first.p4,
        missing141: first.missingProfiles141,
        skipGeminiEnabled: first.futureGates.skipGeminiEnabled,
      },
      null,
      2,
    ),
  );
}

main();
