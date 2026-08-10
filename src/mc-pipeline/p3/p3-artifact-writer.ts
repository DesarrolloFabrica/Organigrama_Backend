import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { P3ContractEnvelope } from './p3.types';

export function writeP3ArtifactPack(args: {
  outDir: string;
  envelope: P3ContractEnvelope;
  extraManifest?: Record<string, unknown>;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const p = args.envelope.payload;

  const observedFlat = p.fieldResults.flatMap((fr) =>
    fr.observedSpecialties
      .filter((s) => s.status === 'OBSERVED' || s.status === 'WEAK')
      .map((s) => ({
        fieldCode: fr.fieldCode,
        specialtyCode: s.specialtyCode,
        status: s.status,
        confidence: s.confidence,
        supportCount: s.supportingEvidenceUnitIds.length,
        rationaleCode: s.rationaleCode,
      })),
  );

  writeFileSync(
    join(args.outDir, 'manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL_LAB',
        mode: 'ARTIFACT_ONLY',
        contractCode: args.envelope.contractCode,
        contractVersion: args.envelope.contractVersion,
        executionId: p.executionId,
        snapshotId: p.snapshotId,
        outcomeStatus: p.outcomeStatus,
        fieldsEvaluated: p.fieldsEvaluated,
        specialtyCatalogVersion: p.specialtyCatalogVersion,
        r1Unchanged: p.r1Unchanged,
        producedAt: args.envelope.producedAt,
        ...args.extraManifest,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'p3-contract.json'),
    JSON.stringify(args.envelope, null, 2),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'field-results.json'),
    JSON.stringify({ fieldResults: p.fieldResults }, null, 2),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'summary.json'),
    JSON.stringify(
      {
        snapshotId: p.snapshotId,
        outcomeStatus: p.outcomeStatus,
        r1FieldResolutionStatus: p.r1FieldResolutionStatus,
        fieldsEvaluated: p.fieldsEvaluated,
        observed: observedFlat,
        r1Unchanged: true,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'warnings.json'),
    JSON.stringify(
      { warnings: args.envelope.warnings, errors: args.envelope.errors },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'provenance.json'),
    JSON.stringify(p.artifactProvenance, null, 2),
    'utf8',
  );
}
