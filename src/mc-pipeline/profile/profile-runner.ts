import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import { loadP2EvidenceFromP1Pack } from '../p2/p2-evidence-loader';
import {
  assembleProfilePilot,
  buildExplicitnessIndexFromUnits,
} from './profile-assembler';
import { writeProfilePilotPack } from './profile-artifact-writer';
import type { ProfilePilotEnvelope } from './profile.types';

export type ProfilePilotRunResult = {
  envelope: ProfilePilotEnvelope;
  outDir: string;
};

/**
 * Runner PROFILE PILOT 8E — ARTIFACT_ONLY.
 * Ensambla R1+P3+P4+dimensiones. Sin Gemini. Sin persistencia.
 */
export async function runProfilePilot(args: {
  backendRoot: string;
  snapshotId: string;
  outRoot: string;
  dataSource?: DataSource;
  r1PackDir?: string;
  p3PackDir?: string;
  p4PackDir?: string;
}): Promise<ProfilePilotRunResult> {
  let explicitnessIndex: Map<string, string> | undefined;
  if (args.dataSource) {
    try {
      const evidence = await loadP2EvidenceFromP1Pack({
        backendRoot: args.backendRoot,
        snapshotId: args.snapshotId,
        dataSource: args.dataSource,
      });
      explicitnessIndex = buildExplicitnessIndexFromUnits(evidence.units);
    } catch {
      // Explicitness opcional; radar sigue siendo válido sin boost.
      explicitnessIndex = undefined;
    }
  }

  const envelope = assembleProfilePilot({
    backendRoot: args.backendRoot,
    snapshotId: args.snapshotId,
    r1PackDir: args.r1PackDir,
    p3PackDir: args.p3PackDir,
    p4PackDir: args.p4PackDir,
    explicitnessIndex,
  });

  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  const outDir = resolve(
    args.outRoot,
    `PROF-8E-S${args.snapshotId}-${stamp}`,
  );
  writeProfilePilotPack({ outDir, envelope });
  return { envelope, outDir };
}
