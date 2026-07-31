/**
 * Enrichment sintético desde extracción curada (sin Gemini).
 *
 * Mapping:
 * JSON evidence.text + sourceSection
 *   → cv_extraction_skill.evidence_items
 *   → enrichment_item.evidence_items / source_types
 *   → evidence engine input
 *   → PA2
 */

import type { DataSource } from 'typeorm';
import {
  computeBlockConfigHash,
  computeInventoryHash,
} from '../../cv-skills-enrichment/cv-skills-enrichment.hash';
import type { EnrichmentBlockConfig } from '../../cv-skills-enrichment/cv-skills-enrichment.types';
import type { EnrichmentItemPersistInput } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.types';
import { CvSkillsEnrichmentPersistenceService } from '../../cv-skills-enrichment/cv-skills-enrichment-persistence.service';
import { CURATED_EXTRACTION_MAPPING } from './curated-profile.constants';

export const CURATED_ENRICHMENT_BLOCK_CONFIG: EnrichmentBlockConfig = {
  blockSize: 50,
  parallelism: 1,
  maxBlockAttempts: 1,
  microRetrySize: 1,
  maxMicroRetryAttempts: 0,
};

export interface ExtractionSkillRow {
  id: string;
  skillId: string;
  normalizedName: string;
  skillType: string;
  sortOrder: number;
  evidenceItems: Array<Record<string, unknown>>;
}

export async function loadExtractionSkillsForEnrichment(
  dataSource: DataSource,
  extractionId: string,
): Promise<ExtractionSkillRow[]> {
  const rows = (await dataSource.query(
    `SELECT es.id::text AS id,
            es.skill_id::text AS "skillId",
            s.normalized_name AS "normalizedName",
            s.skill_type AS "skillType",
            es.sort_order AS "sortOrder",
            COALESCE(es.evidence_items, '[]'::jsonb) AS "evidenceItems"
     FROM organigrama.cv_extraction_skill es
     JOIN organigrama.cv_skill s ON s.id = es.skill_id
     WHERE es.extraction_id = $1::bigint
     ORDER BY es.sort_order ASC, s.normalized_name ASC, es.id ASC`,
    [extractionId],
  )) as ExtractionSkillRow[];
  return rows;
}

export async function persistSyntheticEnrichment(params: {
  enrichmentPersistence: CvSkillsEnrichmentPersistenceService;
  dataSource: DataSource;
  extractionId: string;
  personId: string;
  personCvId: string;
  pdfSha256: string;
  contentFingerprint: string;
}): Promise<{ enrichmentId: string; itemCount: number }> {
  const skills = await loadExtractionSkillsForEnrichment(
    params.dataSource,
    params.extractionId,
  );
  if (skills.length === 0) {
    throw new Error('Extracción sin skills; no se puede enriquecer.');
  }

  const inventorySkills = skills.map((s) => ({
    extractionSkillId: s.id,
    skillId: s.skillId,
    normalizedName: s.normalizedName,
    skillType: s.skillType,
    sortOrder: Number(s.sortOrder),
  }));
  const { inventoryHash } = computeInventoryHash(inventorySkills);
  const blockConfigHash = computeBlockConfigHash(CURATED_ENRICHMENT_BLOCK_CONFIG);

  const existing =
    await params.enrichmentPersistence.findIdempotentSucceededRun({
      extractionId: params.extractionId,
      pdfSha256: params.pdfSha256,
      inventoryHash,
      model: CURATED_EXTRACTION_MAPPING.enricherModel,
      promptVersion: CURATED_EXTRACTION_MAPPING.enricherPromptVersion,
      enricherVersion: CURATED_EXTRACTION_MAPPING.enricherVersion,
      blockConfigHash,
    });

  let enrichmentId: string;
  if (existing) {
    enrichmentId = existing.id;
    if (!existing.is_active) {
      await params.enrichmentPersistence.activateSucceededRun(existing.id);
    }
  } else {
    const pending = await params.enrichmentPersistence.createPendingRun({
      extractionId: params.extractionId,
      personId: params.personId,
      personCvId: params.personCvId,
      pdfSha256: params.pdfSha256,
      inventoryHash,
      model: CURATED_EXTRACTION_MAPPING.enricherModel,
      promptVersion: CURATED_EXTRACTION_MAPPING.enricherPromptVersion,
      enricherVersion: CURATED_EXTRACTION_MAPPING.enricherVersion,
      blockConfigHash,
      blockConfigVersion: 'manual-enrich-1.0.0',
      blockConfig: CURATED_ENRICHMENT_BLOCK_CONFIG,
      inputSkillsCount: skills.length,
      blocksTotal: 1,
    });
    await params.enrichmentPersistence.markRunning(pending.id);

    const items: EnrichmentItemPersistInput[] = skills.map((s) => {
      const evidenceItems = Array.isArray(s.evidenceItems)
        ? s.evidenceItems
        : [];
      const sourceTypes = [
        ...new Set(
          evidenceItems
            .map((e) =>
              typeof e.sourceType === 'string' ? e.sourceType : 'OTHER',
            )
            .filter(Boolean),
        ),
      ];
      return {
        extractionSkillId: s.id,
        normalizedName: s.normalizedName,
        evidenceItems,
        sourceTypes,
        warnings: null,
        status: evidenceItems.length > 0 ? 'OK' : 'EMPTY',
        wasFilledEmpty: false,
      };
    });

    await params.enrichmentPersistence.completeSucceeded({
      enrichmentId: pending.id,
      items,
      metrics: {
        source: 'MANUAL_CURATED',
        contentFingerprint: params.contentFingerprint,
      },
      warnings: [
        CURATED_EXTRACTION_MAPPING.warningSourceTag,
        'enrichment=SYNTHETIC_FROM_CURATED_JSON',
      ],
      validatedResultJson: {
        source: 'MANUAL_CURATED',
        skills: items.map((i) => ({
          extractionSkillId: i.extractionSkillId,
          normalizedName: i.normalizedName,
          evidenceCount: i.evidenceItems.length,
        })),
      },
      blocksSucceeded: 1,
      blocksFailed: 0,
      attemptsTotal: 0,
      expectedSkills: skills.map((s) => ({
        extractionSkillId: s.id,
        normalizedName: s.normalizedName,
      })),
    });

    await params.enrichmentPersistence.activateSucceededRun(pending.id);
    enrichmentId = pending.id;
  }

  return { enrichmentId, itemCount: skills.length };
}
