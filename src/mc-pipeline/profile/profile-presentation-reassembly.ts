/**
 * Reensamblado determinista de presentation MC1 desde R1+P3+P4 existentes.
 * No llama Gemini. No ejecuta P1–P4. Valida lineage de snapshot/pack dirs.
 *
 * Si `profilePackDir` está presente, aplica el overlay WEAK sobre el pack
 * canónico (coverage OBSERVED intacta). Si no, reensambla con assembleProfilePilot.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
import { assembleProfilePilot } from './profile-assembler';
import {
  listObservedP3Specialties,
  listObservedP4Skills,
  loadProfileSourcePacks,
} from './profile-pack-loader';
import { mapProfilePackToPresentation } from '../person-profile/mc1-person-profile.reader';
import { mapSkillToDimensions } from './profile-skill-dimension-mapper';
import {
  applyWeakEvidenceRadarSemantics,
  collectWeakRadarSignals,
  PROFILE_RADAR_WEAK_SEMANTICS_VERSION,
  WEAK_EVIDENCE_FLOOR,
} from './profile-radar-weak-semantics';
import {
  applyRadarCalibrationToAxes,
  calibrateDimensionCoverage,
  RADAR_CALIBRATION_METADATA,
  RADAR_CALIBRATION_POLICY,
} from './profile-radar-calibration';
import type { P3ContractEnvelope } from '../p3/p3.types';
import type { P4ContractEnvelope } from '../p4/p4.types';
import type { Mc1PersonCompetenciesPresentationDto } from '../person-profile/mc1-person-profile.types';
import type { ProfilePilotEnvelope } from './profile.types';

export type PresentationReassemblyArgs = {
  backendRoot: string;
  snapshotId: string;
  r1PackDir: string;
  p3PackDir: string;
  p4PackDir: string;
  /**
   * Pack PROFILE canónico. Overlay WEAK sin recalcular rawScore/coverage.
   * Obligatorio para republicación segura (no inflar/deflactar OBSERVED).
   */
  profilePackDir?: string;
  /** Require P4.p3PackDir / P3.r1PackDir basename match. Default true. */
  strictLineage?: boolean;
};

export type PresentationReassemblyResult = {
  envelope: ProfilePilotEnvelope;
  presentation: Mc1PersonCompetenciesPresentationDto;
  fingerprint: string;
  producedAt: string;
  snapshotId: string;
  r1PackDir: string;
  p3PackDir: string;
  p4PackDir: string;
  p3CatalogVersion: string | null;
  p4CatalogVersion: string | null;
  publicSpecialtyCodes: string[];
  publicSkillCodes: string[];
  unmappedPublicSkills: Array<{
    skillCode: string;
    parentFieldCode: string;
    parentSpecialtyCode: string;
  }>;
};

function packName(dir: string): string {
  return basename(dir.replace(/\\/g, '/'));
}

export function presentationFingerprint(
  presentation: Mc1PersonCompetenciesPresentationDto,
): string {
  const canonical = {
    calibration: RADAR_CALIBRATION_METADATA,
    fields: presentation.fields.map((f) => ({
      code: f.code,
      role: f.role,
      specialties: f.specialties.map((s) => ({
        code: s.code,
        skills: s.skills.map((sk) => ({ code: sk.code, name: sk.name })),
      })),
      tools: [...f.tools].sort(),
      dimensions: f.competencyMap.dimensions.map((d) => ({
        code: d.code,
        relativeCoverage: d.relativeCoverage,
        displayCoverage: calibrateDimensionCoverage(d),
        evidenceState: d.evidenceState ?? null,
      })),
      evidenceVolume: f.evidenceVolume,
    })),
  };
  return `weak-radar-sha256:${createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex')
    .slice(0, 24)}`;
}

export function loadProfileEnvelope(
  profilePackDir: string,
): ProfilePilotEnvelope {
  const path = join(profilePackDir, 'profile-contract.json');
  if (!existsSync(path)) {
    throw new Error(`PROFILE_PACK_MISSING: ${path}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ProfilePilotEnvelope;
}

/**
 * Overlay WEAK sobre un envelope ya ensamblado. No recalcula rawScore.
 */
export function overlayWeakOnProfileEnvelope(args: {
  envelope: ProfilePilotEnvelope;
  p3: P3ContractEnvelope;
  p4: P4ContractEnvelope;
}): ProfilePilotEnvelope {
  const envelope: ProfilePilotEnvelope = JSON.parse(
    JSON.stringify(args.envelope),
  );
  const extraWarnings: ProfilePilotEnvelope['warnings'] = [];
  for (const field of envelope.payload.fields) {
    const weakSignals = collectWeakRadarSignals({
      fieldCode: field.fieldCode,
      p3: args.p3,
      p4: args.p4,
      observedRadarSkillCodes: new Set(field.skills.map((s) => s.skillCode)),
    });
    const overlay = applyWeakEvidenceRadarSemantics({
      axes: field.radar.axes,
      weakSignals,
      fieldCode: field.fieldCode,
    });
    field.radar.axes = applyRadarCalibrationToAxes(overlay.axes);
    extraWarnings.push(...overlay.warnings);
  }
  envelope.warnings = [...(envelope.warnings ?? []), ...extraWarnings];
  envelope.payload.presentationNotes = {
    ...envelope.payload.presentationNotes,
    radarWeakSemanticsVersion: PROFILE_RADAR_WEAK_SEMANTICS_VERSION,
    radarWeakEvidenceFloor: WEAK_EVIDENCE_FLOOR,
    radarCalibrationPolicy: RADAR_CALIBRATION_POLICY.policy,
    radarCalibrationVersion: RADAR_CALIBRATION_POLICY.version,
  };
  return envelope;
}

export function assertCompatibleLineage(
  args: PresentationReassemblyArgs,
): void {
  const packs = loadProfileSourcePacks(args);
  const p3Sid = String(packs.p3.payload.snapshotId);
  const p4Sid = String(packs.p4.payload.snapshotId);
  const r1Sid = String(packs.r1.payload.snapshotId);
  if (
    p3Sid !== args.snapshotId ||
    p4Sid !== args.snapshotId ||
    r1Sid !== args.snapshotId
  ) {
    throw new Error(
      `SNAPSHOT_MISMATCH: expected=${args.snapshotId} r1=${r1Sid} p3=${p3Sid} p4=${p4Sid}`,
    );
  }
  if (args.strictLineage !== false) {
    const p4P3 = packs.p4.payload.p3PackDir;
    const p3R1 = packs.p3.payload.r1PackDir;
    if (p4P3 && packName(p4P3) !== packName(args.p3PackDir)) {
      throw new Error(
        `LINEAGE_P4_P3_MISMATCH: p4.p3PackDir=${packName(p4P3)} requested=${packName(args.p3PackDir)}`,
      );
    }
    if (p3R1 && packName(p3R1) !== packName(args.r1PackDir)) {
      throw new Error(
        `LINEAGE_P3_R1_MISMATCH: p3.r1PackDir=${packName(p3R1)} requested=${packName(args.r1PackDir)}`,
      );
    }
    const p3Cat = packs.p3.payload.specialtyCatalogVersion;
    const p4Cat = packs.p4.payload.specialtyCatalogVersion;
    if (p3Cat && p4Cat && p3Cat !== p4Cat) {
      throw new Error(`CATALOG_VERSION_MISMATCH: p3=${p3Cat} p4=${p4Cat}`);
    }
  }
  if (!args.profilePackDir) return;
  const env = loadProfileEnvelope(args.profilePackDir);
  const profSid = String(env.payload.snapshotId);
  if (profSid !== args.snapshotId) {
    throw new Error(
      `PROFILE_SNAPSHOT_MISMATCH: expected=${args.snapshotId} profile=${profSid}`,
    );
  }
  if (args.strictLineage === false) return;
  const prov = env.payload.provenance;
  if (
    prov?.p3PackDir &&
    packName(prov.p3PackDir) !== packName(args.p3PackDir)
  ) {
    throw new Error(
      `LINEAGE_PROFILE_P3_MISMATCH: profile.p3=${packName(prov.p3PackDir)} requested=${packName(args.p3PackDir)}`,
    );
  }
  if (
    prov?.p4PackDir &&
    packName(prov.p4PackDir) !== packName(args.p4PackDir)
  ) {
    throw new Error(
      `LINEAGE_PROFILE_P4_MISMATCH: profile.p4=${packName(prov.p4PackDir)} requested=${packName(args.p4PackDir)}`,
    );
  }
  if (
    prov?.r1PackDir &&
    packName(prov.r1PackDir) !== packName(args.r1PackDir)
  ) {
    throw new Error(
      `LINEAGE_PROFILE_R1_MISMATCH: profile.r1=${packName(prov.r1PackDir)} requested=${packName(args.r1PackDir)}`,
    );
  }
}

export function reassembleMc1Presentation(
  args: PresentationReassemblyArgs,
): PresentationReassemblyResult {
  assertCompatibleLineage(args);
  const packs = loadProfileSourcePacks(args);
  const envelope = args.profilePackDir
    ? overlayWeakOnProfileEnvelope({
        envelope: loadProfileEnvelope(args.profilePackDir),
        p3: packs.p3,
        p4: packs.p4,
      })
    : assembleProfilePilot({
        backendRoot: args.backendRoot,
        snapshotId: args.snapshotId,
        r1PackDir: args.r1PackDir,
        p3PackDir: args.p3PackDir,
        p4PackDir: args.p4PackDir,
      });
  const presentation = mapProfilePackToPresentation({
    packDir: args.p4PackDir,
    envelope,
    producedAtMs: Date.parse(envelope.producedAt) || 0,
  });
  const observedP3 = listObservedP3Specialties(packs.p3);
  const publicSkills = listObservedP4Skills(packs.p4, observedP3);
  const unmappedPublicSkills = publicSkills
    .map((sk) => ({
      skillCode: sk.skillCode,
      parentFieldCode: sk.parentFieldCode,
      parentSpecialtyCode: sk.parentSpecialtyCode,
      dims: mapSkillToDimensions({
        skillCode: sk.skillCode,
        name: sk.name,
        parentFieldCode: sk.parentFieldCode,
        parentSpecialtyCode: sk.parentSpecialtyCode,
        supportingSignals: sk.supportingSignals ?? [],
        toolOrTechnologySignals: sk.toolOrTechnologySignals ?? [],
        supportingEvidenceUnitIds: sk.supportingEvidenceUnitIds ?? [],
      }).dimensionCodes,
    }))
    .filter((s) => s.dims.length === 0)
    .map(({ skillCode, parentFieldCode, parentSpecialtyCode }) => ({
      skillCode,
      parentFieldCode,
      parentSpecialtyCode,
    }));

  return {
    envelope,
    presentation,
    fingerprint: presentationFingerprint(presentation),
    producedAt: packs.p4.producedAt,
    snapshotId: args.snapshotId,
    r1PackDir: args.r1PackDir,
    p3PackDir: args.p3PackDir,
    p4PackDir: args.p4PackDir,
    p3CatalogVersion: packs.p3.payload.specialtyCatalogVersion ?? null,
    p4CatalogVersion: packs.p4.payload.specialtyCatalogVersion ?? null,
    publicSpecialtyCodes: observedP3.map(
      (s) => `${s.fieldCode}::${s.specialtyCode}`,
    ),
    publicSkillCodes: publicSkills.map(
      (s) => `${s.parentFieldCode}::${s.parentSpecialtyCode}::${s.skillCode}`,
    ),
    unmappedPublicSkills,
  };
}
