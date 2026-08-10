import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { R1ContractEnvelope } from './r1.types';

export function writeR1ArtifactPack(args: {
  outDir: string;
  envelope: R1ContractEnvelope;
  p2PackDir: string;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const p = args.envelope.payload;

  writeFileSync(
    join(args.outDir, 'manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL_LAB',
        mode: 'ARTIFACT_ONLY',
        stageCode: 'R1',
        contractCode: args.envelope.contractCode,
        contractVersion: args.envelope.contractVersion,
        snapshotId: p.snapshotId,
        fieldResolutionStatus: p.fieldResolutionStatus,
        resolutionStatus: p.resolutionStatus,
        p2PackDir: args.p2PackDir,
        p2ExecutionId: p.p2ExecutionId,
        producedAt: args.envelope.producedAt,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'resolution.json'),
    JSON.stringify(
      {
        fieldResolutionStatus: p.fieldResolutionStatus,
        resolutionStatus: p.resolutionStatus,
        primaryField: p.primaryField,
        secondaryFields: p.secondaryFields,
        primaryDomainCode: p.primaryDomainCode,
        secondaryDomainCodes: p.secondaryDomainCodes,
        decisionCodes: p.decisionCodes,
        decisionExplanation: p.decisionExplanation,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'summary.json'),
    JSON.stringify(
      {
        snapshotId: p.snapshotId,
        fieldResolutionStatus: p.fieldResolutionStatus,
        professionalField:
          p.primaryField?.fieldCode ?? p.primaryField?.sourceKey ?? null,
        secondaryFields: p.secondaryFields.map(
          (f) => f.fieldCode ?? f.sourceKey,
        ),
        p2OutcomeStatus: p.p2OutcomeStatus,
        decisionCodes: p.decisionCodes,
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
    JSON.stringify(
      {
        payloadProvenance: p.provenance,
        resolutionRuleVersion: p.resolutionRuleVersion,
        configHash: p.configHash,
        p2ExecutionId: p.p2ExecutionId,
        p2PackDir: args.p2PackDir,
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'r1-contract.json'),
    JSON.stringify(args.envelope, null, 2),
    'utf8',
  );
}
