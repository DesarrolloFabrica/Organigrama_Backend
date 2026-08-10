import { callP1GeminiJson } from '../p1/p1-gemini-client';
import { writeP2ArtifactPack } from './p2-artifact-writer';
import {
  assertP2ContractReferentialIntegrity,
  assertP2EvidenceIdentityIntegrity,
  fingerprintP2Config,
  loadP2EvidenceFromP1Pack,
  newExecutionId,
  type P2LoadedEvidence,
} from './p2-evidence-loader';
import { normalizeP2ModelOutput } from './p2-normalize';
import { buildP2SystemPrompt, buildP2UserPayload } from './p2-prompt-v1';
import {
  P2_CATALOG_POLICY_VERSION,
  P2_CONTRACT_VERSION,
  P2_GENERATION_POLICY_VERSION,
  P2_PROMPT_VERSION,
  P2_REASONING_POLICY_VERSION,
  type P2ContractEnvelope,
  type P2ModelRawOutput,
} from './p2.types';
import { PROFESSIONAL_FIELD_CATALOG_VERSION } from '../catalog/professional-fields';
import type { DataSource } from 'typeorm';

export type P2RunResult = {
  envelope: P2ContractEnvelope;
  outDir: string;
  loaded: P2LoadedEvidence;
  geminiInvoked: boolean;
  activities: unknown[];
  capabilities: unknown[];
};

function parseModelJson(text: string): P2ModelRawOutput {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('model_output_not_json_object');
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as P2ModelRawOutput;
}

/**
 * Runner P2 v1 — ARTIFACT_ONLY.
 * Evidence Units (pack) → Activities/Hypotheses (modelo) → Domain Candidates → contrato.
 */
export async function runP2ArtifactOnly(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
  apiKey: string;
  model: string;
  outRoot: string;
  campaignId?: string;
  pipelineRunId?: string;
}): Promise<P2RunResult> {
  const loaded = await loadP2EvidenceFromP1Pack({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
  });

  // Guard de entrada: unicidad 1:1 antes de Gemini
  assertP2EvidenceIdentityIntegrity(loaded.units);

  const executionId = newExecutionId();
  const campaignId = args.campaignId ?? 'MC1-P2-8A2-IDENTITY';
  const pipelineRunId =
    args.pipelineRunId ?? `p2-8a2-${args.snapshotId}-${Date.now()}`;

  const configFingerprint = fingerprintP2Config({
    contractVersion: P2_CONTRACT_VERSION,
    promptVersion: P2_PROMPT_VERSION,
    reasoningPolicy: P2_REASONING_POLICY_VERSION,
    generationPolicy: P2_GENERATION_POLICY_VERSION,
    catalogPolicy: P2_CATALOG_POLICY_VERSION,
    professionalFieldCatalog: PROFESSIONAL_FIELD_CATALOG_VERSION,
    model: args.model,
    mode: 'ARTIFACT_ONLY',
    evidenceIdentity: 'CANONICAL_CEU_V1',
  });

  const registryFingerprint = fingerprintP2Config({
    registry: 'mc1-local-lab',
    promptVersion: P2_PROMPT_VERSION,
  });

  let raw: P2ModelRawOutput;
  let geminiInvoked = false;

  if (loaded.units.length === 0) {
    raw = {
      professionalActivities: [],
      capabilityAreas: [],
      domainCandidates: [],
      evidenceDispositions: [],
      outcomeStatus: 'NO_DOMAIN_EVIDENCE',
      reviewState: 'NOT_REQUIRED',
      warnings: ['no_eligible_units'],
    };
  } else {
    const systemPrompt = buildP2SystemPrompt();
    const userPayload = buildP2UserPayload({
      snapshotId: loaded.snapshotId,
      p1ArtifactDigest: loaded.p1ArtifactDigest,
      units: loaded.units.map((u) => ({
        evidenceUnitId: u.evidenceUnitId,
        evidenceKind: u.evidenceKind,
        explicitness: u.explicitness,
        pageNumber: u.pageNumber,
        normalizedActivity: u.normalizedActivity,
        object: u.object,
        toolOrMethod: u.toolOrMethod,
        result: u.result,
        scope: u.scope,
        temporalContext: u.temporalContext,
      })),
    });

    const gem = await callP1GeminiJson({
      apiKey: args.apiKey,
      model: args.model,
      systemPrompt,
      userPayload,
    });
    geminiInvoked = true;
    raw = parseModelJson(gem.text);
  }

  const normalized = normalizeP2ModelOutput({
    raw,
    executionId,
    configFingerprint,
    snapshotId: loaded.snapshotId,
    p1RunId: loaded.p1RunId,
    p1ArtifactDigest: loaded.p1ArtifactDigest,
    unitIds: loaded.units.map((u) => u.evidenceUnitId),
    campaignId,
    pipelineRunId,
    registryFingerprint,
    modelWarnings: loaded.warningCodes,
    inputSource: 'P1_PACK_ARTIFACT_ONLY_LAB',
  });

  // Guard post-normalización: dispositions 1:1 y refs sin huérfanos
  assertP2ContractReferentialIntegrity(
    normalized.envelope,
    loaded.units.map((u) => u.evidenceUnitId),
  );

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const outDir = `${args.outRoot}/P2F-8A2-S${args.snapshotId}-${stamp}-${executionId.slice(0, 8)}`;

  writeP2ArtifactPack({
    outDir,
    envelope: normalized.envelope,
    activities: normalized.activities,
    capabilities: normalized.capabilities,
    extraManifest: {
      p1PrototypeId: loaded.p1PrototypeId,
      p1ArtifactDir: loaded.artifactDir,
      model: args.model,
      promptVersion: P2_PROMPT_VERSION,
      professionalFieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
      eligibleUnitCount: loaded.units.length,
      geminiInvoked,
    },
  });

  return {
    envelope: normalized.envelope,
    outDir,
    loaded,
    geminiInvoked,
    activities: normalized.activities,
    capabilities: normalized.capabilities,
  };
}
