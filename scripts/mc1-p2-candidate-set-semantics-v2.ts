/**
 * FASE — MC1 P2 CANDIDATE SET SEMANTICS V2
 * Gemini LIVE prohibido. Skip no se activa.
 *
 *   npx ts-node --transpile-only scripts/mc1-p2-candidate-set-semantics-v2.ts
 */
import { resolve } from 'node:path';
import { runCandidateSetSemanticsV2 } from '../src/mc-pipeline/shadow-resolver/run-candidate-set-v2';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runCandidateSetSemanticsV2(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        evaluated: r.evaluated,
        domains: r.domains,
        roles: r.roles,
        review: r.review,
        r1: r.r1,
        p3: r.p3,
        skip: r.skip,
        adversarial: r.adversarial,
        mutation: r.mutation,
        determinism: r.determinism,
        costOpportunity: r.costOpportunity,
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
