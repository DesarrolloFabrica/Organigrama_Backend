/**
 * Rollback operativo de la última importación manual de una persona.
 */

import type { DataSource } from 'typeorm';
import { CURATED_EXTRACTION_MAPPING } from './curated-profile.constants';
import {
  activateSucceededExtraction,
  deactivateExtraction,
  deactivateProfileEvaluationsForExtraction,
  findActiveExtractionId,
  readExtractionMeta,
} from './curated-profile.activation';
import { createCuratedCatalogLookup } from './curated-profile.catalog-lookup';
import { maskDocument } from './curated-profile.normalize';

export interface CuratedRollbackResult {
  outcome: 'DRY_RUN' | 'EXECUTED' | 'NO_OP' | 'BLOCKED' | 'FAILED';
  documentMasked: string;
  targetExtractionId: string | null;
  previousExtractionId: string | null;
  reactivatedExtractionId: string | null;
  messages: string[];
}

export async function rollbackCuratedProfile(params: {
  dataSource: DataSource;
  document: string;
  extractionId?: string;
  execute?: boolean;
}): Promise<CuratedRollbackResult> {
  const masked = maskDocument(params.document);
  const lookup = createCuratedCatalogLookup(params.dataSource);
  const persons = await lookup.findPersonsByDocument(params.document.trim());
  if (persons.length !== 1) {
    return {
      outcome: 'BLOCKED',
      documentMasked: masked,
      targetExtractionId: null,
      previousExtractionId: null,
      reactivatedExtractionId: null,
      messages: [`Persona no resuelta unívocamente (${persons.length}).`],
    };
  }
  const personId = persons[0].personId;
  const activeId = await findActiveExtractionId(params.dataSource, personId);
  const targetId = params.extractionId ?? activeId;
  if (!targetId) {
    return {
      outcome: 'BLOCKED',
      documentMasked: masked,
      targetExtractionId: null,
      previousExtractionId: null,
      reactivatedExtractionId: null,
      messages: ['No hay extracción objetivo.'],
    };
  }

  const meta = await readExtractionMeta(params.dataSource, targetId);
  if (!meta) {
    return {
      outcome: 'BLOCKED',
      documentMasked: masked,
      targetExtractionId: targetId,
      previousExtractionId: null,
      reactivatedExtractionId: null,
      messages: ['Extracción no encontrada.'],
    };
  }
  if (meta.model !== CURATED_EXTRACTION_MAPPING.model) {
    return {
      outcome: 'BLOCKED',
      documentMasked: masked,
      targetExtractionId: targetId,
      previousExtractionId: null,
      reactivatedExtractionId: null,
      messages: [
        `Extracción ${targetId} no es manual-curated (model=${meta.model}).`,
      ],
    };
  }

  const curated = (meta.rawResult?.curatedImport ?? null) as {
    previousExtractionId?: string | null;
  } | null;
  const previousId = curated?.previousExtractionId ?? null;

  if (!meta.isActive && previousId) {
    // Already rolled back?
    const prev = await readExtractionMeta(params.dataSource, previousId);
    if (prev?.isActive) {
      return {
        outcome: 'NO_OP',
        documentMasked: masked,
        targetExtractionId: targetId,
        previousExtractionId: previousId,
        reactivatedExtractionId: previousId,
        messages: ['Rollback ya aplicado (previa activa).'],
      };
    }
  }

  const messages = [
    `Objetivo manual ${targetId} (active=${meta.isActive}).`,
    previousId
      ? `Se reactivaría extracción previa ${previousId}.`
      : 'Sin previousExtractionId en meta; solo se desactivará la manual.',
  ];

  if (!params.execute) {
    return {
      outcome: 'DRY_RUN',
      documentMasked: masked,
      targetExtractionId: targetId,
      previousExtractionId: previousId,
      reactivatedExtractionId: null,
      messages,
    };
  }

  try {
    await deactivateProfileEvaluationsForExtraction(
      params.dataSource,
      targetId,
    );
    await deactivateExtraction(params.dataSource, targetId);
    let reactivated: string | null = null;
    if (previousId) {
      await activateSucceededExtraction({
        dataSource: params.dataSource,
        personId,
        extractionId: previousId,
      });
      reactivated = previousId;
    }
    return {
      outcome: 'EXECUTED',
      documentMasked: masked,
      targetExtractionId: targetId,
      previousExtractionId: previousId,
      reactivatedExtractionId: reactivated,
      messages: [...messages, 'Rollback ejecutado.'],
    };
  } catch (error) {
    return {
      outcome: 'FAILED',
      documentMasked: masked,
      targetExtractionId: targetId,
      previousExtractionId: previousId,
      reactivatedExtractionId: null,
      messages: [
        ...messages,
        error instanceof Error ? error.message : String(error),
      ],
    };
  }
}
