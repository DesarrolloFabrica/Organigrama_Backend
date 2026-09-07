/**
 * FASE — MC1 P2 SEMANTIC REUSE CANARY DESIGN
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-semantic-reuse-canary-design.ts
 */
import { resolve } from 'node:path';
import { runCamiloCanaryDesign } from '../src/mc-pipeline/shadow-resolver/run-canary-design';
import { isP2CanaryEnabled, productionCanaryArmed } from '../src/mc-pipeline/shadow-resolver/canary-design';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runCamiloCanaryDesign(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isP2DeterministicSkipGeminiEnabled(),
        authority: isP2DeterministicAuthorityEnabled(),
        canaryEnabled: isP2CanaryEnabled(),
        armed: productionCanaryArmed(),
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        dryRun: r.dryRun,
        p2Primary: r.p2.primary,
        p2Eligible: r.p2.authorityEligible,
        p3: r.p3,
        p4: r.p4,
        equivalence: r.equivalence,
        failure: { passed: r.failure.passed, failed: r.failure.failed },
        determinism: r.determinism,
        geminiFallback: r.execution.geminiFallback,
        johan: r.johan,
        s19: r.s19,
        missingProfiles: 'NOT_PROCESSED',
      },
      null,
      2,
    ),
  );
}

main();
