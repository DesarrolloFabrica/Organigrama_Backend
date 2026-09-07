import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProfilePilotEnvelope } from './profile.types';
import {
  calibrateDimensionCoverage,
  RADAR_CALIBRATION_METADATA,
} from './profile-radar-calibration';

export function writeProfilePilotPack(args: {
  outDir: string;
  envelope: ProfilePilotEnvelope;
}): void {
  mkdirSync(args.outDir, { recursive: true });
  const p = args.envelope.payload;

  writeFileSync(
    join(args.outDir, 'profile-contract.json'),
    JSON.stringify(args.envelope, null, 2),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'manifest.json'),
    JSON.stringify(
      {
        classification: 'CONFIDENTIAL_LAB',
        mode: 'ARTIFACT_ONLY',
        contractCode: args.envelope.contractCode,
        contractVersion: args.envelope.contractVersion,
        snapshotId: p.snapshotId,
        r1FieldResolutionStatus: p.r1FieldResolutionStatus,
        fieldCount: p.fields.length,
        formulaVersion: p.presentationNotes.formulaVersion,
        calibration: RADAR_CALIBRATION_METADATA,
        producedAt: args.envelope.producedAt,
        provenance: p.provenance,
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
        r1FieldResolutionStatus: p.r1FieldResolutionStatus,
        fields: p.fields.map((f) => ({
          fieldCode: f.fieldCode,
          role: f.role,
          specialties: f.specialties.map((s) => s.specialtyCode),
          skills: f.skills.map((s) => s.name),
          tools: f.toolsTechnologies,
          evidenceVolume: f.evidenceVolume,
          evidenceUnitCount: f.evidenceUnitCount,
          radarTop: [...f.radar.axes]
            .sort((a, b) => b.relativeCoverage - a.relativeCoverage)
            .slice(0, 4)
            .map((a) => ({
              dimension: a.label,
              relativeCoverage: a.relativeCoverage,
              displayCoverage:
                a.displayCoverage ?? calibrateDimensionCoverage(a),
              rawScore: a.rawScore,
            })),
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'radars.json'),
    JSON.stringify(
      {
        fields: p.fields.map((f) => ({
          fieldCode: f.fieldCode,
          evidenceVolume: f.evidenceVolume,
          evidenceUnitCount: f.evidenceUnitCount,
          axes: f.radar.axes,
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'skill-dimension-mappings.json'),
    JSON.stringify(
      {
        mappings: p.fields.flatMap((f) =>
          f.skillDimensionMappings.map((m) => ({
            fieldCode: f.fieldCode,
            ...m,
          })),
        ),
      },
      null,
      2,
    ),
    'utf8',
  );

  writeFileSync(
    join(args.outDir, 'warnings.json'),
    JSON.stringify({ warnings: args.envelope.warnings }, null, 2),
    'utf8',
  );
}
