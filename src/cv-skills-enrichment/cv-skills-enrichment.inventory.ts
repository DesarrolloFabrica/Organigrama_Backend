/**
 * Carga inventario desde artefacto c1 (dry-run) o desde BD (solo lectura).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import type {
  EnrichmentInputSkill,
  EnrichmentInventorySource,
  EnrichmentRunInput,
} from './cv-skills-enrichment.types';

export class EnrichmentInventoryLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnrichmentInventoryLoadError';
  }
}

function padIndex(n: number): string {
  return String(n).padStart(4, '0');
}

/**
 * Extrae skills del artefacto c1 (normalizedJson o result o rawJson).
 */
export function loadSkillsFromC1Artifact(
  artifactPath: string,
): {
  document: string;
  pdfSha256: string;
  personId?: number;
  skills: EnrichmentInputSkill[];
  source: EnrichmentInventorySource;
} {
  const abs = resolve(artifactPath);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new EnrichmentInventoryLoadError(
      `No se pudo leer inventario ARTIFACT "${artifactPath}": ${msg}`,
    );
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new EnrichmentInventoryLoadError('Artefacto de inventario inválido.');
  }

  const root = parsed as Record<string, unknown>;
  const document =
    typeof root.document === 'string' ? root.document.trim() : '';
  if (!document) {
    throw new EnrichmentInventoryLoadError(
      'El artefacto no incluye document (cédula).',
    );
  }

  const pdfSha256 =
    typeof root.pdfSha256 === 'string' ? root.pdfSha256.trim() : '';
  if (!pdfSha256) {
    throw new EnrichmentInventoryLoadError(
      'El artefacto no incluye pdfSha256.',
    );
  }

  let personId: number | undefined;
  if (root.person && typeof root.person === 'object') {
    const id = (root.person as Record<string, unknown>).id;
    if (typeof id === 'number') personId = id;
  } else if (typeof root.personId === 'number') {
    personId = root.personId;
  }

  const payload =
    (root.normalizedJson as Record<string, unknown> | undefined) ||
    (root.result as Record<string, unknown> | undefined) ||
    (root.rawJson as Record<string, unknown> | undefined);

  if (!payload || !Array.isArray(payload.categories)) {
    throw new EnrichmentInventoryLoadError(
      'El artefacto no contiene categories en normalizedJson/result/rawJson.',
    );
  }

  const skills: EnrichmentInputSkill[] = [];
  let idx = 0;
  for (const cat of payload.categories) {
    if (!cat || typeof cat !== 'object') continue;
    const catSkills = (cat as Record<string, unknown>).skills;
    if (!Array.isArray(catSkills)) continue;
    for (const s of catSkills) {
      if (!s || typeof s !== 'object') continue;
      const rec = s as Record<string, unknown>;
      const normalizedName =
        typeof rec.normalizedName === 'string'
          ? rec.normalizedName.trim()
          : typeof rec.originalName === 'string'
            ? rec.originalName.trim()
            : '';
      if (!normalizedName) continue;
      idx += 1;
      const originalName =
        typeof rec.originalName === 'string'
          ? rec.originalName.trim()
          : undefined;
      const skillType =
        typeof rec.skillType === 'string' ? rec.skillType.trim() : undefined;
      skills.push({
        extractionSkillId: `artifact-c1-${padIndex(idx)}`,
        normalizedName,
        originalName,
        skillType,
        sortOrder: idx - 1,
        syntheticExtractionSkillId: true,
      });
    }
  }

  if (skills.length === 0) {
    throw new EnrichmentInventoryLoadError(
      'El artefacto no contiene skills en categories.',
    );
  }

  return {
    document,
    pdfSha256,
    personId,
    skills,
    source: { type: 'ARTIFACT', reference: artifactPath },
  };
}

export function buildRunInputFromArtifact(
  artifactPath: string,
  documentOverride?: string,
): EnrichmentRunInput {
  const loaded = loadSkillsFromC1Artifact(artifactPath);
  if (documentOverride && documentOverride !== loaded.document) {
    throw new EnrichmentInventoryLoadError(
      `Documento CLI (${documentOverride}) no coincide con artefacto (${loaded.document}).`,
    );
  }
  return {
    personId: loaded.personId,
    document: loaded.document,
    pdfSha256: loaded.pdfSha256,
    inventorySource: loaded.source,
    skills: loaded.skills,
  };
}

type DbExtractionRow = {
  id: string;
  person_id: string;
  person_cv_id: string;
  document: string;
  pdf_sha256: string;
  status: string;
  is_active: boolean;
};

type DbSkillRow = {
  extraction_skill_id: string;
  skill_id: string;
  original_name: string;
  normalized_name: string;
  skill_type: string;
  sort_order: number;
};

/**
 * Carga inventario desde cv_extraction + cv_extraction_skill (solo lectura).
 * Usa IDs reales; no modifica BD.
 */
export async function buildRunInputFromDatabase(
  dataSource: DataSource,
  extractionId: string,
  documentOverride?: string,
): Promise<EnrichmentRunInput> {
  const id = extractionId.trim();
  if (!/^\d+$/.test(id)) {
    throw new EnrichmentInventoryLoadError(
      `extractionId inválido "${extractionId}".`,
    );
  }

  const extractions = (await dataSource.query(
    `SELECT id::text AS id,
            person_id::text AS person_id,
            person_cv_id::text AS person_cv_id,
            document,
            pdf_sha256,
            status,
            is_active
       FROM organigrama.cv_extraction
      WHERE id = $1
      LIMIT 1`,
    [id],
  )) as DbExtractionRow[];

  if (extractions.length === 0) {
    throw new EnrichmentInventoryLoadError(`No existe cv_extraction id=${id}.`);
  }
  const ext = extractions[0];
  if (ext.status !== 'SUCCEEDED') {
    throw new EnrichmentInventoryLoadError(
      `Extracción ${id} no está SUCCEEDED (status=${ext.status}).`,
    );
  }
  if (documentOverride && documentOverride !== ext.document) {
    throw new EnrichmentInventoryLoadError(
      `Documento CLI (${documentOverride}) no coincide con extracción (${ext.document}).`,
    );
  }

  const rows = (await dataSource.query(
    `SELECT es.id::text AS extraction_skill_id,
            es.skill_id::text AS skill_id,
            es.original_name,
            s.normalized_name,
            s.skill_type,
            es.sort_order
       FROM organigrama.cv_extraction_skill es
       JOIN organigrama.cv_skill s ON s.id = es.skill_id
      WHERE es.extraction_id = $1
      ORDER BY es.sort_order ASC, es.id ASC`,
    [id],
  )) as DbSkillRow[];

  if (rows.length === 0) {
    throw new EnrichmentInventoryLoadError(
      `Extracción ${id} no tiene skills en cv_extraction_skill.`,
    );
  }

  const skills: EnrichmentInputSkill[] = rows.map((r) => ({
    extractionSkillId: r.extraction_skill_id,
    skillId: r.skill_id,
    originalName: r.original_name,
    normalizedName: r.normalized_name,
    skillType: r.skill_type,
    sortOrder: Number(r.sort_order) || 0,
    syntheticExtractionSkillId: false,
  }));

  return {
    extractionId: id,
    personId: Number(ext.person_id),
    personCvId: ext.person_cv_id,
    document: ext.document,
    pdfSha256: ext.pdf_sha256,
    inventorySource: { type: 'DATABASE', reference: id },
    skills,
  };
}
