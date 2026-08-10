import { callP1GeminiJson } from '../p1/p1-gemini-client';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import type { DataSource } from 'typeorm';
import {
  fingerprintP3Config,
  loadP3Context,
  newP3ExecutionId,
  type P3LoadedContext,
} from './p3-context-loader';
import { writeP3ArtifactPack } from './p3-artifact-writer';
import {
  assertP3ReferentialIntegrity,
  normalizeP3ModelOutput,
} from './p3-normalize';
import { buildP3SystemPrompt, buildP3UserPayload } from './p3-prompt-v1';
import {
  P3_CONTRACT_VERSION,
  P3_GENERATION_POLICY_VERSION,
  P3_PROMPT_VERSION,
  P3_REASONING_POLICY_VERSION,
  type P3ContractEnvelope,
  type P3ModelRawOutput,
} from './p3.types';

export type P3RunResult = {
  envelope: P3ContractEnvelope;
  outDir: string;
  loaded: P3LoadedContext;
  geminiInvoked: boolean;
};

function parseModelJson(text: string): P3ModelRawOutput {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('model_output_not_json_object');
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as P3ModelRawOutput;
}

/**
 * Runner P3 v1 — ARTIFACT_ONLY.
 * R1 resolution + Evidence Units canónicas → especialidades observadas.
 * No modifica R1. No skills. Sin persistencia.
 */
export async function runP3ArtifactOnly(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
  apiKey: string;
  model: string;
  outRoot: string;
  r1PackDir?: string;
  campaignId?: string;
  pipelineRunId?: string;
}): Promise<P3RunResult> {
  const loaded = await loadP3Context({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
    r1PackDir: args.r1PackDir,
  });

  const executionId = newP3ExecutionId();
  const campaignId = args.campaignId ?? 'MC1-P3-8B2-FREEZE';
  const pipelineRunId =
    args.pipelineRunId ?? `p3-8b2-${args.snapshotId}-${Date.now()}`;

  const fieldsEvaluated = loaded.fieldsToEvaluate.map((f) => f.fieldCode);

  const configFingerprint = fingerprintP3Config({
    contractVersion: P3_CONTRACT_VERSION,
    promptVersion: P3_PROMPT_VERSION,
    reasoningPolicy: P3_REASONING_POLICY_VERSION,
    generationPolicy: P3_GENERATION_POLICY_VERSION,
    specialtyCatalog: SPECIALTY_CATALOG_VERSION,
    model: args.model,
    mode: 'ARTIFACT_ONLY',
    fields: fieldsEvaluated.join(','),
  });

  const registryFingerprint = fingerprintP3Config({
    registry: 'mc1-local-lab',
    promptVersion: P3_PROMPT_VERSION,
  });

  let raw: P3ModelRawOutput;
  let geminiInvoked = false;

  if (fieldsEvaluated.length === 0) {
    raw = {
      fieldResults: [],
      outcomeStatus: 'ABSTAINED_NO_FIELD',
      warnings: ['no_in_scope_fields'],
    };
  } else if (loaded.evidence.units.length === 0) {
    raw = {
      fieldResults: fieldsEvaluated.map((fieldCode) => ({
        fieldCode,
        observedSpecialties: [],
      })),
      outcomeStatus: 'NO_SPECIALTY_EVIDENCE',
      warnings: ['no_eligible_units'],
    };
  } else {
    const systemPrompt = buildP3SystemPrompt(fieldsEvaluated);
    const userPayload = buildP3UserPayload({
      snapshotId: loaded.snapshotId,
      r1FieldResolutionStatus: loaded.r1.payload.fieldResolutionStatus,
      fieldsEvaluated,
      p1ArtifactDigest: loaded.evidence.p1ArtifactDigest,
      units: loaded.evidence.units.map((u) => ({
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

  const { envelope } = normalizeP3ModelOutput({
    raw,
    executionId,
    configFingerprint,
    snapshotId: loaded.snapshotId,
    fieldsEvaluated,
    r1FieldResolutionStatus: loaded.r1.payload.fieldResolutionStatus,
    unitIds: loaded.evidence.units.map((u) => u.evidenceUnitId),
    campaignId,
    pipelineRunId,
    registryFingerprint,
    modelWarnings: loaded.warningCodes,
    r1PackDir: loaded.r1PackDir,
    p1ArtifactDigest: loaded.evidence.p1ArtifactDigest,
    geminiInvoked,
  });

  assertP3ReferentialIntegrity(
    envelope,
    loaded.evidence.units.map((u) => u.evidenceUnitId),
    fieldsEvaluated,
  );

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const outDir = `${args.outRoot}/P3F-8B2-S${args.snapshotId}-${stamp}-${executionId.slice(0, 8)}`;

  writeP3ArtifactPack({
    outDir,
    envelope,
    extraManifest: {
      r1PackDir: loaded.r1PackDir,
      model: args.model,
      promptVersion: P3_PROMPT_VERSION,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      eligibleUnitCount: loaded.evidence.units.length,
      geminiInvoked,
    },
  });

  return { envelope, outDir, loaded, geminiInvoked };
}
