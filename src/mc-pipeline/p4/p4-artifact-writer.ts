import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { P4ContractEnvelope } from './p4.types';

export function writeP4ArtifactPack(args: {
  outDir: string;
  envelope: P4ContractEnvelope;
  extraManifest?: Record<string, unknown>;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const p = args.envelope.payload;

  const flat = p.specialtyResults.flatMap((sr) =>
    sr.observedSkills.map((sk) => ({
      fieldCode: sr.fieldCode,
      specialtyCode: sr.specialtyCode,
      skillCode: sk.skillCode,
      name: sk.name,
      status: sk.status,
      confidence: sk.confidence,
      supportCount: sk.supportingEvidenceUnitIds.length,
      tools: sk.toolOrTechnologySignals,
      signals: sk.supportingSignals,
      rationaleCode: sk.rationaleCode,
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
        specialtyCatalogVersion: p.specialtyCatalogVersion,
        specialtiesEvaluated: p.specialtiesEvaluated,
        r1Unchanged: p.r1Unchanged,
        p3Unchanged: p.p3Unchanged,
        producedAt: args.envelope.producedAt,
        ...args.extraManifest,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'p4-contract.json'),
    JSON.stringify(args.envelope, null, 2),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'specialty-results.json'),
    JSON.stringify({ specialtyResults: p.specialtyResults }, null, 2),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'summary.json'),
    JSON.stringify(
      {
        snapshotId: p.snapshotId,
        outcomeStatus: p.outcomeStatus,
        r1FieldResolutionStatus: p.r1FieldResolutionStatus,
        specialtiesEvaluated: p.specialtiesEvaluated,
        skills: flat,
        r1Unchanged: true,
        p3Unchanged: true,
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
