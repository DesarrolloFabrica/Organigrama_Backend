/**
 * ObservatoryRunDiff — comparación entre dos runs (R9 cuando aplica).
 */
import type {
  ObservatoryAggregateMetrics,
  ObservatoryRunManifest,
  RunDiffResult,
} from './observatory.types';

export class ObservatoryRunDiff {
  compare(params: {
    a: {
      manifest: ObservatoryRunManifest;
      aggregates: ObservatoryAggregateMetrics;
      signatureIds: string[];
    };
    b: {
      manifest: ObservatoryRunManifest;
      aggregates: ObservatoryAggregateMetrics;
      signatureIds: string[];
    };
  }): RunDiffResult {
    const { a, b } = params;
    if (a.manifest.cohortReproHash !== b.manifest.cohortReproHash) {
      return {
        comparable: false,
        reason: 'COHORT_CHANGED',
        configDelta: [],
        volumeDelta: {},
        shapeDelta: {},
        signatureJaccard: null,
        causeHypothesis: null,
      };
    }

    const configDelta: string[] = [];
    if (a.manifest.configFingerprint !== b.manifest.configFingerprint) {
      for (const [k, v] of Object.entries(a.manifest.frozenConfig)) {
        if (b.manifest.frozenConfig[k] !== v) configDelta.push(k);
      }
      if (configDelta.length === 0) configDelta.push('configFingerprint');
    }

    const volumeDelta = {
      totalEvidenceUnits:
        b.aggregates.totalEvidenceUnits - a.aggregates.totalEvidenceUnits,
      totalCandidates: b.aggregates.totalCandidates - a.aggregates.totalCandidates,
      totalBatches: b.aggregates.totalBatches - a.aggregates.totalBatches,
      reviewRequired:
        b.aggregates.reviewRequiredTotal - a.aggregates.reviewRequiredTotal,
    };

    const shapeDelta = {
      explicit: b.aggregates.explicitTotal - a.aggregates.explicitTotal,
      stronglySupported:
        b.aggregates.stronglySupportedTotal - a.aggregates.stronglySupportedTotal,
      inferred: b.aggregates.inferredTotal - a.aggregates.inferredTotal,
    };

    const setA = new Set(a.signatureIds);
    const setB = new Set(b.signatureIds);
    let inter = 0;
    for (const id of setA) if (setB.has(id)) inter += 1;
    const union = new Set([...setA, ...setB]).size;
    const jaccard = union > 0 ? inter / union : 1;

    let causeHypothesis: string | null = null;
    if (configDelta.includes('promptVersion')) {
      causeHypothesis = 'prompt_change';
    } else if (configDelta.includes('segmenterVersion')) {
      causeHypothesis = 'segmenter_change';
    } else if (configDelta.includes('modelVersion')) {
      causeHypothesis = 'model_change';
    } else if (configDelta.includes('contractVersion')) {
      causeHypothesis = 'contract_change';
    } else if (configDelta.length === 0) {
      causeHypothesis = 'same_config_stability_check';
    } else {
      causeHypothesis = `config_delta:${configDelta.join(',')}`;
    }

    return {
      comparable: true,
      reason: 'SAME_COHORT',
      configDelta,
      volumeDelta,
      shapeDelta,
      signatureJaccard: Number(jaccard.toFixed(4)),
      causeHypothesis,
    };
  }
}
