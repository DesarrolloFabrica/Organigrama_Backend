/**
 * FASE — MC1 DETERMINISTIC RESOLVER PROTOTYPE
 *
 * ARTIFACT_ONLY. Gemini LIVE prohibido.
 *
 *   npx ts-node --transpile-only scripts/mc1-deterministic-resolver-prototype.ts
 */
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runDeterministicResolverPrototype,
  writePrototypeArtifacts,
  stableStringify,
} from '../src/mc-pipeline/experimental/deterministic-resolver';

function main() {
  const root = resolve(__dirname, '..');
  const artifacts = runDeterministicResolverPrototype(root);
  const outDir = writePrototypeArtifacts(root, artifacts);
  const p2 = artifacts.p2Results as { metrics: Record<string, unknown> };
  const p3 = artifacts.p3Results as { metrics: Record<string, unknown> };
  const hybrid = artifacts.hybridSimulation as Record<string, unknown>;
  const comparison = artifacts.comparison as { prototypeFail: boolean };
  writeFileSync(
    join(outDir, 'test-report.json'),
    stableStringify({
      note: 'Jest suite is the source of PASS/FAIL for unit controls. This file records cohort run metrics.',
      prototypeFail: comparison.prototypeFail,
      p2: p2.metrics,
      p3: p3.metrics,
      hybrid: {
        p2CallsTheoreticallyAvoided: hybrid.p2CallsTheoreticallyAvoided,
        p2FallbackCount: hybrid.p2FallbackCount,
        p3CallsTheoreticallyAvoided: hybrid.p3CallsTheoreticallyAvoided,
        p3FallbackCount: hybrid.p3FallbackCount,
      },
      gemini: 'NOT_INVOKED',
    }),
    'utf8',
  );
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir,
        prototypeFail: comparison.prototypeFail,
        p2: p2.metrics,
        p3: p3.metrics,
        hybrid: {
          p2Avoided: hybrid.p2CallsTheoreticallyAvoided,
          p2Fallback: hybrid.p2FallbackCount,
          p3Avoided: hybrid.p3CallsTheoreticallyAvoided,
          p3Fallback: hybrid.p3FallbackCount,
        },
        gemini: 'NOT_INVOKED',
      },
      null,
      2,
    ),
  );
}

main();
