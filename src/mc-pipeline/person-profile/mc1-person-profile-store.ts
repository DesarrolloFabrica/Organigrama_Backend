/**
 * Validación + lectura del store Cloud de presentación MC1.
 * No ejecuta pipeline. No modifica Publication Gate.
 */
import type { DataSource } from 'typeorm';
import type { Mc1PersonCompetenciesPresentationDto } from './mc1-person-profile.types';
import {
  calibrateDimensionCoverage,
  RADAR_CALIBRATION_METADATA,
} from '../profile/profile-radar-calibration';

export const MC1_PRESENTATION_STORE_SOURCE = 'CLOUD_PRESENTATION_STORE' as const;

const EVIDENCE_VOLUME = new Set(['LOW', 'MEDIUM', 'HIGH']);
const ROLES = new Set(['PRIMARY', 'SECONDARY']);

export type Mc1PresentationValidationOk = {
  ok: true;
  presentation: Mc1PersonCompetenciesPresentationDto;
};

export type Mc1PresentationValidationErr = {
  ok: false;
  reason: string;
};

export type Mc1PresentationValidationResult =
  | Mc1PresentationValidationOk
  | Mc1PresentationValidationErr;

/**
 * Valida un payload de presentación MC1 ya gateado (mc1Profile).
 */
export function validateMc1PresentationPayload(
  raw: unknown,
): Mc1PresentationValidationResult {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, reason: 'PAYLOAD_NOT_OBJECT' };
  }
  const p = raw as Record<string, unknown>;
  if (p.status !== 'AVAILABLE') {
    return { ok: false, reason: 'STATUS_NOT_AVAILABLE' };
  }
  if (!Array.isArray(p.fields) || p.fields.length === 0) {
    return { ok: false, reason: 'EMPTY_OR_MISSING_FIELDS' };
  }

  const fields: Mc1PersonCompetenciesPresentationDto['fields'] = [];
  for (const [i, fRaw] of p.fields.entries()) {
    if (fRaw == null || typeof fRaw !== 'object' || Array.isArray(fRaw)) {
      return { ok: false, reason: `FIELD_${i}_NOT_OBJECT` };
    }
    const f = fRaw as Record<string, unknown>;
    const code = typeof f.code === 'string' ? f.code.trim() : '';
    if (!code) return { ok: false, reason: `FIELD_${i}_CODE_MISSING` };
    const role = String(f.role ?? '');
    if (!ROLES.has(role)) {
      return { ok: false, reason: `FIELD_${i}_ROLE_INVALID` };
    }
    if (!Array.isArray(f.specialties)) {
      return { ok: false, reason: `FIELD_${i}_SPECIALTIES_MISSING` };
    }
    if (!Array.isArray(f.tools)) {
      return { ok: false, reason: `FIELD_${i}_TOOLS_MISSING` };
    }
    const ev = String(f.evidenceVolume ?? '');
    if (!EVIDENCE_VOLUME.has(ev)) {
      return { ok: false, reason: `FIELD_${i}_EVIDENCE_VOLUME_INVALID` };
    }
    const map = f.competencyMap;
    if (map == null || typeof map !== 'object' || Array.isArray(map)) {
      return { ok: false, reason: `FIELD_${i}_COMPETENCY_MAP_MISSING` };
    }
    const dimensions = (map as { dimensions?: unknown }).dimensions;
    if (!Array.isArray(dimensions)) {
      return { ok: false, reason: `FIELD_${i}_DIMENSIONS_MISSING` };
    }

    const specialties: Mc1PersonCompetenciesPresentationDto['fields'][0]['specialties'] =
      [];
    for (const [j, sRaw] of f.specialties.entries()) {
      if (sRaw == null || typeof sRaw !== 'object' || Array.isArray(sRaw)) {
        return { ok: false, reason: `FIELD_${i}_SPEC_${j}_NOT_OBJECT` };
      }
      const s = sRaw as Record<string, unknown>;
      const sc = typeof s.code === 'string' ? s.code.trim() : '';
      if (!sc) return { ok: false, reason: `FIELD_${i}_SPEC_${j}_CODE_MISSING` };
      if (!Array.isArray(s.skills)) {
        return { ok: false, reason: `FIELD_${i}_SPEC_${j}_SKILLS_MISSING` };
      }
      const skills: Array<{ code: string; name: string }> = [];
      for (const [k, skRaw] of s.skills.entries()) {
        if (skRaw == null || typeof skRaw !== 'object' || Array.isArray(skRaw)) {
          return { ok: false, reason: `FIELD_${i}_SPEC_${j}_SKILL_${k}_NOT_OBJECT` };
        }
        const sk = skRaw as Record<string, unknown>;
        const skc = typeof sk.code === 'string' ? sk.code.trim() : '';
        const skn = typeof sk.name === 'string' ? sk.name.trim() : '';
        if (!skc || !skn) {
          return { ok: false, reason: `FIELD_${i}_SPEC_${j}_SKILL_${k}_INCOMPLETE` };
        }
        skills.push({ code: skc, name: skn });
      }
      specialties.push({
        code: sc,
        label:
          typeof s.label === 'string' && s.label.trim()
            ? s.label.trim()
            : sc,
        confidence:
          typeof s.confidence === 'number' && Number.isFinite(s.confidence)
            ? s.confidence
            : undefined,
        skills,
      });
    }

    const dims: Array<{
      code: string;
      label: string;
      relativeCoverage: number;
      displayCoverage: number;
      evidenceState?: 'NO_EVIDENCE' | 'WEAK_EVIDENCE' | 'OBSERVED';
    }> = [];
    const EVIDENCE_STATES = new Set([
      'NO_EVIDENCE',
      'WEAK_EVIDENCE',
      'OBSERVED',
    ]);
    for (const [d, dRaw] of dimensions.entries()) {
      if (dRaw == null || typeof dRaw !== 'object' || Array.isArray(dRaw)) {
        return { ok: false, reason: `FIELD_${i}_DIM_${d}_NOT_OBJECT` };
      }
      const dim = dRaw as Record<string, unknown>;
      const dc = typeof dim.code === 'string' ? dim.code.trim() : '';
      const dl = typeof dim.label === 'string' ? dim.label.trim() : '';
      const cov = Number(dim.relativeCoverage);
      if (!dc || !dl || !Number.isFinite(cov)) {
        return { ok: false, reason: `FIELD_${i}_DIM_${d}_INCOMPLETE` };
      }
      const stateRaw =
        typeof dim.evidenceState === 'string' ? dim.evidenceState : undefined;
      if (stateRaw && !EVIDENCE_STATES.has(stateRaw)) {
        return { ok: false, reason: `FIELD_${i}_DIM_${d}_EVIDENCE_STATE_INVALID` };
      }
      const evidenceState = stateRaw as
        | 'NO_EVIDENCE'
        | 'WEAK_EVIDENCE'
        | 'OBSERVED'
        | undefined;
      dims.push({
        code: dc,
        label: dl,
        relativeCoverage: cov,
        displayCoverage: calibrateDimensionCoverage({
          relativeCoverage: cov,
          evidenceState,
        }),
        ...(evidenceState ? { evidenceState } : {}),
      });
    }

    fields.push({
      code,
      label:
        typeof f.label === 'string' && f.label.trim() ? f.label.trim() : code,
      role: role as 'PRIMARY' | 'SECONDARY',
      confidence:
        typeof f.confidence === 'number' && Number.isFinite(f.confidence)
          ? f.confidence
          : undefined,
      derivedPresentationLabel:
        f.derivedPresentationLabel === null ||
        typeof f.derivedPresentationLabel === 'string'
          ? (f.derivedPresentationLabel as string | null)
          : null,
      specialties,
      tools: (f.tools as unknown[])
        .map((t) => String(t).trim())
        .filter(Boolean),
      competencyMap: { dimensions: dims },
      evidenceVolume: ev as 'LOW' | 'MEDIUM' | 'HIGH',
    });
  }

  return {
    ok: true,
    presentation: {
      status: 'AVAILABLE',
      source: MC1_PRESENTATION_STORE_SOURCE,
      calibration: RADAR_CALIBRATION_METADATA,
      fields,
    },
  };
}

export type Mc1StoredPresentationRow = {
  personId: string;
  payloadJson: unknown;
  configFingerprint: string;
  producedAt: string;
};

/**
 * Lee la presentación activa desde Cloud/DB. Si la tabla no existe → null.
 */
export async function readActiveMc1PresentationFromStore(args: {
  dataSource: DataSource;
  personId: string;
}): Promise<Mc1StoredPresentationRow | null> {
  try {
    const rows = await args.dataSource.query(
      `
      SELECT person_id::text AS person_id,
             payload_json,
             config_fingerprint,
             produced_at
        FROM organigrama.mc1_person_profile_presentation
       WHERE person_id = $1
         AND is_active = TRUE
       LIMIT 1
      `,
      [args.personId],
    );
    const row = rows?.[0];
    if (!row || row.payload_json == null) return null;
    return {
      personId: String(row.person_id ?? args.personId),
      payloadJson: row.payload_json,
      configFingerprint: String(row.config_fingerprint ?? ''),
      producedAt:
        row.produced_at instanceof Date
          ? row.produced_at.toISOString()
          : String(row.produced_at ?? ''),
    };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    if (
      /mc1_person_profile_presentation/i.test(msg) &&
      /does not exist|no existe/i.test(msg)
    ) {
      return null;
    }
    throw e;
  }
}
