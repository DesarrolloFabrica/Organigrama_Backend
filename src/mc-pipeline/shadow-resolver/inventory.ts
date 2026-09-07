/**
 * Inventario offline de packs históricos. No genera artefactos. No llama Gemini.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { COHORT } from '../experimental/deterministic-resolver/cohort';
import {
  PROFESSIONAL_FIELD_CATALOG_VERSION,
} from '../catalog/professional-fields';
import {
  resolveToKnownSpecialtyCode,
  SPECIALTY_CATALOG_VERSION,
} from '../catalog/specialties-visual-education';

export type InclusionClass =
  | 'P2_ELIGIBLE'
  | 'P3_ELIGIBLE'
  | 'EXCLUDED_VERSION_MISMATCH'
  | 'EXCLUDED_MISSING_ARTIFACT';

export type InventoryRow = {
  snapshotId: string;
  person: string;
  domain: string;
  p1Available: boolean;
  p2Available: boolean;
  p3Available: boolean;
  p4Available: boolean;
  profileAvailable: boolean;
  p1PackRel: string | null;
  p2PackRel: string | null;
  p3PackRel: string | null;
  p4PackRel: string | null;
  profilePackRel: string | null;
  p1RunId: string | null;
  specialtyCatalogVersion: string | null;
  fieldCatalogVersion: string;
  resolverCompatible: boolean;
  catalogNormalized: boolean;
  unknownSpecialtyCodes: string[];
  p2Class: InclusionClass;
  p3Class: InclusionClass;
  included: boolean;
  reason: string;
};

function listDirs(abs: string): string[] {
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .map((n) => join(abs, n))
    .filter((p) => statSync(p).isDirectory());
}

function snapshotFromName(name: string): string | null {
  const m = name.match(/-S(\d+)-/) || name.match(/^S(\d+)$/) || name.match(/S(\d+)/);
  return m ? m[1] : null;
}

function latestDir(dirs: string[]): string | null {
  if (!dirs.length) return null;
  return [...dirs].sort()[dirs.length - 1];
}

function readJson(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function personLabel(snapshotId: string): string {
  const hit = COHORT.find((c) => c.snapshotId === snapshotId);
  return hit?.person ?? `S${snapshotId}`;
}

function rel(backendRoot: string, abs: string | null): string | null {
  if (!abs) return null;
  return abs.replace(/\\/g, '/').replace(backendRoot.replace(/\\/g, '/') + '/', '');
}

export function discoverHistoricalInventory(backendRoot: string): InventoryRow[] {
  const root = resolve(backendRoot);
  const p1Root = join(root, 'tmp', 'mc1-p1-prototype');
  const p2Root = join(root, 'tmp', 'mc1-p2-functional');
  const p3Root = join(root, 'tmp', 'mc1-p3-functional');
  const p4Root = join(root, 'tmp', 'mc1-p4-functional');
  const profileRoots = [
    join(root, 'tmp', 'mc1-profile-pilot'),
    join(root, 'tmp', 'mc1-profile-validation-8f'),
  ];

  const p2By = new Map<string, string[]>();
  for (const d of listDirs(p2Root)) {
    const s = snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? '');
    if (!s) continue;
    const arr = p2By.get(s) ?? [];
    arr.push(d);
    p2By.set(s, arr);
  }
  const p3By = new Map<string, string[]>();
  for (const d of listDirs(p3Root)) {
    const s = snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? '');
    if (!s) continue;
    const arr = p3By.get(s) ?? [];
    arr.push(d);
    p3By.set(s, arr);
  }
  const p4By = new Map<string, string[]>();
  for (const d of listDirs(p4Root)) {
    const s = snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? '');
    if (!s) continue;
    const arr = p4By.get(s) ?? [];
    arr.push(d);
    p4By.set(s, arr);
  }
  const profileBy = new Map<string, string[]>();
  for (const pr of profileRoots) {
    for (const d of listDirs(pr)) {
      const s = snapshotFromName(d.replace(/\\/g, '/').split('/').pop() ?? '');
      if (!s) continue;
      const arr = profileBy.get(s) ?? [];
      arr.push(d);
      profileBy.set(s, arr);
    }
  }

  const snapshots = [...new Set([...p2By.keys(), ...p3By.keys()])].sort(
    (a, b) => Number(a) - Number(b),
  );

  return snapshots.map((snapshotId) => {
    const p2Dir = latestDir(p2By.get(snapshotId) ?? []);
    const p3Dir = latestDir((p3By.get(snapshotId) ?? []).filter((d) => existsSync(join(d, 'summary.json'))));
    const p4Dir = latestDir(p4By.get(snapshotId) ?? []);
    const profileDir = latestDir(profileBy.get(snapshotId) ?? []);
    const p2Contract = p2Dir ? readJson(join(p2Dir, 'p2-contract.json')) : null;
    const p2Summary = p2Dir ? readJson(join(p2Dir, 'summary.json')) : null;
    const payload = (p2Contract?.payload ?? {}) as Record<string, unknown>;
    const p1RunId = typeof payload.p1RunId === 'string' ? payload.p1RunId : null;
    const p1Name = p1RunId ? String(p1RunId).replace(/^pack:/, '') : null;
    const p1Dir = p1Name && existsSync(join(p1Root, p1Name, 'validated-evidence.json'))
      ? join(p1Root, p1Name)
      : null;
    const ranks = (p2Summary?.ranks ?? []) as Array<{
      domainCode?: string;
      rank?: number;
      status?: string;
    }>;
    const domain =
      ranks.find((r) => r.rank === 1)?.domainCode ??
      ranks.find((r) => r.status === 'ACTIVE')?.domainCode ??
      'UNKNOWN';

    const p3Contract = p3Dir ? readJson(join(p3Dir, 'p3-contract.json')) : null;
    const p3Payload = (p3Contract?.payload ?? {}) as Record<string, unknown>;
    const specialtyCatalogVersion =
      typeof p3Payload.specialtyCatalogVersion === 'string'
        ? p3Payload.specialtyCatalogVersion
        : null;
    const unknownSpecialtyCodes: string[] = [];
    const fieldResults = (p3Payload.fieldResults ?? []) as Array<{
      observedSpecialties?: Array<{ specialtyCode?: string }>;
    }>;
    for (const fr of fieldResults) {
      for (const o of fr.observedSpecialties ?? []) {
        const code = o.specialtyCode ?? '';
        if (code && !resolveToKnownSpecialtyCode(code)) unknownSpecialtyCodes.push(code);
      }
    }
    const p3Summary = p3Dir ? readJson(join(p3Dir, 'summary.json')) : null;
    if (!fieldResults.length && p3Summary) {
      for (const o of (p3Summary.observed ?? []) as Array<{ specialtyCode?: string }>) {
        const code = o.specialtyCode ?? '';
        if (code && !resolveToKnownSpecialtyCode(code)) unknownSpecialtyCodes.push(code);
      }
    }

    const p1Available = Boolean(p1Dir);
    const p2Available = Boolean(p2Dir && p2Summary);
    const p3Available = Boolean(p3Dir && p3Summary);
    const catalogNormalized =
      Boolean(specialtyCatalogVersion) && specialtyCatalogVersion !== SPECIALTY_CATALOG_VERSION;
    const p3CodesOk = unknownSpecialtyCodes.length === 0;

    let p2Class: InclusionClass = 'EXCLUDED_MISSING_ARTIFACT';
    let p3Class: InclusionClass = 'EXCLUDED_MISSING_ARTIFACT';
    let reason = '';
    if (!p1Available || !p2Available) {
      p2Class = 'EXCLUDED_MISSING_ARTIFACT';
      reason = 'missing P1 evidence and/or P2 canonical';
    } else {
      p2Class = 'P2_ELIGIBLE';
      reason = 'P1+P2 linked by p1RunId';
    }
    if (!p1Available || !p3Available) {
      p3Class = 'EXCLUDED_MISSING_ARTIFACT';
      if (!reason.startsWith('P1')) reason = [reason, 'missing P3 canonical'].filter(Boolean).join('; ');
    } else if (!p3CodesOk) {
      p3Class = 'EXCLUDED_VERSION_MISMATCH';
      reason = [reason, `unknown specialty codes: ${unknownSpecialtyCodes.join(',')}`]
        .filter(Boolean)
        .join('; ');
    } else {
      p3Class = 'P3_ELIGIBLE';
      if (catalogNormalized) {
        reason = [
          reason,
          `P3 catalog ${specialtyCatalogVersion} normalized to ${SPECIALTY_CATALOG_VERSION} via resolveToKnownSpecialtyCode`,
        ]
          .filter(Boolean)
          .join('; ');
      }
    }

    return {
      snapshotId,
      person: personLabel(snapshotId),
      domain,
      p1Available,
      p2Available,
      p3Available,
      p4Available: Boolean(p4Dir),
      profileAvailable: Boolean(profileDir),
      p1PackRel: rel(root, p1Dir),
      p2PackRel: rel(root, p2Dir),
      p3PackRel: rel(root, p3Dir),
      p4PackRel: rel(root, p4Dir),
      profilePackRel: rel(root, profileDir),
      p1RunId,
      specialtyCatalogVersion,
      fieldCatalogVersion: PROFESSIONAL_FIELD_CATALOG_VERSION,
      resolverCompatible: p2Class === 'P2_ELIGIBLE',
      catalogNormalized,
      unknownSpecialtyCodes,
      p2Class,
      p3Class,
      included: p2Class === 'P2_ELIGIBLE',
      reason: reason || 'eligible',
    };
  });
}
