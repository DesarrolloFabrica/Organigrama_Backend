import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { P2ContractEnvelope } from './p2.types';

export function writeP2ArtifactPack(args: {
  outDir: string;
  envelope: P2ContractEnvelope;
  activities: unknown[];
  capabilities: unknown[];
  extraManifest?: Record<string, unknown>;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const p = args.envelope.payload;

  const manifest = {
    classification: 'CONFIDENTIAL_LAB',
    mode: 'ARTIFACT_ONLY',
    contractCode: args.envelope.contractCode,
    contractVersion: args.envelope.contractVersion,
    executionId: p.executionId,
    snapshotId: p.snapshotId,
    p1RunId: p.p1RunId,
    outcomeStatus: p.outcomeStatus,
    candidateCount: p.domainCandidates.length,
    producedAt: args.envelope.producedAt,
    ...args.extraManifest,
  };

  writeFileSync(
    join(args.outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );
  writeFileSync(
    join(args.outDir, 'domainCandidates.json'),
    JSON.stringify(
      {
        outcomeStatus: p.outcomeStatus,
        domainCandidates: p.domainCandidates,
        evidenceDispositions: p.evidenceDispositions,
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
        outcomeStatus: p.outcomeStatus,
        reviewState: p.reviewState,
        candidateCount: p.domainCandidates.length,
        ranks: p.domainCandidates.map((c) => ({
          rank: c.rank,
          domainCode: c.domainCode,
          proposedDomainKey: c.proposedDomainKey,
          catalogStatus: c.catalogStatus,
          status: c.candidateStatus,
          confidence: c.confidence,
          supportCount: c.supportingEvidenceUnitIds.length,
          rationaleCode: c.rationaleCode,
          flags: c.ambiguityFlags,
        })),
        activityCount: args.activities.length,
        capabilityCount: args.capabilities.length,
        dispositionCount: p.evidenceDispositions.length,
      },
      null,
      2,
    ),
    'utf8',
  );
  writeFileSync(
    join(args.outDir, 'warnings.json'),
    JSON.stringify({ warnings: args.envelope.warnings, errors: args.envelope.errors }, null, 2),
    'utf8',
  );
  writeFileSync(
    join(args.outDir, 'provenance.json'),
    JSON.stringify(
      {
        envelopeMeta: {
          campaignId: args.envelope.campaignId,
          pipelineRunId: args.envelope.pipelineRunId,
          registryFingerprint: args.envelope.registryFingerprint,
          configFingerprint: p.configFingerprint,
          p1ArtifactDigest: p.p1ArtifactDigest,
        },
        artifactProvenance: p.artifactProvenance,
        reasoningTrace: {
          professionalActivities: args.activities,
          capabilityAreas: args.capabilities,
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  writeFileSync(
    join(args.outDir, 'p2-contract.json'),
    JSON.stringify(args.envelope, null, 2),
    'utf8',
  );
}
