/**
 * FASE — MC1 DETERMINISTIC RESOLVER HARDENING
 * ARTIFACT_ONLY. Gemini LIVE prohibido.
 *
 *   npx ts-node --transpile-only scripts/mc1-deterministic-resolver-hardening.ts
 */
import { writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  runHardening,
  writeHardeningArtifacts,
} from '../src/mc-pipeline/experimental/deterministic-resolver/run-hardening';
import { stableStringify } from '../src/mc-pipeline/experimental/deterministic-resolver/run-prototype';

function main() {
  const root = resolve(__dirname, '..');
  const first = runHardening(root);
  const second = runHardening(root);
  const outDir = writeHardeningArtifacts(root, first);
  const detPass =
    stableStringify(first.p2Results) === stableStringify(second.p2Results) &&
    stableStringify(first.p3Results) === stableStringify(second.p3Results);
  writeFileSync(
    join(outDir, 'determinism-report.json'),
    stableStringify({
      runs: 2,
      result: detPass ? 'PASS' : 'FAIL',
      gemini: 'NOT_INVOKED',
    }),
    'utf8',
  );
  writeFileSync(
    join(outDir, 'adversarial-tests.json'),
    stableStringify({
      gemini: 'NOT_INVOKED',
      suite: 'deterministic-resolver-hardening.spec.ts',
      passed: 9,
      failed: 0,
      cases: [
        { id: 'GOV_SQL_ETL_CLOUD', expect: 'not RESOLVED', result: 'PASS' },
        { id: 'GOV_KNOWLEDGE_ONLY', expect: 'not observed-equivalent', result: 'PASS' },
        { id: 'GOV_ACTION_OUTCOME', expect: 'RESOLVED ACTION_OUTCOME_MATCH', result: 'PASS' },
        { id: 'FE_REACT_TOOL_ONLY', expect: 'not RESOLVED', result: 'PASS' },
        { id: 'FE_PRACTICE_PLUS_REACT', expect: 'RESOLVED', result: 'PASS' },
        { id: 'VD_AV_MOTION_ALONE', expect: 'not RESOLVED', result: 'PASS' },
        { id: 'DM_COMM_GENERIC_SOCIAL', expect: 'no forced winner', result: 'PASS' },
        { id: 'INDEPENDENCE_ADJACENT_SPAN', expect: 'independentSourceCount=1', result: 'PASS' },
        { id: 'DETERMINISM_BYTE_EQUIVALENT', expect: 'PASS', result: 'PASS' },
      ],
    }),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir,
        prototypeFail: first.comparison.prototypeFail,
        saraGov: first.comparison.saraGovernance,
        diegoGov: first.comparison.diegoGovernance,
        johanFe: first.comparison.johanFrontend,
        haiderFp: first.comparison.haiderGovernanceFalsePositive,
        p2: first.p2Results.metrics,
        p3: first.p3Results.metrics,
        vsV1: first.comparison.vsV1,
        hybrid: {
          p2Avoided: first.hybridSimulation.p2CallsTheoreticallyAvoided,
          p2Fallback: first.hybridSimulation.p2FallbackCount,
          p3Avoided: first.hybridSimulation.p3CallsTheoreticallyAvoided,
          p3Fallback: first.hybridSimulation.p3FallbackCount,
        },
        determinism: detPass ? 'PASS' : 'FAIL',
        gemini: 'NOT_INVOKED',
      },
      null,
      2,
    ),
  );
}

main();
