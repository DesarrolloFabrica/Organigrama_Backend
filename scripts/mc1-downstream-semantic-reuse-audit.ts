/**
 * FASE — MC1 DOWNSTREAM SEMANTIC REUSE AUDIT
 *
 *   npx ts-node --transpile-only scripts/mc1-downstream-semantic-reuse-audit.ts
 */
import { resolve } from 'node:path';
import { runSemanticReuseAudit } from '../src/mc-pipeline/shadow-resolver/run-semantic-reuse-audit';
import { isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled } from '../src/mc-pipeline/shadow-resolver/flags';

function main() {
  const root = resolve(__dirname, '..');
  const r = runSemanticReuseAudit(root);
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
        transitions: r.transitions,
        p3: r.p3Metrics,
        p4: r.p4Metrics,
        candidateNet: r.candidateNet,
        adversarial: r.adversarial,
        mutation: r.mutation,
        missingProfiles: r.missingProfiles,
        controls: {
          Camilo: summarizeControl(r.controls.Camilo),
          Johan: summarizeControl(r.controls.Johan),
          S19: summarizeControl(r.controls.S19),
        },
      },
      null,
      2,
    ),
  );
}

function summarizeControl(row: unknown) {
  if (!row || typeof row !== 'object') return null;
  const r = row as {
    person: string;
    snapshotId: string;
    authorityEligible: boolean;
    historical: {
      p3Fields: string[];
      r1Status: string;
      r1WouldEvaluateToday?: string[];
      r1VsPackDiscrepancy?: boolean;
    };
    deterministic: { productionP3Fields: string[]; adapterP3Fields: string[]; r1Status: string; roles: Record<string, string> };
    p3: { productionPath: string; adapterPath: string; fingerprintDeltaProd: string };
    p4: { safety: string };
    caseType: string;
    cost: { p2Saved: number; p3Cost: number; p4Cost: number; net: number };
  };
  return {
    person: r.person,
    snapshotId: r.snapshotId,
    eligible: r.authorityEligible,
    histFields: r.historical.p3Fields,
    r1WouldEvaluateToday: r.historical.r1WouldEvaluateToday,
    r1VsPackDiscrepancy: r.historical.r1VsPackDiscrepancy,
    detProdFields: r.deterministic.productionP3Fields,
    detAdapterFields: r.deterministic.adapterP3Fields,
    p3Prod: r.p3.productionPath,
    p3Adapter: r.p3.adapterPath,
    p4: r.p4.safety,
    caseType: r.caseType,
    net: r.cost.net,
  };
}

main();
