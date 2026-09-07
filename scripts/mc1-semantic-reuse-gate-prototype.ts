/**
 * FASE — MC1 SEMANTIC REUSE GATE PROTOTYPE
 *
 *   npx ts-node --transpile-only scripts/mc1-semantic-reuse-gate-prototype.ts
 */
import { resolve } from 'node:path';
import { runSemanticReuseGateWithDeterminism } from '../src/mc-pipeline/shadow-resolver/run-semantic-reuse-gate';
import {
  isP2DeterministicAuthorityEnabled,
  isP2DeterministicSkipGeminiEnabled,
} from '../src/mc-pipeline/shadow-resolver/flags';

function brief(row: unknown) {
  if (!row || typeof row !== 'object') return null;
  const r = row as {
    person: string;
    snapshotId: string;
    authorityEligible: boolean;
    jointState: string | null;
    canary: string | null;
    p3: { reuseDecision: string; compare: string };
    p4: { reuseDecision: string };
    payload: { p3Equivalent: boolean; p4Equivalent: boolean | null };
    cost: { net: number; p2Saved: number };
    historical: { p3PackFields: string[] };
    deterministic: { productionP3Fields: string[] };
  };
  return {
    person: r.person,
    snapshotId: r.snapshotId,
    eligible: r.authorityEligible,
    histFields: r.historical.p3PackFields,
    detFields: r.deterministic.productionP3Fields,
    p3: r.p3.reuseDecision,
    p3Compare: r.p3.compare,
    p4: r.p4.reuseDecision,
    payloadP3: r.payload.p3Equivalent,
    payloadP4: r.payload.p4Equivalent,
    net: r.cost.net,
    joint: r.jointState,
    canary: r.canary,
  };
}

function main() {
  const root = resolve(__dirname, '..');
  const r = runSemanticReuseGateWithDeterminism(root);
  // eslint-disable-next-line no-console
  console.log(
    JSON.stringify(
      {
        outDir: r.outDir,
        verdict: r.verdict,
        skipGemini: isP2DeterministicSkipGeminiEnabled(),
        authority: isP2DeterministicAuthorityEnabled(),
        ledger: {
          callsDelta: r.ledger.callsDelta,
          tokensDelta: r.ledger.tokensDelta,
          eventsDelta: r.ledger.eventsDelta,
        },
        determinism: r.determinism,
        criticalUnderinvalidations: r.criticalCount,
        currentInvalidations: r.currentInvalidations,
        semanticInvalidations: r.semanticInvalidations,
        overinvalidationsRemoved: r.over,
        underinvalidationsDetected: r.under,
        p3Safe: r.p3Safe,
        adversarial: r.adversarial,
        mutation: r.mutation,
        canaries: r.canaries.map((c) => c.person),
        net: r.net,
        controls: {
          Camilo: brief(r.controls.Camilo),
          Johan: brief(r.controls.Johan),
          S19: brief(r.controls.S19),
          JuanPablo: brief(r.controls['Juan Pablo']),
          Diego: brief(r.controls.Diego),
        },
        missingProfiles: 'NOT_PROCESSED',
      },
      null,
      2,
    ),
  );
}

main();
