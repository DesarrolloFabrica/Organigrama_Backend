import { dimensionsForField } from './profile-dimensions';
import {
  buildExplicitnessIndexFromUnits,
  listObservedP3Specialties,
  listObservedP4Skills,
  loadProfileSourcePacks,
  type EvidenceExplicitnessIndex,
  type ProfileSourcePacks,
} from './profile-pack-loader';
import {
  classifyEvidenceVolume,
  explicitnessBoostFor,
  normalizeRadarAxes,
  PROFILE_RADAR_FORMULA_VERSION,
  rawScoreForContributions,
  type Explicitness,
  type RadarSkillContribution,
} from './profile-radar';
import { mapSkillToDimensions } from './profile-skill-dimension-mapper';
import {
  PROFILE_CONTRACT_CODE,
  PROFILE_CONTRACT_VERSION,
  type ProfileFieldBlock,
  type ProfilePilotEnvelope,
} from './profile.types';
import { SPECIALTY_CATALOG_SCOPE } from '../catalog/specialties-visual-education';

function asExplicitness(raw: string | undefined): Explicitness {
  if (raw === 'EXPLICIT') return 'EXPLICIT';
  if (raw === 'STRONGLY_SUPPORTED') return 'STRONGLY_SUPPORTED';
  if (!raw) return 'UNKNOWN';
  return 'OTHER';
}

function fieldsFromR1(packs: ProfileSourcePacks): Array<{
  fieldCode: string;
  role: 'PRIMARY' | 'SECONDARY';
  confidence: number;
}> {
  const p = packs.r1.payload;
  const out: Array<{
    fieldCode: string;
    role: 'PRIMARY' | 'SECONDARY';
    confidence: number;
  }> = [];
  if (p.primaryField?.fieldCode) {
    out.push({
      fieldCode: p.primaryField.fieldCode,
      role: 'PRIMARY',
      confidence: p.primaryField.confidence,
    });
  }
  if (p.fieldResolutionStatus === 'MULTI_FIELD') {
    for (const s of p.secondaryFields ?? []) {
      if (!s.fieldCode) continue;
      if (out.some((x) => x.fieldCode === s.fieldCode)) continue;
      out.push({
        fieldCode: s.fieldCode,
        role: 'SECONDARY',
        confidence: s.confidence,
      });
    }
  }
  return out;
}

export function assembleProfilePilot(args: {
  backendRoot: string;
  snapshotId: string;
  r1PackDir?: string;
  p3PackDir?: string;
  p4PackDir?: string;
  /** Opcional: explicitness por evidenceUnitId */
  explicitnessIndex?: EvidenceExplicitnessIndex;
}): ProfilePilotEnvelope {
  const packs = loadProfileSourcePacks(args);
  const warnings: Array<{ code: string; severity: string; messageSafe: string }> =
    [
      {
        code: 'PROFILE_PILOT_EXPERIMENTAL',
        severity: 'INFO',
        messageSafe: 'Experimental presentation assembly; not production',
      },
    ];

  const r1Fields = fieldsFromR1(packs);
  const p3Specs = listObservedP3Specialties(packs.p3);
  const p4Skills = listObservedP4Skills(packs.p4);
  const expIndex = args.explicitnessIndex ?? new Map<string, string>();

  const fieldBlocks: ProfileFieldBlock[] = [];

  for (const rf of r1Fields) {
    const specialties = p3Specs
      .filter((s) => s.fieldCode === rf.fieldCode)
      .map((s) => ({
        specialtyCode: s.specialtyCode,
        confidence: s.confidence,
      }));

    const skills = p4Skills.filter((s) => s.parentFieldCode === rf.fieldCode);
    const tools = [
      ...new Set(skills.flatMap((s) => s.toolOrTechnologySignals)),
    ].sort();

    const mappings = skills.map((s) =>
      mapSkillToDimensions({
        skillCode: s.skillCode,
        name: s.name,
        parentFieldCode: s.parentFieldCode,
        parentSpecialtyCode: s.parentSpecialtyCode,
        supportingSignals: s.supportingSignals,
        toolOrTechnologySignals: s.toolOrTechnologySignals,
        supportingEvidenceUnitIds: s.supportingEvidenceUnitIds,
      }),
    );

    for (const m of mappings) {
      for (const d of m.dimensionCodes) {
        const allowed = dimensionsForField(rf.fieldCode).some(
          (x) => x.code === d,
        );
        if (!allowed) {
          warnings.push({
            code: 'CROSS_FIELD_OR_UNKNOWN_DIMENSION_STRIPPED',
            severity: 'WARNING',
            messageSafe: `${m.skillCode}->${d}`,
          });
        }
      }
      m.dimensionCodes = m.dimensionCodes.filter((d) =>
        dimensionsForField(rf.fieldCode).some((x) => x.code === d),
      );
    }

    const dimDefs = dimensionsForField(rf.fieldCode);
    const axesRaw = dimDefs.map((dim) => {
      const contribSkills = mappings.filter((m) =>
        m.dimensionCodes.includes(dim.code),
      );
      const contribs: RadarSkillContribution[] = contribSkills.map((m) => {
        const sk = skills.find((x) => x.skillCode === m.skillCode)!;
        const levels = m.supportingEvidenceUnitIds.map((id) =>
          asExplicitness(expIndex.get(id)),
        );
        return {
          skillCode: m.skillCode,
          confidence: sk.confidence,
          evidenceUnitIds: m.supportingEvidenceUnitIds,
          signalCount: sk.supportingSignals.length,
          explicitnessBoost: explicitnessBoostFor(levels),
        };
      });
      const euIds = [
        ...new Set(contribs.flatMap((c) => c.evidenceUnitIds)),
      ].sort();
      return {
        dimensionCode: dim.code,
        label: dim.label,
        rawScore: rawScoreForContributions(contribs),
        contributingSkillCodes: contribs.map((c) => c.skillCode),
        supportingEvidenceUnitIds: euIds,
      };
    });

    const axes = normalizeRadarAxes(axesRaw);
    const allEu = [
      ...new Set(skills.flatMap((s) => s.supportingEvidenceUnitIds)),
    ];
    const evidenceVolume = classifyEvidenceVolume(allEu.length);

    const specialtyCodes = new Set(specialties.map((s) => s.specialtyCode));
    const derivedPresentationLabel =
      rf.fieldCode === 'SOFTWARE_ENGINEERING' &&
      specialtyCodes.has('FRONTEND_ENGINEERING') &&
      specialtyCodes.has('BACKEND_ENGINEERING')
        ? 'Perfil Full Stack'
        : null;

    fieldBlocks.push({
      fieldCode: rf.fieldCode,
      role: rf.role,
      r1Confidence: rf.confidence,
      specialties,
      skills: skills.map((s) => ({
        skillCode: s.skillCode,
        name: s.name,
        parentSpecialtyCode: s.parentSpecialtyCode,
        confidence: s.confidence,
        supportingEvidenceUnitIds: s.supportingEvidenceUnitIds,
      })),
      toolsTechnologies: tools,
      skillDimensionMappings: mappings,
      radar: { fieldCode: rf.fieldCode, axes },
      evidenceVolume,
      evidenceUnitCount: allEu.length,
      derivedPresentationLabel,
    });

    if (specialties.length === 0) {
      if (!SPECIALTY_CATALOG_SCOPE.has(rf.fieldCode)) {
        warnings.push({
          code: `SPECIALTY_CATALOG_NOT_AVAILABLE:${rf.fieldCode}`,
          severity: 'INFO',
          messageSafe: `No specialty catalog for ${rf.fieldCode}; Field retained without specialties/skills`,
        });
      }
    }
  }

  if (packs.r1.payload.fieldResolutionStatus === 'MULTI_FIELD') {
    warnings.push({
      code: 'MULTI_FIELD_SEPARATE_RADARS',
      severity: 'INFO',
      messageSafe: 'One radar per professional field',
    });
  }

  return {
    contractCode: PROFILE_CONTRACT_CODE,
    contractVersion: PROFILE_CONTRACT_VERSION,
    stageCode: 'PROFILE_PILOT',
    producedAt: new Date().toISOString(),
    warnings,
    payload: {
      snapshotId: packs.snapshotId,
      r1FieldResolutionStatus: packs.r1.payload.fieldResolutionStatus,
      fields: fieldBlocks,
      presentationNotes: {
        weakHiddenFromPrimary: true,
        toolsSeparatedFromSkills: true,
        radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
        formulaVersion: PROFILE_RADAR_FORMULA_VERSION,
      },
      provenance: {
        r1PackDir: packs.r1PackDir,
        p3PackDir: packs.p3PackDir,
        p4PackDir: packs.p4PackDir,
        mode: 'ARTIFACT_ONLY',
        dimensionsDoc: 'docs/mc1-competency-map-dimensions.md',
      },
    },
  };
}

export { buildExplicitnessIndexFromUnits };
