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
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  computeP2ReuseFingerprint,
  findReusableP2Pack,
  recordGeminiReuse,
  resolveForceRecompute,
  serializeThinkingConfig,
} from '../gemini';
import { observeMc1ShadowFromP2, observeMc1DeterministicAuthorityFromP2 } from '../shadow-resolver/hook';

export type P2PhaseStatus = 'EXECUTED' | 'REUSED';

export type P2RunResult = {
  envelope: P2ContractEnvelope;
  outDir: string;
  loaded: P2LoadedEvidence;
  geminiInvoked: boolean;
  executionStatus: P2PhaseStatus;
  reuseFingerprint: string;
  sourceArtifactId: string | null;
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
  personId?: string;
  forceRecompute?: boolean;
  fingerprintOverrides?: Record<string, string>;
  thinkingConfig?: import('../gemini/gemini-thinking-config').Mc1ThinkingConfig;
}): Promise<P2RunResult> {
  const loaded = await loadP2EvidenceFromP1Pack({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
  });

  // Guard de entrada: unicidad 1:1 antes de Gemini
  assertP2EvidenceIdentityIntegrity(loaded.units);

  observeMc1ShadowFromP2({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    personId: args.personId,
    units: loaded.units,
  });
  observeMc1DeterministicAuthorityFromP2({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    personId: args.personId,
    units: loaded.units,
    artifactIdentity: loaded.p1ArtifactDigest,
  });

  const forceRecompute = resolveForceRecompute(args.forceRecompute);
  const reuseFingerprint = computeP2ReuseFingerprint({
    p1ArtifactDigest: loaded.p1ArtifactDigest,
    promptVersion: P2_PROMPT_VERSION,
    contractVersion: P2_CONTRACT_VERSION,
    catalogPolicyVersion: P2_CATALOG_POLICY_VERSION,
    professionalFieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
    reasoningPolicyVersion: P2_REASONING_POLICY_VERSION,
    generationPolicyVersion: P2_GENERATION_POLICY_VERSION,
    model: args.model,
    overrides: args.fingerprintOverrides,
  });

  if (!forceRecompute) {
    const hit = findReusableP2Pack({
      searchRoot: args.outRoot,
      snapshotId: args.snapshotId,
      reuseFingerprint,
    });
    if (hit) {
      const envelope = JSON.parse(
        readFileSync(join(hit.dir, 'p2-contract.json'), 'utf8'),
      ) as P2ContractEnvelope;
      let activities: unknown[] = [];
      let capabilities: unknown[] = [];
      const provPath = join(hit.dir, 'provenance.json');
      if (existsSync(provPath)) {
        const prov = JSON.parse(readFileSync(provPath, 'utf8')) as {
          reasoningTrace?: {
            professionalActivities?: unknown[];
            capabilityAreas?: unknown[];
          };
        };
        activities = prov.reasoningTrace?.professionalActivities ?? [];
        capabilities = prov.reasoningTrace?.capabilityAreas ?? [];
      }
      recordGeminiReuse({
        context: {
          phase: 'P2',
          snapshotId: args.snapshotId,
          personId: args.personId,
          runId: args.pipelineRunId,
          model: args.model,
          promptVersion: P2_PROMPT_VERSION,
          contractVersion: P2_CONTRACT_VERSION,
          catalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
          reuseFingerprint,
        },
        sourceArtifactId: hit.artifactId,
        backendRoot: args.backendRoot,
      });
      return {
        envelope,
        outDir: hit.dir,
        loaded,
        geminiInvoked: false,
        executionStatus: 'REUSED',
        reuseFingerprint,
        sourceArtifactId: hit.artifactId,
        activities,
        capabilities,
      };
    }
  }

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
      backendRoot: args.backendRoot,
      ledger: {
        phase: 'P2',
        snapshotId: args.snapshotId,
        personId: args.personId,
        runId: pipelineRunId,
        promptVersion: P2_PROMPT_VERSION,
        contractVersion: P2_CONTRACT_VERSION,
        catalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
        configFingerprint,
        reuseFingerprint,
        forceRecompute,
        inputFingerprint: serializeThinkingConfig(args.thinkingConfig),
      },
      thinkingConfig: args.thinkingConfig,
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
      reuseFingerprint,
    },
  });

  return {
    envelope: normalized.envelope,
    outDir,
    loaded,
    geminiInvoked,
    executionStatus: 'EXECUTED',
    reuseFingerprint,
    sourceArtifactId: null,
    activities: normalized.activities,
    capabilities: normalized.capabilities,
  };
}
