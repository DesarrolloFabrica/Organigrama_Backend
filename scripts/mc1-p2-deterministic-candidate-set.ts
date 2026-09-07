/**
 * FASE — MC1 P2 DETERMINISTIC CANDIDATE SET MODEL
 * Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-deterministic-candidate-set.ts
 */
import { resolve } from 'node:path';
import { runCandidateSetModel } from '../src/mc-pipeline/shadow-resolver/run-candidate-set';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runCandidateSetModel(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        evaluated: r.evaluated,
        domains: r.domains,
        candidateSets: {
          primaryResolved: r.primaryResolved,
          secondaryEmitted: r.secondaryEmitted,
          competitors: r.competitorCount,
          ambiguous: r.ambiguousCount,
        },
        secondaryReview: r.secondaryReview,
        r1: r.r1,
        p3Context: r.p3Context,
        skip: r.skip,
        adversarial: r.adversarial,
        mutation: r.mutation,
        determinism: r.determinism,
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
      },
      null,
      2,
    ),
  );
}

main();
