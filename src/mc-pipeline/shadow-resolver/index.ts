/**
 * Módulo runtime SHADOW. Importar SOLO el hook desde runners.
 * No hay controlador HTTP. No hay skip Gemini.
 */
export { isShadowResolverEnabled, isDeterministicSkipGeminiEnabled, isP2DeterministicAuthorityEnabled, isP2DeterministicSkipGeminiEnabled, isP2DeterministicResolverEnabled } from './flags';
export { observeMc1ShadowFromP2, observeMc1ShadowFromP3, observeMc1DeterministicAuthorityFromP2 } from './hook';
export { observeP2Shadow, observeP3Shadow } from './runtime';
export { PersistentShadowStore } from './persist';
export { runShadowRuntimeHarness } from './harness';
export { runShadowRuntimeGate } from './run-gate';
export {
  evaluateP2SkipEligibility,
  evaluateP3SkipEligibility,
  SKIP_CANDIDATE_CODE,
  SKIP_CANDIDATE_2_CODE,
} from './skip-eligibility';
export { runLargerOfflineValidation } from './run-larger-validation';
export { runCandidate2 } from './run-candidate-2';
