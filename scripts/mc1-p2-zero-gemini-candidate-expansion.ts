/**
 * FASE — MC1 P2 ZERO-GEMINI CANDIDATE EXPANSION
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-zero-gemini-candidate-expansion.ts
 */
import { resolve } from 'node:path';
import { runZeroGeminiCandidateExpansion } from '../src/mc-pipeline/shadow-resolver/run-zero-gemini-expansion';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runZeroGeminiCandidateExpansion(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        regression: r.regression,
        skipGemini: isP2DeterministicSkipGeminiEnabled(),
        authority: isP2DeterministicAuthorityEnabled(),
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        discovered: r.discovered,
        uniquePersons: r.uniquePersons,
        counts: r.counts,
        controls: r.controls,
        reviews: r.reviews,
        domain: r.domain,
        cost: r.cost,
        adversarial: { passed: (r.adversarial as { passed: number }).passed, failed: (r.adversarial as { failed: number }).failed },
        mutation: { passed: (r.mutation as { passed: number }).passed, failed: (r.mutation as { failed: number }).failed },
        determinism: r.determinism,
        missingProfiles: 'NOT_PROCESSED',
        cloud: 'NONE',
        api: 'NONE',
        frontend: 'NONE',
      },
      null,
      2,
    ),
  );
  if (
    r.verdict !== 'NO_ADDITIONAL_SAFE_CANDIDATES' &&
    r.verdict !== 'ZERO_GEMINI_CANDIDATE_SET_VALIDATED'
  ) {
    process.exitCode = 1;
  }
}

main();
