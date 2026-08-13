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
  classifyFieldPublication,
  selectPublishableFields,
} from './profile-publication-gate';
import { resolveR1FieldCatalogCode } from '../r1/r1-field-catalog-resolver';
import {
  PROFILE_CONTRACT_CODE,
  PROFILE_CONTRACT_VERSION,
  type ProfileFieldBlock,
  type ProfilePilotEnvelope,
  type ProfileResolvedFieldProvenance,
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
  if (p.primaryField) {
    const code = resolveR1FieldCatalogCode(p.primaryField);
    if (code) {
      out.push({
        fieldCode: code,
        role: 'PRIMARY',
        confidence: p.primaryField.confidence,
      });
    }
  }
  if (
    p.fieldResolutionStatus === 'MULTI_FIELD' ||
    p.fieldResolutionStatus === 'RESOLVED'
  ) {
    for (const s of p.secondaryFields ?? []) {
      const code = resolveR1FieldCatalogCode(s);
      if (!code) continue;
      if (out.some((x) => x.fieldCode === code)) continue;
      out.push({
        fieldCode: code,
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
  // 12I: filter at Profile Assembly via listObservedP4Skills(+ P3 OBSERVED keys).
  // Skills under WEAK routing parents are excluded from public skills + radar.
  // Mapper 12E semantic rules are unchanged.
  const p4Skills = listObservedP4Skills(packs.p4, p3Specs);
  const expIndex = args.explicitnessIndex ?? new Map<string, string>();

  const resolvedBlocks: ProfileFieldBlock[] = [];

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

    const blockBase: ProfileFieldBlock = {
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
    };

    const pub = classifyFieldPublication(blockBase);
    resolvedBlocks.push({
      ...blockBase,
      publicationStatus: pub.status,
      taxonomyPending: pub.taxonomyPending,
      publicationReasonCode: pub.reasonCode,
    });

    if (specialties.length === 0) {
      if (!SPECIALTY_CATALOG_SCOPE.has(rf.fieldCode)) {
        warnings.push({
          code: `SPECIALTY_CATALOG_NOT_AVAILABLE:${rf.fieldCode}`,
          severity: 'INFO',
          messageSafe:
            rf.role === 'PRIMARY'
              ? `No specialty catalog for primary ${rf.fieldCode}; Field retained (taxonomy pending)`
              : `No specialty catalog for secondary ${rf.fieldCode}; provenance only (not a PersonDetail tab)`,
        });
      }
    }

    if (pub.status === 'PROVENANCE_ONLY') {
      warnings.push({
        code: `FIELD_NOT_PUBLISHABLE:${rf.fieldCode}`,
        severity: 'INFO',
        messageSafe: `${rf.fieldCode} resolved by R1 but not publishable (${pub.reasonCode})`,
      });
    }
  }

  if (packs.r1.payload.fieldResolutionStatus === 'MULTI_FIELD') {
    warnings.push({
      code: 'MULTI_FIELD_SEPARATE_RADARS',
      severity: 'INFO',
      messageSafe: 'One radar per professional field',
    });
  }

  const publishable = selectPublishableFields(resolvedBlocks);
  const resolvedFieldsProvenance: ProfileResolvedFieldProvenance[] =
    resolvedBlocks.map((b) => ({
      fieldCode: b.fieldCode,
      role: b.role,
      r1Confidence: b.r1Confidence,
      publicationStatus: b.publicationStatus ?? 'PUBLISHABLE',
      reasonCode: b.publicationReasonCode ?? 'LEGACY_UNCLASSIFIED',
      taxonomyPending: !!b.taxonomyPending,
      observedSpecialtyCount: b.specialties.length,
      observedSkillCount: b.skills.length,
    }));

  return {
    contractCode: PROFILE_CONTRACT_CODE,
    contractVersion: PROFILE_CONTRACT_VERSION,
    stageCode: 'PROFILE_PILOT',
    producedAt: new Date().toISOString(),
    warnings,
    payload: {
      snapshotId: packs.snapshotId,
      r1FieldResolutionStatus: packs.r1.payload.fieldResolutionStatus,
      fields: publishable,
      resolvedFieldsProvenance,
      presentationNotes: {
        weakHiddenFromPrimary: true,
        toolsSeparatedFromSkills: true,
        radarSemantics: 'RELATIVE_COVERAGE_WITHIN_FIELD_NOT_ABSOLUTE_MASTERY',
        formulaVersion: PROFILE_RADAR_FORMULA_VERSION,
        fieldPublicationGate: 'MC1.PROFILE.PUBLICATION_GATE.1.0.0',
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
