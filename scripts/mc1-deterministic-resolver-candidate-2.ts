/**
 * FASE — MC1 DETERMINISTIC RESOLVER CANDIDATE.2
 * Gemini LIVE prohibido. Skip no se activa. Candidate.1 no se toca.
 *
 *   npx ts-node --transpile-only scripts/mc1-deterministic-resolver-candidate-2.ts
 */
import { resolve } from 'node:path';
import { runCandidate2 } from '../src/mc-pipeline/shadow-resolver/run-candidate-2';
import { isDeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runCandidate2(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        failedBoundaryFix: r.failedBoundaryFix,
        verdict: 'verdict' in r ? r.verdict : r.verdict,
        skipGemini: isDeterministicSkipGeminiEnabled(),
        frozen: r.frozen,
        p2: 'p2' in r ? r.p2 : null,
        ledger: 'ledger' in r ? r.ledger : { before: r.ledgerBefore },
        determinism: 'determinism' in r ? r.determinism : null,
      },
      null,
      2,
    ),
  );
}

main();
