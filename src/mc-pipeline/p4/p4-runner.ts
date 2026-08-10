import { callP1GeminiJson } from '../p1/p1-gemini-client';
import { SPECIALTY_CATALOG_VERSION } from '../catalog/specialties-visual-education';
import type { DataSource } from 'typeorm';
import {
  fingerprintP4Config,
  loadP4Context,
  newP4ExecutionId,
  type P4LoadedContext,
} from './p4-context-loader';
import { writeP4ArtifactPack } from './p4-artifact-writer';
import {
  assertP4ReferentialIntegrity,
  normalizeP4ModelOutput,
} from './p4-normalize';
import { buildP4SystemPrompt, buildP4UserPayload } from './p4-prompt-v1';
import {
  P4_CONTRACT_VERSION,
  P4_GENERATION_POLICY_VERSION,
  P4_PROMPT_VERSION,
  P4_REASONING_POLICY_VERSION,
  type P4ContractEnvelope,
  type P4ModelRawOutput,
} from './p4.types';

export type P4RunResult = {
  envelope: P4ContractEnvelope;
  outDir: string;
  loaded: P4LoadedContext;
  geminiInvoked: boolean;
};

function parseModelJson(text: string): P4ModelRawOutput {
  const trimmed = text.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end < start) {
    throw new Error('model_output_not_json_object');
  }
  return JSON.parse(trimmed.slice(start, end + 1)) as P4ModelRawOutput;
}

/**
 * Runner P4 v1 — ARTIFACT_ONLY.
 * R1 + P3 OBSERVED specialties + Evidence Units → Skills.
 * No modifica R1/P3. Sin niveles, radar ni persistencia.
 */
export async function runP4ArtifactOnly(args: {
  backendRoot: string;
  snapshotId: string;
  dataSource: DataSource;
  apiKey: string;
  model: string;
  outRoot: string;
  r1PackDir?: string;
  p3PackDir?: string;
  campaignId?: string;
  pipelineRunId?: string;
}): Promise<P4RunResult> {
  const loaded = await loadP4Context({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    dataSource: args.dataSource,
    r1PackDir: args.r1PackDir,
    p3PackDir: args.p3PackDir,
  });

  const executionId = newP4ExecutionId();
  const campaignId = args.campaignId ?? 'MC1-P4-8D-FUNCTIONAL';
  const pipelineRunId =
    args.pipelineRunId ?? `p4-8d-${args.snapshotId}-${Date.now()}`;

  const specialtiesEvaluated = loaded.specialtiesEvaluated;

  const configFingerprint = fingerprintP4Config({
    contractVersion: P4_CONTRACT_VERSION,
    promptVersion: P4_PROMPT_VERSION,
    reasoningPolicy: P4_REASONING_POLICY_VERSION,
    generationPolicy: P4_GENERATION_POLICY_VERSION,
    specialtyCatalog: SPECIALTY_CATALOG_VERSION,
    model: args.model,
    mode: 'ARTIFACT_ONLY',
    specialties: specialtiesEvaluated
      .map((s) => `${s.fieldCode}:${s.specialtyCode}`)
      .join(','),
  });

  const registryFingerprint = fingerprintP4Config({
    registry: 'mc1-local-lab',
    promptVersion: P4_PROMPT_VERSION,
  });

  let raw: P4ModelRawOutput;
  let geminiInvoked = false;

  if (specialtiesEvaluated.length === 0) {
    raw = {
      specialtyResults: [],
      outcomeStatus: 'ABSTAINED_NO_OBSERVED_SPECIALTY',
      warnings: ['no_observed_specialties'],
    };
  } else if (loaded.evidence.units.length === 0) {
    raw = {
      specialtyResults: specialtiesEvaluated.map((s) => ({
        fieldCode: s.fieldCode,
        specialtyCode: s.specialtyCode,
        observedSkills: [],
      })),
      outcomeStatus: 'NO_SKILL_EVIDENCE',
      warnings: ['no_eligible_units'],
    };
  } else {
    const systemPrompt = buildP4SystemPrompt(specialtiesEvaluated);
    const userPayload = buildP4UserPayload({
      snapshotId: loaded.snapshotId,
      r1FieldResolutionStatus: loaded.r1.payload.fieldResolutionStatus,
      specialtiesEvaluated,
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

  const { envelope } = normalizeP4ModelOutput({
    raw,
    executionId,
    configFingerprint,
    snapshotId: loaded.snapshotId,
    specialtiesEvaluated,
    r1FieldResolutionStatus: loaded.r1.payload.fieldResolutionStatus,
    unitIds: loaded.evidence.units.map((u) => u.evidenceUnitId),
    campaignId,
    pipelineRunId,
    registryFingerprint,
    modelWarnings: loaded.warningCodes,
    r1PackDir: loaded.r1PackDir,
    p3PackDir: loaded.p3PackDir,
    p1ArtifactDigest: loaded.evidence.p1ArtifactDigest,
    geminiInvoked,
  });

  assertP4ReferentialIntegrity(
    envelope,
    loaded.evidence.units.map((u) => u.evidenceUnitId),
    specialtiesEvaluated,
  );

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const outDir = `${args.outRoot}/P4F-8D-S${args.snapshotId}-${stamp}-${executionId.slice(0, 8)}`;

  writeP4ArtifactPack({
    outDir,
    envelope,
    extraManifest: {
      r1PackDir: loaded.r1PackDir,
      p3PackDir: loaded.p3PackDir,
      model: args.model,
      promptVersion: P4_PROMPT_VERSION,
      specialtyCatalogVersion: SPECIALTY_CATALOG_VERSION,
      eligibleUnitCount: loaded.evidence.units.length,
      geminiInvoked,
    },
  });

  return { envelope, outDir, loaded, geminiInvoked };
}
